# Fieldwork CRM

A standalone, single-owner CRM for professional relationships, prospects, sequences, and parallel research. The web UI, REST API, and MCP adapter use the same application operations and SQLite database. It runs independently of Monica; move this folder into its own repository when ready.

## Run locally

Requires Node.js 24 or newer. Native `node:sqlite` is used; Node 24 currently emits an experimental-feature warning. Dependencies are pinned in `package-lock.json`.

```sh
cd /Users/alanhegewisch/dev/monica/apps/fieldwork
npm ci
npm start
```

Open [http://localhost:4178](http://localhost:4178). Default local mode binds only to loopback and treats the owner of this computer as the user. Other local processes with access to this computer can act as the owner. Agents authenticate independently with scoped tokens. Local mode refuses a non-loopback bind.

On first use, the app imports a compatible prototype workspace from this browser's `fieldwork.crm.v1` storage if the server workspace is empty. The old browser copy is retained. Future reads/writes use the database; a new browser sees the same records. Fresh installs have an empty workspace and a starting pipeline/sequence template. If a prototype import fails validation, it leaves the database unchanged and displays the reason.

## Implemented

- People, independent company records, company contacts, personal details, notes, and profile links.
- Pipeline movement, editable stage names, archived/restored people, and dated next actions.
- Editable sequences, snapshot enrollments, transactional completion, pause/resume, and reply handling.
- Parallel research investigations, company/person subjects, sourced observations/hypotheses/questions, and promotion into the pipeline using the same person identity.
- Persistent research jobs that external agents can queue, claim, update, and finish. Claiming is exclusive. Findings can reference the job.
- Bearer credentials with read/write scopes, revocation, server-derived authorship, and audit history.
- Typed command API, resource routes, generated OpenAPI, expected versions, workspace revision guards, and idempotent request IDs.
- Official MCP SDK adapter over stdio, verified with a real MCP client.
- Database backups and JSON workspace exports/imports.

Sequence steps are manual actions; completion schedules the next task but does not send outreach. Research jobs are executed by an external agent; the app does not run a web research worker. The Telegram/Hermes gateway is configured separately. Pipeline items currently represent people; multi-contact sales opportunities and message delivery integrations can be added once the selling process is defined.

## Data and backups

Default database: `.data/fieldwork.sqlite`, with WAL files beside it. The data directory is private and ignored by Git. Configure `FIELDWORK_DATA_DIR` to use a different persistent path.

```sh
npm run backup
```

This uses SQLite's online backup API and writes a consistent database snapshot to `backups/`. To restore a database backup, stop the server, retain a copy of the current database and WAL/SHM files, then replace the database with the chosen snapshot and restart. Restore only backups from this app version; add explicit migrations before changing its schema.

The UI exports JSON through **Export workspace**. An owner can import a compatible JSON export into an empty workspace from **Agent access → Import workspace**, or `POST /api/v1/workspace/import`. Imports are transactional and refuse to overwrite existing people, companies, research, or a previous import. Currently research jobs are execution state and are not restored from JSON; use a database backup to preserve sessions, credentials, jobs, audit history, and idempotency records as well.

## Connect an agent

Start with [the agent guide](AGENT_GUIDE.md). Agents can call `describe_workspace`
to discover permitted operations, research conventions, and limitations. Research
investigations support summaries and tags. API and UI searches include findings,
subjects, summaries, and tags using literal case-insensitive text matching.
Feedback can be saved as Question findings in a separate Fieldwork feedback
investigation, so gaps remain retrievable alongside concrete examples.

In **Agent access**, create a credential for Hermes or another agent. It is shown once; save it in the agent's private environment, then close the dialog. A read-only token can inspect records; a read/write token can use the CRM operations. Token names and IDs identify the actor in findings and audit history. Tokens cannot administer credentials or import a workspace.

Alternatively, `npm run agent-token -- Hermes` writes an agent credential to a private `.data/agent-<id>.env` file and prints only its path. Do not commit or share credential files.

Run the adapter using these environment variables:

```sh
FIELDWORK_API_URL=http://localhost:4178
FIELDWORK_API_TOKEN=your-private-agent-token
npm run mcp
```

Configure an MCP client to launch `node /absolute/path/apps/fieldwork/server/mcp.js` directly; stdout is reserved for MCP messages. See [hermes.example.yaml](hermes.example.yaml). Local stdio starts the adapter alongside Hermes; HTTP requests go to the running CRM. Remote API URLs require HTTPS. Tokens stay in the adapter environment rather than in tool arguments.

Hermes supports [Telegram voice memo transcription](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram#voice-messages) and [MCP configuration](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp). Enable the Fieldwork tools for the messaging session and configure the Telegram gateway for your own allowed identity. Then a voice note can become search → create/update → finding → pipeline transition → next action. Use stable request IDs based on the Telegram update and operation number for retried writes. Resolve ambiguous names to IDs before changing a record. Relative dates should use the workspace timezone, `America/Mexico_City` by default.

For background research, list queued jobs, claim one, post findings with its `jobId`, and mark it completed or failed. The agent may run several jobs concurrently; each claim is exclusive. A stopped agent's running job can be cancelled by the owner through the API, and a new job can be queued. Automatic lease expiry/requeue is not implemented.

## API

Base: `/api/v1`. Authenticate with `Authorization: Bearer <token>`.

- `GET /workspace`: shared UI snapshot, including timezone and revision.
- `GET /schema`: permitted operations and JSON input schemas.
- `GET /openapi.json`: generated OpenAPI 3.1 contract for command endpoints.
- `POST /commands/{operation}`: canonical operations exposed by MCP as well.
- `GET /people`, `/companies`, `/research`, `/tasks`, `/sequences`, `/jobs`, `/stages`: cursor pagination (`cursor`, `limit`), query, status, updated-since filtering.
- `GET /{collection}/{id}`: individual record.
- `POST /people`, `/companies`, `/research`, `/tasks`, `/sequences`: create.
- `PATCH /people/{id}`, `/companies/{id}`, `/research/{id}`, `/tasks/{id}`, `/sequences/{id}`: update (sequence templates require name and steps).
- `POST /people/{id}/notes` and `/companies/{id}/notes`: notes; corresponding `/links`: profile links.
- `POST /people/{id}/transitions`: move to `stageId`.
- `POST /tasks/{id}/completions`: complete once, schedule next sequence step.
- `POST /research/{id}/subjects`, `/findings`, `/jobs`: research additions.

Command operations also cover enrollment events, promotion, stage edits, and job claims/progress. Schemas reject unknown fields. Mutations accept `Idempotency-Key` or a `requestId` argument. A reused key with different input returns `409 idempotency_conflict`. `expectedVersion` protects individual edits; the UI uses `If-Match: <workspace revision>` on writes. A stale update returns `409 version_conflict` and leaves the database unchanged. Responses include `{ data, revision }`; errors include a stable code, message, and request ID.

## Self-hosting

The existing droplet can serve `fieldwork.promptu.net` without Vercel. See
[the server deployment guide](deploy/README.md) for the release script, DNS,
Nginx/HTTPS setup, and hosted credentials. Local credentials and sample data stay
local; the hosted installation starts with a separate empty database.

Use password mode with a public HTTPS origin, secure cookies, a persistent data directory, and a reverse proxy that preserves the configured Host header. On the first password-mode start, supply a unique `FIELDWORK_PASSWORD` of at least 12 characters through a private environment file or secret manager. The server stores a salted scrypt hash. Remove the plaintext password from the environment after the first successful start; subsequent starts use the stored hash. Changing the environment password does not reset an existing owner password.

The included compose file binds the app's HTTP port to the host's loopback interface for use behind your TLS reverse proxy. It does not configure DNS, certificates, proxying, or deploy itself. Set `FIELDWORK_ORIGIN` and `FIELDWORK_PASSWORD` in your private `.env`, then:

```sh
docker compose up --build -d
```

Authentication uses HttpOnly, SameSite=Strict sessions; writes from the web UI require its custom client header and same-origin requests. API tokens are stored as hashes. Static serving is an allowlist and never exposes the database or credential files. Single owner/workspace only; multi-user permissions are not implemented.

## Verification

```sh
npm test
```

The suite uses isolated temporary/in-memory databases and localhost servers. It checks persistence, sequence transitions/replay, import rollback, identity linking, exclusive research jobs, validation, stale versions, auth/CSRF/host checks, scoped tokens/revocation, and a real MCP client round trip.

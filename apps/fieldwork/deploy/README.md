# Server deployment

Target: `monica-droplet`, public address `https://fieldwork.promptu.net`.
Vercel is not required. Fieldwork runs as a separate Docker Compose project with
its own SQLite volume; Monica's container and production data are not involved.
Local prototype/sample data and local agent credentials are not deployed.

## Release code

Follow the repository policy: commit and push the release to `origin/main` from
a clean checkout. Then run from the repository root:

```sh
bash apps/fieldwork/deploy/deploy.sh
```

This transfers only committed Fieldwork source, builds on the droplet, backs up
an existing Fieldwork database, starts it on `127.0.0.1:4178`, and records the
release under `/home/prmptu/fieldwork/current`. A first install generates a
private owner password on the server. Read
`/home/prmptu/fieldwork/owner-bootstrap.env` privately to log in; do not send it
in a chat. It is removed from the container's environment after initialization.
The initial server workspace is empty. Local and hosted credentials are separate.

## DNS and HTTPS (server administrator)

Create the DNS A record `fieldwork.promptu.net → 24.199.97.213`. Do not add an
AAAA record unless that address is routed to this server.
After deployment, run on `monica-droplet` with sudo access:

```sh
sudo install -m 644 /home/prmptu/fieldwork/current/deploy/nginx.conf /etc/nginx/sites-available/fieldwork.promptu.net
sudo ln -s /etc/nginx/sites-available/fieldwork.promptu.net /etc/nginx/sites-enabled/fieldwork.promptu.net
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d fieldwork.promptu.net --redirect
```

If the symlink already exists, inspect the existing configuration instead of
overwriting it. Certbot configures HTTPS and renewal using the server's existing
certificate setup. Confirm the public `/health` endpoint succeeds, `/auth/status`
reports password mode, and unauthenticated `/api/v1/workspace` returns 401 before
connecting an agent.

## Agent setup

Log into the hosted app and create a separate agent token in Agent access. For a
local MCP client set `FIELDWORK_API_URL=https://fieldwork.promptu.net` and the
hosted token in its private environment. Your local token works only with your
local database. Start the existing stdio adapter locally; it calls the hosted API.
For a custom GPT, configure authenticated Actions using the hosted API schema at
`/api/v1/openapi.json` and the token in authentication settings. The schema itself
requires authentication: retrieve it locally with your configured credential and
paste the schema into the GPT editor. Do not paste credentials into the schema.

Use [AGENT_GUIDE.md](../AGENT_GUIDE.md) as agent instructions. An ordinary ChatGPT
conversation needs a configured tool integration; a token in chat does not create
one. Remote MCP transport/OAuth is not implemented yet.

# Fieldwork — local prospect CRM prototype

The working, persistent app now lives in [apps/fieldwork](../../apps/fieldwork/README.md). This folder is retained as the original mockup; the real app can import its browser workspace.

This is a standalone prototype inside the Monica repository. It has no Laravel routes, migrations, or dependency on Monica. Move this entire folder to another repository when ready.

## Run locally

From this folder, run `npm start` (Node.js required), then open [http://localhost:4178](http://localhost:4178). The server listens only on this computer. Override the port with `PORT=4180 npm start` if needed. No install or build is required.

## Explore

- Move prospects through the pipeline by dragging cards or changing the stage in their profile. Rename the five stages with **Edit stages**.
- Add individuals or company contacts, personal details, short notes, and dated next actions.
- Create or edit sequences with channels and wait days, and enroll people.
- Complete an action to schedule the next sequence step. Record a reply to pause a sequence; resume it from the profile.
- Use **Next actions** to see due tasks or all upcoming tasks. **Tomorrow** moves a task to tomorrow.
- Export the workspace to JSON for a portable copy.
- Use **Research** for parallel investigations containing people, companies, profile links, and sourced findings. Keep observations, hypotheses, and open questions distinct. Edit a subject to add multiple URLs or link an existing CRM profile. Add a researched person to the pipeline while retaining their research context.

Data is stored in this browser's local storage under `fieldwork.crm.v1`. Clearing browser data removes it; another browser or port has a separate workspace. Exports are portable snapshots, not automatic backups. The prototype has no import screen yet. Initial people and companies are fictional.

Existing browser workspaces receive the research section without replacing contacts or actions. Research links in the sample data point to example.com as fictional placeholders. The prototype tracks research manually; it does not execute background searches.

All sequence steps are manual tasks. No emails, LinkedIn messages, calls, or other communication are sent. Wait days are relative to enrollment for the first step and completion of the previous step thereafter. A new enrollment replaces that person's active/paused sequence tasks. Template edits affect new enrollments; existing enrollments keep a snapshot of their original steps. Sequence completion does not choose a sales outcome or change the pipeline stage.

## Future application

Keep the eventual CRM in its own repository and database, with optional links to Monica later. This prototype explores the workflow; it is not a production data model. Current company names group contacts informally. Separate companies, opportunities spanning several contacts, authentication, server storage, integrations, and message automation can follow once the sales process is clearer.

See [AGENT_ARCHITECTURE.md](AGENT_ARCHITECTURE.md) for the proposed shared API, MCP tools, Hermes/Telegram voice flow, evidence provenance, and concurrent research jobs. Those interfaces are a design proposal, not live endpoints. Research operations live in a UI-independent module. Run `node --test research-model.test.js` to check subject promotion, finding isolation, duplicate protection, and link validation.

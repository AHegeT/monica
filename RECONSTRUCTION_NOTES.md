# Monica reconstruction findings

## Current upstream code

This checkout follows the Monica Personal Relationship Manager project. The current `main` line is a PHP application using Laravel 12, with Vue 3 and Inertia for its browser UI. Browser routes are in `routes/web.php`; API routes are in `routes/api.php`. Contact behavior is organized under `app/Domains/Contact`, with request controllers, services, models, and view helpers. Database changes are under `database/migrations`.

Contact notes are stored as plain text in the `notes.body` database column. The existing note form advertises Markdown, and the text area already supports newlines. Before this change, note bodies were interpolated as plain text in the contact module, so Markdown list syntax was not rendered as a list. This change keeps the existing text storage and renders Markdown with raw HTML stripped and unsafe links disabled.

## Current main changes

The current `main` branch includes a public `/testing` route that returns `success`. Contact notes remain stored as plain text; the editor can insert Markdown bullet markers, and note views render Markdown with raw HTML removed, unsafe links disabled, and ordinary line breaks preserved.

## Live deployment

The live Droplet now runs the fork's `main` build in Docker, served at
`https://monica.promptu.net`. Its SQLite database is stored in the persistent
`monica_next_data` Docker volume and contains the imported contact data. The
previous Monica container, MariaDB database, and storage volume were retained
for rollback. See [the development and deployment setup](docs/development-and-deployment.md)
for the current topology and release procedure.

## Python reconstruction direction

A Python reconstruction is a separate migration project. First map the capabilities, data model, authorization rules, and API behavior to preserve. For an initial Python capability, prefer a separately deployed service with a narrow interface to Monica (such as authenticated API calls) over writing directly to Monica's MariaDB schema. This keeps new behavior testable without coupling it to undocumented database details. This is a design recommendation, not an implemented integration.

# Monica reconstruction findings

## What is running

The live instance is the upstream Monica Personal Relationship Manager, release v4.1.2. Its application image reports Laravel 9.52.16 and PHP 8.2.26. The matching upstream application source is tag `v4.1.2` (commit `32028ce3c`), so this checkout is based on that release to keep the first change compatible with the live app.

The deployment uses Docker Compose on an Ubuntu host. Nginx terminates HTTPS and forwards requests to the Monica app container on port 8080. The app image uses Apache and serves Laravel from `/var/www/html`. MariaDB runs in a separate container. Monica storage and the database use Docker volumes, so a replacement app container can reuse the existing data.

The route and deployable change in this branch are deliberately limited to the application layer: `/testing` returns the plain text body `success`. The deployment Dockerfile overlays the modified route file onto the exact v4.1.2 production image, and removes a compiled route cache if one exists. It does not replace application dependencies, change configuration, or run database migrations.

## Where behavior lives

- `routes/web.php` defines browser routes. The application applies Laravel's web middleware there; account pages are grouped behind authentication, email verification, and MFA middleware. `/testing` is a public route outside those groups.
- `routes/api.php` defines API routes. The project includes Laravel Passport for API authentication.
- `app/Http/Controllers` handles web requests. Domain behavior is primarily in `app/Models`, `app/Services`, and policies; schema changes live under `database/migrations`.
- The browser UI uses Vue 2 and Laravel Mix. It is a PHP/Laravel application rather than a Python service.
- `scripts/docker` contains the project's own image build scripts. The live image is from Monica's separate Docker image project, so building the full upstream app image would change more than the route and could involve dependency and schema changes.

## Python reconstruction direction

A Python reconstruction is a separate migration project, not a small route edit. First map the capabilities, data model, auth rules, and API behavior that need to be preserved. For an initial Python capability, prefer a separately deployed service with a narrow interface to Monica (for example, authenticated API calls) over writing directly to its MariaDB schema. This keeps new behavior testable without coupling it to undocumented database details. Treat this as a design recommendation, not an implemented integration.

## Current scope

This branch adds only the `/testing` smoke-test route and a Docker overlay deployment recipe. The branch is based on upstream `v4.1.2`, matching the version currently installed on the Droplet; it does not upgrade Monica to current upstream `main`.

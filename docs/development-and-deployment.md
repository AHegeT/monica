# Development and deployment setup

This checkout is the `AHegeT/monica` fork, on the `main` branch. It is based on
Monica's Laravel application and includes the contact profile changes and
development work described in [the reconstruction notes](../RECONSTRUCTION_NOTES.md).

## Run locally

Use Docker Compose for the Laravel app and its supporting services. From the
repository root:

```sh
docker compose up -d --no-build laravel.test
corepack yarn dev
```

Leave the Vite development server running while using the app. Open the URL
configured by `APP_URL` in `.env` (the example configuration uses
`http://localhost:8000`). If the Sail image or dependencies are missing, install
the project dependencies and build the app image first, following Monica's
standard Laravel Sail setup. After first setup or after changing PHP
dependencies, rebuild the app image before starting it.

The local development database is separate from production. The Compose file
starts a local MariaDB service and persists it in the `sail-mariadb` Docker
volume. The repository's `.env.example` defaults `DB_CONNECTION` to SQLite;
configure the local `.env` consistently with the database service you choose.
`docker compose down` stops and removes the containers but keeps named volumes;
`docker compose down -v` also deletes those volumes and their data.

## Production topology

The live service is at [monica.promptu.net](https://monica.promptu.net). The
domain's HTTPS proxy forwards to the app on the droplet. Chowow is the SSH hop
used to reach the droplet:

```sh
ssh ssh.alanhegewisch.com
# On Chowow:
ssh monica-droplet
```

The production Monica app is a Docker Compose service on the droplet. The
current app uses SQLite stored on the persistent Docker volume
`monica_next_data`. This production database is independent from the local
development database; local changes do not automatically read or write live
data. Production environment values and credentials remain on the droplet and
must not be copied into this repository.

## Sync and deployment policy

Git `main` is authoritative for application code, migrations, and UI. Commit and
push local changes before deploying; the deployment script refuses a dirty
checkout or a commit that is not on `origin/main`. Changes made directly inside
the droplet's application container are temporary and will be replaced by the
next image.

The droplet's `monica_next_data` volume is authoritative for production
contacts, settings, and uploaded files. Local databases and storage are never
sent to production. Each deployment stops the app briefly, archives that volume
under `/home/prmptu/monica-next/backups/`, and starts the new image so its normal
entrypoint can apply migrations. The backup is kept on the droplet. The script
retains a Compose override at `/home/prmptu/monica-next/docker-compose.deploy.yml`
so Compose continues to use the deployed image tag. If startup fails, it
restores the previously running image; it does not replace production data.

After reviewing and pushing a commit to `main`, run:

```sh
scripts/deploy-droplet.sh
```

The script builds the image from that commit, transfers it over SSH, backs up
production storage, updates the service, and checks `/testing` and `/login` at
the production URL. Set `MONICA_DROPLET_SSH` or `MONICA_PRODUCTION_URL` to
override the default SSH alias or URL. This process keeps code and production
data on their respective sources of truth; it does not merge database contents
between local and production.

Deployment records, private exports, and machine-specific process notes belong
under `docs/internal/`. That directory is ignored by Git. Keep this tracked doc
to stable procedures and non-secret setup information.

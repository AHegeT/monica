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

## Deployment procedure

1. Commit and push the intended source changes to the fork's `main` branch.
2. Build the production image from that commit using
   `scripts/docker/Dockerfile` and transfer the image to the droplet through
   Chowow.
3. Start the new app on a separate loopback port. Confirm its migrations,
   `/testing` route, and `/login` page before changing the public service.
4. Back up the current database and preserve the previous image, container, and
   storage before switching the Compose port used by the HTTPS proxy.
5. Verify `https://monica.promptu.net/testing` returns `success` and that
   `/login` responds after the switch. Keep the old app and its data available
   until the replacement is confirmed.

Deployment records, private exports, and machine-specific process notes belong
under `docs/internal/`. That directory is ignored by Git. Keep this tracked doc
to stable procedures and non-secret setup information.

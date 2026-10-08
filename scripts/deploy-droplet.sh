#!/usr/bin/env bash

set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${MONICA_DROPLET_SSH:-monica-droplet}"
APP_URL="${MONICA_PRODUCTION_URL:-https://monica.promptu.net}"

cd "$ROOT"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    cat <<'HELP'
Usage: scripts/deploy-droplet.sh

Builds the current committed main branch, transfers the image to the Monica
droplet, backs up its monica_next_data volume, and updates the app container.

Requirements: Docker, Git, SSH access to monica-droplet, and a clean main
checkout whose commit has been pushed to origin. The script does not deploy
uncommitted changes. Set MONICA_DROPLET_SSH or MONICA_PRODUCTION_URL to override
the defaults.
HELP
    exit 0
fi

if [[ $# -ne 0 ]]; then
    echo "This script does not accept positional arguments. Use --help." >&2
    exit 2
fi

branch="$(git branch --show-current)"
if [[ "$branch" != "main" ]]; then
    echo "Deploy from main (currently on '$branch')." >&2
    exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
    echo "Commit or discard working tree changes before deploying." >&2
    exit 1
fi

commit="$(git rev-parse HEAD)"
if ! git merge-base --is-ancestor "$commit" origin/main 2>/dev/null; then
    echo "Push this commit to origin/main before deploying." >&2
    exit 1
fi

if ! command -v docker >/dev/null || ! command -v ssh >/dev/null || ! command -v scp >/dev/null; then
    echo "Docker, SSH, and SCP are required." >&2
    exit 1
fi

short_commit="${commit:0:12}"
image_tag="monica:promptu-next-${short_commit}"
archive="$(mktemp "${TMPDIR:-/tmp}/monica-image.XXXXXX.tar.gz")"
remote_archive="/tmp/monica-image-${short_commit}-$$.tar.gz"
trap 'rm -f "$archive"' EXIT

echo "Building $image_tag from $commit"
"$ROOT/scripts/docker/build.sh" "$commit" "$image_tag"

echo "Transferring image to $REMOTE"
docker save "$image_tag" | gzip > "$archive"
scp "$archive" "$REMOTE:$remote_archive"

echo "Backing up production storage and updating the app"
ssh "$REMOTE" "bash -s -- '$image_tag' '$remote_archive' '$short_commit'" <<'REMOTE_SCRIPT'
set -Eeuo pipefail

image_tag="$1"
archive="$2"
release="$3"
project="/home/prmptu/monica-next"
backup_dir="$project/backups"
compose_file="$project/docker-compose.yml"
override="$project/docker-compose.deploy.yml"
service="app"

cd "$project"
[[ -f "$compose_file" ]] || { echo "Missing $compose_file" >&2; exit 1; }
[[ -f "$archive" ]] || { echo "Missing transferred image archive $archive" >&2; exit 1; }

compose() {
    docker compose --project-directory "$project" -f "$compose_file" -f "$override" "$@"
}

current_image="$(docker inspect --format '{{.Config.Image}}' monica-next-app)"
docker load -i "$archive"
rm -f "$archive"
mkdir -p "$backup_dir"
cat > "$override" <<EOF
services:
  app:
    image: $image_tag
    pull_policy: never
EOF

restart_old_app() {
    cat > "$override" <<EOF
services:
  app:
    image: $current_image
    pull_policy: never
EOF
    compose up -d --no-deps "$service" >/dev/null || true
}

compose stop "$service"
backup="$backup_dir/monica_next_data-$(date -u +%Y%m%dT%H%M%SZ)-${release}.tar.gz"
if ! docker run --rm --entrypoint tar \
    -v monica_next_data:/data:ro \
    -v "$backup_dir:/backup" \
    "$current_image" czf "/backup/$(basename "$backup")" -C /data .; then
    restart_old_app
    exit 1
fi

if ! compose up -d --no-deps "$service"; then
    echo "New container failed to start. Restoring the previous image." >&2
    restart_old_app
    exit 1
fi

for attempt in $(seq 1 45); do
    running="$(docker inspect --format '{{.State.Running}}' monica-next-app 2>/dev/null || true)"
    if [[ "$running" == "true" ]]; then
        break
    fi
    if [[ "$attempt" -eq 45 ]]; then
        echo "New container exited during startup. Recent logs:" >&2
        docker logs --tail 80 monica-next-app >&2 || true
        echo "Restoring the previous image." >&2
        restart_old_app
        exit 1
    fi
    sleep 2
done

echo "Deployment started. Production storage backup: $backup"
REMOTE_SCRIPT

echo "Checking $APP_URL/testing and $APP_URL/login"
if curl --fail --silent --show-error "$APP_URL/testing" >/dev/null && \
   curl --fail --silent --show-error "$APP_URL/login" >/dev/null; then
    echo "Deployment verified."
else
    echo "The app was updated, but an HTTP check failed. Review the container logs and backup before deciding whether to roll back." >&2
    exit 1
fi

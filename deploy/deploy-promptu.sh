#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
remote="${PROMPTU_SSH_HOST:-monica-droplet}"
remote_source="/home/prmptu/monica-custom"

tar -C "$repo_root" -cf - routes/web.php deploy/Dockerfile deploy/docker-compose.promptu.yml | \
  ssh "$remote" "mkdir -p '$remote_source' && tar -xf - -C '$remote_source'"

ssh "$remote" 'bash -s' <<'REMOTE'
set -euo pipefail
project=/home/prmptu/monica
source=/home/prmptu/monica-custom
base=monica:promptu-base-v4.1.2

if ! docker image inspect "$base" >/dev/null 2>&1; then
  version="$(docker image inspect monica --format '{{index .Config.Labels "org.opencontainers.image.version"}}')"
  if [ "$version" != "v4.1.2" ]; then
    echo "Expected the current monica image to be v4.1.2; found $version" >&2
    exit 1
  fi
  docker image tag monica "$base"
fi

docker build --tag monica:promptu-custom --file "$source/deploy/Dockerfile" "$source"
docker compose --project-directory "$project" \
  -f "$project/docker-compose.yml" \
  -f "$source/deploy/docker-compose.promptu.yml" \
  up -d app

for attempt in $(seq 1 20); do
  body="$(curl -fsS --max-time 4 http://127.0.0.1:8080/testing 2>/dev/null || true)"
  if [ "$body" = success ]; then
    echo "Deployment verified: /testing returned success over the app port."
    exit 0
  fi
  sleep 3
done

echo "Smoke check failed; restoring the original Compose image." >&2
docker compose --project-directory "$project" -f "$project/docker-compose.yml" up -d app >&2
docker logs --tail 80 monica-app-1 >&2 || true
exit 1
REMOTE

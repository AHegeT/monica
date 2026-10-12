#!/usr/bin/env bash
set -Eeuo pipefail
root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
remote="${FIELDWORK_SSH:-monica-droplet}"
revision="$(git -C "$root" rev-parse HEAD)"
if [[ -n "$(git -C "$root" status --porcelain)" ]]; then
  echo 'Commit working changes before deploying.' >&2; exit 1
fi
git -C "$root" merge-base --is-ancestor "$revision" origin/main || { echo 'Push the release to origin/main first.' >&2; exit 1; }
git -C "$root" archive "$revision:apps/fieldwork" | ssh "$remote" "mkdir -p /home/prmptu/fieldwork/releases/$revision && tar -x -C /home/prmptu/fieldwork/releases/$revision"
ssh "$remote" bash -s -- "$revision" <<'REMOTE'
set -Eeuo pipefail
base=/home/prmptu/fieldwork
release="$base/releases/$1"
export FIELDWORK_IMAGE="fieldwork:$1"
umask 077
mkdir -p "$base/backups"
if [[ ! -f "$base/.env" ]]; then
  python3 - "$base/.env" <<'PY'
import secrets, sys
from pathlib import Path
Path(sys.argv[1]).write_text('FIELDWORK_ORIGIN=https://fieldwork.promptu.net\nFIELDWORK_PASSWORD='+secrets.token_urlsafe(32)+'\n')
PY
  chmod 600 "$base/.env"
fi
compose() { docker compose -p fieldwork --env-file "$base/.env" -f "$release/compose.yml" "$@"; }
previous="$(readlink -f "$base/current" 2>/dev/null || true)"
container="$(compose ps -q fieldwork 2>/dev/null || true)"
if [[ -n "$container" ]]; then
  docker exec "$container" node server/admin.js backup
  docker cp "$container:/app/backups/." "$base/backups/"
fi
compose up --build -d
ready=false
for attempt in {1..30}; do
  if curl -fsS --max-time 3 -H 'Host: fieldwork.promptu.net' http://127.0.0.1:4178/health >/dev/null; then ready=true; break; fi
  sleep 2
done
if [[ "$ready" != true ]]; then
  echo 'Fieldwork failed its health check.' >&2
  if [[ -n "$previous" && "$previous" != "$release" ]]; then
    FIELDWORK_IMAGE="fieldwork:$(basename "$previous")" docker compose -p fieldwork --env-file "$base/.env" -f "$previous/compose.yml" up -d --no-build
  fi
  exit 1
fi
ln -sfn "$release" "$base/current"
# The salted owner hash is persisted; remove the bootstrap plaintext secret from
# the container environment after capturing it in the private owner file.
if grep -q '^FIELDWORK_PASSWORD=' "$base/.env"; then
  grep '^FIELDWORK_PASSWORD=' "$base/.env" > "$base/owner-bootstrap.env"
  chmod 600 "$base/owner-bootstrap.env"
  sed -i '/^FIELDWORK_PASSWORD=/d' "$base/.env"
  compose up -d --force-recreate
fi
for attempt in {1..30}; do
  if curl -fsS --max-time 3 -H 'Host: fieldwork.promptu.net' http://127.0.0.1:4178/health >/dev/null; then break; fi
  if [[ "$attempt" == 30 ]]; then echo 'Fieldwork did not become healthy after restart.' >&2; exit 1; fi
  sleep 2
done
echo 'Fieldwork installed on server loopback. Configure DNS and Nginx/HTTPS before opening it.'
echo "Owner password is in $base/owner-bootstrap.env (read privately on the server)."
REMOTE

#!/usr/bin/env bash
# deploy.sh — Pack project, copy to Pi, rebuild Docker container.
# Usage: bash deploy.sh
set -euo pipefail

REMOTE_USER="udzerins"
REMOTE_HOST="${DEPLOY_HOST:-srvop.duckdns.org}"
REMOTE_PORT="1979"
REMOTE_DIR="/home/udzerins/praulitis"

SSH="ssh -p ${REMOTE_PORT} -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_HOST}"

GIT_ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "[git] Checking sync with origin..."
if git -C "$GIT_ROOT" fetch origin --quiet 2>/dev/null; then
  BEHIND=$(git -C "$GIT_ROOT" rev-list --count "HEAD..@{u}" 2>/dev/null || echo 0)
  AHEAD=$(git -C "$GIT_ROOT" rev-list --count "@{u}..HEAD" 2>/dev/null || echo 0)
  if [ "$BEHIND" -gt 0 ]; then
    echo "[git] ERROR: Local branch is $BEHIND commit(s) behind origin. Run 'git pull' first." >&2
    exit 1
  fi
  [ "$AHEAD" -gt 0 ] && echo "[git] WARNING: Local has $AHEAD unpushed commit(s). Push to GitHub so the other machine stays in sync."
  echo "[git] Local is in sync with origin."
else
  echo "[git] WARNING: Could not reach GitHub — skipping sync check."
fi

echo "==> Building frontend..."
(cd "$(dirname "$0")/frontend" && npm run build)

echo "==> Packing project..."
TMPTAR=$(mktemp /tmp/praulitis-XXXXXX.tar.gz)
tar \
  --exclude='./.git' \
  --exclude='./__pycache__' \
  --exclude='./app/__pycache__' \
  --exclude='./**/__pycache__' \
  --exclude='./*.pyc' \
  --exclude='./app/static/uploads' \
  --exclude='./data' \
  -czf "$TMPTAR" \
  -C "$(dirname "$0")" .

echo "==> Uploading to ${REMOTE_HOST}..."
scp -P "${REMOTE_PORT}" -o StrictHostKeyChecking=no "$TMPTAR" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/praulitis.tar.gz"
rm "$TMPTAR"

echo "==> Extracting and rebuilding on server..."
$SSH bash -s <<'REMOTE'
set -euo pipefail
LOCK="/tmp/praulitis.deploy.lock"
if [ -e "$LOCK" ]; then
  lock_pid=$(cat "$LOCK" 2>/dev/null || true)
  if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
    echo "[lock] Deploy already in progress (PID=$lock_pid). Aborting." >&2
    exit 2
  fi
  rm -f "$LOCK"
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

mkdir -p ~/praulitis
# Wipe non-persistent files so deleted local files don't linger
find ~/praulitis -mindepth 1 -maxdepth 1 \
  ! -name data \
  ! -name .env \
  ! -name 'app' \
  -exec rm -rf {} + 2>/dev/null || true
# Clear app dir except uploads
if [ -d ~/praulitis/app ]; then
  find ~/praulitis/app -mindepth 1 -maxdepth 1 ! -name static -exec rm -rf {} +
  if [ -d ~/praulitis/app/static ]; then
    find ~/praulitis/app/static -mindepth 1 -maxdepth 1 ! -name uploads -exec rm -rf {} +
  fi
fi
tar -xzf /tmp/praulitis.tar.gz -C ~/praulitis
rm /tmp/praulitis.tar.gz
mkdir -p ~/praulitis/data ~/praulitis/app/static/uploads
# On first deploy, copy .env if not present
if [ ! -f ~/praulitis/.env ]; then
  echo "NOTE: No .env on server — using the one from package. Change credentials after deploy."
fi
cd ~/praulitis
docker compose up -d --build
echo "==> Deploy complete. Container status:"
docker compose ps
REMOTE

echo ""
echo "Done. Praulitis running on ${REMOTE_HOST} (port 5002, behind Caddy if configured)"

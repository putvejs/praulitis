set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is not installed on remote host" >&2
  exit 10
fi

WORKROOT="__REMOTE_DIR__/.ops/work"
WORKDIR="$WORKROOT/praulitis-restore-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$WORKROOT"
mkdir -p "$WORKDIR/extract"
ARCHIVE="$WORKDIR/backup.tar.gz"

aws s3 cp "s3://__S3_BUCKET__/__BACKUP_KEY__" "$ARCHIVE" __AWS_ARGS__
tar -xzf "$ARCHIVE" -C "$WORKDIR/extract"

cd "__REMOTE_DIR__"
docker compose down || true

cp "$WORKDIR/extract/files/.env" "__REMOTE_DIR__/.env"
cp "$WORKDIR/extract/files/docker-compose.yml" "__REMOTE_DIR__/docker-compose.yml"
chmod 600 "__REMOTE_DIR__/.env"

if [ -f "$WORKDIR/extract/files/data.tar.gz" ]; then
  sudo rm -rf "__REMOTE_DIR__/data"
  tar -xzf "$WORKDIR/extract/files/data.tar.gz" -C "__REMOTE_DIR__"
fi

docker compose up -d
sleep 8
docker compose ps

rm -rf "$WORKDIR"
echo "Restore completed from key: __BACKUP_KEY__"

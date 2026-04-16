set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is not installed on remote host" >&2
  exit 10
fi

TS=$(date +%Y%m%d-%H%M%S)
WORKROOT="__REMOTE_DIR__/.ops/work"
WORKDIR="$WORKROOT/praulitis-backup-$TS"
OUTDIR=$WORKDIR/payload
mkdir -p "$WORKROOT"
mkdir -p "$OUTDIR/files"

cp "__REMOTE_DIR__/.env" "$OUTDIR/files/.env"
cp "__REMOTE_DIR__/docker-compose.yml" "$OUTDIR/files/docker-compose.yml"

# Back up the data directory (contains praulitis.db SQLite database)
if [ -d "__REMOTE_DIR__/data" ]; then
  tar -czf "$OUTDIR/files/data.tar.gz" -C "__REMOTE_DIR__" data
fi

cat > "$OUTDIR/manifest.txt" << EOF
project=praulitis
created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
host=$(hostname)
remote_dir=__REMOTE_DIR__
volumes=none
EOF

ARCHIVE="$WORKROOT/praulitis-backup-$TS.tar.gz"
tar -czf "$ARCHIVE" -C "$OUTDIR" .

S3_URI="s3://__S3_BUCKET__/__S3_PREFIX__/praulitis-backup-$TS.tar.gz"
aws s3 cp "$ARCHIVE" "$S3_URI" --no-progress __AWS_ARGS__

rm -rf "$WORKDIR" "$ARCHIVE"
echo "Backup uploaded: $S3_URI"

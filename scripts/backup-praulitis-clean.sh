#!/usr/bin/env bash
set -euo pipefail

S3_BUCKET="praulits-media"
S3_PREFIX="praulitis/prod"
REMOTE_DIR="/home/udzerins/praulitis"
AWS_REGION="us-east-1"
TS=$(date +%Y%m%d-%H%M%S)
WORKDIR=/tmp/praulitis-backup-$TS
OUTDIR=$WORKDIR/payload
LOG=/home/udzerins/logs/praulitis-backup-nightly.log

mkdir -p "$OUTDIR/volumes" "$OUTDIR/files" /home/udzerins/logs

if ! command -v aws >/dev/null 2>&1; then
  echo "$(date -Iseconds) aws CLI missing" >> "$LOG"
  exit 10
fi

cp "$REMOTE_DIR/docker-compose.yml" "$OUTDIR/files/docker-compose.yml"

if [ -d "$REMOTE_DIR/data" ]; then
  tar -czf "$OUTDIR/files/data.tar.gz" -C "$REMOTE_DIR" data
fi

docker run --rm -v praulitis_sqlite_data:/source -v "$OUTDIR/volumes":/backup alpine:3.20 sh -lc 'tar -czf /backup/sqlite_data.tar.gz -C /source .' 2>/dev/null || true

cat > "$OUTDIR/manifest.txt" << EOF
project=praulitis
created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
host=$(hostname)
remote_dir=$REMOTE_DIR
EOF

ARCHIVE=/tmp/praulitis-backup-$TS.tar.gz
tar -czf "$ARCHIVE" -C "$OUTDIR" .
KEY="$S3_PREFIX/praulitis-backup-$TS.tar.gz"
aws s3 cp "$ARCHIVE" "s3://$S3_BUCKET/$KEY" --no-progress --region "$AWS_REGION"

echo "$(date -Iseconds) uploaded s3://$S3_BUCKET/$KEY" >> "$LOG"
rm -rf "$WORKDIR" "$ARCHIVE"

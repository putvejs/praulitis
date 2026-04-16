set -euo pipefail

mkdir -p "__REMOTE_DIR__/.ops/bin" "__REMOTE_DIR__/.ops/logs" "__REMOTE_DIR__/.ops/work"
SCRIPT_PATH="__REMOTE_DIR__/.ops/bin/backup-praulitis-nightly.sh"
cat > "$SCRIPT_PATH" << 'EOS'
#!/usr/bin/env bash
set -euo pipefail

S3_BUCKET='__S3_BUCKET__'
S3_PREFIX='__S3_PREFIX__'
REMOTE_DIR='__REMOTE_DIR__'
RETENTION_DAYS='__RETENTION_DAYS__'
AWS_PROFILE_ARG="__AWS_PROFILE_ARG__"
AWS_REGION_ARG="__AWS_REGION_ARG__"
TS=$(date +%Y%m%d-%H%M%S)
WORKROOT="$REMOTE_DIR/.ops/work"
WORKDIR=$WORKROOT/praulitis-backup-$TS
OUTDIR=$WORKDIR/payload
LOG="$REMOTE_DIR/.ops/logs/praulitis-backup-nightly.log"

mkdir -p "$WORKROOT"
mkdir -p "$OUTDIR/files"

if ! command -v aws >/dev/null 2>&1; then
  echo "$(date -Iseconds) aws CLI missing" >> "$LOG"
  exit 10
fi

cp "$REMOTE_DIR/.env" "$OUTDIR/files/.env"
cp "$REMOTE_DIR/docker-compose.yml" "$OUTDIR/files/docker-compose.yml"

if [ -d "$REMOTE_DIR/data" ]; then
  tar -czf "$OUTDIR/files/data.tar.gz" -C "$REMOTE_DIR" data
fi

cat > "$OUTDIR/manifest.txt" << EOF
project=praulitis
created_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
host=$(hostname)
remote_dir=$REMOTE_DIR
volumes=none
EOF

ARCHIVE=$WORKROOT/praulitis-backup-$TS.tar.gz
tar -czf "$ARCHIVE" -C "$OUTDIR" .
KEY="$S3_PREFIX/praulitis-backup-$TS.tar.gz"
aws s3 cp "$ARCHIVE" "s3://$S3_BUCKET/$KEY" --no-progress $AWS_PROFILE_ARG $AWS_REGION_ARG

echo "$(date -Iseconds) uploaded s3://$S3_BUCKET/$KEY" >> "$LOG"

if [ "$RETENTION_DAYS" -gt 0 ]; then
  CUTOFF=$(date -d "-$RETENTION_DAYS days" +%Y-%m-%d)
  aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" --recursive $AWS_PROFILE_ARG $AWS_REGION_ARG \
    | awk -v cutoff="$CUTOFF" '/praulitis-backup-/ { if ($1 < cutoff) print $4 }' \
    | while read -r oldKey; do aws s3 rm "s3://$S3_BUCKET/$oldKey" $AWS_PROFILE_ARG $AWS_REGION_ARG || true; done
fi

rm -rf "$WORKDIR" "$ARCHIVE"
EOS
chmod +x "$SCRIPT_PATH"

CRON_LINE="__SCHEDULE__ __REMOTE_DIR__/.ops/bin/backup-praulitis-nightly.sh >> __REMOTE_DIR__/.ops/logs/praulitis-backup-nightly.log 2>&1"
CURRENT_CRONTAB=$(crontab -l 2>/dev/null || true)
{
  printf '%s\n' "$CURRENT_CRONTAB" | grep -v 'backup-praulitis-nightly.sh' || true
  printf '%s\n' "$CRON_LINE"
} | crontab -

echo "Installed nightly backup cron for praulitis"
crontab -l | grep 'backup-praulitis-nightly.sh' || true

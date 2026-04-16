"""
scripts/migrate_to_s3.py — One-time migration of local uploads to S3.

Run this ONCE after setting AWS credentials and AWS_S3_BUCKET in .env.
Existing local files are uploaded to S3; local copies are left intact as backup.

Usage (on Pi, inside the project directory):
    python scripts/migrate_to_s3.py --dry-run   # preview without uploading
    python scripts/migrate_to_s3.py             # do the actual upload
"""

import argparse
import logging
import sys
from pathlib import Path

# Add project root to path so app.config can be imported
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import os
import boto3
from botocore.exceptions import ClientError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUBFOLDERS = ["photos", "audio", "videos"]


def main():
    parser = argparse.ArgumentParser(description="Migrate local uploads to S3.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be uploaded without doing it.")
    args = parser.parse_args()

    bucket = os.environ.get("AWS_S3_BUCKET", "")
    region = os.environ.get("AWS_S3_REGION", "eu-north-1")
    upload_path = os.environ.get("UPLOAD_PATH", str(Path(__file__).parent.parent / "app" / "static" / "uploads"))

    if not bucket:
        log.error("AWS_S3_BUCKET not set in .env — aborting.")
        sys.exit(1)

    log.info("Bucket: s3://%s  Region: %s", bucket, region)
    log.info("Local uploads: %s", upload_path)
    if args.dry_run:
        log.info("DRY RUN — no files will be uploaded.")

    s3 = boto3.client("s3", region_name=region)

    # Verify bucket is accessible
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError as e:
        log.error("Cannot access bucket %s: %s", bucket, e)
        sys.exit(1)

    total = uploaded = skipped = errors = 0

    for subfolder in SUBFOLDERS:
        folder = Path(upload_path) / subfolder
        if not folder.exists():
            log.info("Skipping %s (not found locally)", folder)
            continue
        files = list(folder.iterdir())
        log.info("%s: %d files", subfolder, len(files))
        for fpath in files:
            if not fpath.is_file():
                continue
            total += 1
            key = f"{subfolder}/{fpath.name}"
            # Skip if already in S3
            try:
                s3.head_object(Bucket=bucket, Key=key)
                log.debug("Already exists: %s", key)
                skipped += 1
                continue
            except ClientError:
                pass  # Not found — upload it
            if args.dry_run:
                log.info("Would upload: %s (%d KB)", key, fpath.stat().st_size // 1024)
                uploaded += 1
                continue
            try:
                s3.upload_file(str(fpath), bucket, key)
                log.info("Uploaded: %s (%d KB)", key, fpath.stat().st_size // 1024)
                uploaded += 1
            except Exception as e:
                log.error("Failed: %s — %s", key, e)
                errors += 1

    log.info("Done. Total: %d | Uploaded: %d | Skipped (already in S3): %d | Errors: %d",
             total, uploaded, skipped, errors)
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()

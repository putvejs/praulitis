"""
storage.py — Abstraction layer for file storage.

If AWS_S3_BUCKET is set in environment, files are stored in S3 and served via
CloudFront (or direct S3 URL). Otherwise falls back to local disk.

Usage:
    from app.storage import save_upload, delete_file, public_url

    # Upload
    key = save_upload(file_obj, "photos", "abc123.jpg")

    # Public URL for serving
    url = public_url("photos", "abc123.jpg")

    # Delete
    delete_file("photos", "abc123.jpg")
"""

import mimetypes
import logging
from pathlib import Path

from app.config import (
    UPLOAD_PATH,
    AWS_S3_BUCKET,
    AWS_S3_REGION,
    AWS_CLOUDFRONT_URL,
    USE_S3,
)

log = logging.getLogger(__name__)


def _s3_client():
    import boto3
    return boto3.client("s3", region_name=AWS_S3_REGION)


def _s3_key(subfolder, filename):
    return f"{subfolder}/{filename}"


def save_upload(file_obj, subfolder, filename):
    """
    Save an uploaded file.
    - file_obj: werkzeug FileStorage (or any file-like object)
    - subfolder: 'photos', 'audio', or 'videos'
    - filename: stored filename (UUID-based, no path)
    Returns filename (unchanged) — subfolder is stored separately in DB context.
    """
    if USE_S3:
        key = _s3_key(subfolder, filename)
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        _s3_client().upload_fileobj(
            file_obj, AWS_S3_BUCKET, key,
            ExtraArgs={"ContentType": content_type}
        )
        log.info("S3 upload: s3://%s/%s (%s)", AWS_S3_BUCKET, key, content_type)
    else:
        dest = Path(UPLOAD_PATH) / subfolder / filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        file_obj.save(str(dest))
    return filename


def delete_file(subfolder, filename):
    """Delete a stored file. Silently ignores missing files."""
    if not filename:
        return
    if USE_S3:
        key = _s3_key(subfolder, filename)
        try:
            _s3_client().delete_object(Bucket=AWS_S3_BUCKET, Key=key)
            log.info("S3 delete: s3://%s/%s", AWS_S3_BUCKET, key)
        except Exception as e:
            log.warning("S3 delete failed for %s: %s", key, e)
    else:
        path = Path(UPLOAD_PATH) / subfolder / filename
        try:
            path.unlink()
        except FileNotFoundError:
            pass


def ensure_cors():
    """Set S3 bucket CORS to allow direct browser PUT uploads. Idempotent."""
    if not USE_S3:
        return
    cors_config = {
        "CORSRules": [
            {
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "HEAD", "PUT"],
                "AllowedOrigins": ["*"],
                "ExposeHeaders": ["ETag", "Content-Length"],
                "MaxAgeSeconds": 3600,
            }
        ]
    }
    try:
        _s3_client().put_bucket_cors(Bucket=AWS_S3_BUCKET, CORSConfiguration=cors_config)
        log.info("S3 CORS configured for bucket %s", AWS_S3_BUCKET)
    except Exception as e:
        log.warning("Could not set S3 CORS: %s", e)


def generate_presign_url(subfolder, filename):
    """Generate a presigned S3 PUT URL for direct browser upload. Returns (url, content_type)."""
    import mimetypes
    key = _s3_key(subfolder, filename)
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    url = _s3_client().generate_presigned_url(
        "put_object",
        Params={"Bucket": AWS_S3_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=3600,
    )
    return url, content_type


def public_url_key(key):
    """Return a public URL for an arbitrary S3 key (e.g. 'hls/123/master.m3u8')."""
    if not key:
        return None
    if USE_S3:
        if AWS_CLOUDFRONT_URL:
            return f"{AWS_CLOUDFRONT_URL.rstrip('/')}/{key}"
        return f"https://{AWS_S3_BUCKET}.s3.{AWS_S3_REGION}.amazonaws.com/{key}"
    return f"/static/uploads/{key}"


def public_url(subfolder, filename):
    """
    Return the public URL for a stored file.
    - S3+CloudFront: https://xxx.cloudfront.net/photos/file.jpg
    - S3 direct:     https://bucket.s3.region.amazonaws.com/photos/file.jpg
    - Local:         /static/uploads/photos/file.jpg
    """
    if not filename:
        return None
    if USE_S3:
        key = _s3_key(subfolder, filename)
        if AWS_CLOUDFRONT_URL:
            return f"{AWS_CLOUDFRONT_URL.rstrip('/')}/{key}"
        return f"https://{AWS_S3_BUCKET}.s3.{AWS_S3_REGION}.amazonaws.com/{key}"
    return f"/static/uploads/{subfolder}/{filename}"

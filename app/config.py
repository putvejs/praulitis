import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

SECRET_KEY    = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-in-prod")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "praulitis")
DATABASE_PATH = os.environ.get("DATABASE_PATH", str(Path(__file__).parent.parent / "data" / "praulitis.db"))
UPLOAD_PATH   = os.environ.get("UPLOAD_PATH", str(Path(__file__).parent / "static" / "uploads"))
FLASK_PORT    = int(os.environ.get("FLASK_PORT", 5002))

# AWS S3 — optional. If AWS_S3_BUCKET is set, files are stored in S3.
AWS_S3_BUCKET      = os.environ.get("AWS_S3_BUCKET", "")
AWS_S3_REGION      = os.environ.get("AWS_S3_REGION", "eu-north-1")
AWS_CLOUDFRONT_URL = os.environ.get("AWS_CLOUDFRONT_URL", "")  # e.g. https://abc123.cloudfront.net
USE_S3             = bool(AWS_S3_BUCKET)

"""Configuration for the private social media bucket."""
import os

from fastapi import HTTPException


def storage_config():
    url, key, bucket = (os.getenv(k) for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SOCIAL_BUCKET"))
    if not all((url, key, bucket)):
        raise HTTPException(503, "Social media storage is not configured")
    if not url.startswith("https://") or "/" in bucket or ".." in bucket:
        raise HTTPException(503, "Invalid social media storage configuration")
    return url.rstrip("/"), key, bucket

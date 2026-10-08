"""Daily retention cleanup for private social-event media and expired events."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import requests
from sqlalchemy import and_, exists, or_
from sqlalchemy.orm import Session

import models as m
from database import SessionLocal
from social_storage import storage_config

log = logging.getLogger(__name__)
STORAGE_KEY = re.compile(r"^(?:[0-9]+/)?(?:event|avatar)/[A-Za-z0-9_-]+\.jpg$")


def cleanup(db: Session, *, current_time: datetime | None = None, batch_size: int = 100) -> tuple[int, int, int]:
    if batch_size < 1:
        raise ValueError("batch_size must be positive")
    url, secret, bucket = storage_config()
    timestamp = current_time or datetime.now(timezone.utc)
    event_cutoff = timestamp - timedelta(days=7)
    report_cutoff = timestamp - timedelta(days=30)
    upload_cutoff = timestamp - timedelta(hours=24)
    failures = 0
    deleted_events = 0
    deleted_orphans = 0

    def remove(key: str) -> bool:
        if not STORAGE_KEY.fullmatch(key):
            log.error("Unsafe social media key; refusing to delete it")
            return False
        try:
            response = requests.delete(
                f"{url}/storage/v1/object/{quote(bucket, safe='')}",
                headers={"Authorization": f"Bearer {secret}", "apikey": secret},
                json={"prefixes": [key]},
                timeout=15, allow_redirects=False,
            )
        except requests.RequestException as exc:
            log.warning("Social media deletion failed: %s", type(exc).__name__)
            return False
        if 200 <= response.status_code < 300:
            return True
        if response.status_code == 404:
            try:
                payload = response.json()
            except ValueError:
                payload = None
            if isinstance(payload, dict) and payload.get("message") == "Object not found":
                return True
        log.warning("Social media deletion failed: HTTP %s", response.status_code)
        return False

    retained_report = exists().where(and_(
        m.SocialReport.event_id == m.SocialEvent.id,
        or_(m.SocialReport.status != "resolved",
            m.SocialReport.resolved_at.is_(None),
            m.SocialReport.resolved_at > report_cutoff),
    ))
    cursor = 0
    while True:
        events = db.query(m.SocialEvent).filter(
            m.SocialEvent.id > cursor, m.SocialEvent.expires_at <= event_cutoff,
            ~retained_report,
        ).order_by(m.SocialEvent.id).limit(batch_size).all()
        if not events:
            break
        for event in events:
            cursor = event.id
            if event.photo_key and not remove(event.photo_key):
                failures += 1
                continue
            media = db.get(m.SocialMedia, event.photo_key) if event.photo_key else None
            if media:
                db.delete(media)
            db.delete(event)
            db.commit()
            deleted_events += 1

    used_by_event = exists().where(m.SocialEvent.photo_key == m.SocialMedia.key)
    used_by_profile = exists().where(m.SocialProfile.avatar_key == m.SocialMedia.key)
    cursor_key = ""
    while True:
        uploads = db.query(m.SocialMedia).filter(
            m.SocialMedia.key > cursor_key, m.SocialMedia.created_at <= upload_cutoff,
            ~used_by_event, ~used_by_profile,
        ).order_by(m.SocialMedia.key).limit(batch_size).all()
        if not uploads:
            break
        for upload in uploads:
            cursor_key = upload.key
            # Profile and event updates lock media rows until their reference is committed.
            media = db.query(m.SocialMedia).filter_by(key=upload.key).with_for_update().first()
            if not media:
                continue
            if (db.query(m.SocialEvent.id).filter_by(photo_key=media.key).first()
                    or db.query(m.SocialProfile.telegram_id).filter_by(avatar_key=media.key).first()):
                db.rollback()
                continue
            if not remove(media.key):
                failures += 1
                db.rollback()
                continue
            db.delete(media)
            db.commit()
            deleted_orphans += 1

    log.info("Social cleanup: %s events, %s unused uploads, %s failures",
             deleted_events, deleted_orphans, failures)
    return deleted_events, deleted_orphans, failures


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    with SessionLocal() as session:
        _, _, failed = cleanup(session)
    if failed:
        raise SystemExit(1)

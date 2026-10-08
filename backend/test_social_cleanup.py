import io
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

os.environ["DATABASE_URL"] = "sqlite://"
import requests
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
import main
from database import get_db
from social_cleanup import cleanup


class SocialCleanupTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        models.Base.metadata.create_all(self.engine)
        with self.engine.connect() as conn:
            conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        self.Session = sessionmaker(bind=self.engine)
        self.timestamp = datetime(2026, 10, 1, tzinfo=timezone.utc)
        self.storage_env = patch.dict(os.environ, {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "fake-test-key",
            "SUPABASE_SOCIAL_BUCKET": "social",
        })
        self.storage_env.start()

    def tearDown(self):
        self.storage_env.stop()
        self.engine.dispose()

    def add_media(self, db, key, age_days=2):
        db.add(models.SocialMedia(key=key, owner_id=1, kind=key.split("/")[0],
                                  created_at=self.timestamp - timedelta(days=age_days)))

    def add_event(self, db, key, age_days=8):
        self.add_media(db, key, age_days=age_days)
        event = models.SocialEvent(
            owner_id=1, description="Social event", drink="coffee", visibility="public",
            latitude=34.7, longitude=32.4, location="Paphos", photo_key=key,
            starts_at=self.timestamp - timedelta(days=age_days, hours=1),
            expires_at=self.timestamp - timedelta(days=age_days),
        )
        db.add(event)
        db.flush()
        return event

    def test_retention_reports_avatars_and_unused_uploads(self):
        with self.Session() as db:
            expired = self.add_event(db, "event/expired.jpg")
            pending = self.add_event(db, "event/pending.jpg", age_days=40)
            db.add(models.SocialReport(event_id=pending.id, reporter_id=2, category="spam", status="open"))
            recent_report = self.add_event(db, "event/recentreport.jpg", age_days=40)
            db.add(models.SocialReport(
                event_id=recent_report.id, reporter_id=2, category="spam", status="resolved",
                resolved_at=self.timestamp - timedelta(days=2)))
            old_report = self.add_event(db, "event/oldreport.jpg", age_days=40)
            db.add(models.SocialReport(
                event_id=old_report.id, reporter_id=2, category="spam", status="resolved",
                resolved_at=self.timestamp - timedelta(days=31)))
            active = self.add_event(db, "event/active.jpg", age_days=1)
            self.add_media(db, "avatar/current.jpg")
            db.add(models.SocialProfile(telegram_id=1, display_name="Owner", avatar_key="avatar/current.jpg"))
            self.add_media(db, "avatar/unused.jpg")
            self.add_media(db, "event/abandoned.jpg")
            self.add_media(db, "event/newupload.jpg", age_days=0)
            db.commit()
            expired_id, pending_id, recent_id, old_id, active_id = (
                expired.id, pending.id, recent_report.id, old_report.id, active.id)

        with patch("social_cleanup.requests.delete", return_value=Mock(status_code=200)) as delete:
            with self.Session() as db:
                self.assertEqual(cleanup(db, current_time=self.timestamp, batch_size=1), (2, 2, 0))
                self.assertIsNone(db.get(models.SocialEvent, expired_id))
                self.assertIsNone(db.get(models.SocialEvent, old_id))
                self.assertIsNone(db.query(models.SocialReport).filter_by(event_id=old_id).first())
                self.assertIsNotNone(db.get(models.SocialEvent, pending_id))
                self.assertIsNotNone(db.get(models.SocialEvent, recent_id))
                self.assertIsNotNone(db.get(models.SocialEvent, active_id))
                self.assertIsNotNone(db.get(models.SocialMedia, "avatar/current.jpg"))
                self.assertIsNotNone(db.get(models.SocialMedia, "event/newupload.jpg"))
                self.assertEqual(delete.call_count, 4)
                self.assertTrue(all("fake-test-key" not in call.args[0] for call in delete.call_args_list))
                self.assertTrue(all(call.kwargs["json"]["prefixes"][0].endswith(".jpg")
                                    for call in delete.call_args_list))
                self.assertTrue(all(call.args[0].endswith("/storage/v1/object/social")
                                    for call in delete.call_args_list))
                report = db.query(models.SocialReport).filter_by(event_id=pending_id).one()
                report.status = "resolved"
                report.resolved_at = self.timestamp - timedelta(days=31)
                db.commit()
                self.assertEqual(cleanup(db, current_time=self.timestamp), (1, 0, 0))

    def test_storage_failure_retries_without_dropping_records(self):
        with self.Session() as db:
            event = self.add_event(db, "event/retry.jpg")
            db.commit()
            event_id = event.id
            with patch("social_cleanup.requests.delete", return_value=Mock(status_code=503)):
                self.assertEqual(cleanup(db, current_time=self.timestamp), (0, 0, 1))
            self.assertIsNotNone(db.get(models.SocialEvent, event_id))
            self.assertIsNotNone(db.get(models.SocialMedia, "event/retry.jpg"))
            with patch("social_cleanup.requests.delete", return_value=Mock(
                    status_code=404, json=Mock(return_value={"message": "Bucket not found"}))):
                self.assertEqual(cleanup(db, current_time=self.timestamp), (0, 0, 1))
            self.assertIsNotNone(db.get(models.SocialEvent, event_id))
            with patch("social_cleanup.requests.delete", return_value=Mock(
                    status_code=404, json=Mock(return_value={"message": "Object not found"}))):
                self.assertEqual(cleanup(db, current_time=self.timestamp), (1, 0, 0))
            self.assertIsNone(db.get(models.SocialEvent, event_id))
            self.assertIsNone(db.get(models.SocialMedia, "event/retry.jpg"))

    def test_global_event_cleanup_does_not_delete_external_images(self):
        with self.Session() as db:
            expired = models.SocialEvent(
                owner_id=4, event_type="global",
                image_urls=["https://images.example.test/photo.jpg"], photo_key=None,
                description="Global event", drink="wine", visibility="public",
                latitude=34.7, longitude=32.4, location="Paphos",
                starts_at=self.timestamp - timedelta(days=9),
                expires_at=self.timestamp - timedelta(days=8),
            )
            db.add(expired)
            db.commit()
            event_id = expired.id
        with patch("social_cleanup.requests.delete") as delete:
            with self.Session() as db:
                self.assertEqual(cleanup(db, current_time=self.timestamp), (1, 0, 0))
                self.assertIsNone(db.get(models.SocialEvent, event_id))
            delete.assert_not_called()

    def test_failed_upload_remains_trackable_for_cleanup(self):
        from routers import social

        with self.Session() as db:
            db.add(models.SocialProfile(telegram_id=1, display_name="Owner", age=21))
            db.commit()

        def db_override():
            with self.Session() as db:
                yield db

        def user_override():
            return main.TelegramAuthContext(telegram_id=1, user={"first_name": "Owner"})

        main.app.dependency_overrides[get_db] = db_override
        main.app.dependency_overrides[main.get_authenticated_telegram_user] = user_override
        image = io.BytesIO()
        Image.new("RGB", (2, 2)).save(image, "JPEG")
        try:
            with patch.dict(os.environ, {"SOCIAL_EVENTS_ENABLED": "true"}), patch.object(
                    social.requests, "post", return_value=Mock(status_code=503, ok=False,
                                                               raise_for_status=Mock(side_effect=requests.HTTPError()))):
                with TestClient(main.app) as client:
                    result = client.post("/api/social/media?kind=avatar", content=image.getvalue())
                    self.assertEqual(result.status_code, 503)
            with self.Session() as db:
                media = db.query(models.SocialMedia).one()
                self.assertEqual(media.kind, "avatar")
                media.created_at = self.timestamp - timedelta(days=2)
                db.commit()
                with patch("social_cleanup.requests.delete", return_value=Mock(status_code=200)):
                    self.assertEqual(cleanup(db, current_time=self.timestamp), (0, 1, 0))
        finally:
            main.app.dependency_overrides.clear()


if __name__ == "__main__":
    unittest.main()

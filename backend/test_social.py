import os
import io
import unittest
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite://"
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, event as sqlalchemy_event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
import models
from database import get_db
from routers import social


class SocialTest(unittest.TestCase):
    def setUp(self):
        self.signed_mock = patch.object(social, "signed", return_value="https://example.test/signed-image")
        self.signed_client = self.signed_mock.start()
        self.notify_mock = patch.object(social, "notify", return_value="not_configured")
        self.notify_client = self.notify_mock.start()
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        @sqlalchemy_event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, record):
            connection.execute("PRAGMA foreign_keys=ON")
        models.Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        def db_override():
            with self.Session() as db:
                yield db
        main.app.dependency_overrides[get_db] = db_override
        main.app.dependency_overrides[main.get_authenticated_telegram_user] = self.current_user
        main.app.dependency_overrides[main.require_admin] = self.current_admin
        self.actor = 1
        self.client = TestClient(main.app)
        for i in (1, 2, 3, 4):
            self.actor = i
            self.request("PUT", "/profile", json={"display_name": f"Person{i}", "age": 21})
        self.actor = 1

    def tearDown(self):
        self.client.close()
        main.app.dependency_overrides.clear()
        self.engine.dispose()
        self.notify_mock.stop()
        self.signed_mock.stop()

    def current_user(self):
        return main.TelegramAuthContext(telegram_id=self.actor, user={"first_name": f"Person{self.actor}"})

    def current_admin(self):
        if self.actor != 4:
            raise main.HTTPException(403, "Admin access required")
        return self.current_user()

    def request(self, method, path, **kwargs):
        return self.client.request(method, "/api/social" + path, **kwargs)

    def uploaded_photo(self):
        key = f"event/{uuid4().hex}.jpg"
        with self.Session() as db:
            db.add(models.SocialMedia(key=key, owner_id=self.actor, kind="event"))
            db.commit()
        return key

    def create(self, visibility="public", capacity=2, tagged=None):
        r = self.request("POST", "/events", json={
            "description": "Coffee in Paphos", "drink": "coffee", "visibility": visibility,
            "latitude": 34.77, "longitude": 32.42, "location": "Paphos",
            "capacity": capacity, "start": "now", "ttl": "1h", "tagged_friend_ids": tagged or [],
            "photo_key": self.uploaded_photo(),
        })
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()["id"]

    def global_payload(self, **updates):
        start = social.now() + timedelta(hours=2)
        return {
            "location": "Paphos", "description": "A global tasting",
            "latitude": 34.77, "longitude": 32.42, "drink": "spirits",
            "visibility": "public",
            "image_urls": ["https://images.example.test/one.jpg", "https://images.example.test/two.jpg"],
            "starts_at": start.isoformat(),
            "expires_at": (start + timedelta(hours=3)).isoformat(),
            **updates,
        }

    def regular_update(self, **updates):
        return {
            **{k: v for k, v in self.global_payload().items() if k != "image_urls"},
            "capacity": 3, **updates,
        }

    def test_admin_updates_regular_event_without_changing_owner_or_relations(self):
        invite = self.request("POST", "/friend-requests", json={"telegram_id": 2}).json()["id"]
        self.actor = 2
        self.request("POST", f"/friend-requests/{invite}/accept")
        self.actor = 1
        event_id = self.create(capacity=2, tagged=[2])
        original_key = self.request("GET", f"/admin/events/{event_id}").status_code
        self.assertEqual(original_key, 403)
        self.actor = 2
        self.request("POST", f"/events/{event_id}/tags/accept")
        join_id = self.request("POST", f"/events/{event_id}/join").json()["id"]
        self.actor = 1
        self.request("POST", f"/events/{event_id}/join-requests/{join_id}/accept")
        self.request("POST", f"/events/{event_id}/chat", json={"body": "Hello"})
        self.actor = 4
        with self.Session() as db:
            original_photo = db.get(models.SocialEvent, event_id).photo_key
        payload = self.regular_update(description="Updated", visibility="anonymous", capacity=2)
        with patch.dict(os.environ, {"SOCIAL_EVENTS_ENABLED": "false", "ADMIN_TELEGRAM_ID": "4"}):
            response = self.request("PUT", f"/admin/events/{event_id}", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["description"], "Updated")
        self.assertEqual(response.json()["attendee_count"], 2)
        self.assertEqual(response.json()["tagged_friends"][0]["telegram_id"], 2)
        self.assertEqual(response.json()["owner"]["telegram_id"], 1)
        self.assertEqual(response.json()["photo_url"], "https://example.test/signed-image")
        with self.Session() as db:
            row = db.get(models.SocialEvent, event_id)
            self.assertEqual(row.photo_key, original_photo)
            self.assertEqual(row.owner_id, 1)
            self.assertEqual(row.capacity, 2)
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{event_id}/chat").json()[0]["body"], "Hello")
        self.actor = 4
        self.assertEqual(self.request("PUT", f"/admin/events/{event_id}", json=self.regular_update(
            photo_key=original_photo, capacity=None)).status_code, 200)
        self.assertEqual(self.request("PUT", f"/admin/events/{event_id}", json=self.regular_update(
            description="a" * 400)).status_code, 200)
        replacement = self.uploaded_photo()
        replaced = self.request("PUT", f"/admin/events/{event_id}", json=self.regular_update(
            photo_key=replacement))
        self.assertEqual(replaced.status_code, 200, replaced.text)
        with self.Session() as db:
            self.assertEqual(db.get(models.SocialEvent, event_id).photo_key, replacement)
            self.assertIsNotNone(db.get(models.SocialMedia, original_photo))
        self.assertEqual(self.request("PUT", f"/admin/events/{event_id}", json=self.regular_update(
            photo_key=original_photo)).status_code, 422)

    def test_admin_updates_global_event_and_rejects_invalid_replacements(self):
        self.actor = 4
        event_id = self.request("POST", "/events/global", json=self.global_payload()).json()["id"]
        valid = self.global_payload(description="Changed", image_urls=["https://images.example.test/new.jpg"])
        response = self.request("PUT", f"/admin/events/{event_id}", json=valid)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["photo_url"], valid["image_urls"][0])
        self.assertEqual(response.json()["description"], "Changed")
        self.assertEqual(self.request("PUT", f"/admin/events/{event_id}", json={
            **valid, "description": "a" * 5000,
        }).status_code, 200)
        invalid = [
            {"image_urls": []}, {"image_urls": ["https://images.example.test/a"] * 6},
            {"image_urls": ["http://images.example.test/a"]},
            {"starts_at": "2026-10-01T12:00:00"},
            {"expires_at": (social.now() - timedelta(seconds=1)).isoformat()},
            {"expires_at": valid["starts_at"]}, {"description": "a" * 5001},
            {"capacity": 3}, {"photo_key": self.uploaded_photo()}, {"owner_id": 1},
            {"latitude": 37}, {"drink": "soda"}, {"visibility": "secret"},
        ]
        for update in invalid:
            with self.subTest(update=update):
                result = self.request("PUT", f"/admin/events/{event_id}", json={**valid, **update})
                self.assertEqual(result.status_code, 422, result.text)
        self.assertEqual(self.request("GET", f"/admin/events/{event_id}").json()["description"], "a" * 5000)
        with self.Session() as db:
            self.assertEqual(db.get(models.SocialEvent, event_id).owner_id, 4)

    def test_admin_regular_update_rejects_invalid_photo_capacity_and_fields(self):
        event_id = self.create(capacity=3)
        self.actor = 2
        join_id = self.request("POST", f"/events/{event_id}/join").json()["id"]
        self.actor = 1
        self.request("POST", f"/events/{event_id}/join-requests/{join_id}/accept")
        foreign_key = self.uploaded_photo()
        self.actor = 4
        another_event = self.create()
        with self.Session() as db:
            used_key = db.get(models.SocialEvent, another_event).photo_key
        self.actor = 4
        invalid = [
            {"capacity": 1}, {"description": "a" * 401}, {"image_urls": []},
            {"owner_id": 4}, {"event_type": "global"}, {"photo_key": foreign_key},
            {"photo_key": "event/" + "a" * 32 + ".jpg"}, {"photo_key": None},
            {"photo_key": "https://example.test/photo.jpg"},
            {"expires_at": (social.now() - timedelta(seconds=1)).isoformat()},
            {"starts_at": "2026-10-01T12:00:00"}, {"expires_at": self.regular_update()["starts_at"]},
        ]
        for update in invalid:
            with self.subTest(update=update):
                result = self.request("PUT", f"/admin/events/{event_id}", json=self.regular_update(**update))
                self.assertEqual(result.status_code, 422, result.text)
        self.assertEqual(self.request("PUT", f"/admin/events/{event_id}", json=self.regular_update(
            photo_key=used_key)).status_code, 409)
        missing_capacity = self.regular_update()
        del missing_capacity["capacity"]
        self.assertEqual(self.request("PUT", f"/admin/events/{event_id}", json=missing_capacity).status_code, 422)
        with self.Session() as db:
            row = db.get(models.SocialEvent, event_id)
            self.assertEqual(row.owner_id, 1)
            self.assertEqual(row.capacity, 3)

    def test_admin_deletes_regular_and_global_events_with_cascade(self):
        event_id = self.create()
        self.actor = 2
        join_id = self.request("POST", f"/events/{event_id}/join").json()["id"]
        self.request("POST", f"/events/{event_id}/report", json={"category": "spam"})
        self.request("POST", f"/events/{event_id}/cheer")
        self.actor = 1
        self.request("POST", f"/events/{event_id}/join-requests/{join_id}/accept")
        self.request("POST", f"/events/{event_id}/chat", json={"body": "Hello"})
        self.actor = 4
        global_id = self.request("POST", "/events/global", json=self.global_payload()).json()["id"]
        self.request("POST", f"/events/{global_id}/chat", json={"body": "Welcome"})
        with self.Session() as db:
            key = db.get(models.SocialEvent, event_id).photo_key
        for deleted_id in (event_id, global_id):
            response = self.request("DELETE", f"/admin/events/{deleted_id}")
            self.assertEqual(response.status_code, 204, response.text)
            self.assertEqual(response.content, b"")
            self.assertEqual(self.request("DELETE", f"/admin/events/{deleted_id}").status_code, 404)
            self.assertEqual(self.request("PUT", f"/admin/events/{deleted_id}", json=self.regular_update()).status_code, 404)
        with self.Session() as db:
            for model in (models.SocialTag, models.SocialJoinRequest, models.SocialChatMessage,
                          models.SocialCheer, models.SocialReport):
                self.assertEqual(db.query(model).filter(model.event_id.in_((event_id, global_id))).count(), 0)
            self.assertIsNotNone(db.get(models.SocialMedia, key))

    def test_admin_edit_delete_forbidden_to_tester_and_unauthenticated(self):
        event_id = self.create()
        self.actor = 4
        global_id = self.request("POST", "/events/global", json=self.global_payload()).json()["id"]
        with patch.dict(os.environ, {"SOCIAL_EVENTS_ENABLED": "true", "ADMIN_TELEGRAM_ID": "4"}):
            for actor in (1, 369764930):
                self.actor = actor
                for event in (event_id, global_id):
                    self.assertEqual(self.request("PUT", f"/admin/events/{event}",
                                                  json=self.regular_update()).status_code, 403)
                    self.assertEqual(self.request("DELETE", f"/admin/events/{event}").status_code, 403)
            main.app.dependency_overrides.pop(main.get_authenticated_telegram_user)
            self.assertEqual(self.request("DELETE", f"/admin/events/{event_id}").status_code, 401)
            self.assertEqual(self.request("PUT", f"/admin/events/{global_id}",
                                          json=self.global_payload()).status_code, 401)
            main.app.dependency_overrides[main.get_authenticated_telegram_user] = self.current_user
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{event_id}").status_code, 200)
        self.actor = 369764930
        with patch.dict(os.environ, {"SOCIAL_EVENTS_ENABLED": "false", "ADMIN_TELEGRAM_ID": "4"}):
            self.assertEqual(self.request("DELETE", f"/admin/events/{event_id}").status_code, 403)
            self.assertEqual(self.request("PUT", f"/admin/events/{event_id}",
                                          json=self.regular_update()).status_code, 403)

    def test_any_authenticated_adult_can_create_regular_but_not_global_events(self):
        with patch.dict(os.environ, {"SOCIAL_EVENTS_ENABLED": "false", "ADMIN_TELEGRAM_ID": "4"}):
            self.actor = 2
            self.assertEqual(self.request("GET", "/profile").status_code, 200)

            self.actor = 369764930
            self.assertEqual(self.request("PUT", "/profile", json={
                "display_name": "Map user", "age": 21,
            }).status_code, 200)
            event_id = self.create()
            self.assertEqual(self.request("GET", f"/events/{event_id}").status_code, 200)
            self.assertIn(event_id, [event["id"] for event in self.request("GET", "/events").json()])
            self.assertEqual(self.request("POST", "/events/global", json=self.global_payload()).status_code, 403)
            self.assertEqual(self.request("GET", "/admin/reports").status_code, 403)

            self.actor = 4
            self.assertEqual(self.request("GET", "/profile").status_code, 200)

    def test_global_admin_only_and_regular_event_regression(self):
        payload = self.global_payload()
        self.assertEqual(self.request("POST", "/events/global", json=payload).status_code, 403)
        main.app.dependency_overrides.pop(main.get_authenticated_telegram_user)
        self.assertEqual(self.request("POST", "/events/global", json=payload).status_code, 401)
        main.app.dependency_overrides[main.get_authenticated_telegram_user] = self.current_user
        self.actor = 4
        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "4", "SOCIAL_EVENTS_ENABLED": "false"}):
            result = self.request("POST", "/events/global", json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        created = result.json()
        event_id = created["id"]
        self.assertEqual(created["event_type"], "global")
        self.assertEqual(created["image_urls"], payload["image_urls"])
        self.assertEqual(created["photo_url"], payload["image_urls"][0])
        self.signed_client.assert_not_called()
        self.assertEqual(created["attendee_count"], 0)
        self.assertEqual(created["attendees"], [])
        self.assertIsNone(created["join_status"])
        with self.Session() as db:
            event = db.get(models.SocialEvent, event_id)
            self.assertIsNone(event.photo_key)
            self.assertEqual(event.owner_id, 4)
            self.assertEqual(event.image_urls, payload["image_urls"])
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{event_id}").json()["photo_url"], payload["image_urls"][0])
        self.assertIn(event_id, [e["id"] for e in self.request("GET", "/events").json()])
        regular = self.create()
        details = self.request("GET", f"/events/{regular}").json()
        self.assertEqual(details["event_type"], "regular")
        self.assertEqual(details["image_urls"], [])
        self.assertEqual(details["photo_url"], "https://example.test/signed-image")
        self.assertEqual(details["attendee_count"], 1)
        self.assertEqual(details["join_status"], "host")
        self.actor = 2
        injected = self.request("POST", "/events", json={
            "description": "Coffee", "drink": "coffee", "visibility": "public",
            "latitude": 34.77, "longitude": 32.42, "location": "Paphos",
            "start": "now", "ttl": "1h", "photo_key": self.uploaded_photo(),
            "event_type": "global", "image_urls": ["https://images.example.test/other.jpg"],
        })
        self.assertEqual(injected.status_code, 201, injected.text)
        self.assertEqual(injected.json()["event_type"], "regular")
        self.assertIsNotNone(injected.json()["photo_url"])

    def test_global_validation(self):
        self.actor = 4
        payload = self.global_payload()
        invalid = [
            {"image_urls": []}, {"image_urls": ["https://images.example.test/1"] * 6},
            *({"image_urls": [url]} for url in (
                "http://images.example.test/a", "javascript:alert(1)", "data:image/png;base64,abcd",
                "//images.example.test/a", "https://", "https://user:password@images.example.test/a",
                "https://images.example.test\\@evil.test/a", "https://images.example.test:bad/a",
                "https://images.example.test/a\n", "https://images.example.test/" + "a" * 2049,
            )),
            {"starts_at": "2026-10-01T12:00:00"},
            {"starts_at": "1234567890"},
            {"expires_at": "2026-10-01T12:00:00"},
            {"expires_at": (social.now() - timedelta(seconds=1)).isoformat()},
            {"expires_at": payload["starts_at"]},
            {"starts_at": 1234567890},
            {"description": "a" * 5001},
            {"latitude": 37}, {"longitude": 31}, {"drink": "soda"},
            {"visibility": "secret"}, {"location": ""},
        ]
        for update in invalid:
            with self.subTest(update=update):
                response = self.request("POST", "/events/global", json={**payload, **update})
                self.assertEqual(response.status_code, 422, response.text)
        with self.Session() as db:
            self.assertEqual(db.query(models.SocialEvent).count(), 0)
        result = self.request("POST", "/events/global", json=self.global_payload(
            description="a" * 5000, image_urls=["https://images.example.test/one.jpg"],
        ))
        self.assertEqual(result.status_code, 201, result.text)

    def test_global_ongoing_and_upcoming_events_are_visible_and_chat_without_join(self):
        self.actor = 4
        ongoing = self.request("POST", "/events/global", json=self.global_payload(
            starts_at=(social.now() - timedelta(hours=1)).isoformat(),
            expires_at=(social.now() + timedelta(hours=1)).isoformat(),
        ))
        self.assertEqual(ongoing.status_code, 201, ongoing.text)
        upcoming = self.request("POST", "/events/global", json=self.global_payload())
        self.assertEqual(upcoming.status_code, 201, upcoming.text)
        self.actor = 1
        listed = {event["id"] for event in self.request("GET", "/events").json()}
        for event_id in (ongoing.json()["id"], upcoming.json()["id"]):
            with self.subTest(event_id=event_id):
                self.assertIn(event_id, listed)
                self.assertEqual(self.request("GET", f"/events/{event_id}").status_code, 200)
                self.assertEqual(self.request("GET", f"/events/{event_id}/chat").status_code, 200)
                self.assertEqual(self.request("POST", f"/events/{event_id}/chat",
                                              json={"body": "Hello"}).status_code, 200)
                with self.Session() as db:
                    self.assertIsNone(db.query(models.SocialJoinRequest).filter_by(
                        event_id=event_id, telegram_id=1).first())

    def test_global_chat_visibility_block_and_moderation(self):
        self.actor = 4
        event = self.request("POST", "/events/global", json=self.global_payload()).json()["id"]
        self.actor = 5
        self.assertEqual(self.request("GET", f"/events/{event}/chat").status_code, 403)
        self.assertEqual(self.request("POST", f"/events/{event}/chat",
                                      json={"body": "Hello"}).status_code, 403)
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{event}/chat").json(), [])
        self.assertEqual(self.request("POST", f"/events/{event}/join").status_code, 403)
        self.assertEqual(self.request("POST", f"/events/{event}/chat", json={"body": "Hello"}).status_code, 200)
        self.assertEqual(self.request("POST", f"/events/{event}/report",
                                      json={"category": "spam"}).status_code, 200)
        self.actor = 2
        self.assertEqual(self.request("GET", f"/events/{event}/chat").json()[0]["body"], "Hello")
        self.assertEqual(self.request("POST", f"/events/{event}/chat", json={"body": "Hi"}).status_code, 200)
        self.assertEqual(self.request("POST", f"/events/{event}/block").status_code, 200)
        self.assertEqual(self.request("GET", f"/events/{event}").status_code, 404)
        self.assertEqual(self.request("GET", f"/events/{event}/chat").status_code, 404)
        self.assertEqual(self.request("POST", f"/events/{event}/chat", json={"body": "No"}).status_code, 404)
        self.actor = 4
        self.assertEqual(self.request("GET", f"/events/{event}/join-requests").status_code, 403)
        self.assertEqual(self.request("GET", "/admin/reports").json()[0]["photo_url"],
                         self.global_payload()["image_urls"][0])
        self.assertEqual(self.request("GET", f"/admin/events/{event}").json()["photo_url"],
                         self.global_payload()["image_urls"][0])
        self.assertEqual(self.request("POST", f"/admin/events/{event}/hide").status_code, 200)
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{event}").status_code, 404)
        self.assertEqual(self.request("GET", f"/events/{event}/chat").status_code, 404)
        self.assertEqual(self.request("GET", "/events").json(), [])
        self.actor = 4
        second = self.request("POST", "/events/global", json=self.global_payload()).json()["id"]
        with self.Session() as db:
            db.get(models.SocialEvent, second).expires_at = social.now() - timedelta(seconds=1)
            db.commit()
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{second}").status_code, 404)
        self.assertEqual(self.request("GET", f"/events/{second}/chat").status_code, 404)
        self.assertEqual(self.request("GET", "/events").json(), [])

    def test_global_visibility_friends_and_anonymous(self):
        self.actor = 4
        friend_event = self.request("POST", "/events/global", json=self.global_payload(
            visibility="friends")).json()["id"]
        anonymous_event = self.request("POST", "/events/global", json=self.global_payload(
            visibility="anonymous")).json()["id"]
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{friend_event}").status_code, 404)
        self.assertIsNone(self.request("GET", f"/events/{anonymous_event}").json()["owner"])
        self.assertEqual(self.request("POST", f"/events/{anonymous_event}/chat",
                                      json={"body": "Hello"}).status_code, 200)
        req = self.request("POST", "/friend-requests", json={"telegram_id": 4}).json()["id"]
        self.actor = 4
        self.request("POST", f"/friend-requests/{req}/accept")
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{friend_event}").status_code, 200)
        self.assertEqual(self.request("GET", f"/events/{friend_event}/chat").status_code, 200)

    def test_map_markers_are_minimal_and_match_event_detail_visibility(self):
        self.actor = 4
        global_id = self.request("POST", "/events/global", json=self.global_payload()).json()["id"]
        friend_id = self.request("POST", "/events/global", json=self.global_payload(
            visibility="friends")).json()["id"]
        anonymous_id = self.request("POST", "/events/global", json=self.global_payload(
            visibility="anonymous")).json()["id"]
        self.actor = 1
        regular_id = self.create()
        self.actor = 2
        result = self.request("GET", "/events/map")
        self.assertEqual(result.status_code, 200, result.text)
        markers = {item["id"]: item for item in result.json()}
        self.assertEqual(set(markers), {global_id, anonymous_id, regular_id})
        self.assertEqual(set(markers[global_id]), {
            "id", "latitude", "longitude", "event_type", "expires_at",
            "starts_at", "drink", "image_url",
        })
        self.assertEqual(markers[global_id]["image_url"], self.global_payload()["image_urls"][0])
        self.assertIsNone(markers[regular_id]["image_url"])
        self.assertEqual(markers[global_id]["event_type"], "global")
        self.assertEqual(markers[regular_id]["event_type"], "regular")
        self.assertEqual(self.request("GET", f"/events/{global_id}").json()["description"], "A global tasting")
        invite = self.request("POST", "/friend-requests", json={"telegram_id": 4}).json()["id"]
        self.actor = 4
        self.request("POST", f"/friend-requests/{invite}/accept")
        self.assertIn(friend_id, {e["id"] for e in self.request("GET", "/events/map").json()})
        self.actor = 2
        self.assertIn(friend_id, {e["id"] for e in self.request("GET", "/events/map").json()})
        with self.Session() as db:
            db.get(models.SocialEvent, global_id).expires_at = social.now() - timedelta(seconds=1)
            db.get(models.SocialEvent, anonymous_id).hidden = True
            db.commit()
        self.assertEqual({e["id"] for e in self.request("GET", "/events/map").json()},
                         {friend_id, regular_id})
        self.request("POST", "/blocks", json={"telegram_id": 4})
        self.assertEqual({e["id"] for e in self.request("GET", "/events/map").json()}, {regular_id})
        self.actor = 4
        self.request("POST", "/blocks", json={"telegram_id": 1})
        self.assertNotIn(regular_id, {e["id"] for e in self.request("GET", "/events/map").json()})
        self.actor = 1
        with self.Session() as db:
            db.get(models.SocialEvent, regular_id).hidden = True
            db.commit()
        self.actor = 2
        self.assertEqual(self.request("GET", "/events/map").json(), [])

    def test_map_markers_require_adult_auth_and_do_not_query_per_event(self):
        self.actor = 5
        self.assertEqual(self.request("GET", "/events/map").status_code, 403)
        self.actor = 1
        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "1"}):
            ids = [self.create() for _ in range(3)]
        self.actor = 2
        self.signed_client.reset_mock()
        queries = []
        def count_queries(connection, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith("SELECT"):
                queries.append(statement)
        sqlalchemy_event.listen(self.engine, "before_cursor_execute", count_queries)
        try:
            self.assertEqual({e["id"] for e in self.request("GET", "/events/map").json()}, set(ids))
        finally:
            sqlalchemy_event.remove(self.engine, "before_cursor_execute", count_queries)
        self.assertLessEqual(len(queries), 3)
        self.signed_client.assert_not_called()
        with patch.dict(os.environ, {"SOCIAL_EVENTS_ENABLED": "false"}):
            self.assertEqual(self.request("GET", "/events/map").status_code, 200)
        main.app.dependency_overrides[main.get_authenticated_telegram_user] = lambda: (
            (_ for _ in ()).throw(main.HTTPException(401, "Unauthenticated"))
        )
        self.assertEqual(self.request("GET", "/events/map").status_code, 401)

    def test_auth_age_friendship_visibility_and_block(self):
        event = self.create("friends")
        self.actor = 2
        self.assertEqual(self.request("GET", f"/events/{event}").status_code, 404)
        self.assertEqual(self.request("GET", "/events").json(), [])
        invite = self.request("POST", "/friend-requests", json={"telegram_id": 1})
        self.assertEqual(invite.status_code, 200)
        self.actor = 1
        self.assertEqual(self.request("POST", f"/friend-requests/{invite.json()['id']}/accept").status_code, 200)
        self.actor = 2
        self.assertEqual(len(self.request("GET", "/events").json()), 1)
        self.assertIsNone(self.request("GET", f"/events/{event}").json()["owner"]["age"])
        self.assertEqual(self.request("GET", "/profile").json()["age"], 21)
        self.assertEqual(self.request("PUT", "/profile", json={
            "display_name": "Person2", "age": None,
        }).status_code, 422)
        self.assertEqual(self.request("POST", "/blocks", json={"telegram_id": 1}).status_code, 200)
        self.assertEqual(self.request("GET", "/events").json(), [])
        self.assertEqual(self.request("POST", f"/events/{event}/join").status_code, 404)
        self.assertEqual(self.request("GET", "/friends").json(), [])
        self.actor = 1
        self.assertEqual(self.request("GET", "/friends").json(), [])
        self.assertEqual(self.request("GET", f"/events/{event}/chat").status_code, 200)
        self.actor = 3
        self.assertEqual(self.request("PUT", "/profile", json={"display_name": "Young", "age": 17}).status_code, 422)

    def test_age_required_once_and_admin_can_remain_without_age(self):
        self.actor = 5
        self.assertIsNone(self.request("GET", "/profile").json()["age"])
        self.assertEqual(self.request("GET", "/events").status_code, 403)
        self.assertEqual(self.request("PUT", "/profile", json={
            "display_name": "Person5", "age": 18,
        }).status_code, 200)
        self.assertEqual(self.request("GET", "/events").status_code, 200)
        self.assertEqual(self.request("GET", "/profile").json()["age"], 18)
        self.actor = 4
        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "4"}):
            self.assertEqual(self.request("PUT", "/profile", json={
                "display_name": "Admin", "age": None,
            }).status_code, 200)
            self.assertEqual(self.request("GET", "/events").status_code, 200)

    def test_profile_avatar_omission_preserves_and_explicit_null_clears(self):
        avatar_key = f"avatar/{uuid4().hex}.jpg"
        with self.Session() as db:
            db.add(models.SocialMedia(key=avatar_key, owner_id=1, kind="avatar"))
            db.commit()
        avatar = self.request("PUT", "/profile", json={
            "display_name": "Person1", "age": 21, "avatar_key": avatar_key,
        })
        self.assertEqual(avatar.status_code, 200, avatar.text)
        self.assertIsNotNone(avatar.json()["avatar_url"])
        self.actor = 4
        self.assertTrue(self.request("POST", "/admin/profiles/1/verify",
                                     json={"verified": True}).json()["verified"])
        self.actor = 1
        unchanged = self.request("PUT", "/profile", json={
            "display_name": "Person1", "age": 21,
        }).json()
        self.assertTrue(unchanged["verified"])
        self.assertIsNotNone(unchanged["avatar_url"])
        renamed = self.request("PUT", "/profile", json={
            "display_name": "Updated", "age": 21,
        }).json()
        self.assertFalse(renamed["verified"])
        self.assertIsNotNone(renamed["avatar_url"])
        with self.Session() as db:
            self.assertEqual(db.get(models.SocialProfile, 1).avatar_key, avatar_key)
        self.actor = 4
        self.request("POST", "/admin/profiles/1/verify", json={"verified": True})
        self.actor = 1
        cleared = self.request("PUT", "/profile", json={
            "display_name": "Updated", "age": 21, "avatar_key": None,
        }).json()
        self.assertIsNone(cleared["avatar_url"])
        self.assertFalse(cleared["verified"])
        with self.Session() as db:
            self.assertIsNone(db.get(models.SocialProfile, 1).avatar_key)

    def test_profile_avatar_removal_overrides_telegram_fallback_and_upload_restores(self):
        self.assertFalse(self.request("GET", "/profile").json()["avatar_hidden"])
        avatar_key = f"avatar/{uuid4().hex}.jpg"
        with self.Session() as db:
            db.add(models.SocialMedia(key=avatar_key, owner_id=1, kind="avatar"))
            db.commit()
        self.assertEqual(self.request("PUT", "/profile", json={
            "display_name": "Person1", "age": 21, "avatar_key": avatar_key,
        }).status_code, 200)
        removed = self.request("PUT", "/profile", json={
            "display_name": "Person1", "age": 21, "avatar_key": None, "avatar_hidden": True,
        })
        self.assertEqual(removed.status_code, 200, removed.text)
        self.assertTrue(removed.json()["avatar_hidden"])
        self.assertIsNone(removed.json()["avatar_url"])
        self.assertTrue(self.request("GET", "/profile").json()["avatar_hidden"])
        with self.Session() as db:
            self.assertIsNone(db.get(models.SocialProfile, 1).avatar_key)
        self.assertEqual(self.request("PUT", "/profile", json={
            "display_name": "Person1", "age": 21, "avatar_hidden": True, "avatar_key": avatar_key,
        }).status_code, 422)
        restored = self.request("PUT", "/profile", json={
            "display_name": "Person1", "age": 21, "avatar_key": avatar_key,
        })
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertFalse(restored.json()["avatar_hidden"])
        self.assertIsNotNone(restored.json()["avatar_url"])

    def test_anonymous_join_capacity_chat_expiry_report(self):
        event = self.create("anonymous")
        self.actor = 2
        detail = self.request("GET", f"/events/{event}").json()
        self.assertIsNone(detail["owner"])
        self.assertEqual(detail["attendees"], [])
        self.assertNotIn('"age":21', str(detail).replace(" ", ""))
        self.assertTrue(detail["expires_at"].endswith("+00:00"))
        self.assertTrue(detail["starts_at"].endswith("+00:00"))
        self.assertNotIn("Person1", str(detail))
        self.assertEqual(self.request("GET", f"/events/{event}/chat").status_code, 403)
        join = self.request("POST", f"/events/{event}/join").json()["id"]
        self.actor = 3
        second = self.request("POST", f"/events/{event}/join").json()["id"]
        self.actor = 1
        self.assertEqual(self.request("POST", f"/events/{event}/join-requests/{join}/accept").status_code, 200)
        self.assertEqual(self.request("POST", f"/events/{event}/join-requests/{second}/accept").status_code, 409)
        self.assertEqual(self.request("POST", f"/events/{event}/chat", json={"body": "Welcome"}).status_code, 200)
        self.actor = 2
        chat = self.request("GET", f"/events/{event}/chat").json()
        self.assertIsNone(chat[0]["sender"])
        self.assertIsNone(self.request("GET", f"/events/{event}").json()["attendees"][0]["age"])
        self.assertEqual(self.request("POST", f"/events/{event}/report",
                                      json={"category": "false_location"}).status_code, 200)
        self.actor = 4
        self.assertEqual(self.request("GET", "/admin/reports").json()[0]["category"], "false_location")
        self.assertEqual(self.request("POST", "/admin/profiles/2/verify",
                                      json={"verified": True}).status_code, 200)
        self.actor = 2
        self.assertTrue(self.request("GET", "/profile").json()["verified"])
        self.assertFalse(self.request("PUT", "/profile", json={
            "display_name": "Changed", "age": 21,
        }).json()["verified"])
        self.actor = 4
        with self.Session() as db:
            row = db.get(models.SocialEvent, event)
            row.expires_at = social.now() - timedelta(seconds=1)
            db.commit()
        self.assertEqual(self.request("GET", f"/events/{event}").status_code, 404)
        self.assertEqual(self.request("GET", f"/events/{event}/chat").status_code, 404)

    def test_event_block_does_not_reveal_anonymous_owner(self):
        event = self.create("anonymous")
        self.assertEqual(self.request("POST", f"/events/{event}/block").status_code, 403)
        self.actor = 2
        detail = self.request("GET", f"/events/{event}")
        self.assertEqual(detail.headers["Cache-Control"], "private, no-store")
        self.assertIsNone(detail.json()["owner"])
        response = self.request("POST", f"/events/{event}/block")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"status": "blocked"})
        rows = self.request("GET", "/blocks").json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(set(rows[0]), {"id"})
        self.assertNotIn("telegram_id", str(rows))
        self.assertEqual(self.request("GET", f"/events/{event}").status_code, 404)
        self.assertEqual(self.request("GET", "/events").json(), [])
        self.assertEqual(self.request("POST", f"/events/{event}/chat", json={"body": "Hi"}).status_code, 404)
        self.actor = 1
        self.assertEqual(self.request("GET", "/friends").json(), [])
        self.actor = 2
        self.assertEqual(self.request("DELETE", f"/blocks/{rows[0]['id']}").status_code, 200)
        self.assertEqual(self.request("GET", f"/events/{event}").status_code, 200)

    def test_admin_hides_event_and_resolves_report_even_with_flag_off(self):
        event = self.create("anonymous")
        self.actor = 2
        report = self.request("POST", f"/events/{event}/report",
                              json={"category": "inappropriate"})
        self.assertEqual(report.status_code, 200, report.text)
        self.actor = 4
        with patch.dict(os.environ, {"SOCIAL_EVENTS_ENABLED": "false", "ADMIN_TELEGRAM_ID": "4"}):
            reports = self.request("GET", "/admin/reports").json()
            report_id = reports[0]["id"]
            self.assertEqual(reports[0]["status"], "open")
            self.assertFalse(reports[0]["hidden"])
            self.assertEqual(self.request("GET", f"/admin/events/{event}").json()["owner"]["telegram_id"], 1)
            self.assertEqual(self.request("POST", f"/admin/events/{event}/hide").json(),
                             {"id": event, "hidden": True})
            self.assertEqual(self.request("POST", f"/admin/reports/{report_id}/resolve").json(),
                             {"id": report_id, "status": "resolved"})
            self.assertTrue(self.request("GET", "/admin/reports").json()[0]["hidden"])
            self.assertEqual(self.request("GET", "/admin/reports").json()[0]["resolved_by"], 4)
            self.assertTrue(self.request("GET", f"/admin/events/{event}").json()["hidden"])
            self.assertEqual(self.request("GET", f"/events/{event}").status_code, 404)
            self.actor = 1
            self.assertEqual(self.request("GET", "/events").status_code, 200)
            self.actor = 2
            self.assertEqual(self.request("POST", f"/events/{event}/block").status_code, 404)
            self.assertEqual(self.request("POST", "/media?kind=event",
                                          content=b"invalid").status_code, 422)
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{event}").status_code, 404)
        self.assertEqual(self.request("GET", "/events").json(), [])
        self.assertEqual(self.request("GET", f"/events/{event}/chat").status_code, 404)
        self.actor = 2
        self.assertEqual(self.request("GET", f"/events/{event}").status_code, 404)
        self.assertEqual(self.request("POST", f"/events/{event}/join").status_code, 404)
        self.assertEqual(self.request("POST", f"/events/{event}/report",
                                      json={"category": "spam"}).status_code, 404)
        self.assertEqual(self.request("POST", f"/events/{event}/block").status_code, 404)
        self.assertEqual(self.request("GET", f"/admin/events/{event}").status_code, 403)
        self.assertEqual(self.request("POST", f"/admin/events/{event}/hide").status_code, 403)
        self.assertEqual(self.request("POST", f"/admin/reports/{report_id}/resolve").status_code, 403)

    def test_media_rejects_unowned_keys_and_malformed_images(self):
        self.assertEqual(self.request("POST", "/media?kind=event", content=b"not an image").status_code, 422)
        missing_photo = {
            "description": "A", "drink": "beer", "visibility": "public",
            "latitude": 34.77, "longitude": 32.42, "location": "Paphos",
            "capacity": 2, "start": "now", "ttl": "1h",
        }
        self.assertEqual(self.request("POST", "/events", json=missing_photo).status_code, 422)
        self.assertEqual(self.request("POST", "/events", json={
            **missing_photo, "photo_key": "",
        }).status_code, 422)
        self.assertEqual(self.request("POST", "/events", json={
            **{k: v for k, v in missing_photo.items() if k != "location"},
            "photo_key": self.uploaded_photo(),
        }).status_code, 422)
        key = self.uploaded_photo()
        self.assertEqual(self.request("POST", "/events", json={
            **missing_photo, "photo_key": key, "description": "a" * 401,
        }).status_code, 422)
        created = self.request("POST", "/events", json={
            **missing_photo, "photo_key": key, "description": "a" * 400,
        })
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(self.request("POST", "/events", json={
            **missing_photo, "photo_key": key,
        }).status_code, 409)
        with self.Session() as db:
            foreign_key = f"event/{uuid4().hex}.jpg"
            db.add(models.SocialMedia(key=foreign_key, owner_id=2, kind="event"))
            db.commit()
        self.assertEqual(self.request("POST", "/events", json={
            "description": "A", "drink": "beer", "visibility": "public",
            "latitude": 34.77, "longitude": 32.42, "location": "Paphos",
            "capacity": 2, "start": "now", "ttl": "1h", "photo_key": "https://evil.test/image.jpg",
        }).status_code, 422)
        self.assertEqual(self.request("POST", "/events", json={
            "description": "A", "drink": "beer", "visibility": "public",
            "latitude": 34.77, "longitude": 32.42, "location": "Paphos",
            "capacity": 2, "start": "now", "ttl": "1h", "photo_key": foreign_key,
        }).status_code, 422)
        self.actor = 2
        self.assertEqual(self.request("GET", "/admin/reports").status_code, 403)

    def test_unlimited_capacity_accepts_multiple_attendees(self):
        photo_key = self.uploaded_photo()
        response = self.request("POST", "/events", json={
            "description": "Coffee in Paphos", "drink": "coffee", "visibility": "public",
            "latitude": 34.77, "longitude": 32.42, "location": "Paphos",
            "photo_key": photo_key, "capacity": None, "start": "now", "ttl": "1h",
        })
        self.assertEqual(response.status_code, 201, response.text)
        self.assertIsNone(response.json()["capacity"])
        event = response.json()["id"]
        ids = []
        for person in (2, 3, 4):
            self.actor = person
            ids.append(self.request("POST", f"/events/{event}/join").json()["id"])
        self.actor = 1
        for join_id in ids:
            self.assertEqual(
                self.request("POST", f"/events/{event}/join-requests/{join_id}/accept").status_code,
                200,
            )
        self.assertEqual(self.request("GET", f"/events/{event}").json()["attendee_count"], 4)

    def test_visible_event_before_three_hundred_invisible_events_is_listed(self):
        event = self.create()
        start = social.now()
        with self.Session() as db:
            db.add_all(models.SocialEvent(
                owner_id=3, description="Friends only", drink="coffee", visibility="friends",
                latitude=34.77, longitude=32.42, location="Paphos",
                photo_key=f"event/{uuid4().hex}.jpg", starts_at=start,
                expires_at=start + timedelta(hours=1), capacity=2,
            ) for _ in range(301))
            db.commit()
        self.actor = 2
        listed = self.request("GET", "/events")
        self.assertEqual(listed.status_code, 200, listed.text)
        self.assertEqual([item["id"] for item in listed.json()], [event])

    def test_blocked_attendee_loses_seat_and_chat_even_after_unblock(self):
        event = self.create(capacity=2)
        self.actor = 2
        join_id = self.request("POST", f"/events/{event}/join").json()["id"]
        self.actor = 1
        self.assertEqual(self.request(
            "POST", f"/events/{event}/join-requests/{join_id}/accept").status_code, 200)
        self.assertEqual(self.request("GET", f"/events/{event}").json()["attendee_count"], 2)
        self.assertEqual(self.request("POST", "/blocks", json={"telegram_id": 2}).status_code, 200)
        self.assertEqual(self.request("GET", f"/events/{event}").json()["attendee_count"], 1)
        self.actor = 3
        next_join = self.request("POST", f"/events/{event}/join").json()["id"]
        self.actor = 1
        self.assertEqual(self.request(
            "POST", f"/events/{event}/join-requests/{next_join}/accept").status_code, 200)
        block_id = self.request("GET", "/blocks").json()[0]["id"]
        self.request("DELETE", f"/blocks/{block_id}")
        self.actor = 2
        self.assertEqual(self.request("GET", f"/events/{event}").json()["join_status"], None)
        self.assertEqual(self.request("GET", f"/events/{event}/chat").status_code, 403)
        with self.Session() as db:
            self.assertIsNone(db.query(models.SocialJoinRequest).filter_by(
                event_id=event, telegram_id=2).first())

    def test_attendee_blocking_host_also_revokes_their_seat(self):
        event = self.create(capacity=2)
        self.actor = 2
        join_id = self.request("POST", f"/events/{event}/join").json()["id"]
        self.actor = 1
        self.request("POST", f"/events/{event}/join-requests/{join_id}/accept")
        self.actor = 2
        self.assertEqual(self.request("POST", f"/events/{event}/block").status_code, 200)
        self.request("DELETE", f"/blocks/{self.request('GET', '/blocks').json()[0]['id']}")
        self.assertEqual(self.request("GET", f"/events/{event}/chat").status_code, 403)
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{event}").json()["attendee_count"], 1)

    def test_legacy_media_keys_cannot_reveal_organizer_id(self):
        event = self.create("anonymous")
        with self.Session() as db:
            db.get(models.SocialEvent, event).photo_key = "1/event/legacy.jpg"
            db.get(models.SocialProfile, 1).avatar_key = "1/avatar/legacy.jpg"
            db.commit()
        self.signed_mock.stop()
        self.actor = 2
        detail = self.request("GET", f"/events/{event}")
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertIsNone(detail.json()["photo_url"])
        self.assertIsNone(detail.json()["owner"])
        self.assertNotIn("1/event/", detail.text)
        self.assertNotIn("1/avatar/", detail.text)

    def test_avatar_signed_url_uses_opaque_key_for_tagged_friend(self):
        image = io.BytesIO()
        Image.new("RGB", (2, 2)).save(image, "PNG")
        class StorageResponse:
            ok = True
            def __init__(self, url):
                self.url = url
            def raise_for_status(self):
                pass
            def json(self):
                if "/object/sign/" in self.url:
                    path = self.url.split("/object/sign/", 1)[1]
                    return {"signedURL": f"/object/sign/{path}?token=short"}
                return {}
        env = {"SUPABASE_URL": "https://example.supabase.co",
               "SUPABASE_SERVICE_ROLE_KEY": "fake-test-key",
               "SUPABASE_SOCIAL_BUCKET": "social"}
        self.signed_mock.stop()
        with patch.dict(os.environ, env), patch.object(social.requests, "post",
                  side_effect=lambda url, **kwargs: StorageResponse(url)):
            self.actor = 2
            avatar = self.request("POST", "/media?kind=avatar", content=image.getvalue())
            self.assertEqual(avatar.status_code, 200, avatar.text)
            avatar_key = avatar.json()["key"]
            self.assertRegex(avatar_key, r"^avatar/[0-9a-f]{32}\.jpg$")
            self.assertNotIn("/2/", avatar_key)
            profile = self.request("PUT", "/profile", json={
                "display_name": "Person2", "age": 21, "avatar_key": avatar_key,
            }).json()
            self.assertIn(avatar_key, profile["avatar_url"])
            self.assertNotIn("/2/", profile["avatar_url"])
            self.actor = 1
            req = self.request("POST", "/friend-requests", json={"telegram_id": 2}).json()["id"]
            self.actor = 2
            self.request("POST", f"/friend-requests/{req}/accept")
            self.actor = 1
            event = self.create("anonymous", tagged=[2])
            self.assertEqual(self.request("GET", f"/events/{event}").json()["tagged_friends"], [])
            self.actor = 2
            self.assertEqual(self.request("GET", "/tag-requests").json()[0]["id"], event)
            self.assertEqual(self.request("POST", f"/events/{event}/tags/accept").json(),
                             {"status": "accepted"})
            self.actor = 1
            tagged = self.request("GET", f"/events/{event}").json()["tagged_friends"][0]
            self.assertEqual(tagged["telegram_id"], 2)
            self.assertIn(avatar_key, tagged["avatar_url"])
            self.assertNotIn("/2/", tagged["avatar_url"])
            self.actor = 3
            detail = self.request("GET", f"/events/{event}").json()
            self.assertIsNone(detail["owner"])
            self.assertEqual(detail["tagged_friends"], [])

    def test_auth_is_required_and_tags_are_mutual(self):
        main.app.dependency_overrides.pop(main.get_authenticated_telegram_user)
        self.assertEqual(self.request("GET", "/events").status_code, 401)
        main.app.dependency_overrides[main.get_authenticated_telegram_user] = self.current_user
        event_payload = {
            "description": "A", "drink": "beer", "visibility": "anonymous",
            "latitude": 34.77, "longitude": 32.42, "location": "Paphos",
            "capacity": 2, "start": "now", "ttl": "3h", "tagged_friend_ids": [2],
            "photo_key": self.uploaded_photo(),
        }
        self.assertEqual(self.request("POST", "/events", json=event_payload).status_code, 422)
        req = self.request("POST", "/friend-requests", json={"telegram_id": 2}).json()["id"]
        self.actor = 2
        self.assertEqual(self.request("POST", f"/friend-requests/{req}/accept").status_code, 200)
        self.actor = 1
        created = self.request("POST", "/events", json=event_payload)
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(created.json()["tagged_friends"], [])
        self.notify_client.assert_any_call(2, "Вас отметили в событии!")
        self.assertEqual(created.json()["notifications"], {"2": "not_configured"})

    def test_tag_consent_decline_unauthorized_blocked_expired_and_hidden(self):
        req = self.request("POST", "/friend-requests", json={"telegram_id": 2}).json()["id"]
        self.actor = 2
        self.request("POST", f"/friend-requests/{req}/accept")
        self.actor = 1
        accepted_event = self.create("anonymous", tagged=[2])
        self.assertEqual(self.request("GET", f"/events/{accepted_event}").json()["tagged_friends"], [])
        self.actor = 3
        self.assertEqual(self.request("POST", f"/events/{accepted_event}/tags/accept").status_code, 404)
        self.assertEqual(self.request("POST", f"/events/{accepted_event}/tags/decline").status_code, 404)
        self.assertEqual(self.request("GET", "/tag-requests").json(), [])
        self.actor = 2
        requests = self.request("GET", "/tag-requests").json()
        self.assertEqual(len(requests), 1)
        self.assertEqual(set(requests[0]), {"id", "location", "owner", "starts_at", "expires_at"})
        self.assertEqual(requests[0]["id"], accepted_event)
        self.assertIsNone(requests[0]["owner"])
        self.assertEqual(self.request("GET", f"/events/{accepted_event}").json()["tagged_friends"], [])
        self.assertEqual(self.request("POST", f"/events/{accepted_event}/tags/accept").json(),
                         {"status": "accepted"})
        self.assertEqual(self.request("GET", "/tag-requests").json(), [])
        self.assertEqual(self.request("GET", f"/events/{accepted_event}").json()["tagged_friends"][0]["telegram_id"], 2)
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{accepted_event}").json()["tagged_friends"][0]["telegram_id"], 2)

        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "1"}):
            declined_event = self.create("public", tagged=[2])
        self.actor = 2
        self.assertEqual(self.request("POST", f"/events/{declined_event}/tags/decline").json(),
                         {"status": "declined"})
        self.assertEqual(self.request("POST", f"/events/{declined_event}/tags/accept").status_code, 404)
        self.actor = 1
        self.assertEqual(self.request("GET", f"/events/{declined_event}").json()["tagged_friends"], [])

        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "1"}):
            expired_event = self.create("public", tagged=[2])
        with self.Session() as db:
            db.get(models.SocialEvent, expired_event).expires_at = social.now() - timedelta(seconds=1)
            db.commit()
        self.actor = 2
        self.assertEqual(self.request("GET", "/tag-requests").json(), [])
        self.assertEqual(self.request("POST", f"/events/{expired_event}/tags/accept").status_code, 404)

        self.actor = 1
        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "1"}):
            hidden_event = self.create("public", tagged=[2])
        self.actor = 4
        self.request("POST", f"/admin/events/{hidden_event}/hide")
        self.actor = 2
        self.assertEqual(self.request("GET", "/tag-requests").json(), [])
        self.assertEqual(self.request("POST", f"/events/{hidden_event}/tags/accept").status_code, 404)

        self.actor = 1
        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "1"}):
            blocked_event = self.create("public", tagged=[2])
        self.actor = 2
        self.assertEqual(self.request("POST", f"/events/{blocked_event}/block").status_code, 200)
        self.assertEqual(self.request("GET", "/tag-requests").json(), [])
        self.assertEqual(self.request("POST", f"/events/{blocked_event}/tags/accept").status_code, 404)
        with self.Session() as db:
            self.assertIsNone(db.get(models.SocialTag, (blocked_event, 2)))

    def test_tag_delivery_status_requires_telegram_confirmation(self):
        self.notify_mock.stop()
        class Reply:
            ok = True
            def __init__(self, accepted):
                self.accepted = accepted
            def json(self):
                return {"ok": self.accepted}
        with patch.dict(os.environ, {"BOT_TOKEN": "fake-test-token"}), patch.object(
            social.requests, "post", return_value=Reply(False)
        ) as send:
            self.assertEqual(social.notify(2, "Вас отметили в событии!"), "not_delivered")
            self.assertEqual(send.call_args.kwargs["json"], {
                "chat_id": 2, "text": "Вас отметили в событии!",
            })
            send.return_value = Reply(True)
            self.assertEqual(social.notify(2, "Вас отметили в событии!"), "sent")
        with patch.dict(os.environ, {"BOT_TOKEN": ""}):
            self.assertEqual(social.notify(2, "Вас отметили в событии!"), "not_configured")

    def test_social_access_is_authenticated_not_feature_flagged(self):
        event = self.create()
        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "4"}):
            os.environ.pop("SOCIAL_EVENTS_ENABLED", None)
            self.assertEqual(self.request("GET", "/events").status_code, 200)
            self.assertEqual(self.request("GET", f"/events/{event}").status_code, 200)
            self.assertEqual(self.request("GET", "/profile").status_code, 200)
            self.assertEqual(self.request("GET", "/admin/reports").status_code, 403)
            self.actor = 4
            with self.Session() as db:
                db.get(models.SocialProfile, 4).age = None
                db.commit()
            self.assertEqual(self.request("GET", "/events").status_code, 200)
            self.assertEqual(self.request("GET", "/profile").status_code, 200)
            self.assertEqual(self.request("GET", "/admin/reports").status_code, 200)
            self.actor = 1
            os.environ["SOCIAL_EVENTS_ENABLED"] = "false"
            self.assertEqual(self.request("GET", "/events").status_code, 200)
            os.environ["SOCIAL_EVENTS_ENABLED"] = "true"
            self.assertEqual(self.request("GET", "/events").status_code, 200)
            main.app.dependency_overrides.pop(main.get_authenticated_telegram_user)
            self.assertEqual(self.request("GET", "/events").status_code, 401)
            main.app.dependency_overrides[main.get_authenticated_telegram_user] = self.current_user

    def test_regular_event_limit_counts_hidden_until_expired_and_exempts_admin(self):
        self.assertEqual(self.request("GET", "/events/mine/active").json(), {"has_active_event": False})
        event_id = self.create()
        self.assertEqual(self.request("GET", "/events/mine/active").json(), {"has_active_event": True})
        first_photo = self.uploaded_photo()
        payload = {
            "description": "Another event", "drink": "coffee", "visibility": "public",
            "latitude": 34.77, "longitude": 32.42, "location": "Paphos",
            "capacity": 2, "start": "now", "ttl": "1h", "tagged_friend_ids": [],
            "photo_key": first_photo,
        }
        duplicate = self.request("POST", "/events", json=payload)
        self.assertEqual(duplicate.status_code, 409, duplicate.text)
        self.assertEqual(duplicate.json()["detail"], "Only one active event is allowed")
        self.actor = 4
        self.assertEqual(self.request("POST", "/events/global", json=self.global_payload()).status_code, 201)
        self.assertEqual(self.request("POST", "/admin/events/" + str(event_id) + "/hide").status_code, 200)
        self.actor = 1
        self.assertEqual(self.request("GET", "/events/mine/active").json(), {"has_active_event": True})
        self.assertEqual(self.request("POST", "/events", json=payload).status_code, 409)
        with self.Session() as db:
            db.get(models.SocialEvent, event_id).expires_at = social.now() - timedelta(seconds=1)
            db.commit()
        self.assertEqual(self.request("GET", "/events/mine/active").json(), {"has_active_event": False})
        self.assertEqual(self.request("POST", "/events", json=payload).status_code, 201)
        self.actor = 2
        self.assertEqual(self.request("GET", "/events/mine/active").json(), {"has_active_event": False})
        self.assertEqual(self.request("POST", "/events/global", json=self.global_payload()).status_code, 403)
        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "4"}):
            self.actor = 4
            self.assertEqual(self.request("GET", "/events/mine/active").json(), {"has_active_event": False})
            self.create()
            self.create()

    def test_media_upload_and_private_signed_event_url(self):
        image = io.BytesIO()
        Image.new("RGB", (2, 2), color="blue").save(image, "PNG")
        class Response:
            ok = True
            def raise_for_status(self):
                pass
            def json(self):
                return {"signedURL": "/object/sign/social/test?token=short"}
        env = {"SUPABASE_URL": "https://example.supabase.co",
               "SUPABASE_SERVICE_ROLE_KEY": "fake-test-key",
               "SUPABASE_SOCIAL_BUCKET": "social"}
        self.signed_mock.stop()
        with patch.dict(os.environ, env), patch.object(social.requests, "post", return_value=Response()) as mock_post:
            result = self.request("POST", "/media?kind=event",
                                  content=image.getvalue(), headers={"Content-Type": "application/octet-stream"})
            self.assertEqual(result.status_code, 200, result.text)
            key = result.json()["key"]
            self.assertRegex(key, r"^event/[0-9a-f]{32}\.jpg$")
            self.assertNotIn("/1/", key)
            event = self.request("POST", "/events", json={
                "description": "Coffee", "drink": "coffee", "visibility": "public",
                "latitude": 34.77, "longitude": 32.42, "location": "Paphos",
                "capacity": 2, "start": "20m", "ttl": "today", "photo_key": key,
            })
            self.assertEqual(event.status_code, 201, event.text)
            self.assertIn("?token=short", event.json()["photo_url"])
            self.assertNotIn("fake-test-key", str(event.json()))
            self.assertTrue(mock_post.call_args.kwargs["json"]["expiresIn"] <= 300)
            self.assertNotIn("/1/", mock_post.call_args.args[0])

    def test_uploaded_photo_is_at_most_one_megabyte(self):
        size = 1600
        noisy = Image.frombytes("RGB", (size, size), os.urandom(size * size * 3))
        image = io.BytesIO()
        noisy.save(image, "JPEG", quality=95)
        self.assertGreater(len(image.getvalue()), social.MAX_SOCIAL_IMAGE_BYTES)
        self.assertLess(len(image.getvalue()), 5 * 1024 * 1024)

        class Response:
            ok = True
            def raise_for_status(self):
                pass

        env = {"SUPABASE_URL": "https://example.supabase.co",
               "SUPABASE_SERVICE_ROLE_KEY": "fake-test-key",
               "SUPABASE_SOCIAL_BUCKET": "social"}
        with patch.dict(os.environ, env), patch.object(social.requests, "post", return_value=Response()) as mock_post:
            result = self.request("POST", "/media?kind=avatar", content=image.getvalue())
            self.assertEqual(result.status_code, 200, result.text)
            stored = mock_post.call_args.kwargs["data"]
            self.assertLessEqual(len(stored), social.MAX_SOCIAL_IMAGE_BYTES)
            with Image.open(io.BytesIO(stored)) as encoded:
                self.assertEqual(encoded.format, "JPEG")
                self.assertLessEqual(max(encoded.size), 1600)
        self.assertEqual(self.request("POST", "/media?kind=avatar",
                                      content=b"x" * (5 * 1024 * 1024 + 1)).status_code, 413)


if __name__ == "__main__":
    unittest.main()

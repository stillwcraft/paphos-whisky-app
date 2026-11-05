import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite://")

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from presentation import PresentationRoomRecord, create_presentation_router, write_record
from schemas.presentation import PresentationManifest


def authenticate(authorization=Header(default=None)):
    if authorization not in {"tma presenter", "tma viewer", "tma viewer2"}:
        raise HTTPException(401, "Invalid Telegram authentication")
    return SimpleNamespace(telegram_id={"tma presenter": 1, "tma viewer": 2, "tma viewer2": 3}[authorization])


def require_admin(user=Depends(authenticate)):
    if user.telegram_id != 1:
        raise HTTPException(403, "Admin access required")
    return user


MANIFEST = {
    "id": "demo",
    "slides": [
        {"id": "intro", "type": "static", "html": "<h1>Welcome</h1>"},
        {"id": "vote", "type": "poll", "question": {"en": "Pick one"},
         "options": [{"id": "a", "label": {"en": "A"}}, {"id": "b", "label": {"en": "B"}}],
         "answers": ["b"]},
        {"id": "words", "type": "word_cloud", "prompt": {"en": "Describe it"}},
        {"id": "secret", "type": "video", "title": {"en": "Secret reveal"},
         "video": {"url": "https://example.test/private-future.mp4"}},
    ],
}


class PresentationTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        PresentationRoomRecord.__table__.create(self.engine)
        self.patch = patch("presentation.SessionLocal", sessionmaker(bind=self.engine))
        self.patch.start()
        self.app = self.make_app()
        self.client = TestClient(self.app).__enter__()
        result = self.client.post("/api/presentations/rooms", json=MANIFEST, headers={"Authorization": "tma presenter"})
        self.assertEqual(result.status_code, 201, result.text)
        self.room_id = result.json()["room_id"]
        self.path = f"/api/presentations/rooms/{self.room_id}"

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.patch.stop()
        self.engine.dispose()

    def make_app(self):
        app = FastAPI()
        app.include_router(create_presentation_router(authenticate, require_admin))
        return app

    def connect(self, token):
        return self.client.websocket_connect(f"{self.path}/ws")

    def auth_socket(self, ws, token):
        ws.send_json({"type": "auth", "init_data": token})
        return ws.receive_json()

    def test_initial_http_and_ws_never_disclose_future(self):
        response = self.client.get(self.path, headers={"Authorization": "tma viewer"})
        self.assertEqual(response.headers["cache-control"], "private, no-store")
        state = response.json()
        self.assertEqual(list(state["slides"]), ["0"])
        self.assertNotIn("Secret reveal", response.text)
        self.assertNotIn("private-future", response.text)
        self.assertNotIn("answers", response.text)
        with self.connect("viewer") as ws:
            self.assertEqual(self.auth_socket(ws, "viewer"), state)

    def test_auth_and_admin_enforced(self):
        self.assertEqual(self.client.get(self.path).status_code, 401)
        self.assertEqual(self.client.post("/api/presentations/rooms", json=MANIFEST,
                                         headers={"Authorization": "tma viewer"}).status_code, 403)
        with self.connect("viewer") as ws:
            self.auth_socket(ws, "viewer")
            ws.send_json({"type": "advance", "index": 1})
            self.assertEqual(ws.receive_json()["type"], "error")
            ws.send_json({"type": "sync"})
            self.assertEqual(ws.receive_json()["max_unlocked_slide_index"], 0)
        with self.connect("invalid") as ws:
            ws.send_json({"type": "auth", "init_data": "invalid"})
            self.assertEqual(ws.receive_json()["type"], "error")
            with self.assertRaises(WebSocketDisconnect) as caught:
                ws.receive_json()
            self.assertEqual(caught.exception.code, 4001)

    def test_admin_list_is_private_paginated_and_excludes_other_owners(self):
        path = "/api/presentations/rooms"
        self.assertEqual(self.client.get(path).status_code, 401)
        self.assertEqual(self.client.get(path, headers={"Authorization": "tma viewer"}).status_code, 403)
        headers = {"Authorization": "tma presenter"}
        second = self.client.post(path, json=MANIFEST, headers=headers).json()["room_id"]
        write_record("f" * 32, {
            "manifest": MANIFEST, "presenter_id": 99, "current_slide_index": 0,
            "max_unlocked_slide_index": 0, "revision": 0, "responses": {},
        })
        response = self.client.get(path, headers=headers, params={"limit": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "private, no-store")
        page = response.json()
        self.assertEqual(page["total"], 2)
        self.assertEqual(page["limit"], 1)
        self.assertEqual(page["offset"], 0)
        self.assertTrue(page["has_more"])
        self.assertEqual(page["items"][0]["room_id"], max(self.room_id, second))
        self.assertEqual(set(page["items"][0]), {
            "room_id", "manifest_id", "title", "slide_count", "current_slide_index",
        })
        self.assertNotIn("answers", response.text)
        self.assertNotIn("private-future", response.text)
        next_page = self.client.get(path, headers=headers, params={"limit": 1, "offset": 1}).json()
        self.assertEqual(next_page["items"][0]["room_id"], min(self.room_id, second))
        self.assertFalse(next_page["has_more"])
        self.assertEqual(self.client.get(path, headers=headers, params={"limit": 51}).status_code, 422)
        self.assertEqual(self.client.get(path, headers=headers, params={"offset": -1}).status_code, 422)
        with TestClient(self.make_app()) as client:
            self.assertEqual(client.get(path, headers=headers).json()["total"], 2)

    def test_invalid_upload_is_rejected_without_creating_a_room(self):
        path = "/api/presentations/rooms"
        headers = {"Authorization": "tma presenter"}
        response = self.client.post(path, json={"id": "bad", "slides": []}, headers=headers)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get(path, headers=headers).json()["total"], 1)

    def test_progression_is_sequential_and_unlock_is_monotonic(self):
        with self.connect("presenter") as presenter, self.connect("viewer") as viewer:
            self.auth_socket(presenter, "presenter")
            self.auth_socket(viewer, "viewer")
            presenter.send_json({"type": "advance", "index": 2})
            self.assertEqual(presenter.receive_json()["type"], "error")
            presenter.send_json({"type": "advance", "index": 1})
            presenter.receive_json()
            state = viewer.receive_json()
            self.assertEqual(state["current_slide_index"], 1)
            self.assertEqual(list(state["slides"]), ["0", "1"])
            self.assertNotIn("answers", str(state))
            presenter.send_json({"type": "advance", "index": 0})
            presenter.receive_json()
            state = viewer.receive_json()
            self.assertEqual(state["current_slide_index"], 0)
            self.assertEqual(state["max_unlocked_slide_index"], 1)

    def test_votes_are_current_only_deduplicated_and_private(self):
        with self.connect("presenter") as presenter, self.connect("viewer") as viewer:
            self.auth_socket(presenter, "presenter")
            self.auth_socket(viewer, "viewer")
            viewer.send_json({"type": "vote", "slide_id": "vote", "option_id": "a"})
            self.assertEqual(viewer.receive_json()["type"], "error")
            presenter.send_json({"type": "advance", "index": 1})
            presenter.receive_json()
            viewer.receive_json()
            viewer.send_json({"type": "vote", "slide_id": "vote", "option_id": "bad"})
            self.assertEqual(viewer.receive_json()["type"], "error")
            viewer.send_json({"type": "vote", "slide_id": "vote", "option_id": "a"})
            presenter_state = presenter.receive_json()
            viewer_state = viewer.receive_json()
            self.assertIsNone(presenter_state["results"]["vote"]["own_vote"])
            self.assertEqual(viewer_state["results"]["vote"], {"counts": {"a": 1, "b": 0}, "own_vote": "a"})
            viewer.send_json({"type": "vote", "slide_id": "vote", "option_id": "b"})
            self.assertEqual(viewer.receive_json()["type"], "error")
            presenter.send_json({"type": "advance", "index": 0})
            presenter.receive_json()
            viewer.receive_json()
            viewer.send_json({"type": "vote", "slide_id": "vote", "option_id": "b"})
            self.assertEqual(viewer.receive_json()["type"], "error")

    def test_word_normalization_and_reconnection_persistence(self):
        with self.connect("presenter") as ws:
            self.auth_socket(ws, "presenter")
            for index in (1, 2):
                ws.send_json({"type": "advance", "index": index})
                ws.receive_json()
        with self.connect("viewer") as ws:
            self.assertEqual(self.auth_socket(ws, "viewer")["current_slide_index"], 2)
            ws.send_json({"type": "words", "slide_id": "words", "words": ["  ", "oak"]})
            self.assertEqual(ws.receive_json()["type"], "error")
            ws.send_json({"type": "words", "slide_id": "words", "words": ["Oak", "oak", "Fruit"]})
            state = ws.receive_json()
            self.assertEqual(state["results"]["words"]["counts"], {"oak": 1, "fruit": 1})
        # A fresh manager simulates a process restart, not merely reuse of an in-memory room.
        with TestClient(self.make_app()) as client:
            state = client.get(self.path, headers={"Authorization": "tma viewer"}).json()
            self.assertEqual(state["current_slide_index"], 2)
            self.assertEqual(state["revision"], 3)
            self.assertEqual(state["results"]["words"]["own_words"], ["oak", "fruit"])
            with client.websocket_connect(f"{self.path}/ws") as ws:
                self.assertEqual(self.auth_socket(ws, "viewer"), state)

    def test_closed_rooms_do_not_resurrect(self):
        self.assertEqual(self.client.delete(self.path, headers={"Authorization": "tma viewer"}).status_code, 403)
        with self.connect("viewer") as ws:
            self.auth_socket(ws, "viewer")
            self.assertEqual(self.client.delete(self.path, headers={"Authorization": "tma presenter"}).status_code, 204)
            with self.assertRaises(WebSocketDisconnect) as caught:
                ws.receive_json()
            self.assertEqual(caught.exception.code, 4004)
        self.assertEqual(self.client.get(self.path, headers={"Authorization": "tma viewer"}).status_code, 404)

    def test_malformed_commands_do_not_change_state(self):
        with self.connect("presenter") as ws:
            self.auth_socket(ws, "presenter")
            for command in [
                {"type": "advance", "index": True}, {"type": "advance", "index": -1},
                {"type": "advance", "index": 200}, {"type": "advance", "index": 1, "role": "presenter"},
                {"type": "unknown"},
            ]:
                ws.send_json(command)
                self.assertEqual(ws.receive_json()["type"], "error")
            ws.send_json({"type": "sync"})
            self.assertEqual(ws.receive_json()["revision"], 0)

    def test_manifest_rejects_duplicate_ids_unsafe_media_and_unknown_fields(self):
        PresentationManifest.model_validate(MANIFEST)
        invalid = [
            {"id": "bad", "slides": [MANIFEST["slides"][0], MANIFEST["slides"][0]]},
            {"id": "bad", "slides": [{"id": "s", "type": "video", "video": {"url": "javascript:alert(1)"}}]},
            {"id": "bad", "slides": [{"id": "s", "type": "static", "future_answers": "secret"}]},
        ]
        for manifest in invalid:
            with self.assertRaises(ValidationError):
                PresentationManifest.model_validate(manifest)


if __name__ == "__main__":
    unittest.main()

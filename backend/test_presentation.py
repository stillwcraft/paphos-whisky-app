import os
import unittest
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault("DATABASE_URL", "sqlite://")

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from presentation import (
    PresentationBroadcastRecord, PresentationRoomRecord, create_presentation_router,
    read_room_summaries, write_record,
)
from schemas.presentation import PresentationManifest, public_slide


PRESENTER_ID = 2 ** 33 + 123


def authenticate(authorization=Header(default=None)):
    if authorization not in {"tma presenter", "tma viewer", "tma viewer2"}:
        raise HTTPException(401, "Invalid Telegram authentication")
    return SimpleNamespace(telegram_id={"tma presenter": PRESENTER_ID, "tma viewer": 2, "tma viewer2": 3}[authorization])


def require_admin(user=Depends(authenticate)):
    if user.telegram_id != PRESENTER_ID:
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

AUTHORED_MANIFEST = {
    "id": "authored_demo",
    "title": {"ru": "Презентация", "en": "Presentation"},
    "theme": {
        "primaryColor": "#D4AF37", "backgroundColor": "#121212", "textColor": "#FFFFFF",
        "accentColor": "#8B0000", "fontFamily": "sans",
    },
    "slides": [
        {"id": "intro", "type": "static", "imageUrl": "https://example.test/intro.jpg",
         "animations": {"entry": "fade-up"}},
        {"id": "photos", "type": "gallery", "subtitle": {"ru": "Свайпайте вверх", "en": "Swipe up"},
         "photos": [{"url": "https://example.test/gallery.jpg", "caption": {"ru": "Подпись", "en": "Caption"}}],
         "animations": {"entry": "slide-left"}},
        {"id": "vote", "type": "poll", "question": {"en": "Pick one"},
         "options": [{"id": "a", "text": {"en": "A"}}, {"id": "b", "text": {"en": "B"}}],
         "allowMultiple": False, "showResultsLive": True, "answers": ["b"],
         "animations": {"entry": "zoom-in"}},
        {"id": "film", "type": "video", "videoUrl": "https://example.test/future.mp4",
         "loop": True, "autoPlayMuted": True, "animations": {"entry": "fade-up"}},
        {"id": "html", "type": "static", "contentHtml": {"ru": "<h1>Привет</h1>", "en": "<h1>Hello</h1>"},
         "interactiveHtml": True,
         "animations": {"entry": "zoom-in"}},
    ],
}

GALLERY_MANIFEST = {
    "id": "gallery_demo",
    "slides": [
        {"id": "intro", "type": "static", "html": "<h1>Welcome</h1>"},
        {"id": "photos", "type": "gallery", "photos": [
            {"url": f"https://example.test/photo-{i}.jpg"} for i in range(3)
        ]},
        {"id": "future_photos", "type": "gallery", "photos": [
            {"url": "https://example.test/future-photo.jpg"}
        ]},
    ],
}


class PresentationTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        PresentationRoomRecord.__table__.create(self.engine)
        PresentationBroadcastRecord.__table__.create(self.engine)
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

    def auth_socket(self, ws, token, broadcast_only=False):
        ws.send_json({"type": "auth", "init_data": token, "broadcast_only": broadcast_only})
        return ws.receive_json()

    def test_room_filter_uses_bigint_for_json_and_parameter_on_postgresql(self):
        db = MagicMock()
        query = db.query.return_value.filter.return_value
        query.count.return_value = 0
        query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
        with patch("presentation.SessionLocal") as sessions:
            sessions.return_value.__enter__.return_value = db
            self.assertEqual(read_room_summaries(PRESENTER_ID, 20, 0)["total"], 0)
        condition = db.query.return_value.filter.call_args.args[0]
        self.assertIsInstance(condition.left.type, BigInteger)
        self.assertIsInstance(condition.right.type, BigInteger)
        self.assertEqual(condition.right.value, PRESENTER_ID)
        for dialect in (postgresql.dialect(), postgresql.psycopg.dialect()):
            compiled = condition.compile(dialect=dialect)
            self.assertIn("AS BIGINT", str(compiled))
            self.assertNotIn("AS INTEGER", str(compiled))
            self.assertIsInstance(compiled.binds["presenter_id"].type, BigInteger)

    def test_broadcast_lifecycle_is_private_admin_only_and_relocks_on_restart(self):
        active_path = "/api/presentations/broadcast"
        broadcast_path = self.path + "/broadcast"
        presenter_headers = {"Authorization": "tma presenter"}
        viewer_headers = {"Authorization": "tma viewer"}
        self.assertEqual(self.client.get(active_path).status_code, 401)
        self.assertEqual(self.client.get(active_path, headers=viewer_headers).json(), {"room_id": None})
        self.assertEqual(self.client.post(broadcast_path, headers=viewer_headers).status_code, 403)
        self.assertEqual(self.client.delete(broadcast_path, headers=viewer_headers).status_code, 403)
        self.assertEqual(self.client.get(self.path, params={"broadcast_only": True},
                                         headers=viewer_headers).status_code, 409)
        self.assertEqual(self.client.post(broadcast_path, headers=presenter_headers).json(),
                         {"room_id": self.room_id})
        response = self.client.get(active_path, headers=viewer_headers)
        self.assertEqual(response.headers["cache-control"], "private, no-store")
        self.assertEqual(response.json(), {"room_id": self.room_id})
        with self.connect("presenter") as presenter, self.connect("viewer") as viewer, self.connect("viewer2") as direct:
            self.assertEqual(self.auth_socket(presenter, "presenter", True)["role"], "presenter")
            self.assertEqual(self.auth_socket(viewer, "viewer", True)["role"], "viewer")
            self.auth_socket(direct, "viewer2")
            viewer.send_json({"type": "advance", "index": 1})
            self.assertEqual(viewer.receive_json()["type"], "error")
            presenter.send_json({"type": "advance", "index": 1})
            presenter.receive_json()
            state = viewer.receive_json()
            direct.receive_json()
            self.assertEqual(state["current_slide_index"], 1)
            self.assertNotIn("answers", str(state))
            self.assertNotIn("private-future", str(state))
            self.assertEqual(self.client.delete(broadcast_path, headers=presenter_headers).status_code, 204)
            for ws in (presenter, viewer):
                self.assertEqual(ws.receive_json(), {"type": "broadcast_changed"})
                with self.assertRaises(WebSocketDisconnect) as caught:
                    ws.receive_json()
                self.assertEqual(caught.exception.code, 4005)
            direct.send_json({"type": "sync"})
            self.assertEqual(direct.receive_json()["current_slide_index"], 1)
        self.assertEqual(self.client.get(active_path, headers=viewer_headers).json(), {"room_id": None})
        self.assertEqual(self.client.get(self.path, params={"broadcast_only": True},
                                         headers=viewer_headers).status_code, 409)
        with self.connect("viewer") as viewer:
            self.assertEqual(self.auth_socket(viewer, "viewer", True)["type"], "error")
            with self.assertRaises(WebSocketDisconnect) as caught:
                viewer.receive_json()
            self.assertEqual(caught.exception.code, 4005)
        saved = self.client.get(self.path, headers=viewer_headers).json()
        self.assertEqual(saved["current_slide_index"], 1)
        self.assertEqual(saved["max_unlocked_slide_index"], 1)
        self.assertEqual(self.client.post(broadcast_path, headers=presenter_headers).status_code, 200)
        restarted = self.client.get(self.path, params={"broadcast_only": True}, headers=viewer_headers).json()
        self.assertEqual(restarted["current_slide_index"], 0)
        self.assertEqual(restarted["max_unlocked_slide_index"], 0)
        self.assertEqual(list(restarted["slides"]), ["0"])
        self.assertEqual(restarted["revision"], saved["revision"] + 1)

    def test_broadcast_restart_relocks_connected_and_returning_viewers(self):
        headers = {"Authorization": "tma presenter"}
        viewer_headers = {"Authorization": "tma viewer"}
        broadcast_path = self.path + "/broadcast"
        self.assertEqual(self.client.post(broadcast_path, headers=headers).status_code, 200)
        with self.connect("presenter") as presenter, self.connect("viewer") as viewer:
            self.auth_socket(presenter, "presenter")
            self.auth_socket(viewer, "viewer")
            for index in (1, 2, 0):
                presenter.send_json({"type": "advance", "index": index})
                presenter.receive_json()
                saved = viewer.receive_json()
            self.assertEqual(saved["current_slide_index"], 0)
            self.assertEqual(saved["max_unlocked_slide_index"], 2)
            self.assertEqual(self.client.post(broadcast_path, headers=headers).status_code, 200)
            viewer.send_json({"type": "sync"})
            self.assertEqual(viewer.receive_json(), saved)
            self.assertEqual(self.client.delete(broadcast_path, headers=headers).status_code, 204)
            self.assertEqual(self.client.post(broadcast_path, headers=headers).status_code, 200)
            presenter.receive_json()
            reset = viewer.receive_json()
            self.assertEqual(reset["current_slide_index"], 0)
            self.assertEqual(reset["max_unlocked_slide_index"], 0)
            self.assertEqual(reset["revision"], saved["revision"] + 1)
            self.assertEqual(list(reset["slides"]), ["0"])
            self.assertEqual(reset["results"], {})
            presenter.send_json({"type": "advance", "index": 2})
            self.assertEqual(presenter.receive_json()["type"], "error")
            viewer.send_json({"type": "advance", "index": 1})
            self.assertEqual(viewer.receive_json()["type"], "error")
            self.assertEqual(self.client.get(self.path, headers=viewer_headers).json(), reset)
        with TestClient(self.make_app()) as restarted:
            self.assertEqual(restarted.get(self.path, headers=viewer_headers).json(), reset)
            with restarted.websocket_connect(self.path + "/ws") as viewer:
                self.assertEqual(self.auth_socket(viewer, "viewer", True), reset)

    def test_failed_broadcast_reset_does_not_publish_or_save_partial_state(self):
        headers = {"Authorization": "tma presenter"}
        viewer_headers = {"Authorization": "tma viewer"}
        with self.connect("presenter") as presenter:
            self.auth_socket(presenter, "presenter")
            presenter.send_json({"type": "advance", "index": 1})
            saved = presenter.receive_json()
            with patch("sqlalchemy.orm.Session.commit", side_effect=RuntimeError("Commit failed")):
                client = TestClient(self.app, raise_server_exceptions=False)
                response = client.post(self.path + "/broadcast", headers=headers)
            self.assertEqual(response.status_code, 500)
            self.assertEqual(self.client.get("/api/presentations/broadcast", headers=viewer_headers).json(),
                             {"room_id": None})
            state = self.client.get(self.path, headers=headers).json()
            self.assertEqual(state, saved)
        with TestClient(self.make_app()) as restarted:
            self.assertEqual(restarted.get(self.path, headers=headers).json(), saved)

    def test_broadcast_switch_restart_ownership_and_deletion(self):
        active_path = "/api/presentations/broadcast"
        headers = {"Authorization": "tma presenter"}
        viewer_headers = {"Authorization": "tma viewer"}
        self.client.post(self.path + "/broadcast", headers=headers)
        write_record("f" * 32, {
            "manifest": MANIFEST, "presenter_id": 99, "current_slide_index": 0,
            "max_unlocked_slide_index": 0, "revision": 0, "responses": {},
        })
        self.assertEqual(self.client.post("/api/presentations/rooms/" + "f" * 32 + "/broadcast",
                                         headers=headers).status_code, 403)
        second = self.client.post("/api/presentations/rooms", json=MANIFEST, headers=headers).json()["room_id"]
        second_path = "/api/presentations/rooms/" + second
        with self.connect("viewer") as viewer:
            self.auth_socket(viewer, "viewer", True)
            self.assertEqual(self.client.post(second_path + "/broadcast", headers=headers).status_code, 200)
            self.assertEqual(viewer.receive_json(), {"type": "broadcast_changed"})
        self.assertEqual(self.client.get(active_path, headers=viewer_headers).json(), {"room_id": second})
        self.assertEqual(self.client.delete(self.path + "/broadcast", headers=headers).status_code, 409)
        with TestClient(self.make_app()) as restarted:
            self.assertEqual(restarted.get(active_path, headers=viewer_headers).json(), {"room_id": second})
            self.assertEqual(restarted.get(second_path, params={"broadcast_only": True},
                                           headers=viewer_headers).json()["role"], "viewer")
        with self.client.websocket_connect(second_path + "/ws") as viewer:
            self.auth_socket(viewer, "viewer", True)
            self.assertEqual(self.client.delete(second_path, headers=headers).status_code, 204)
            self.assertEqual(viewer.receive_json(), {"type": "broadcast_changed"})
        self.assertEqual(self.client.get(active_path, headers=viewer_headers).json(), {"room_id": None})

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

    def test_authoring_aliases_are_normalized_without_losing_content(self):
        manifest = PresentationManifest.model_validate(AUTHORED_MANIFEST)
        data = manifest.model_dump()
        self.assertEqual(data["title"], AUTHORED_MANIFEST["title"])
        self.assertEqual(data["theme"], AUTHORED_MANIFEST["theme"])
        self.assertEqual(data["slides"][0]["image"]["url"], AUTHORED_MANIFEST["slides"][0]["imageUrl"])
        self.assertEqual(data["slides"][1]["photos"][0]["caption"]["ru"], "Подпись")
        self.assertEqual(data["slides"][1]["subtitle"]["en"], "Swipe up")
        self.assertEqual(data["slides"][2]["options"][0]["label"]["en"], "A")
        self.assertTrue(data["slides"][3]["loop"])
        self.assertTrue(data["slides"][3]["muted"])
        self.assertTrue(data["slides"][3]["autoplay"])
        self.assertEqual(data["slides"][4]["html"]["en"], "<h1>Hello</h1>")
        self.assertFalse(data["slides"][0]["interactiveHtml"])
        self.assertTrue(public_slide(manifest.slides[4])["interactiveHtml"])
        self.assertEqual([slide["animations"]["entry"] for slide in data["slides"]],
                         ["fade-up", "slide-left", "zoom-in", "fade-up", "zoom-in"])
        self.assertNotIn("answers", public_slide(manifest.slides[2]))
        self.assertEqual(PresentationManifest.model_validate(data).model_dump(), data)

    def test_authored_upload_sync_and_saved_title_preserve_redaction(self):
        response = self.client.post("/api/presentations/rooms", json=AUTHORED_MANIFEST,
                                    headers={"Authorization": "tma presenter"})
        self.assertEqual(response.status_code, 201, response.text)
        path = "/api/presentations/rooms/" + response.json()["room_id"]
        listed = self.client.get("/api/presentations/rooms", headers={"Authorization": "tma presenter"}).json()
        summary = next(item for item in listed["items"] if item["room_id"] == response.json()["room_id"])
        self.assertEqual(summary["title"], AUTHORED_MANIFEST["title"])
        with self.client.websocket_connect(path + "/ws") as presenter, self.client.websocket_connect(path + "/ws") as viewer:
            self.auth_socket(presenter, "presenter")
            state = self.auth_socket(viewer, "viewer")
            self.assertEqual(state["theme"], AUTHORED_MANIFEST["theme"])
            self.assertEqual(state["title"], AUTHORED_MANIFEST["title"])
            self.assertEqual(list(state["slides"]), ["0"])
            self.assertNotIn("future.mp4", str(state))
            for index in range(1, 5):
                presenter.send_json({"type": "advance", "index": index})
                presenter.receive_json()
                state = viewer.receive_json()
                self.assertEqual(list(state["slides"]), [str(i) for i in range(index + 1)])
                self.assertNotIn("answers", str(state))
                if index < 3:
                    self.assertNotIn("future.mp4", str(state))
            self.assertEqual(state["slides"]["4"]["html"]["ru"], "<h1>Привет</h1>")
            self.assertTrue(state["slides"]["4"]["interactiveHtml"])
            self.assertTrue(state["slides"]["3"]["loop"])
        self.assertEqual(self.client.get(path, headers={"Authorization": "tma viewer"}).json(), state)

    def test_interactive_html_requires_an_explicit_boolean(self):
        for value in ("true", 1, None):
            with self.subTest(value=value):
                data = deepcopy(AUTHORED_MANIFEST)
                data["slides"][4]["interactiveHtml"] = value
                with self.assertRaises(ValidationError):
                    PresentationManifest.model_validate(data)

    def test_authoring_aliases_do_not_bypass_url_css_or_behavior_validation(self):
        cases = [
            ("image_url", lambda data: data["slides"][0].update(imageUrl="javascript:alert(1)")),
            ("video_url", lambda data: data["slides"][3].update(videoUrl="http://example.test/film.mp4")),
            ("unmuted", lambda data: data["slides"][3].update(autoPlayMuted=False)),
            ("theme_css", lambda data: data["theme"].update(primaryColor="red; background:url(https://example.test)")),
            ("theme_font", lambda data: data["theme"].update(fontFamily="sans; color:red")),
            ("animation", lambda data: data["slides"][0]["animations"].update(entry="unsupported")),
            ("multiple", lambda data: data["slides"][2].update(allowMultiple=True)),
            ("hidden_results", lambda data: data["slides"][2].update(showResultsLive=False)),
            ("conflicting_alias", lambda data: data["slides"][0].update(image={"url": "https://example.test/other.jpg"})),
        ]
        for name, mutate in cases:
            with self.subTest(name=name):
                manifest = deepcopy(AUTHORED_MANIFEST)
                mutate(manifest)
                with self.assertRaises(ValidationError):
                    PresentationManifest.model_validate(manifest)

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

    def test_presenter_gallery_focus_is_broadcast_and_persisted(self):
        response = self.client.post("/api/presentations/rooms", json=GALLERY_MANIFEST,
                                    headers={"Authorization": "tma presenter"})
        self.assertEqual(response.status_code, 201, response.text)
        path = "/api/presentations/rooms/" + response.json()["room_id"]
        with self.client.websocket_connect(path + "/ws") as presenter, self.client.websocket_connect(path + "/ws") as viewer:
            self.assertEqual(self.auth_socket(presenter, "presenter")["gallery_photo_indices"], {})
            self.assertEqual(self.auth_socket(viewer, "viewer")["gallery_photo_indices"], {})
            presenter.send_json({"type": "advance", "index": 1})
            presenter.receive_json()
            state = viewer.receive_json()
            self.assertEqual(state["gallery_photo_indices"], {"photos": 0})
            self.assertNotIn("future_photos", str(state))
            viewer.send_json({"type": "gallery_photo", "slide_id": "photos", "photo_index": 1})
            self.assertEqual(viewer.receive_json()["type"], "error")
            for photo_index in (1, 2):
                presenter.send_json({"type": "gallery_photo", "slide_id": "photos", "photo_index": photo_index})
                self.assertEqual(presenter.receive_json()["gallery_photo_indices"], {"photos": photo_index})
                state = viewer.receive_json()
                self.assertEqual(state["gallery_photo_indices"], {"photos": photo_index})
                self.assertEqual(state["current_slide_index"], 1)
                self.assertEqual(state["max_unlocked_slide_index"], 1)
                self.assertEqual(state["results"], {})
            self.assertEqual(state["revision"], 3)
            for index in (2, 1):
                presenter.send_json({"type": "advance", "index": index})
                presenter.receive_json()
                state = viewer.receive_json()
                self.assertEqual(state["gallery_photo_indices"], {"photos": 2, "future_photos": 0})
        with TestClient(self.make_app()) as restarted:
            restored = restarted.get(path, headers={"Authorization": "tma viewer"}).json()
            self.assertEqual(restored, state)
            with restarted.websocket_connect(path + "/ws") as viewer:
                self.assertEqual(self.auth_socket(viewer, "viewer"), state)

    def test_gallery_focus_validates_active_slide_and_photo_bounds(self):
        response = self.client.post("/api/presentations/rooms", json=GALLERY_MANIFEST,
                                    headers={"Authorization": "tma presenter"})
        self.assertEqual(response.status_code, 201, response.text)
        path = "/api/presentations/rooms/" + response.json()["room_id"]
        with self.client.websocket_connect(path + "/ws") as presenter:
            self.auth_socket(presenter, "presenter")
            presenter.send_json({"type": "gallery_photo", "slide_id": "intro", "photo_index": 0})
            self.assertEqual(presenter.receive_json()["type"], "error")
            presenter.send_json({"type": "advance", "index": 1})
            presenter.receive_json()
            commands = [
                {"slide_id": "photos", "photo_index": value} for value in (-1, 3, 30, True, "1", 1.5, None)
            ] + [{"slide_id": "photos"}, {"slide_id": "intro", "photo_index": 0},
                 {"slide_id": "future_photos", "photo_index": 0}]
            for command in commands:
                presenter.send_json({"type": "gallery_photo", **command})
                self.assertEqual(presenter.receive_json()["type"], "error")
            presenter.send_json({"type": "sync"})
            state = presenter.receive_json()
            self.assertEqual(state["revision"], 1)
            self.assertEqual(state["gallery_photo_indices"], {"photos": 0})
            self.assertEqual(state["results"], {})

    def test_existing_gallery_rooms_default_to_the_first_photo(self):
        room_id = "f" * 32
        write_record(room_id, {
            "manifest": GALLERY_MANIFEST, "presenter_id": PRESENTER_ID, "current_slide_index": 1,
            "max_unlocked_slide_index": 1, "revision": 0, "responses": {},
        })
        state = self.client.get("/api/presentations/rooms/" + room_id,
                                headers={"Authorization": "tma viewer"}).json()
        self.assertEqual(state["gallery_photo_indices"], {"photos": 0})
        self.assertNotIn("future_photos", str(state))

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

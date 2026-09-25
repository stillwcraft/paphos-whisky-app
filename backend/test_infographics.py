import os
import unittest
from uuid import uuid4
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

import models
from database import SessionLocal
from fastapi import HTTPException
from pydantic import ValidationError
from main import TelegramAuthContext, app, require_admin
from routers.infographics import create_infographic, get_infographic
from schemas.infographic import InfographicCreate, InfographicResponse


class InfographicTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.db.query(models.Infographic).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_chart_round_trip_and_missing_id(self):
        payload = InfographicCreate(
            title="Tasting notes",
            type="chart",
            schema_data={
                "chart_type": "bar",
                "labels": ["Smoke", "Oak"],
                "datasets": [{"name": "Intensity", "data": [4, 8], "color": "#C5A059"}],
                "animated": True,
                "animation_delay_ms": 150,
            },
        )
        created = create_infographic(payload, db=self.db)
        response = InfographicResponse.model_validate(created)
        self.assertEqual(response.schema_data["datasets"][0]["data"], [4, 8])
        self.assertEqual(response.type, "chart")
        self.assertIsNotNone(response.created_at)
        self.assertEqual(get_infographic(created.id, db=self.db).id, created.id)
        with self.assertRaises(HTTPException) as context:
            get_infographic(uuid4(), db=self.db)
        self.assertEqual(context.exception.status_code, 404)

    def test_rejects_mismatched_and_malformed_payloads(self):
        cases = [
            ("chart", {"steps": [{"step": 1, "title": "A", "description": "B"}]}),
            ("chart", {"chart_type": "line", "labels": ["One"], "datasets": [{"name": "A", "data": [1, 2]}]}),
            ("chart", {"chart_type": "pie", "labels": ["One"], "datasets": [
                {"name": "A", "data": [1]}, {"name": "B", "data": [2]},
            ]}),
            ("timeline", {"steps": []}),
            ("timeline", {"steps": [
                {"step": 1, "title": "A", "description": "First"},
                {"step": 1, "title": "B", "description": "Second"},
            ]}),
            ("map_overlay", {"markers": [{"latitude": 91, "longitude": 0, "title": "X"}]}),
        ]
        for infographic_type, data in cases:
            with self.subTest(infographic_type=infographic_type, data=data):
                with self.assertRaises(ValidationError):
                    InfographicCreate(title="Test", type=infographic_type, schema_data=data)
        self.assertEqual(self.db.query(models.Infographic).count(), 0)

    def test_timeline_and_map_overlay_validate_and_persist(self):
        for infographic_type, schema_data in [
            ("timeline", {"steps": [
                {
                    "id": "foundation",
                    "badge": "History",
                    "title": "Founded",
                    "subtitle": "The beginning",
                    "description": "The distillery opened.",
                    "dateOrYear": 1890,
                },
                {"step": 2, "title": "Legacy", "description": "Older saved format"},
            ]}),
            ("map_overlay", {"markers": [{"latitude": 55.95, "longitude": -3.2, "title": "Edinburgh"}]}),
        ]:
            with self.subTest(infographic_type=infographic_type):
                payload = InfographicCreate(title="Test", type=infographic_type, schema_data=schema_data)
                created = create_infographic(payload, db=self.db)
                self.assertEqual(get_infographic(created.id, db=self.db).schema_data, payload.model_dump()["schema_data"])

    def test_rejects_duplicate_timeline_ids(self):
        with self.assertRaises(ValidationError):
            InfographicCreate(
                title="History",
                type="timeline",
                schema_data={"steps": [
                    {"id": "same", "title": "Start", "subtitle": "", "description": "", "dateOrYear": "1890"},
                    {"id": "same", "title": "End", "subtitle": "", "description": "", "dateOrYear": "1900"},
                ]},
            )

    def test_post_is_admin_only_and_get_is_public(self):
        post = next(route for route in app.routes if route.path == "/api/v1/infographics" and "POST" in route.methods)
        get = next(route for route in app.routes if route.path == "/api/v1/infographics/{infographic_id}")
        self.assertIn(require_admin, [dependency.call for dependency in post.dependant.dependencies])
        self.assertNotIn(require_admin, [dependency.call for dependency in get.dependant.dependencies])

        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "123"}):
            with self.assertRaises(HTTPException) as context:
                require_admin(TelegramAuthContext(telegram_id=456, user={}))
            self.assertEqual(context.exception.status_code, 403)
            self.assertEqual(require_admin(TelegramAuthContext(telegram_id=123, user={})).telegram_id, 123)


if __name__ == "__main__":
    unittest.main()

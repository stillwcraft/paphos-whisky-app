import json
import os
import re
import unittest
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

import models
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from database import SessionLocal
from fastapi import HTTPException
from pydantic import ValidationError
from main import TelegramAuthContext, app, ensure_infographic_schema, require_admin
from routers.infographics import create_infographic, get_distillery_infographic, get_infographic
from schemas.infographic import InfographicCreate, InfographicResponse


class InfographicTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.db.query(models.Infographic).delete()
        self.distillery = models.Distillery(name=f"Infographic test {uuid4()}")
        self.db.add(self.distillery)
        self.db.commit()

    def tearDown(self):
        self.db.query(models.Infographic).delete()
        self.db.delete(self.distillery)
        self.db.commit()
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

    def test_localized_ardbeg_history_matches_timeline_schema(self):
        history_file = (
            Path(__file__).resolve().parent.parent
            / "frontend/src/components/infographics/ardbegHistory.json"
        )
        milestones = json.loads(history_file.read_text(encoding="utf-8"))
        payload = InfographicCreate(
            title="Ardbeg History",
            type="timeline",
            distillery_id=self.distillery.id,
            schema_data={"steps": [
                {
                    "id": item["id"],
                    "dateOrYear": item["year"],
                    "title": item["title"],
                    "subtitle": "",
                    "description": item["description"],
                }
                for item in milestones
            ]},
        )
        self.assertEqual(len(payload.schema_data.steps), 23)
        self.assertEqual(payload.schema_data.steps[0].dateOrYear, "1815")
        self.assertEqual(payload.schema_data.steps[-1].dateOrYear, "2026")

    def test_arran_sql_contains_valid_localized_timeline(self):
        sql_file = Path(__file__).with_name("migrations") / "004_seed_arran_infographic.sql"
        sql = sql_file.read_text(encoding="utf-8")
        match = re.search(r"\$arran_payload\$\s*(.*?)\s*\$arran_payload\$", sql, re.DOTALL)
        self.assertIsNotNone(match)
        payload = InfographicCreate(
            title="Arran History",
            type="timeline",
            distillery_id=self.distillery.id,
            schema_data=json.loads(match.group(1)),
        )
        self.assertEqual(len(payload.schema_data.steps), 13)
        self.assertEqual(payload.schema_data.steps[0].dateOrYear, "1800")
        self.assertEqual(payload.schema_data.steps[-1].dateOrYear, "2019")
        for step in payload.schema_data.steps:
            for language in ("en", "ru", "uk"):
                self.assertTrue(getattr(step.title, language))
                self.assertTrue(getattr(step.description, language))

    def test_distillery_lookup_and_single_assigned_infographic(self):
        self.assertIsNone(get_distillery_infographic(self.distillery.id, db=self.db))
        payload = InfographicCreate(
            title="History",
            type="timeline",
            distillery_id=self.distillery.id,
            schema_data={"steps": [{"step": 1, "title": "Start", "description": "First"}]},
        )
        created = create_infographic(payload, db=self.db)
        self.assertEqual(get_distillery_infographic(self.distillery.id, db=self.db).id, created.id)
        self.assertEqual(InfographicResponse.model_validate(created).distillery_id, self.distillery.id)
        with self.assertRaises(HTTPException) as conflict:
            create_infographic(payload, db=self.db)
        self.assertEqual(conflict.exception.status_code, 409)
        self.assertEqual(self.db.query(models.Infographic).count(), 1)

    def test_distillery_lookup_rejects_unknown_id(self):
        with self.assertRaises(HTTPException) as missing:
            get_distillery_infographic(-1, db=self.db)
        self.assertEqual(missing.exception.status_code, 404)
        payload = InfographicCreate(
            title="History",
            type="timeline",
            distillery_id=999999,
            schema_data={"steps": [{"step": 1, "title": "Start", "description": "First"}]},
        )
        with self.assertRaises(HTTPException) as missing:
            create_infographic(payload, db=self.db)
        self.assertEqual(missing.exception.status_code, 404)

    def test_existing_table_upgrades_with_unique_distillery_index(self):
        legacy_engine = create_engine("sqlite://")
        with legacy_engine.begin() as connection:
            connection.execute(text("CREATE TABLE distilleries (id INTEGER PRIMARY KEY)"))
            connection.execute(text("INSERT INTO distilleries (id) VALUES (1)"))
            connection.execute(text(
                "CREATE TABLE infographics (id VARCHAR PRIMARY KEY, title TEXT, type VARCHAR, "
                "schema_data JSON, created_at DATETIME, updated_at DATETIME)"
            ))
        with patch("main.engine", legacy_engine):
            ensure_infographic_schema()
            ensure_infographic_schema()
        self.assertIn("distillery_id", {column["name"] for column in inspect(legacy_engine).get_columns("infographics")})
        with legacy_engine.begin() as connection:
            connection.execute(text("INSERT INTO infographics (id, distillery_id) VALUES ('a', 1)"))
            with self.assertRaises(IntegrityError):
                connection.execute(text("INSERT INTO infographics (id, distillery_id) VALUES ('b', 1)"))
        legacy_engine.dispose()

    def test_post_is_admin_only_and_get_is_public(self):
        post = next(route for route in app.routes if route.path == "/api/v1/infographics" and "POST" in route.methods)
        get = next(route for route in app.routes if route.path == "/api/v1/infographics/{infographic_id}")
        by_distillery = next(
            route for route in app.routes if route.path == "/api/v1/distilleries/{distillery_id}/infographic"
        )
        self.assertIn(require_admin, [dependency.call for dependency in post.dependant.dependencies])
        self.assertNotIn(require_admin, [dependency.call for dependency in get.dependant.dependencies])
        self.assertNotIn(require_admin, [dependency.call for dependency in by_distillery.dependant.dependencies])

        with patch.dict(os.environ, {"ADMIN_TELEGRAM_ID": "123"}):
            with self.assertRaises(HTTPException) as context:
                require_admin(TelegramAuthContext(telegram_id=456, user={}))
            self.assertEqual(context.exception.status_code, 403)
            self.assertEqual(require_admin(TelegramAuthContext(telegram_id=123, user={})).telegram_id, 123)


if __name__ == "__main__":
    unittest.main()

import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

import models
from sqlalchemy import create_engine, inspect, text
from fastapi import HTTPException
from pydantic import ValidationError
from main import (
    BottleCreate,
    BottleUpdate,
    build_event_response,
    build_event_summary_response,
    create_bottle,
    create_event,
    delete_bottle,
    delete_event,
    ensure_event_schema,
    EventCreate,
    EventUpdate,
    get_event_detail,
    get_events,
    validate_bottle_ids,
    load_event_bottles,
    load_bottles_for_events,
    update_bottle,
    update_event,
)
from database import SessionLocal


class EventBottleTest(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        # Clean state in dependency order
        self.db.execute(text("DELETE FROM event_bottles"))
        self.db.query(models.UserReviewTag).delete()
        self.db.query(models.UserReview).delete()
        self.db.query(models.UserBottleAction).delete()
        self.db.query(models.Registration).delete()
        self.db.query(models.Bottle).delete()
        self.db.query(models.Event).delete()
        self.db.query(models.Distillery).delete()
        self.db.commit()

        self.distillery = models.Distillery(
            name="Test Distillery",
            logo_url="https://example.com/logo.png",
        )
        self.event = models.Event(
            title="Test Tasting",
            date="2026-07-20T19:00:00Z",
            description="Test event",
            price=30.0,
            has_samples=False,
            distillery=self.distillery,
        )
        self.bottle1 = models.Bottle(
            name="Glen Scotia",
            name_i18n={"en": "Glen Scotia", "ru": "Глен Скотиа"},
            price_per_sample=15.0,
            description="A dram",
            description_i18n={"en": "A dram", "ru": "Дрэм"},
            favorites_count=0,
            tried_count=0,
        )
        self.bottle2 = models.Bottle(
            name="Ardbeg",
            price_per_sample=20.0,
            description="Peaty",
            favorites_count=2,
            tried_count=1,
        )
        self.db.add_all([self.distillery, self.event, self.bottle1, self.bottle2])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    # --- validate_bottle_ids ---

    def test_validate_deduplicates_preserving_order(self):
        result = validate_bottle_ids(
            [self.bottle2.id, self.bottle1.id, self.bottle2.id],
            self.db,
        )
        self.assertEqual(result, [self.bottle2.id, self.bottle1.id])

    def test_validate_empty_list_is_ok(self):
        result = validate_bottle_ids([], self.db)
        self.assertEqual(result, [])

    def test_validate_raises_422_for_unknown_id(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_bottle_ids([self.bottle1.id, 999999], self.db)
        self.assertEqual(ctx.exception.status_code, 422)
        self.assertIn("999999", ctx.exception.detail)

    def test_validate_raises_422_listing_all_unknown_ids(self):
        with self.assertRaises(HTTPException) as ctx:
            validate_bottle_ids([111111, 222222], self.db)
        self.assertIn("111111", ctx.exception.detail)
        self.assertIn("222222", ctx.exception.detail)

    # --- load_event_bottles ---

    def test_load_returns_associated_bottles(self):
        self.db.execute(
            models.event_bottles_table.insert(),
            [
                {"event_id": self.event.id, "bottle_id": self.bottle1.id},
                {"event_id": self.event.id, "bottle_id": self.bottle2.id},
            ],
        )
        self.db.commit()

        bottles = load_event_bottles(self.event.id, self.db)
        self.assertEqual({b.id for b in bottles}, {self.bottle1.id, self.bottle2.id})

    def test_load_returns_empty_when_no_association(self):
        bottles = load_event_bottles(self.event.id, self.db)
        self.assertEqual(bottles, [])

    def test_load_only_returns_bottles_for_that_event(self):
        other_event = models.Event(
            title="Other", date="2026-08-01T00:00:00Z",
            description="Other", price=10.0, has_samples=False,
        )
        self.db.add(other_event)
        self.db.commit()
        self.db.execute(
            models.event_bottles_table.insert(),
            [
                {"event_id": self.event.id, "bottle_id": self.bottle1.id},
                {"event_id": other_event.id, "bottle_id": self.bottle2.id},
            ],
        )
        self.db.commit()

        bottles = load_event_bottles(self.event.id, self.db)
        self.assertEqual([b.id for b in bottles], [self.bottle1.id])

    # --- load_bottles_for_events ---

    def test_batch_load_groups_correctly(self):
        other_event = models.Event(
            title="Second", date="2026-08-15T19:00:00Z",
            description="Second", price=25.0, has_samples=False,
        )
        self.db.add(other_event)
        self.db.commit()
        self.db.execute(
            models.event_bottles_table.insert(),
            [
                {"event_id": self.event.id, "bottle_id": self.bottle1.id},
                {"event_id": other_event.id, "bottle_id": self.bottle2.id},
            ],
        )
        self.db.commit()

        result = load_bottles_for_events([self.event.id, other_event.id], self.db)
        self.assertEqual({b.id for b in result[self.event.id]}, {self.bottle1.id})
        self.assertEqual({b.id for b in result[other_event.id]}, {self.bottle2.id})

    def test_batch_load_empty_ids_returns_empty_dict(self):
        result = load_bottles_for_events([], self.db)
        self.assertEqual(result, {})

    def test_batch_load_event_with_no_bottles_returns_empty_list(self):
        result = load_bottles_for_events([self.event.id], self.db)
        self.assertEqual(result[self.event.id], [])

    # --- build_event_response with localization ---

    def test_bottles_are_localized_in_response(self):
        bottles = [self.bottle1]
        response = build_event_response(
            self.event,
            lang="ru",
            registered_count=0,
            samples_count=0,
            bottles=bottles,
        )

        self.assertEqual(len(response.bottles), 1)
        self.assertEqual(response.bottles[0].name, "Глен Скотиа")
        self.assertEqual(response.bottles[0].description, "Дрэм")

    def test_bottles_fall_back_to_en_for_missing_locale(self):
        response = build_event_response(
            self.event,
            lang="uk",
            bottles=[self.bottle1],
        )
        # uk is not in name_i18n, falls back to "en"
        self.assertEqual(response.bottles[0].name, "Glen Scotia")

    def test_bottles_include_counts(self):
        response = build_event_response(
            self.event,
            lang="en",
            registered_count=5,
            samples_count=3,
            bottles=[self.bottle2],
        )
        self.assertEqual(response.registered_count, 5)
        self.assertEqual(response.samples_count, 3)
        self.assertEqual(response.bottles[0].favorites_count, 2)
        self.assertEqual(response.bottles[0].tried_count, 1)

    def test_response_includes_participant_badge_visibility(self):
        self.event.show_participants = False
        response = build_event_response(self.event, lang="en")

        self.assertFalse(response.show_participants)

    def test_response_has_bottles_not_bottle_ids(self):
        response = build_event_response(self.event, lang="en", bottles=[self.bottle1])
        self.assertTrue(hasattr(response, "bottles"))
        self.assertFalse(hasattr(response, "bottle_ids"))

    def test_response_bottles_empty_by_default(self):
        response = build_event_response(self.event, lang="en")
        self.assertEqual(response.bottles, [])

    def test_summary_excludes_descriptions_and_bottles(self):
        summary = build_event_summary_response(
            self.event,
            lang="en",
            registered_count=2,
            samples_count=1,
            bottle_count=3,
        )

        self.assertEqual(summary.bottle_count, 3)
        self.assertNotIn("description", summary.model_dump())
        self.assertNotIn("bottles", summary.model_dump())

    def test_event_response_includes_banner_data(self):
        response = build_event_response(self.event, lang="en")

        self.assertEqual(response.distillery_id, self.distillery.id)
        self.assertEqual(response.distillery_logo_url, self.distillery.logo_url)
        self.assertEqual(response.event_date_formatted, "20.07.2026")

    def test_event_location_is_in_detail_and_summary(self):
        self.event.location = "Paphos Whisky Club"
        self.db.commit()

        self.assertEqual(build_event_response(self.event).location, "Paphos Whisky Club")
        self.assertEqual(build_event_summary_response(self.event).location, "Paphos Whisky Club")

    def test_event_location_defaults_to_none_for_existing_events(self):
        self.assertIsNone(build_event_response(self.event).location)
        self.assertIsNone(build_event_summary_response(self.event).location)

    def test_event_coordinates_default_to_none(self):
        self.assertIsNone(get_event_detail(self.event.id, "en", self.db).latitude)
        self.assertIsNone(get_events("en", limit=24, offset=0, db=self.db)["items"][0].longitude)

    def test_create_and_update_event_coordinates_in_responses(self):
        created = create_event(
            EventCreate(
                title="Paphos tasting",
                date="2026-09-01T19:00:00Z",
                price=25,
                latitude=34.772,
                longitude=32.425,
            ),
            self.db,
            None,
        )
        self.assertEqual((created.latitude, created.longitude), (34.772, 32.425))
        self.assertEqual(
            (self.db.get(models.Event, created.id).latitude, self.db.get(models.Event, created.id).longitude),
            (34.772, 32.425),
        )
        detail = get_event_detail(created.id, "en", self.db)
        summary = next(
            item for item in get_events("en", limit=24, offset=0, db=self.db)["items"]
            if item.id == created.id
        )
        self.assertEqual((detail.latitude, detail.longitude), (34.772, 32.425))
        self.assertEqual((summary.latitude, summary.longitude), (34.772, 32.425))

        updated = update_event(
            created.id,
            EventUpdate(title="Paphos tasting", date="2026-09-01T19:00:00Z",
                        price=25, latitude=34.78, longitude=32.43),
            self.db,
            None,
        )
        self.assertEqual((updated.latitude, updated.longitude), (34.78, 32.43))
        self.assertEqual(
            (self.db.get(models.Event, created.id).latitude, self.db.get(models.Event, created.id).longitude),
            (34.78, 32.43),
        )

        unchanged = update_event(
            created.id,
            EventUpdate(title="Paphos tasting", date="2026-09-01T19:00:00Z", price=25),
            self.db,
            None,
        )
        self.assertEqual((unchanged.latitude, unchanged.longitude), (34.78, 32.43))

        cleared = update_event(
            created.id,
            EventUpdate(title="Paphos tasting", date="2026-09-01T19:00:00Z",
                        price=25, latitude=None, longitude=None),
            self.db,
            None,
        )
        self.assertIsNone(cleared.latitude)
        self.assertIsNone(cleared.longitude)
        self.assertIsNone(self.db.get(models.Event, created.id).latitude)

    def test_event_coordinates_must_be_finite_in_range_and_paired(self):
        invalid = [
            {"latitude": 34.7},
            {"longitude": 32.4},
            {"latitude": None},
            {"latitude": 34.7, "longitude": None},
            {"latitude": 91, "longitude": 32},
            {"latitude": -91, "longitude": 32},
            {"latitude": 34, "longitude": 181},
            {"latitude": 34, "longitude": -181},
            {"latitude": float("nan"), "longitude": 32},
            {"latitude": 34, "longitude": float("inf")},
        ]
        for schema in (EventCreate, EventUpdate):
            for coordinates in invalid:
                with self.subTest(schema=schema.__name__, coordinates=coordinates):
                    with self.assertRaises(ValidationError):
                        schema(title="Invalid", date="2026-09-01", price=25, **coordinates)
            self.assertIsNone(
                schema(title="Without coordinates", date="2026-09-01", price=25).latitude
            )
            self.assertIsNone(
                schema(title="Cleared", date="2026-09-01", price=25,
                       latitude=None, longitude=None).longitude
            )
            boundary = schema(title="Boundary", date="2026-09-01", price=25,
                              latitude=-90, longitude=180)
            self.assertEqual((boundary.latitude, boundary.longitude), (-90, 180))

    def test_legacy_event_schema_adds_coordinates_without_losing_rows(self):
        legacy_engine = create_engine("sqlite://")
        try:
            with legacy_engine.begin() as connection:
                connection.execute(text("CREATE TABLE events (id INTEGER PRIMARY KEY, title VARCHAR)"))
                connection.execute(text("INSERT INTO events (id, title) VALUES (1, 'Legacy')"))
            with patch("main.engine", legacy_engine):
                ensure_event_schema()
                ensure_event_schema()
            with legacy_engine.connect() as connection:
                columns = {column["name"] for column in inspect(connection).get_columns("events")}
                self.assertTrue({"latitude", "longitude"} <= columns)
                self.assertEqual(
                    connection.execute(
                        text("SELECT title, latitude, longitude FROM events WHERE id = 1")
                    ).one(),
                    ("Legacy", None, None),
                )
        finally:
            legacy_engine.dispose()

    def test_event_list_returns_lightweight_summary_with_bottle_count(self):
        self.db.execute(
            models.event_bottles_table.insert(),
            {"event_id": self.event.id, "bottle_id": self.bottle1.id},
        )
        self.db.commit()

        summaries = get_events("en", limit=24, offset=0, db=self.db)["items"]
        summary = next(event for event in summaries if event.id == self.event.id)

        self.assertEqual(summary.bottle_count, 1)
        self.assertNotIn("description", summary.model_dump())
        self.assertNotIn("bottles", summary.model_dump())

    def test_event_detail_returns_description_and_lineup(self):
        self.db.execute(
            models.event_bottles_table.insert(),
            {"event_id": self.event.id, "bottle_id": self.bottle1.id},
        )
        self.db.commit()

        detail = get_event_detail(self.event.id, "en", self.db)

        self.assertEqual(detail.description, "Test event")
        self.assertEqual([bottle.id for bottle in detail.bottles], [self.bottle1.id])

    # --- association table persistence ---

    def test_association_survives_commit_and_reload(self):
        self.db.execute(
            models.event_bottles_table.insert(),
            {"event_id": self.event.id, "bottle_id": self.bottle1.id},
        )
        self.db.commit()

        # Fresh load in same session
        count = self.db.execute(
            text(
                "SELECT COUNT(*) FROM event_bottles "
                "WHERE event_id = :eid AND bottle_id = :bid"
            ),
            {"eid": self.event.id, "bid": self.bottle1.id},
        ).scalar()
        self.assertEqual(count, 1)

    def test_create_event_persists_deduplicated_lineup(self):
        created = create_event(
            EventCreate(
                title="Created tasting",
                date="2026-09-01T19:00:00Z",
                location="Paphos Whisky Club",
                description="Created event",
                price=25,
                bottle_ids=[self.bottle1.id, self.bottle2.id, self.bottle1.id],
            ),
            self.db,
            None,
        )

        self.assertEqual(
            [bottle.id for bottle in created.bottles],
            [self.bottle1.id, self.bottle2.id],
        )
        self.assertEqual(
            [bottle.id for bottle in load_event_bottles(created.id, self.db)],
            [self.bottle1.id, self.bottle2.id],
        )
        self.assertEqual(created.location, "Paphos Whisky Club")

    def test_create_event_without_description(self):
        created = create_event(
            EventCreate(
                title="Tasting without description",
                date="2026-09-01T19:00:00Z",
                price=25,
            ),
            self.db,
            None,
        )

        self.assertEqual(created.description, "")
        self.assertEqual(build_event_response(self.db.get(models.Event, created.id)).description, "")

    def test_update_event_can_clear_description(self):
        updated = update_event(
            self.event.id,
            EventUpdate(
                title=self.event.title,
                date=self.event.date,
                description="",
                price=self.event.price,
            ),
            self.db,
            None,
        )

        self.assertEqual(updated.description, "")

    def test_create_bottle_without_description(self):
        created = create_bottle(
            BottleCreate(name="No description", price_per_sample=12.0),
            self.db,
            None,
        )

        self.assertEqual(created.description, "")
        self.assertEqual(self.db.get(models.Bottle, created.id).description, "")

    def test_update_bottle_can_clear_description(self):
        updated = update_bottle(
            self.bottle2.id,
            BottleUpdate(
                name=self.bottle2.name,
                price_per_sample=self.bottle2.price_per_sample,
                description="",
            ),
            self.db,
            None,
        )

        self.assertEqual(updated.description, "")
        self.assertEqual(self.db.get(models.Bottle, self.bottle2.id).description, "")

    def test_update_bottle_without_description_preserves_existing_text(self):
        updated = update_bottle(
            self.bottle2.id,
            BottleUpdate(
                name=self.bottle2.name,
                price_per_sample=self.bottle2.price_per_sample,
            ),
            self.db,
            None,
        )

        self.assertEqual(updated.description, "Peaty")

    def test_update_event_replaces_lineup(self):
        self.db.execute(
            models.event_bottles_table.insert(),
            {"event_id": self.event.id, "bottle_id": self.bottle1.id},
        )
        self.db.commit()

        updated = update_event(
            self.event.id,
            EventUpdate(
                title=self.event.title,
                date=self.event.date,
                description=self.event.description,
                price=self.event.price,
                bottle_ids=[self.bottle2.id],
            ),
            self.db,
            None,
        )

        self.assertEqual([bottle.id for bottle in updated.bottles], [self.bottle2.id])
        self.assertEqual(
            [bottle.id for bottle in load_event_bottles(self.event.id, self.db)],
            [self.bottle2.id],
        )

    def test_deleting_event_cleans_its_lineup(self):
        event_id = self.event.id
        self.db.execute(
            models.event_bottles_table.insert(),
            {"event_id": event_id, "bottle_id": self.bottle1.id},
        )
        self.db.commit()

        delete_event(event_id, self.db, None)

        self.assertEqual(
            self.db.execute(
                text("SELECT COUNT(*) FROM event_bottles WHERE event_id = :event_id"),
                {"event_id": event_id},
            ).scalar(),
            0,
        )

    def test_deleting_bottle_cleans_its_lineup_entries(self):
        bottle_id = self.bottle1.id
        self.db.execute(
            models.event_bottles_table.insert(),
            {"event_id": self.event.id, "bottle_id": bottle_id},
        )
        self.db.commit()

        delete_bottle(bottle_id, self.db, None)

        self.assertEqual(
            self.db.execute(
                text("SELECT COUNT(*) FROM event_bottles WHERE bottle_id = :bottle_id"),
                {"bottle_id": bottle_id},
            ).scalar(),
            0,
        )


if __name__ == "__main__":
    unittest.main()

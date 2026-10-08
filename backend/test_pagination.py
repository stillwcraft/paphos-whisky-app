import os
import unittest
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite://"

import models
from sqlalchemy import text
from database import SessionLocal
from main import (
    TelegramAuthContext,
    app,
    get_bottles,
    get_distilleries,
    get_distillery_bottles,
    get_event_members,
    get_events,
    get_map_distilleries,
    get_map_events,
    get_user_bottle_states,
)


class PaginationTest(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.db.execute(text("DELETE FROM event_bottles"))
        self.db.query(models.UserBottleAction).delete()
        self.db.query(models.Registration).delete()
        self.db.query(models.Bottle).delete()
        self.db.query(models.Event).delete()
        self.db.query(models.Distillery).delete()
        self.db.commit()

        distilleries = [models.Distillery(name=f"Distillery {index}") for index in range(3)]
        self.db.add_all(distilleries)
        self.db.flush()
        self.distillery = distilleries[0]
        self.db.add_all(
            [
                models.Bottle(
                    name=f"Bottle {index}",
                    distillery_id=self.distillery.id,
                    price_per_sample=10,
                    description="Test",
                )
                for index in range(3)
            ]
            + [
                models.Event(
                    title=f"Event {index}",
                    date=f"2026-0{index + 1}-01T19:00:00Z",
                    description="Test",
                    price=20,
                )
                for index in range(3)
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def assert_page(self, page, *, total, limit, offset, size, has_more):
        self.assertEqual(page["total"], total)
        self.assertEqual(page["limit"], limit)
        self.assertEqual(page["offset"], offset)
        self.assertEqual(len(page["items"]), size)
        self.assertEqual(page["has_more"], has_more)

    def test_catalog_pages_include_metadata_and_boundaries(self):
        self.assert_page(
            get_events(limit=1, offset=0, db=self.db),
            total=3, limit=1, offset=0, size=1, has_more=True,
        )
        self.assert_page(
            get_bottles(limit=1, offset=3, db=self.db),
            total=3, limit=1, offset=3, size=0, has_more=False,
        )
        self.assert_page(
            get_distilleries(limit=100, offset=2, db=self.db),
            total=3, limit=100, offset=2, size=1, has_more=False,
        )

    def test_upcoming_events_filter_precedes_pagination_and_uses_two_hour_window(self):
        current = datetime.now(timezone.utc)
        dates = [
            (current - timedelta(hours=3)).isoformat(),
            (current - timedelta(hours=1)).isoformat(),
            (current + timedelta(hours=1)).isoformat(),
            (current + timedelta(hours=2)).astimezone(timezone(timedelta(hours=3))).isoformat(),
            (current + timedelta(hours=3)).astimezone(timezone(-timedelta(hours=5))).isoformat(),
            "not a date",
        ]
        events = [models.Event(title=f"Timed {i}", date=date, description="Test", price=1)
                  for i, date in enumerate(dates)]
        self.db.add_all(events)
        self.db.commit()
        self.assert_page(get_events(limit=100, offset=0, db=self.db),
                         total=9, limit=100, offset=0, size=9, has_more=False)
        first = get_events(limit=1, offset=0, upcoming=True, db=self.db)
        self.assert_page(first, total=4, limit=1, offset=0, size=1, has_more=True)
        self.assertEqual(first["items"][0].id, events[1].id)
        second = get_events(limit=1, offset=1, upcoming=True, db=self.db)
        self.assert_page(second, total=4, limit=1, offset=1, size=1, has_more=True)
        self.assertEqual(second["items"][0].id, events[2].id)
        last = get_events(limit=2, offset=2, upcoming=True, db=self.db)
        self.assert_page(last, total=4, limit=2, offset=2, size=2, has_more=False)
        self.assertEqual([item.id for item in last["items"]], [events[3].id, events[4].id])
        self.assert_page(get_events(limit=1, offset=4, upcoming=True, db=self.db),
                         total=4, limit=1, offset=4, size=0, has_more=False)

    def test_public_event_map_is_small_localized_and_current(self):
        current = datetime.now(timezone.utc)
        rows = [
            models.Event(
                title="Ongoing", name_i18n={"en": "Ongoing", "ru": "Продолжается"},
                date=(current - timedelta(hours=1)).isoformat(),
                location="Paphos", latitude=34.77, longitude=32.42,
                description="Do not include this", price=20,
            ),
            models.Event(
                title="Later", date=(current + timedelta(hours=1)).astimezone(
                    timezone(timedelta(hours=3))).isoformat(),
                location="Limassol", latitude=34.68, longitude=33.04,
                description="Do not include this either", price=20,
            ),
            models.Event(title="Finished", date=(current - timedelta(hours=3)).isoformat(),
                         latitude=34.77, longitude=32.42, description="", price=20),
            models.Event(title="No coordinates", date=(current + timedelta(hours=2)).isoformat(),
                         description="", price=20),
            models.Event(title="Invalid", date="not a date", latitude=34.77,
                         longitude=32.42, description="", price=20),
        ]
        self.db.add_all(rows)
        self.db.commit()

        markers = get_map_events(lang="ru", db=self.db)
        self.assertEqual(markers, [
            {"id": rows[0].id, "title": "Продолжается", "date": rows[0].date,
             "location": "Paphos", "latitude": 34.77, "longitude": 32.42},
            {"id": rows[1].id, "title": "Later", "date": rows[1].date,
             "location": "Limassol", "latitude": 34.68, "longitude": 33.04},
        ])
        self.assertEqual(get_map_events(lang="en", db=self.db)[0]["title"], "Ongoing")
        self.assertEqual(get_events(limit=1, offset=0, upcoming=True, db=self.db)["total"], 3)
        paths = [route.path for route in app.routes]
        self.assertLess(paths.index("/api/events/map"), paths.index("/api/events/{event_id}"))

    def test_distillery_page_is_summary_and_bottles_are_lazy(self):
        page = get_distilleries(limit=1, offset=0, db=self.db)
        distillery = next(item for item in page["items"] if item.id == self.distillery.id)
        self.assertEqual(distillery.bottle_count, 3)
        self.assertFalse(hasattr(distillery, "bottles"))

        bottles = get_distillery_bottles(self.distillery.id, limit=2, offset=0, db=self.db)
        self.assert_page(bottles, total=3, limit=2, offset=0, size=2, has_more=True)
        self.assertTrue(all(item.distillery_id == self.distillery.id for item in bottles["items"]))

    def test_map_only_returns_visible_distilleries_with_coordinates(self):
        visible = models.Distillery(
            name="Map Distillery",
            latitude=57.4554,
            longitude=-3.1294,
            show_on_map=True,
            image_url="https://example.com/map-distillery.webp",
            region="Speyside",
        )
        hidden = models.Distillery(
            name="Hidden Distillery",
            latitude=57.1,
            longitude=-3.2,
            show_on_map=False,
        )
        self.db.add_all([visible, hidden])
        self.db.commit()

        map_distilleries = get_map_distilleries(db=self.db)

        self.assertEqual([item.id for item in map_distilleries], [visible.id])
        self.assertEqual(map_distilleries[0].latitude, 57.4554)
        self.assertEqual(map_distilleries[0].longitude, -3.1294)
        self.assertEqual(map_distilleries[0].image_url, visible.image_url)
        self.assertEqual(map_distilleries[0].region, "Speyside")

    def test_member_and_user_state_pages_are_paginated(self):
        event = self.db.query(models.Event).first()
        self.db.add_all(
            [
                models.Registration(event_id=event.id, telegram_id=index, registered=True)
                for index in range(3)
            ]
        )
        bottle = self.db.query(models.Bottle).first()
        self.db.add_all(
            [
                models.UserBottleAction(telegram_id=99, bottle_id=bottle.id, is_favorite=True),
            ]
        )
        self.db.commit()
        auth = TelegramAuthContext(telegram_id=99, user={"id": 99})

        self.assert_page(
            get_event_members(event.id, limit=2, offset=1, db=self.db, _=auth),
            total=3, limit=2, offset=1, size=2, has_more=False,
        )
        self.assert_page(
            get_user_bottle_states(telegram_id=99, limit=1, offset=1, db=self.db, authenticated_user=auth),
            total=1, limit=1, offset=1, size=0, has_more=False,
        )

    def test_openapi_declares_pagination_limits(self):
        paths = app.openapi()["paths"]
        for path in (
            "/api/events",
            "/api/distilleries",
            "/api/bottles",
            "/api/events/{event_id}/members",
            "/api/bottles/user-states",
        ):
            parameters = {
                parameter["name"]: parameter["schema"]
                for parameter in paths[path]["get"]["parameters"]
            }
            self.assertEqual(parameters["limit"]["minimum"], 1)
            self.assertEqual(parameters["limit"]["maximum"], 100)
            self.assertEqual(parameters["offset"]["minimum"], 0)

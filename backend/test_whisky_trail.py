import os
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
from database import SessionLocal, get_db
import main
from routers.whisky_trail import build_whisky_trail


class WhiskyTrailTest(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.db.execute(models.event_bottles_table.delete())
        self.db.query(models.UserBottleAction).delete()
        self.db.query(models.Registration).delete()
        self.db.query(models.Bottle).delete()
        self.db.query(models.Event).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_returns_localized_empty_trail(self):
        trail = build_whisky_trail(telegram_id=1, lang="en", db=self.db)

        self.assertEqual(trail.status, "empty")
        self.assertEqual(trail.message, "Start of the Trail")
        self.assertEqual(trail.nodes, [])

    def test_builds_event_and_milestone_nodes(self):
        now = datetime.now(timezone.utc)
        events = [
            models.Event(
                title=f"Event {index}",
                name_i18n={"ru": f"Событие {index}"},
                date=(now + timedelta(days=offset)).isoformat(),
                description="Test event",
                price=10,
            )
            for index, offset in enumerate((-6, -5, -4, -3, 1, 2), start=1)
        ]
        bottles = [
            models.Bottle(name=f"Bottle {index}", favorites_count=0, tried_count=0)
            for index in range(3)
        ]
        self.db.add_all([*events, *bottles])
        self.db.commit()
        self.db.execute(
            models.event_bottles_table.insert(),
            [
                {"event_id": events[0].id, "bottle_id": bottles[0].id},
                {"event_id": events[0].id, "bottle_id": bottles[1].id},
                {"event_id": events[3].id, "bottle_id": bottles[2].id},
            ],
        )
        self.db.add_all(
            [
                models.Registration(
                    event_id=events[0].id,
                    telegram_id=7,
                    registered=True,
                ),
                models.Registration(
                    event_id=events[3].id,
                    telegram_id=7,
                    registered=True,
                ),
                models.UserBottleAction(
                    telegram_id=7,
                    bottle_id=bottles[0].id,
                    is_tried=True,
                ),
            ]
        )
        self.db.commit()

        trail = build_whisky_trail(telegram_id=7, lang="ru", db=self.db)

        self.assertEqual(trail.status, "success")
        self.assertEqual(trail.focused_node_id, f"event_{events[4].id}")
        self.assertEqual([node.id for node in trail.nodes], [
            f"event_{events[0].id}",
            f"event_{events[1].id}",
            f"event_{events[2].id}",
            "milestone_3",
            f"event_{events[3].id}",
            f"event_{events[4].id}",
            f"event_{events[5].id}",
            "milestone_6",
        ])
        self.assertEqual(trail.nodes[0].status, "attended")
        self.assertEqual(trail.nodes[1].status, "missed")
        self.assertEqual(trail.nodes[0].bottles_count, 2)
        self.assertEqual(trail.nodes[3].tried_bottles_count, 2)
        self.assertEqual(trail.nodes[4].status, "attended")
        self.assertEqual(trail.nodes[7].tried_bottles_count, 3)
        self.assertEqual(trail.nodes[0].title, "Событие 1")
        tried_bottle_ids = {
            action.bottle_id
            for action in self.db.query(models.UserBottleAction)
            .filter(
                models.UserBottleAction.telegram_id == 7,
                models.UserBottleAction.is_tried.is_(True),
            )
            .all()
        }
        self.assertEqual(
            tried_bottle_ids,
            {bottles[0].id, bottles[1].id, bottles[2].id},
        )


class WhiskyTrailAuthTest(unittest.TestCase):
    """The trail is private and records progress, so it needs a verified Telegram identity."""

    def setUp(self):
        # One shared in-memory database, because the TestClient serves requests from another thread.
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        models.Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = Session()

        def db_override():
            with Session() as request_db:
                yield request_db

        main.app.dependency_overrides[get_db] = db_override
        event = models.Event(
            title="Past tasting", date=(datetime.now(timezone.utc) - timedelta(days=3)).isoformat(),
            description="x", price=10)
        bottle = models.Bottle(name="Bottle", favorites_count=0, tried_count=0)
        self.db.add_all([event, bottle])
        self.db.commit()
        self.db.execute(models.event_bottles_table.insert(),
                        [{"event_id": event.id, "bottle_id": bottle.id}])
        self.db.add(models.Registration(event_id=event.id, telegram_id=42, registered=True))
        self.db.commit()
        self.client = TestClient(main.app)
        self.actor = None
        main.app.dependency_overrides[main.get_authenticated_telegram_user] = self.current_user

    def tearDown(self):
        main.app.dependency_overrides.clear()
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def current_user(self):
        if self.actor is None:
            raise main.HTTPException(401, "Missing Authorization header")
        return main.TelegramAuthContext(telegram_id=self.actor, user={})

    def tried_count(self, telegram_id):
        self.db.expire_all()
        return self.db.query(models.UserBottleAction).filter_by(
            telegram_id=telegram_id, is_tried=True).count()

    def test_anonymous_request_is_rejected_and_writes_nothing(self):
        response = self.client.get("/api/profile/whisky-trail", params={"telegram_id": 42})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.tried_count(42), 0)

    def test_other_users_trail_is_forbidden_and_writes_nothing(self):
        self.actor = 7
        response = self.client.get("/api/profile/whisky-trail", params={"telegram_id": 42})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.tried_count(42), 0)
        self.assertEqual(self.tried_count(7), 0)

    def test_authenticated_user_gets_own_trail_with_or_without_telegram_id(self):
        self.actor = 42
        for params in ({"telegram_id": 42}, {}):
            response = self.client.get("/api/profile/whisky-trail", params=params)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["nodes"][0]["status"], "attended")
        self.assertEqual(self.tried_count(42), 1)

    def test_real_token_validation_is_used_when_not_overridden(self):
        main.app.dependency_overrides.clear()
        with patch.dict(os.environ, {"BOT_TOKEN": "test-token"}):
            response = self.client.get("/api/profile/whisky-trail", params={"telegram_id": 42},
                                       headers={"Authorization": "tma user=%7B%22id%22%3A42%7D&hash=bad"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.tried_count(42), 0)

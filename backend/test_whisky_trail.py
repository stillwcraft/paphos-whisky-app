import os
import unittest
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite://"

import models
from database import SessionLocal
import main
from routers.whisky_trail import get_whisky_trail


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
        trail = get_whisky_trail(telegram_id=1, lang="en", db=self.db)

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

        trail = get_whisky_trail(telegram_id=7, lang="ru", db=self.db)

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

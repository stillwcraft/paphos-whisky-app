import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"

import models
from fastapi import HTTPException
from main import get_bottle_tag_stats
from database import SessionLocal


class BottleTagStatsTest(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        for model in (
            models.UserReviewTag,
            models.UserReview,
            models.TastingTag,
            models.Bottle,
        ):
            self.db.query(model).delete()
        self.db.commit()

        self.empty_bottle = models.Bottle(
            name="Empty",
            price_per_sample=10,
            description="No reviews",
        )
        self.target_bottle = models.Bottle(
            name="Target",
            price_per_sample=10,
            description="Target reviews",
        )
        self.other_bottle = models.Bottle(
            name="Other",
            price_per_sample=10,
            description="Other reviews",
        )
        self.db.add_all([self.empty_bottle, self.target_bottle, self.other_bottle])
        self.db.flush()

        self.apple = models.TastingTag(name="Apple", icon_url="https://example.com/apple.svg")
        self.berry = models.TastingTag(name="Berry", icon_url="https://example.com/berry.svg")
        self.unused = models.TastingTag(name="Unused", icon_url="https://example.com/unused.svg")
        self.db.add_all([self.apple, self.berry, self.unused])
        self.db.flush()

        first_target_review = models.UserReview(
            telegram_id=1,
            bottle_id=self.target_bottle.id,
            nose=80,
            taste=80,
            finish=80,
        )
        second_target_review = models.UserReview(
            telegram_id=2,
            bottle_id=self.target_bottle.id,
            nose=80,
            taste=80,
            finish=80,
        )
        other_review = models.UserReview(
            telegram_id=3,
            bottle_id=self.other_bottle.id,
            nose=80,
            taste=80,
            finish=80,
        )
        self.db.add_all([first_target_review, second_target_review, other_review])
        self.db.flush()
        self.db.add_all([
            models.UserReviewTag(review_id=first_target_review.id, tasting_tag_id=self.apple.id),
            models.UserReviewTag(review_id=first_target_review.id, tasting_tag_id=self.berry.id),
            models.UserReviewTag(review_id=second_target_review.id, tasting_tag_id=self.apple.id),
            models.UserReviewTag(review_id=other_review.id, tasting_tag_id=self.berry.id),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_aggregates_only_selected_bottle_tags(self):
        empty_stats = get_bottle_tag_stats(self.empty_bottle.id, self.db)
        target_stats = get_bottle_tag_stats(self.target_bottle.id, self.db)
        other_stats = get_bottle_tag_stats(self.other_bottle.id, self.db)

        self.assertEqual(empty_stats, [])
        self.assertEqual(
            [stat.model_dump() for stat in target_stats],
            [
                {
                    "id": self.apple.id,
                    "name": "Apple",
                    "icon_url": "https://example.com/apple.svg",
                    "count": 2,
                },
                {
                    "id": self.berry.id,
                    "name": "Berry",
                    "icon_url": "https://example.com/berry.svg",
                    "count": 1,
                },
            ],
        )
        self.assertEqual(
            [stat.model_dump() for stat in other_stats],
            [{
                "id": self.berry.id,
                "name": "Berry",
                "icon_url": "https://example.com/berry.svg",
                "count": 1,
            }],
        )

    def test_returns_404_for_unknown_bottle(self):
        with self.assertRaisesRegex(HTTPException, "Bottle not found") as context:
            get_bottle_tag_stats(999999, self.db)
        self.assertEqual(context.exception.status_code, 404)

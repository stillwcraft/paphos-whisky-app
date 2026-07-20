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

        self.assertEqual(empty_stats.model_dump(), {"club_rating": None, "tags": []})
        self.assertEqual(
            [stat.model_dump() for stat in target_stats.tags],
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
            [stat.model_dump() for stat in other_stats.tags],
            [{
                "id": self.berry.id,
                "name": "Berry",
                "icon_url": "https://example.com/berry.svg",
                "count": 1,
            }],
        )
        self.assertEqual(target_stats.club_rating, 80.0)
        self.assertEqual(other_stats.club_rating, 80.0)

    def test_club_rating_is_rounded_to_two_decimal_places(self):
        rating_bottle = models.Bottle(
            name="Precise rating",
            price_per_sample=10,
            description="Rating precision",
        )
        self.db.add(rating_bottle)
        self.db.flush()
        self.db.add_all([
            models.UserReview(
                telegram_id=4,
                bottle_id=rating_bottle.id,
                nose=80,
                taste=81,
                finish=82,
            ),
            models.UserReview(
                telegram_id=5,
                bottle_id=rating_bottle.id,
                nose=82,
                taste=83,
                finish=85,
            ),
        ])
        self.db.commit()

        stats = get_bottle_tag_stats(rating_bottle.id, self.db)

        self.assertEqual(stats.club_rating, 82.17)
        self.assertEqual(stats.tags, [])

    def test_returns_only_top_ten_tags_in_count_then_name_order(self):
        top_bottle = models.Bottle(
            name="Top tags",
            price_per_sample=10,
            description="Top ten tags",
        )
        top_tag = models.TastingTag(name="Top", icon_url="https://example.com/top.svg")
        flavor_tags = [
            models.TastingTag(
                name=f"Flavor {index:02d}",
                icon_url=f"https://example.com/flavor-{index}.svg",
            )
            for index in range(1, 12)
        ]
        self.db.add_all([top_bottle, top_tag, *flavor_tags])
        self.db.flush()

        first_review = models.UserReview(
            telegram_id=6,
            bottle_id=top_bottle.id,
            nose=80,
            taste=80,
            finish=80,
        )
        second_review = models.UserReview(
            telegram_id=7,
            bottle_id=top_bottle.id,
            nose=80,
            taste=80,
            finish=80,
        )
        self.db.add_all([first_review, second_review])
        self.db.flush()
        self.db.add_all([
            *(models.UserReviewTag(review_id=first_review.id, tasting_tag_id=tag.id)
              for tag in [top_tag, *flavor_tags]),
            models.UserReviewTag(review_id=second_review.id, tasting_tag_id=top_tag.id),
        ])
        self.db.commit()

        stats = get_bottle_tag_stats(top_bottle.id, self.db)

        self.assertEqual(
            [tag.name for tag in stats.tags],
            ["Top", *(f"Flavor {index:02d}" for index in range(1, 10))],
        )
        self.assertEqual([tag.count for tag in stats.tags], [2, *([1] * 9)])

    def test_returns_404_for_unknown_bottle(self):
        with self.assertRaisesRegex(HTTPException, "Bottle not found") as context:
            get_bottle_tag_stats(999999, self.db)
        self.assertEqual(context.exception.status_code, 404)

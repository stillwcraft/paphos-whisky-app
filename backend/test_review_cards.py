import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

import card_generator as cards
import main
import models
from database import SessionLocal
from fastapi import HTTPException


class ReviewCardEndpointTest(unittest.TestCase):
    def setUp(self):
        cards._cache.clear()
        self.db = SessionLocal()
        bottle = models.Bottle(name="Card endpoint bottle", price_per_sample=10)
        self.db.add(bottle)
        self.db.flush()
        self.review = models.UserReview(
            telegram_id=987654321, bottle_id=bottle.id,
            nose=87, taste=87, finish=87,
            author_name="Card author", author_username="card_author",
        )
        self.db.add(self.review)
        self.db.flush()

    def tearDown(self):
        self.db.rollback()
        self.db.close()
        cards._cache.clear()

    def test_preview_download_and_publication_reuse_png(self):
        user = main.TelegramAuthContext(telegram_id=self.review.telegram_id, user={})
        with patch.object(cards, "_draw_card", wraps=cards._draw_card) as render:
            preview = main.get_review_card(self.review.id, download=False, db=self.db)
            download = main.get_review_card(self.review.id, download=True, db=self.db)
            self.assertEqual(preview.media_type, "image/png")
            self.assertNotIn("content-disposition", preview.headers)
            self.assertEqual(
                preview.headers["cache-control"],
                "no-cache, no-store, must-revalidate",
            )
            self.assertEqual(preview.headers["pragma"], "no-cache")
            self.assertEqual(preview.headers["expires"], "0")
            self.assertIn('attachment;', download.headers["content-disposition"])
            self.assertEqual(preview.body, download.body)
            self.assertTrue(preview.body.startswith(b"\x89PNG\r\n\x1a\n"))
            with patch.dict(os.environ, {"BOT_TOKEN": "test-token", "CLUB_CHAT_ID": "-100123"}):
                with patch.object(main.requests, "post") as send:
                    send.return_value.json.return_value = {"ok": True}
                    main.share_review_card(
                        self.review.id, main.ReviewShareRequest(thread_id=42),
                        db=self.db, authenticated_user=user,
                    )
                    self.assertEqual(send.call_args.kwargs["files"]["photo"][1], preview.body)
                    self.assertEqual(send.call_args.kwargs["data"]["message_thread_id"], 42)
            render.assert_called_once()

    def test_renderer_failure_remains_503(self):
        with patch.object(main, "render_review_card", side_effect=cards.CardGenerationError("bad image")):
            with self.assertRaises(HTTPException) as error:
                main.get_review_card(self.review.id, db=self.db)
        self.assertEqual(error.exception.status_code, 503)

    def test_card_verdict_uses_requested_language(self):
        expected_verdicts = {
            "en": ("A Solid Classic.", "An excellent choice for a fine evening."),
            "ru": ("Достойная классика.", "Отличный выбор для хорошего вечера."),
            "uk": ("Гідна класика.", "Чудовий вибір для гарного вечора."),
        }
        for language, expected in expected_verdicts.items():
            card = main.get_review_card_data(self.review.id, self.db, language)
            self.assertEqual((card.verdict, card.verdict_subtitle), expected)

    def test_cannot_share_another_users_card(self):
        with patch.object(main.requests, "post") as send:
            with self.assertRaises(HTTPException) as error:
                main.share_review_card(
                    self.review.id, main.ReviewShareRequest(), db=self.db,
                    authenticated_user=main.TelegramAuthContext(telegram_id=123, user={}),
                )
            self.assertEqual(error.exception.status_code, 401)
            send.assert_not_called()


if __name__ == "__main__":
    unittest.main()

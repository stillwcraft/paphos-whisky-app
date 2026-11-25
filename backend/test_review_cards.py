import os
import time
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
        self.distillery = models.Distillery(
            name="Card endpoint distillery",
            logo_url="https://example.com/original-logo.png",
            card_logo_url="https://example.com/card-logo.webp",
        )
        bottle = models.Bottle(
            name="Card endpoint bottle",
            price_per_sample=10,
            distillery=self.distillery,
        )
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
            with patch.dict(os.environ, {"BOT_TOKEN": "test-token", "CLUB_CHAT_ID": "-100123", "CLUB_ALLOWED_THREAD_IDS": "42,43"}):
                with patch.object(main.requests, "post") as send:
                    send.return_value.json.return_value = {"ok": True}
                    main.share_review_card(
                        self.review.id, main.ReviewShareRequest(thread_id=42),
                        db=self.db, authenticated_user=user,
                    )
                    self.assertEqual(send.call_args.kwargs["files"]["photo"][1], preview.body)
                    self.assertEqual(send.call_args.kwargs["data"]["message_thread_id"], 42)
            render.assert_called_once()

    def share(self, request=None, user=None, review=None, **env):
        user = user or main.TelegramAuthContext(telegram_id=self.review.telegram_id, user={})
        base = {"BOT_TOKEN": "test-token", "CLUB_CHAT_ID": "-100123"}
        with patch.dict(os.environ, {**base, **env}), patch.object(main.requests, "post") as send:
            send.return_value.json.return_value = {"ok": True}
            main.share_review_card(
                (review or self.review).id, request or main.ReviewShareRequest(),
                db=self.db, authenticated_user=user)
            return send

    def reset_share_state(self):
        main._share_history.clear()
        main._shared_reviews.clear()

    def test_share_topic_must_be_allowed_by_the_operator(self):
        self.reset_share_state()
        with self.assertRaises(HTTPException) as error:
            self.share(main.ReviewShareRequest(thread_id=7), CLUB_ALLOWED_THREAD_IDS="42")
        self.assertEqual(error.exception.status_code, 403)
        # Nothing was posted, so the quota is untouched and an allowed topic still works.
        send = self.share(main.ReviewShareRequest(thread_id=42), CLUB_ALLOWED_THREAD_IDS="42")
        self.assertEqual(send.call_args.kwargs["data"]["message_thread_id"], 42)

    def test_share_without_client_topic_uses_configured_default_only(self):
        self.reset_share_state()
        send = self.share(CLUB_THREAD_ID="99")
        self.assertEqual(send.call_args.kwargs["data"]["message_thread_id"], 99)
        self.reset_share_state()
        self.assertNotIn("message_thread_id", self.share().call_args.kwargs["data"])
        with self.assertRaises(HTTPException) as error:  # without any allowlist no client topic is accepted
            self.share(main.ReviewShareRequest(thread_id=5))
        self.assertEqual(error.exception.status_code, 403)

    def test_same_review_is_published_once_and_failures_do_not_consume_it(self):
        self.reset_share_state()
        with patch.dict(os.environ, {"BOT_TOKEN": "t", "CLUB_CHAT_ID": "-1"}), \
                patch.object(main.requests, "post", side_effect=main.requests.RequestException("down")):
            with self.assertRaises(HTTPException) as error:
                main.share_review_card(self.review.id, main.ReviewShareRequest(), db=self.db,
                                       authenticated_user=main.TelegramAuthContext(
                                           telegram_id=self.review.telegram_id, user={}))
            self.assertEqual(error.exception.status_code, 502)
        self.share()  # retry after a Telegram outage succeeds
        with self.assertRaises(HTTPException) as error:
            self.share()
        self.assertEqual(error.exception.status_code, 409)

    def test_member_hourly_share_limit(self):
        self.reset_share_state()
        for review_id in range(main.SHARES_PER_HOUR):
            main.claim_share_slot(self.review.telegram_id, 1000 + review_id)
        with self.assertRaises(HTTPException) as error:
            self.share()
        self.assertEqual(error.exception.status_code, 429)
        self.reset_share_state()

    def owner(self, offset=0):
        return main.TelegramAuthContext(telegram_id=self.review.telegram_id + offset, user={})

    def assert_link_rejected(self, review_id, exp, sig):
        with self.assertRaises(HTTPException) as error:
            main.require_review_card_link(review_id, exp, sig)
        self.assertEqual(error.exception.status_code, 403)

    def test_card_requires_a_valid_unexpired_owner_link(self):
        with patch.dict(os.environ, {"BOT_TOKEN": "test-token"}):
            self.assert_link_rejected(self.review.id, 0, "")
            self.assert_link_rejected(self.review.id, 9999999999, "bad")
            link = main.create_review_card_link(self.review.id, db=self.db, authenticated_user=self.owner())
            main.require_review_card_link(self.review.id, link.exp, link.sig)  # accepted
            # The signature is bound to one review and cannot be stretched past its expiry.
            self.assert_link_rejected(self.review.id + 1, link.exp, link.sig)
            self.assert_link_rejected(self.review.id, link.exp + 1, link.sig)
            expired = int(time.time()) - 1
            self.assert_link_rejected(self.review.id, expired,
                                      main.review_card_signature(self.review.id, expired))
        with patch.dict(os.environ, {"BOT_TOKEN": "another-token"}):
            self.assert_link_rejected(self.review.id, link.exp, link.sig)

    def test_card_endpoint_is_protected_by_the_link_dependency(self):
        route = next(r for r in main.app.routes if getattr(r, "path", "") == "/api/reviews/{review_id}/card.png")
        self.assertIn(main.require_review_card_link, [d.call for d in route.dependant.dependencies])

    def test_only_the_review_owner_can_obtain_a_card_link(self):
        with patch.dict(os.environ, {"BOT_TOKEN": "test-token"}):
            with self.assertRaises(HTTPException) as error:
                main.create_review_card_link(self.review.id, db=self.db, authenticated_user=self.owner(1))
            self.assertEqual(error.exception.status_code, 401)
            with self.assertRaises(HTTPException) as error:
                main.create_review_card_link(999999, db=self.db, authenticated_user=self.owner())
            self.assertEqual(error.exception.status_code, 404)

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

    def test_card_uses_optimized_distillery_logo(self):
        card = main.get_review_card_data(self.review.id, self.db)
        self.assertEqual(card.distillery_logo_url, self.distillery.card_logo_url)

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

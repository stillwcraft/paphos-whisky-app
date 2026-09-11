import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from io import BytesIO
from unittest.mock import MagicMock, patch

from PIL import Image, ImageDraw

import card_generator as cards


def sample_card(**changes):
    return replace(cards.ReviewCardData(
        bottle_name="Arran 10",
        bottle_image_url=None,
        distillery_name="Arran",
        distillery_logo_url=None,
        abv="46", age="10", cask="Bourbon / Sherry", bottles="1200",
        score=87, verdict="\u0414\u043e\u0441\u0442\u043e\u0439\u043d\u0430\u044f \u043a\u043b\u0430\u0441\u0441\u0438\u043a\u0430",
        verdict_subtitle="\u041e\u0442\u043b\u0438\u0447\u043d\u044b\u0439 \u0432\u044b\u0431\u043e\u0440 \u0434\u043b\u044f \u0445\u043e\u0440\u043e\u0448\u0435\u0433\u043e \u0432\u0435\u0447\u0435\u0440\u0430.",
        author_name="\u0410\u043d\u0442\u043e\u043d", author_username="anton",
        channel_handle="CyprusWhiskyClub",
    ), **changes)


class CardGeneratorTest(unittest.TestCase):
    def setUp(self):
        cards._cache.clear()

    def tearDown(self):
        cards._cache.clear()

    def test_png_dimensions_and_cyrillic(self):
        png = cards.render_review_card(sample_card())
        with Image.open(BytesIO(png)) as image:
            self.assertEqual(image.format, "PNG")
            self.assertEqual(image.size, (1080, 1080))
            self.assertEqual(image.mode, "RGB")
            score_colors = image.crop((72, 865, 204, 978)).getcolors(100000)
            self.assertTrue(any(color == (197, 160, 89) for _, color in score_colors))
            colors = image.crop((244, 1002, 670, 1050)).getcolors(100000)
            self.assertTrue(any(color == (158, 157, 154) for _, color in colors))

    def test_logo_and_bottle_are_composited(self):
        def image_fixture(url, bounds):
            color = "#ff0000" if "logo" in url else "#00ff00"
            return Image.new("RGBA", (100, 100), color)

        with patch.object(cards, "_load_image", side_effect=image_fixture) as load:
            png = cards.render_review_card(sample_card(
                bottle_image_url="https://example.com/bottle.png",
                distillery_logo_url="https://example.com/logo.png",
            ))
        self.assertEqual(load.call_count, 2)
        with Image.open(BytesIO(png)) as image:
            self.assertEqual(image.getpixel((540, 120)), (255, 0, 0))
            self.assertEqual(image.getpixel((540, 560)), (0, 255, 0))

    def test_unavailable_logo_falls_back_to_distillery_name(self):
        with patch.object(cards, "_load_image", side_effect=cards.CardGenerationError("403")), self.assertLogs(cards.logger):
            png = cards.render_review_card(sample_card(
                distillery_logo_url="https://example.com/blocked-logo.png",
            ))
        with Image.open(BytesIO(png)) as image:
            self.assertEqual(image.size, (1080, 1080))

    def test_long_text_and_missing_chips(self):
        png = cards.render_review_card(sample_card(
            bottle_name="Long title " * 100, author_name="Long author " * 100,
            cask="x" * 2000, age=None, abv="", bottles=" ",
        ))
        with Image.open(BytesIO(png)) as image:
            self.assertEqual(image.size, (1080, 1080))

    def test_chips_are_horizontal_and_fit_long_values(self):
        with Image.new("RGB", (1, 1)) as canvas:
            draw = ImageDraw.Draw(canvas)
            value, font = cards._fitted_chip_value(draw, "An exceptionally long cask description", 100)
            self.assertLessEqual(draw.textlength(value, font=font), 100)
            self.assertTrue(value.endswith("..."))

        png = cards.render_review_card(sample_card(
            abv="46%", age="10 y.o.", cask="An exceptionally long cask description", bottles="Regular Release",
        ))
        with Image.open(BytesIO(png)) as image:
            self.assertEqual(image.getpixel((100, 900)), (22, 22, 26))
            self.assertNotEqual(image.getpixel((800, 600)), (22, 22, 26))

    def test_repeated_requests_use_same_png_and_updates_invalidate(self):
        with patch.object(cards, "_draw_card", return_value=b"png") as render:
            self.assertEqual(cards.render_review_card(sample_card()), b"png")
            cards.render_review_card(sample_card())
            render.assert_called_once()
            cards.render_review_card(sample_card(score=90))
            self.assertEqual(render.call_count, 2)

    def test_cache_limits_and_expiration(self):
        with patch.object(cards, "CACHE_BYTES", 6), patch.object(cards, "_draw_card", return_value=b"png") as render:
            for score in range(10):
                cards.render_review_card(sample_card(score=score))
            self.assertEqual(len(cards._cache), 2)
            with patch.object(cards.time, "monotonic", return_value=time.monotonic() + 1000):
                cards.render_review_card(sample_card(score=9))
            self.assertEqual(render.call_count, 11)

    def test_concurrent_requests_generate_only_once(self):
        started = threading.Event()
        release = threading.Event()

        def slow_render(data):
            started.set()
            self.assertTrue(release.wait(2))
            return b"png"

        with patch.object(cards, "_draw_card", side_effect=slow_render) as render:
            with ThreadPoolExecutor(max_workers=4) as pool:
                jobs = [pool.submit(cards.render_review_card, sample_card()) for _ in range(4)]
                self.assertTrue(started.wait(2))
                release.set()
                self.assertEqual([job.result() for job in jobs], [b"png"] * 4)
            render.assert_called_once()

    def test_error_releases_slot_and_is_not_cached(self):
        with patch.object(cards, "_draw_card", side_effect=OSError("bad image")), self.assertLogs(cards.logger):
            with self.assertRaises(cards.CardGenerationError):
                cards.render_review_card(sample_card())
        self.assertFalse(cards._cache)
        with patch.object(cards, "_draw_card", return_value=b"png"):
            self.assertEqual(cards.render_review_card(sample_card()), b"png")

    def test_download_limits_and_decoding(self):
        with BytesIO() as output:
            with Image.new("RGB", (200, 400), "green") as image:
                image.save(output, format="PNG")
            payload = output.getvalue()
        response = MagicMock()
        response.is_redirect = False
        response.iter_content.side_effect = lambda _: iter([payload])
        session = MagicMock()
        session.get.return_value.__enter__.return_value = response
        with patch.object(cards, "_validate_image_url"), patch.object(cards.requests, "Session") as factory:
            factory.return_value.__enter__.return_value = session
            with cards._load_image("https://example.com/a.png", (100, 100)) as image:
                self.assertEqual(image.size, (50, 100))
            with patch.object(cards, "MAX_IMAGE_PIXELS", 100):
                with self.assertRaisesRegex(cards.CardGenerationError, "megapixel"):
                    cards._load_image("https://example.com/a.png", (100, 100))
            with patch.object(cards, "MAX_IMAGE_BYTES", 10):
                with self.assertRaisesRegex(cards.CardGenerationError, "download limit"):
                    cards._load_image("https://example.com/a.png", (100, 100))

    def test_rejects_non_public_image_sources(self):
        for url in ("file:///etc/passwd", "data:image/png;base64,abc"):
            with self.assertRaises(cards.CardGenerationError):
                cards._validate_image_url(url)
        with patch.object(cards.socket, "getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 80))]):
            with self.assertRaises(cards.CardGenerationError):
                cards._validate_image_url("http://localhost/test.png")


if __name__ == "__main__":
    unittest.main()

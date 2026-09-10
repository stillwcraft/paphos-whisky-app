from __future__ import annotations

import ipaddress
import logging
import math
import socket
import time
from collections import OrderedDict
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from threading import BoundedSemaphore
from typing import Optional
from urllib.parse import urljoin, urlsplit

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

logger = logging.getLogger(__name__)

SIZE = 1080
GOLD = "#C5A059"
LIGHT = "#F4F4F5"
MUTED = "#9E9D9A"
FONT_PATH = Path(__file__).with_name("fonts") / "NotoSans.ttf"
SERIF_FONT_PATH = Path(__file__).with_name("fonts") / "NotoSerif.ttf"
MAX_IMAGE_BYTES = 6 * 1024 * 1024
MAX_IMAGE_PIXELS = 12_000_000
CACHE_BYTES = 12 * 1024 * 1024
CACHE_TTL = 300
_render_slot = BoundedSemaphore(1)


class CardGenerationError(RuntimeError):
    """Raised when the card cannot be rendered safely."""


@dataclass(frozen=True)
class ReviewCardData:
    bottle_name: str
    bottle_image_url: Optional[str]
    distillery_name: str
    distillery_logo_url: Optional[str]
    abv: Optional[str]
    age: Optional[str]
    cask: Optional[str]
    bottles: Optional[str]
    score: int
    verdict: str
    verdict_subtitle: str
    author_name: str
    author_username: Optional[str]
    channel_handle: str


_cache: OrderedDict[ReviewCardData, tuple[float, bytes]] = OrderedDict()


def _validate_image_url(url: str) -> None:
    parsed = urlsplit(url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise CardGenerationError("Card images must use public HTTP(S) URLs")
    addresses = socket.getaddrinfo(
        parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80),
        type=socket.SOCK_STREAM,
    )
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise CardGenerationError("Private network images are not allowed")


def _load_image(url: str, bounds: tuple[int, int]) -> Image.Image:
    # Bound both compressed input and decoded pixels before allocating an RGBA image.
    deadline = time.monotonic() + 20
    with requests.Session() as session:
        for _ in range(4):
            _validate_image_url(url)
            with session.get(url, stream=True, timeout=(5, 10), allow_redirects=False) as response:
                if response.is_redirect:
                    url = urljoin(url, response.headers["Location"])
                    continue
                response.raise_for_status()
                with BytesIO() as source:
                    for chunk in response.iter_content(64 * 1024):
                        if time.monotonic() > deadline:
                            raise CardGenerationError("Card image download timed out")
                        if source.tell() + len(chunk) > MAX_IMAGE_BYTES:
                            raise CardGenerationError("Card image exceeds the 6 MB download limit")
                        source.write(chunk)
                    source.seek(0)
                    with Image.open(source) as image:
                        if image.width * image.height > MAX_IMAGE_PIXELS:
                            raise CardGenerationError("Card image exceeds the 12 megapixel limit")
                        image.thumbnail(bounds, Image.Resampling.LANCZOS)
                        oriented = ImageOps.exif_transpose(image)
                        try:
                            oriented.thumbnail(bounds, Image.Resampling.LANCZOS)
                            return oriented.convert("RGBA")
                        finally:
                            oriented.close()
        raise CardGenerationError("Too many card image redirects")


def _font(size: int, bold: bool = False, serif: bool = False) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(SERIF_FONT_PATH if serif else FONT_PATH), size)
    font.set_variation_by_axes([700 if bold else 400, 100])
    return font


def _text(
    draw: ImageDraw.ImageDraw,
    value: str,
    box: tuple[int, int, int, int],
    size: int,
    color: str = LIGHT,
    bold: bool = False,
    align: str = "left",
    serif: bool = False,
) -> None:
    font = _font(size, bold, serif)
    left, top, right, bottom = box
    line_height = size + 9
    max_lines = max(1, (bottom - top) // line_height)
    lines = [""]
    # Character wrapping also handles long usernames and unbroken cask names.
    for char in " ".join(value.split())[:1000]:
        candidate = lines[-1] + char
        if draw.textlength(candidate, font=font) <= right - left:
            lines[-1] = candidate
        elif len(lines) < max_lines:
            lines.append(char.lstrip())
        else:
            while lines[-1] and draw.textlength(lines[-1] + "...", font=font) > right - left:
                lines[-1] = lines[-1][:-1]
            lines[-1] += "..."
            break
    for line in lines:
        line = line.strip()
        width = draw.textlength(line, font=font)
        x = right - width if align == "right" else (left + right - width) / 2 if align == "center" else left
        draw.text((x, top), line, font=font, fill=color, anchor="lt")
        top += line_height


def _background() -> Image.Image:
    # Compute the soft spotlight on a small image, not a million Python objects.
    with Image.new("RGB", (135, 135)) as small:
        pixels = []
        for y in range(135):
            for x in range(135):
                glow = .31 * math.exp(-(((x - 62) / 35) ** 2 + ((y - 63) / 38) ** 2))
                pixels.append(tuple(round(base + (gold - base) * glow) for base, gold in zip((13, 13, 14), (197, 160, 89))))
        small.putdata(pixels)
        return small.resize((SIZE, SIZE), Image.Resampling.BICUBIC)


def _draw_chip_icon(draw: ImageDraw.ImageDraw, label: str, x: int, y: int) -> None:
    color, width = "#D2AF6B", 2
    if label == "ABV":
        draw.rounded_rectangle((x + 8, y, x + 19, y + 25), radius=6, outline=color, width=width)
        draw.line((x + 13, y + 7, x + 13, y + 22), fill=color, width=width)
        draw.ellipse((x + 8, y + 19, x + 19, y + 30), outline=color, width=width)
        for offset in (6, 12, 18):
            draw.line((x + 24, y + offset, x + 29, y + offset), fill=color, width=width)
    elif label == "AGE":
        draw.rounded_rectangle((x + 2, y + 3, x + 28, y + 28), radius=5, outline=color, width=width)
        draw.line((x + 2, y + 10, x + 28, y + 10), fill=color, width=width)
        draw.line((x + 2, y + 21, x + 28, y + 21), fill=color, width=width)
        for offset in (8, 15, 22):
            draw.line((x + offset, y + 3, x + offset, y + 28), fill=color, width=width)
        _text(draw, "VOS", (x + 8, y + 12, x + 24, y + 20), 6, color, True, "center")
    elif label == "CASK":
        draw.rounded_rectangle((x + 2, y + 2, x + 29, y + 30), radius=11, outline=color, width=width)
        draw.line((x + 2, y + 9, x + 29, y + 9), fill=color, width=width)
        draw.line((x + 2, y + 22, x + 29, y + 22), fill=color, width=width)
        for offset in (8, 15, 22):
            draw.line((x + offset, y + 3, x + offset, y + 29), fill=color, width=width)
    else:
        draw.rounded_rectangle((x + 13, y + 2, x + 22, y + 11), radius=2, outline=color, width=width)
        draw.rounded_rectangle((x + 9, y + 10, x + 26, y + 28), radius=3, outline=color, width=width)
        draw.line((x + 12, y + 17, x + 23, y + 17), fill=color, width=width)
        draw.line((x + 1, y + 26, x + 9, y + 26), fill=color, width=width)
        draw.line((x + 1, y + 26, x + 1, y + 32), fill=color, width=width)
        draw.line((x + 1, y + 32, x + 13, y + 32), fill=color, width=width)
        draw.arc((x + 10, y + 23, x + 30, y + 38), 5, 170, fill=color, width=width)


def _load_card_image(url: Optional[str], bounds: tuple[int, int], label: str) -> Optional[Image.Image]:
    if not url:
        return None
    try:
        return _load_image(url, bounds)
    except CardGenerationError:
        logger.warning("Unable to load %s image for review card", label, exc_info=True)
        return None


def _draw_card(data: ReviewCardData) -> bytes:
    with _background() as card:
        draw = ImageDraw.Draw(card)
        logo = _load_card_image(data.distillery_logo_url, (380, 120), "distillery logo")
        if logo:
            try:
                card.paste(logo, ((SIZE - logo.width) // 2, 65 + (120 - logo.height) // 2), logo)
            finally:
                logo.close()
        else:
            _text(draw, data.distillery_name, (72, 80, 1008, 185), 36, GOLD, True, "center", True)
        _text(draw, data.bottle_name, (72, 207, 1008, 313), 44, "#EAD7AE", True, "center", True)

        with Image.new("RGBA", (610, 100)) as shadow:
            ImageDraw.Draw(shadow).ellipse((65, 40, 545, 61), fill=(0, 0, 0, 185))
            with shadow.filter(ImageFilter.GaussianBlur(18)) as blurred:
                card.paste(blurred, (235, 730), blurred)
        bottle = _load_card_image(data.bottle_image_url, (540, 490), "bottle")
        if bottle:
            try:
                card.paste(bottle, ((SIZE - bottle.width) // 2, 315 + (490 - bottle.height) // 2), bottle)
            finally:
                bottle.close()
        else:
            _text(draw, "No bottle image", (260, 525, 740, 585), 24, MUTED, align="center")

        values = [
            (label, value.strip()) for label, value in (
                ("ABV", data.abv), ("AGE", data.age),
                ("CASK", data.cask), ("BOTTLES", data.bottles),
            ) if value and value.strip()
        ]
        chip_height = 100
        y = 560 - (len(values) * (chip_height + 14) - 14) // 2
        for label, value in values:
            draw.rounded_rectangle((748, y, 1008, y + chip_height), radius=12, fill="#16161A", outline="#7D6133", width=1)
            _draw_chip_icon(draw, label, 766, y + 31)
            _text(draw, label, (808, y + 14, 992, y + 38), 12, GOLD, True)
            _text(draw, value, (808, y + 42, 992, y + 90), 19)
            y += chip_height + 14

        draw.line((72, 842, 1008, 842), fill="#604A28", width=1)
        _text(draw, str(data.score), (72, 865, 204, 954), 72, GOLD, True, "center", True)
        _text(draw, "POINTS", (72, 951, 204, 978), 12, GOLD, True, "center")
        _text(draw, data.verdict, (244, 876, 670, 925), 25, "#EAD7AE", True, "center", True)
        _text(draw, data.verdict_subtitle, (244, 932, 670, 978), 15, MUTED, align="center")
        draw.rounded_rectangle((338, 1000, 576, 1004), radius=2, fill="#3E3529")
        draw.rounded_rectangle((338, 1000, 445, 1004), radius=2, fill=GOLD)
        username = data.author_username.lstrip("@") if data.author_username else data.author_name
        _text(draw, f"REVIEW BY {username.upper()}", (710, 868, 1008, 900), 14, "#D1B276", True, "center", True)
        _text(draw, "h", (716, 908, 790, 982), 71, "#D1B276", align="center", serif=True)
        _text(draw, "Cyprus", (790, 910, 1008, 943), 27, "#D1B276", align="left", serif=True)
        _text(draw, "Whisky Club", (790, 944, 1008, 978), 27, "#D1B276", align="left", serif=True)
        _text(draw, f"@{data.channel_handle.lstrip('@')}", (710, 993, 1008, 1028), 21, "#D1B276", align="center", serif=True)
        with BytesIO() as output:
            card.save(output, format="PNG")
            return output.getvalue()


def render_review_card(data: ReviewCardData) -> bytes:
    # Serialize generation, including image decoding, and reuse the PNG for download/share.
    if not _render_slot.acquire(timeout=5):
        logger.warning("Review card renderer is busy")
        raise CardGenerationError("Review card renderer is busy; retry shortly")
    try:
        now = time.monotonic()
        for key, (expires, _) in list(_cache.items()):
            if expires <= now:
                del _cache[key]
        if data in _cache:
            _cache.move_to_end(data)
            return _cache[data][1]
        png = _draw_card(data)
        while _cache and (len(_cache) >= 8 or sum(len(item[1]) for item in _cache.values()) + len(png) > CACHE_BYTES):
            _cache.popitem(last=False)
        if len(png) <= CACHE_BYTES:
            _cache[data] = (time.monotonic() + CACHE_TTL, png)
        return png
    except (CardGenerationError, requests.RequestException, OSError, ValueError, Image.DecompressionBombError) as exc:
        logger.exception("Failed to render social proof review card")
        raise CardGenerationError("Unable to render review card") from exc
    finally:
        _render_slot.release()

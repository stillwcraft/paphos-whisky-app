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
    author_name: str
    author_username: Optional[str]


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


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONT_PATH), size)
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
) -> None:
    font = _font(size, bold)
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
                glow = .15 * math.exp(-(((x - 62) / 38) ** 2 + ((y - 65) / 43) ** 2))
                pixels.append(tuple(round(base + (gold - base) * glow) for base, gold in zip((13, 13, 14), (197, 160, 89))))
        small.putdata(pixels)
        return small.resize((SIZE, SIZE), Image.Resampling.BICUBIC)


def _draw_card(data: ReviewCardData) -> bytes:
    with _background() as card:
        draw = ImageDraw.Draw(card)
        if data.distillery_logo_url:
            with _load_image(data.distillery_logo_url, (380, 120)) as logo:
                card.paste(logo, ((SIZE - logo.width) // 2, 65 + (120 - logo.height) // 2), logo)
        else:
            _text(draw, data.distillery_name, (72, 80, 1008, 185), 36, GOLD, True, "center")
        _text(draw, data.bottle_name, (72, 207, 1008, 313), 40, bold=True, align="center")

        with Image.new("RGBA", (540, 80)) as shadow:
            ImageDraw.Draw(shadow).ellipse((65, 30, 475, 47), fill=(0, 0, 0, 160))
            with shadow.filter(ImageFilter.GaussianBlur(12)) as blurred:
                card.paste(blurred, (270, 760), blurred)
        if data.bottle_image_url:
            with _load_image(data.bottle_image_url, (540, 490)) as bottle:
                card.paste(bottle, ((SIZE - bottle.width) // 2, 315 + (490 - bottle.height) // 2), bottle)
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
            draw.rounded_rectangle((756, y, 1008, y + chip_height), radius=12, fill="#16161A", outline="#51402D", width=1)
            _text(draw, label, (772, y + 12, 992, y + 36), 12, GOLD, True)
            _text(draw, value, (772, y + 35, 992, y + 96), 19)
            y += chip_height + 14

        draw.line((72, 842, 1008, 842), fill="#393024", width=1)
        draw.rounded_rectangle((72, 875, 220, 995), radius=18, outline=GOLD, width=3)
        _text(draw, str(data.score), (78, 894, 214, 986), 66, GOLD, True, "center")
        _text(draw, data.verdict, (72, 1010, 552, 1068), 19, MUTED)
        _text(draw, data.author_name, (586, 900, 1008, 979), 26, bold=True, align="right")
        if data.author_username:
            _text(draw, f"@{data.author_username.lstrip('@')}", (586, 992, 1008, 1058), 20, GOLD, align="right")
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

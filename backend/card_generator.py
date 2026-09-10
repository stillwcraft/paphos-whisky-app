from __future__ import annotations

from dataclasses import dataclass
from html import escape
from typing import Optional


class CardGenerationError(RuntimeError):
    """Raised when the headless browser cannot render a social card."""


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


def _chip(label: str, value: Optional[str]) -> str:
    if not value or not value.strip():
        return ""
    return (
        '<div class="chip">'
        f'<span class="chip-label">{escape(label)}</span>'
        f'<span>{escape(value.strip())}</span>'
        "</div>"
    )


def build_review_card_html(data: ReviewCardData) -> str:
    logo = (
        f'<img class="logo" src="{escape(data.distillery_logo_url, quote=True)}" alt="" />'
        if data.distillery_logo_url
        else f'<div class="distillery-name">{escape(data.distillery_name)}</div>'
    )
    bottle_image = (
        f'<img class="bottle" src="{escape(data.bottle_image_url, quote=True)}" alt="" />'
        if data.bottle_image_url
        else '<div class="missing-bottle">No bottle image</div>'
    )
    username = f"@{data.author_username.lstrip('@')}" if data.author_username else ""
    chips = "".join(
        (
            _chip("ABV", data.abv),
            _chip("AGE", data.age),
            _chip("CASK", data.cask),
            _chip("BOTTLES", data.bottles),
        )
    )
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; width: 1080px; height: 1080px; overflow: hidden; color: #F4F4F5;
    font-family: Arial, Helvetica, sans-serif; background: #0D0D0E; }}
  .card {{ position: relative; width: 1080px; height: 1080px; overflow: hidden; padding: 72px;
    background: radial-gradient(ellipse at 50% 47%, rgba(197,160,89,.15) 0%, rgba(22,22,26,.55) 32%, #0D0D0E 70%); }}
  .header {{ height: 130px; display: flex; align-items: center; justify-content: center; }}
  .logo {{ max-width: 380px; max-height: 115px; object-fit: contain; filter: drop-shadow(0 8px 18px rgba(0,0,0,.55)); }}
  .distillery-name {{ color: #C5A059; font-family: Georgia, serif; font-size: 38px; font-weight: bold; letter-spacing: 2px; }}
  .bottle-name {{ position: absolute; top: 198px; left: 72px; right: 72px; text-align: center;
    font-family: Georgia, serif; font-size: 42px; font-weight: bold; }}
  .showcase {{ position: relative; height: 610px; display: flex; align-items: center; justify-content: center; }}
  .bottle {{ max-width: 560px; max-height: 590px; object-fit: contain; filter: drop-shadow(0 22px 24px rgba(0,0,0,.8)); }}
  .missing-bottle {{ color: #9E9D9A; font-size: 24px; }}
  .chips {{ position: absolute; right: 16px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: flex-end; gap: 16px; }}
  .chip {{ min-width: 158px; max-width: 258px; padding: 13px 16px; border: 1px solid rgba(197,160,89,.3);
    border-radius: 12px; background: rgba(22,22,26,.9); box-shadow: 0 10px 22px rgba(0,0,0,.28); font-size: 19px; }}
  .chip-label {{ display: block; margin-bottom: 4px; color: #C5A059; font-size: 12px; font-weight: bold; letter-spacing: 1.5px; }}
  .footer {{ display: flex; align-items: end; justify-content: space-between; min-height: 180px; border-top: 1px solid rgba(197,160,89,.2); padding-top: 28px; }}
  .score {{ display: inline-flex; min-width: 116px; height: 116px; align-items: center; justify-content: center;
    border: 3px solid #C5A059; border-radius: 18px; color: #C5A059; font-size: 66px; font-weight: bold; line-height: 1; }}
  .verdict {{ margin: 14px 0 0; color: #9E9D9A; font-size: 19px; }}
  .author {{ text-align: right; padding-bottom: 6px; }}
  .author-name {{ font-size: 26px; font-weight: bold; }}
  .username {{ margin-top: 7px; color: #C5A059; font-size: 20px; }}
</style>
</head>
<body>
  <main class="card">
    <header class="header">{logo}</header>
    <div class="bottle-name">{escape(data.bottle_name)}</div>
    <section class="showcase">{bottle_image}<div class="chips">{chips}</div></section>
    <footer class="footer">
      <div><div class="score">{data.score}</div><p class="verdict">{escape(data.verdict)}</p></div>
      <div class="author"><div class="author-name">{escape(data.author_name)}</div><div class="username">{escape(username)}</div></div>
    </footer>
  </main>
</body>
</html>"""


def render_review_card(data: ReviewCardData) -> bytes:
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(viewport={"width": 1080, "height": 1080}, device_scale_factor=1)
            page.set_content(build_review_card_html(data), wait_until="networkidle")
            image = page.screenshot(type="png")
            browser.close()
            return image
    except Exception as exc:
        raise CardGenerationError("Unable to render review card") from exc

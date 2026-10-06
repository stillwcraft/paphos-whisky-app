import os
import unittest
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite://"

import models
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, text
from database import SessionLocal
from fastapi import HTTPException
from unittest.mock import patch
from main import (
    ArticleCreate,
    ArticleUpdate,
    app,
    create_article,
    delete_article,
    get_admin_articles,
    get_article,
    get_articles,
    ensure_articles_schema,
    update_article,
)
from schemas.article import (
    AnimationConfig,
    ArticleResponse,
    BackgroundConfig,
    InteractiveSlide,
    PositionConfig,
    SlideElement,
    TextStyleConfig,
)


class ArticlesTest(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.db.query(models.Article).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_public_api_only_returns_published_articles_newest_first(self):
        old_article = models.Article(
            title={"ru": "Старая", "en": "Old"},
            content={"ru": "Старая статья", "en": "Old article"},
            created_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        newest_article = models.Article(
            title={"ru": "Новая"},
            content={"ru": "Новая статья"},
        )
        draft = models.Article(
            title={"ru": "Черновик"},
            content={"ru": "Черновик статьи"},
            is_published=False,
        )
        self.db.add_all([old_article, newest_article, draft])
        self.db.commit()

        page = get_articles(limit=3, offset=0, db=self.db)
        articles = page["items"]

        self.assertEqual([article.id for article in articles], [newest_article.id, old_article.id])
        self.assertEqual(articles[0].title, "Новая")
        self.assertEqual(page["total"], 2)
        self.assertFalse(page["has_more"])
        english_page = get_articles(lang="en", limit=3, offset=0, db=self.db)
        self.assertEqual(
            english_page["items"],
            [get_article(old_article.id, lang="en", db=self.db)],
        )
        with self.assertRaises(HTTPException) as context:
            get_article(draft.id, db=self.db)
        self.assertEqual(context.exception.status_code, 404)
        self.assertEqual(
            {article.id for article in get_admin_articles(db=self.db)},
            {old_article.id, newest_article.id, draft.id},
        )

    def test_admin_crud_persists_article_fields(self):
        article = create_article(
            ArticleCreate(
                title={"ru": "Новый релиз", "en": "New release", "uk": "Новий реліз"},
                content={
                    "ru": "Доступна новая бутылка.",
                    "en": "A new bottle is available.",
                    "uk": "Доступна нова пляшка.",
                },
                type="article",
                image_urls=["https://example.com/article.webp"],
                is_published=False,
            ),
            db=self.db,
        )
        self.assertEqual(article.type, "article")
        self.assertEqual(article.image_urls, ["https://example.com/article.webp"])

        updated = update_article(
            article.id,
            ArticleUpdate(is_published=True, title={"uk": "Оновлений реліз"}),
            db=self.db,
        )
        self.assertTrue(updated.is_published)
        self.assertEqual(
            updated.title,
            {
                "ru": "Новый релиз",
                "en": "New release",
                "uk": "Оновлений реліз",
            },
        )
        self.assertEqual(updated.content["en"], "A new bottle is available.")

        delete_article(article.id, db=self.db)
        with self.assertRaises(HTTPException) as context:
            get_article(article.id, db=self.db)
        self.assertEqual(context.exception.status_code, 404)

    def test_interactive_article_round_trip_and_partial_update(self):
        slide = {
            "slide_index": 0,
            "elements": [{
                "id": "headline",
                "type": "text",
                "content": {"ru": "Остров Скай", "en": "Isle of Skye"},
                "position": {"top": "20px", "width": "80%"},
                "animation": {"type": "slide_up", "delay": 0.2},
            }],
        }
        article = create_article(
            ArticleCreate(
                title={"ru": "История Talisker", "en": "Talisker history"},
                format="interactive_presentation",
                background_config=BackgroundConfig(type="image", value="/talisker.jpg", overlay_opacity=0.4),
                slides_data=[InteractiveSlide.model_validate(slide)],
            ),
            db=self.db,
        )
        self.assertEqual(article.content, {})
        self.assertEqual(ArticleResponse.model_validate(article).slides_data[0].elements[0].animation.delay, 0.2)
        self.assertEqual(article.background_config["value"], "/talisker.jpg")
        self.assertEqual(get_article(article.id, lang="en", db=self.db).slides_data[0]["slide_index"], 0)
        self.assertEqual(get_articles(lang="ru", limit=3, offset=0, db=self.db)["total"], 1)

        updated = update_article(article.id, ArticleUpdate(is_published=False), db=self.db)
        self.assertEqual(updated.slides_data[0]["elements"][0]["content"], slide["elements"][0]["content"])
        self.assertFalse(updated.is_published)
        with self.assertRaises(HTTPException) as invalid:
            update_article(article.id, ArticleUpdate(format=None), db=self.db)
        self.assertEqual(invalid.exception.status_code, 422)
        self.assertEqual(updated.format, "interactive_presentation")
        self.assertTrue(any(
            route.path == "/api/admin/articles/{article_id}" and "PATCH" in route.methods
            for route in app.routes
        ))

    def test_article_schema_defaults_and_validation(self):
        first = ArticleCreate(title={"en": "One"})
        second = ArticleCreate(title={"en": "Two"})
        first.image_urls.append("/one.jpg")
        first.slides_data.append(InteractiveSlide(slide_index=0, elements=[]))
        self.assertEqual(second.image_urls, [])
        self.assertEqual(second.slides_data, [])
        self.assertEqual(first.background_config.value, "#0a0a0c")
        self.assertEqual(PositionConfig().z_index, 10)
        self.assertEqual(TextStyleConfig().text_align, "left")
        self.assertEqual(ArticleUpdate().model_dump(exclude_unset=True), {})
        self.assertEqual(AnimationConfig(type="fade_in_out").duration, 1.1)
        self.assertEqual(AnimationConfig(type="fade_in_out", duration=0.8).duration, 0.8)
        self.assertEqual(AnimationConfig(type="pulse").duration, 2.0)
        self.assertEqual(AnimationConfig(type="pulse", duration=0.8).duration, 0.8)
        self.assertEqual(AnimationConfig(type="fade_in").duration, 0.5)

        for model, fields in [
            (AnimationConfig, {"type": "slide_up", "delay": -1}),
            (AnimationConfig, {"type": "fade_in", "duration": 0}),
            (AnimationConfig, {"type": "spin"}),
            (BackgroundConfig, {"overlay_opacity": 1.1}),
            (BackgroundConfig, {"overlay_opacity": -0.1}),
            (TextStyleConfig, {"text_align": "justify"}),
            (SlideElement, {"id": "broken", "type": "video", "position": {}}),
            (SlideElement, {"id": "missing-position", "type": "image"}),
            (ArticleCreate, {"title": {"en": "A"}, "format": "unknown"}),
            (ArticleCreate, {"title": {"en": "A"}, "slides_data": [{"slide_index": 0, "elements": [{"id": "x", "type": "text"}]}]}),
        ]:
            with self.subTest(model=model.__name__, fields=fields):
                with self.assertRaises(ValidationError):
                    model(**fields)

    def test_existing_article_table_gains_interactive_columns(self):
        legacy_engine = create_engine("sqlite://")
        with legacy_engine.begin() as connection:
            connection.execute(text(
                "CREATE TABLE articles (id INTEGER PRIMARY KEY, title JSON NOT NULL, "
                "content JSON NOT NULL, type VARCHAR(20), image_urls JSON, "
                "is_published BOOLEAN, created_at DATETIME, updated_at DATETIME)"
            ))
            connection.execute(text(
                "INSERT INTO articles (id, title, content, type, image_urls, is_published) "
                "VALUES (1, '{\"ru\":\"Старая\"}', '{\"ru\":\"Текст\"}', 'news', '[]', 1)"
            ))
        with patch("main.engine", legacy_engine):
            ensure_articles_schema()
            ensure_articles_schema()
        self.assertTrue(
            {"format", "background_config", "slides_data"}.issubset(
                {column["name"] for column in inspect(legacy_engine).get_columns("articles")}
            )
        )
        with legacy_engine.connect() as connection:
            row = connection.execute(
                text("SELECT format, background_config, slides_data FROM articles WHERE id = 1")
            ).one()
        self.assertEqual(row.format, "standard")
        self.assertEqual(row.background_config, '{"type":"color","value":"#0a0a0c","overlay_opacity":null}')
        self.assertEqual(row.slides_data, "[]")
        legacy_engine.dispose()

    def test_public_articles_are_paginated(self):
        now = datetime.now(timezone.utc)
        self.db.add_all(
            [
                models.Article(
                    title={"ru": f"Статья {index}"},
                    content={"ru": f"Текст {index}"},
                    created_at=now - timedelta(minutes=index),
                )
                for index in range(4)
            ]
        )
        self.db.commit()

        first_page = get_articles(limit=2, offset=0, db=self.db)
        second_page = get_articles(limit=2, offset=2, db=self.db)

        self.assertEqual(first_page["total"], 4)
        self.assertEqual(len(first_page["items"]), 2)
        self.assertTrue(first_page["has_more"])
        self.assertEqual(len(second_page["items"]), 2)
        self.assertFalse(second_page["has_more"])

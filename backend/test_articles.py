import os
import unittest
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite://"

import models
from database import SessionLocal
from fastapi import HTTPException
from main import (
    ArticleCreate,
    ArticleUpdate,
    create_article,
    delete_article,
    get_admin_articles,
    get_article,
    get_articles,
    update_article,
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

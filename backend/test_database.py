import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import create_engine

from database import normalize_database_url


class DatabaseUrlTests(unittest.TestCase):
    def test_supported_postgres_urls_use_installed_psycopg2_driver(self):
        for scheme in ("postgres://", "postgresql://", "postgresql+psycopg://"):
            with self.subTest(scheme=scheme):
                url = normalize_database_url(scheme + "user:password@localhost:5432/whisky")
                engine = create_engine(url)
                self.assertEqual(engine.dialect.driver, "psycopg2")
                engine.dispose()

    def test_other_urls_are_unchanged(self):
        self.assertEqual(normalize_database_url("sqlite://"), "sqlite://")


if __name__ == "__main__":
    unittest.main()

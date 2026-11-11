import os
import unittest
from pathlib import Path
from unittest.mock import MagicMock

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import Column, Integer, MetaData, Table, create_engine
from sqlalchemy.dialects import postgresql, sqlite

from database import Base, normalize_database_url, protect_backend_table


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


class TableSecurityTests(unittest.TestCase):
    def setUp(self):
        self.table = Table(
            "security_test", Base.metadata, Column("id", Integer, primary_key=True),
            schema="public",
        )
        self.addCleanup(Base.metadata.remove, self.table)
        self.connection = MagicMock()
        self.connection.dialect = postgresql.dialect()
        self.connection.execute.return_value.scalars.return_value = ["anon", "authenticated"]

    def statements(self):
        return [str(call.args[0]) for call in self.connection.execute.call_args_list]

    def test_postgres_tables_are_backend_only(self):
        protect_backend_table(self.table, self.connection)
        self.assertEqual(self.statements(), [
            "ALTER TABLE public.security_test ENABLE ROW LEVEL SECURITY",
            "REVOKE ALL PRIVILEGES ON TABLE public.security_test FROM PUBLIC",
            "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')",
            "REVOKE ALL PRIVILEGES ON TABLE public.security_test FROM anon",
            "REVOKE ALL PRIVILEGES ON TABLE public.security_test FROM authenticated",
        ])

    def test_plain_postgres_without_supabase_roles(self):
        self.connection.execute.return_value.scalars.return_value = []
        protect_backend_table(self.table, self.connection)
        self.assertEqual(len(self.statements()), 3)

    def test_sqlite_is_unchanged(self):
        self.connection.dialect = sqlite.dialect()
        protect_backend_table(self.table, self.connection)
        self.connection.execute.assert_not_called()

    def test_unrelated_metadata_is_unchanged(self):
        table = Table("other", MetaData(), Column("id", Integer, primary_key=True))
        protect_backend_table(table, self.connection)
        self.connection.execute.assert_not_called()

    def test_table_create_fires_security_hook(self):
        from sqlalchemy import create_mock_engine

        statements = []

        def execute(statement, *args, **kwargs):
            statements.append(str(statement.compile(dialect=postgresql.dialect())))
            result = MagicMock()
            result.scalars.return_value = ["anon", "authenticated"]
            return result

        engine = create_mock_engine("postgresql://", execute)
        self.table.create(engine)
        self.assertIn(
            "ALTER TABLE public.security_test ENABLE ROW LEVEL SECURITY", statements
        )
        self.assertIn(
            "REVOKE ALL PRIVILEGES ON TABLE public.security_test FROM authenticated",
            statements,
        )

    def test_migration_covers_all_application_models(self):
        import models
        import presentation

        migration = (
            Path(__file__).parent / "migrations" / "032_backend_only_table_access.sql"
        ).read_text()
        for table in Base.metadata.tables.values():
            if table is not self.table:
                with self.subTest(table=table.name):
                    self.assertIn(f"'{table.name}'", migration)


if __name__ == "__main__":
    unittest.main()

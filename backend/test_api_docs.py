import importlib
import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient

import main

DOC_PATHS = ("/docs", "/redoc", "/openapi.json")


class ApiDocsTest(unittest.TestCase):
    def test_docs_are_hidden_by_default(self):
        with patch.dict(os.environ):
            os.environ.pop("ENABLE_API_DOCS", None)
            self.assertFalse(main.api_docs_enabled())
        client = TestClient(main.app)
        for path in DOC_PATHS:
            self.assertEqual(client.get(path).status_code, 404, path)
        # Real API routes are unaffected, and the schema is still available to code (tests, tooling).
        self.assertEqual(client.get("/api/bottles/user-states").status_code, 401)
        self.assertIn("/api/articles", main.app.openapi()["paths"])

    def test_flag_values(self):
        for value, expected in (("true", True), ("1", True), ("YES", True), ("false", False),
                                ("", False), ("0", False), ("enabled-ish", False)):
            with patch.dict(os.environ, {"ENABLE_API_DOCS": value}):
                self.assertIs(main.api_docs_enabled(), expected, value)

    def test_flag_exposes_docs_when_explicitly_set(self):
        with patch.dict(os.environ, {"ENABLE_API_DOCS": "true"}):
            reloaded = importlib.reload(main)
            try:
                client = TestClient(reloaded.app)
                for path in DOC_PATHS:
                    self.assertEqual(client.get(path).status_code, 200, path)
            finally:
                os.environ.pop("ENABLE_API_DOCS")
                importlib.reload(main)


if __name__ == "__main__":
    unittest.main()

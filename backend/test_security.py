import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

import security
from security import check_rate_limit, install_security


class RateLimitTest(unittest.TestCase):
    def setUp(self):
        security._hits.clear()

    def test_blocks_after_limit_per_subject_and_scope(self):
        for _ in range(3):
            check_rate_limit("chat", 1, 3, 60)
        with self.assertRaises(Exception) as ctx:
            check_rate_limit("chat", 1, 3, 60)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Retry-After", ctx.exception.headers)
        check_rate_limit("chat", 2, 3, 60)
        check_rate_limit("report", 1, 3, 60)

    def test_window_expires(self):
        check_rate_limit("x", 1, 1, 0.05)
        import time
        time.sleep(0.07)
        check_rate_limit("x", 1, 1, 0.05)


class HeadersTest(unittest.TestCase):
    def client(self, docs):
        app = FastAPI()
        install_security(app, docs)

        @app.get("/ping")
        def ping():
            return {"ok": True}
        return TestClient(app)

    def test_headers_present(self):
        response = self.client(False).get("/ping")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("max-age", response.headers["Strict-Transport-Security"])
        self.assertIn("default-src 'none'", response.headers["Content-Security-Policy"])

    def test_no_csp_when_docs_enabled(self):
        self.assertNotIn("Content-Security-Policy", self.client(True).get("/ping").headers)

    def test_trusted_hosts(self):
        import os
        os.environ["ALLOWED_HOSTS"] = "api.example.com"
        try:
            self.assertEqual(self.client(False).get("/ping").status_code, 400)
            self.assertEqual(
                self.client(False).get("/ping", headers={"host": "api.example.com"}).status_code, 200)
        finally:
            del os.environ["ALLOWED_HOSTS"]

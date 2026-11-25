import os
import unittest
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

import main


def client_with(env):
    with patch.dict(os.environ, env, clear=False):
        for key in ("CORS_ALLOWED_ORIGINS", "CORS_ALLOWED_ORIGIN_REGEX"):
            if key not in env:
                os.environ.pop(key, None)
        settings = main.cors_settings()
    app = FastAPI()
    app.add_middleware(CORSMiddleware, **settings)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return TestClient(app), settings


def preflight(client, origin, headers="authorization,content-type", method="POST"):
    return client.options("/ping", headers={
        "Origin": origin, "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": headers})


class CorsTest(unittest.TestCase):
    def test_only_configured_origins_are_allowed(self):
        client, settings = client_with({"CORS_ALLOWED_ORIGINS": "https://club.example.com/, https://b.example.com"})
        self.assertEqual(settings["allow_origins"], ["https://club.example.com", "https://b.example.com"])
        ok = client.get("/ping", headers={"Origin": "https://club.example.com"})
        self.assertEqual(ok.headers["access-control-allow-origin"], "https://club.example.com")
        evil = client.get("/ping", headers={"Origin": "https://evil.example"})
        self.assertNotIn("access-control-allow-origin", evil.headers)
        self.assertEqual(preflight(client, "https://evil.example").status_code, 400)

    def test_preflight_allows_the_headers_and_methods_the_app_uses(self):
        client, _ = client_with({"CORS_ALLOWED_ORIGINS": "https://club.example.com"})
        for method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
            response = preflight(client, "https://club.example.com", method=method)
            self.assertEqual(response.status_code, 200, method)
        self.assertEqual(preflight(client, "https://club.example.com", headers="x-evil").status_code, 400)

    def test_credentials_are_never_allowed(self):
        for env in ({}, {"CORS_ALLOWED_ORIGINS": "https://club.example.com"}):
            client, settings = client_with(env)
            self.assertFalse(settings["allow_credentials"])
            response = client.get("/ping", headers={"Origin": "https://club.example.com"})
            self.assertNotIn("access-control-allow-credentials", response.headers)

    def test_regex_allows_development_tunnels_only(self):
        client, _ = client_with({"CORS_ALLOWED_ORIGIN_REGEX": r"https://[a-z0-9-]+\.ngrok-free\.app"})
        self.assertIn("access-control-allow-origin",
                      client.get("/ping", headers={"Origin": "https://abc-1.ngrok-free.app"}).headers)
        self.assertNotIn("access-control-allow-origin",
                         client.get("/ping", headers={"Origin": "https://ngrok-free.app.evil.example"}).headers)

    def test_unset_configuration_keeps_working_but_warns(self):
        with self.assertLogs("main", level="WARNING") as logs:
            client, settings = client_with({})
        self.assertEqual(settings["allow_origins"], ["*"])
        self.assertTrue(any("CORS_ALLOWED_ORIGINS" in line for line in logs.output))
        self.assertEqual(client.get("/ping", headers={"Origin": "https://anything.example"}).status_code, 200)

    def test_application_uses_the_hardened_settings(self):
        layers = [m for m in main.app.user_middleware if m.cls is CORSMiddleware]
        self.assertEqual(len(layers), 1)
        self.assertIs(layers[0].kwargs["allow_credentials"], False)
        self.assertEqual(layers[0].kwargs["allow_headers"], ["Authorization", "Content-Type"])


if __name__ == "__main__":
    unittest.main()

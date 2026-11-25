import hashlib
import hmac
import json
import os
import time
import unittest
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlencode

os.environ["DATABASE_URL"] = "sqlite://"

import main

BOT_TOKEN = "123456:test-token"


def signed_init_data(age_seconds: int) -> str:
    fields = {"auth_date": str(int(time.time()) - age_seconds), "user": json.dumps({"id": 42, "first_name": "A"})}
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    return urlencode({**fields, "hash": hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()})


class InitDataAgeTest(unittest.TestCase):
    def validate(self, age_seconds, **env):
        with patch.dict(os.environ, env):
            if "TELEGRAM_INIT_DATA_MAX_AGE_SECONDS" not in env:
                os.environ.pop("TELEGRAM_INIT_DATA_MAX_AGE_SECONDS", None)
            return main.validate_telegram_init_data(signed_init_data(age_seconds), BOT_TOKEN)

    def assert_expired(self, age_seconds, **env):
        with self.assertRaises(main.HTTPException) as error:
            self.validate(age_seconds, **env)
        self.assertEqual(error.exception.status_code, 401)
        self.assertIn("expired", error.exception.detail)

    def test_default_window_is_six_hours(self):
        self.assertEqual(self.validate(5 * 3600).telegram_id, 42)
        self.assert_expired(7 * 3600)
        self.assert_expired(24 * 3600)

    def test_window_is_configurable_and_clamped(self):
        self.assertEqual(self.validate(20 * 3600, TELEGRAM_INIT_DATA_MAX_AGE_SECONDS="86400").telegram_id, 42)
        self.assert_expired(3700, TELEGRAM_INIT_DATA_MAX_AGE_SECONDS="3600")
        # A tiny value cannot lock everybody out, and a huge one cannot disable the check.
        self.assertEqual(self.validate(60, TELEGRAM_INIT_DATA_MAX_AGE_SECONDS="1").telegram_id, 42)
        self.assert_expired(8 * 86400, TELEGRAM_INIT_DATA_MAX_AGE_SECONDS="99999999")

    def test_invalid_setting_falls_back_to_default(self):
        with patch.dict(os.environ, {"TELEGRAM_INIT_DATA_MAX_AGE_SECONDS": "soon"}):
            self.assertEqual(main.telegram_init_data_max_age(), timedelta(hours=6))

    def test_tampered_or_future_data_is_still_rejected(self):
        with self.assertRaises(main.HTTPException):
            main.validate_telegram_init_data(signed_init_data(10).replace("42", "43"), BOT_TOKEN)
        with self.assertRaises(main.HTTPException):
            main.validate_telegram_init_data(signed_init_data(-3600), BOT_TOKEN)


if __name__ == "__main__":
    unittest.main()

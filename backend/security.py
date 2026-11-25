"""Rate limiting and HTTP security headers for the API."""
import os
import threading
import time
from collections import deque
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException, Request, status
from starlette.middleware.trustedhost import TrustedHostMiddleware

# Per-process counters: enough to stop a single client from flooding one worker. With several
# workers each keeps its own window, so the effective limit is limit * workers.
_lock = threading.Lock()
_hits: dict[tuple[str, int], deque] = {}
_last_sweep = 0.0
_SWEEP_INTERVAL = 300.0
_MAX_WINDOW = 3600.0


def _sweep(now: float) -> None:
    global _last_sweep
    if now - _last_sweep < _SWEEP_INTERVAL:
        return
    _last_sweep = now
    for key in [k for k, hits in _hits.items() if not hits or now - hits[-1] > _MAX_WINDOW]:
        del _hits[key]


def check_rate_limit(scope: str, subject: int, limit: int, window: float) -> None:
    """Record a hit; raise 429 when `subject` made more than `limit` hits in `window` seconds."""
    now = time.monotonic()
    with _lock:
        _sweep(now)
        hits = _hits.setdefault((scope, subject), deque())
        while hits and now - hits[0] > window:
            hits.popleft()
        if len(hits) >= limit:
            retry_after = max(1, int(window - (now - hits[0])) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests, try again later",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)


def rate_limit(scope: str, limit: int, window: float, user_dependency: Callable) -> Callable:
    """Dependency limiting an authenticated member to `limit` calls per `window` seconds."""
    def dependency(user=Depends(user_dependency)) -> None:
        check_rate_limit(scope, user.telegram_id, limit, window)
    return dependency


def write_rate_limit(scope: str, limit: int, window: float, user_dependency: Callable) -> Callable:
    """Like rate_limit, but only counts state-changing requests (not GET/HEAD/OPTIONS)."""
    def dependency(request: Request, user=Depends(user_dependency)) -> None:
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            check_rate_limit(scope, user.telegram_id, limit, window)
    return dependency


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    "Cross-Origin-Resource-Policy": "cross-origin",
}


def install_security(app: FastAPI, docs_enabled: bool) -> None:
    """Add security headers to every response and, if ALLOWED_HOSTS is set, a Host allow-list."""
    hosts = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
    if hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        if not docs_enabled:
            # The JSON API never needs to load or run anything; Swagger UI does, so skip it there.
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        return response

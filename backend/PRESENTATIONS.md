# Interactive Presentation Mode

## Running and opening a room

Run migration `migrations/030_presentation_rooms.sql` against an existing database;
normal application startup also creates the table using SQLAlchemy metadata.
Install `requirements.txt`, set the existing `BOT_TOKEN`, `ADMIN_TELEGRAM_ID` and
`DATABASE_URL`, and run **one worker / one replica**:

```sh
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 --ws websockets --ws-max-size 16384
```

Configure the proxy for WebSocket upgrades, WSS and an idle timeout above 60 seconds.
The frontend uses `VITE_API_URL` or `VITE_API_BASE_URL` (defaults to
`https://paphos-whisky-api.onrender.com`). For local backend development, set
`VITE_API_BASE_URL=http://127.0.0.1:8000` in `frontend/.env.local` and restart Vite.
Both HTTP and WS connections use
the existing verified Telegram initData authentication; the browser sends WS
credentials in its first frame, not a query string.

### Uploading through the Mini App

The navigation panel has an admin-only **Presentations** tab using
`frontend/public/assets/nav/Fav.webp`. Open it, select a `.json` file (up to 2 MB),
click **Upload JSON**, then **Open presentation**. The server validates the DSL
and saves it in `presentation_rooms.payload.manifest` in the configured database.
No repository folder upload or rebuild is required for each presentation.
Media files must already have HTTPS URLs in the manifest; this form uploads only
the JSON, not image/video binaries. Do not place the manifest in `frontend/public`:
that would publicly expose future slides and answer keys.

The saved list persists across browser/device reloads and lists only rooms owned
by the authenticated admin, with paginated `GET /api/presentations/rooms`.
The list endpoint and room creation both enforce admin authentication on the server.
Only the navigation/import UI is admin-only for now; existing attendee room links
continue to work, with future-slide redaction.

### Uploading through the API

Alternatively, create a room with an authenticated admin request:

```http
POST /api/presentations/rooms
Authorization: tma <verified Telegram initData>
Content-Type: application/json

{
  "id": "tasting",
  "slides": [
    {"id": "intro", "type": "static", "title": {"en": "Welcome"}, "html": "<h2>Welcome!</h2>", "css": "h2 { color: #c5a059; }", "animations": {"entry": "rise", "staggerDelay": 0.1}},
    {"id": "film", "type": "video", "video": {"url": "https://your-media-host.example/opaque-film.mp4", "alt": {"en": "Distillery film"}}, "autoplay": true, "muted": true},
    {"id": "photos", "type": "gallery", "photos": [{"url": "https://your-media-host.example/opaque-photo.jpg", "alt": {"en": "Casks"}}]},
    {"id": "explore", "type": "interactive_tabs", "tabs": [{"id": "events", "label": {"en": "Events"}, "html": "<p>Explore the club.</p>", "route": "events"}]},
    {"id": "vote", "type": "poll", "question": {"en": "Which cask?"}, "options": [{"id": "a", "label": {"en": "Bourbon"}}, {"id": "b", "label": {"en": "Sherry"}}], "answers": ["b"]},
    {"id": "aromas", "type": "word_cloud", "prompt": {"en": "Describe the aromas"}, "max_words": 3}
  ]
}
```

The response is `{"room_id":"<32-character hexadecimal ID>"}`. Open the existing
Mini App with `startapp=presentation_<room_id>`, for example
`https://t.me/<bot>/<app>?startapp=presentation_<room_id>`.
The same link serves presenter and viewers; role is determined on the server.
Possession of this unguessable room ID is the invitation: any authenticated
Telegram user with the link can join. Add explicit attendee membership checks
before shipping rooms that need restricted invitations.

The manifest is immutable for the life of a room. Uploading again creates a new
room; opening an existing room resumes its saved progression. There is no visual
manifest editor. The API's OpenAPI schema exposes the
discriminated slide models for authoring. `answers` is optional server-only poll
metadata and is **never** delivered to clients (no answer-reveal command).

## Protocol and invariants

`GET /api/presentations/rooms/{id}` and the initial WS frame return the same
personalized snapshot:

```json
{
  "type": "state",
  "room_id": "<id>",
  "role": "viewer",
  "revision": 0,
  "current_slide_index": 0,
  "max_unlocked_slide_index": 0,
  "slide_count": 6,
  "slides": {"0": {"id": "intro", "type": "static", "title": {"en": "Welcome"}, "animations": null, "html": "<h2>Welcome!</h2>", "css": "", "image": null}},
  "results": {}
}
```

WS endpoint: `/api/presentations/rooms/{id}/ws`.

```json
{"type":"auth","init_data":"<raw Telegram initData>"}
{"type":"advance","index":1}
{"type":"vote","slide_id":"vote","option_id":"a"}
{"type":"words","slide_id":"aromas","words":["oak","fruit"]}
{"type":"sync"}
{"type":"ping"}
```

Only the stored presenter can advance. Forward activation is sequential, one
slide at a time; returning to a previous slide never decreases the unlock bound.
Slide zero is activated when the room is created. Viewer navigation is local
within the unlocked prefix; every presenter progression and every reconnect
jumps viewers back to the presenter's current slide. Viewers cannot request
future slide data, and server mutations do not trust client role or indices.

Only the currently active poll/cloud accepts submissions, once per authenticated
user per slide, including across reconnects and restarts. Results contain
aggregate counts plus **only the requesting user's** response. There are no
attendee IDs or individual submissions in broadcast payloads. Errors are explicit
`{"type":"error","message":"..."}` frames.

HTTP responses are `private, no-store`. Snapshots include only activated slides
and use an explicit per-type allowlist that excludes answer keys. Do not host
the full manifest in frontend assets or expose it from another API. Do not embed
answer keys in public HTML, titles, options or URLs. HTTPS media URLs are
author-controlled; they are not themselves an authorization mechanism.
For genuinely confidential media, use a separate authorization-checking,
room/slide-scoped media gateway or short-lived signed URLs issued only after
activation. Do not use predictable publicly accessible future assets.

## Lifecycle, performance and operational limits

Rooms, manifest, unlock state, revision and responses are committed to the
existing database before broadcasting. Idle rooms are evicted from memory and
reloaded on demand. `DELETE /api/presentations/rooms/{id}` permanently closes and
deletes the room, including stored responses; only its presenter may do this.
Schedule retention of expired rooms according to your data policy; the current
foundation has no scheduler or automated retention.

The connection manager and command lock are process-local. **Do not run multiple
workers or replicas**: durable storage alone does not synchronize live clients.
For horizontal scaling, replace the process lock with transactional room-row
locking / revision checks and broadcast committed revisions through Redis
Pub/Sub or a similar broker. Handle broker recovery with a full snapshot sync.

The foundation caps all open/handshaking sockets at 100, room responses at 1,000
users per slide, manifests at 100 slides, and each socket at 20 commands per 10
seconds. WS sends time out, slow clients are disconnected, and silent sockets
expire after 60 seconds. Add proxy-level per-user/IP handshake and HTTP request
rate limits for an internet-facing deployment. Large-room deployments should
use deltas, bounded outbound queues and backend aggregate caching rather than
personalized full snapshots for every vote.

React mounts only the current slide and available immediate neighbors. Future
neighbors are not prefetched. Only the active video mounts a `<video>`; leaving
it pauses, clears/removes `src`, and calls `load()` to release decoder resources.
Videos start inline and muted, provide an explicit Unmute button and a Play
fallback when autoplay is denied. Cloud layout updates are capped at one per two
seconds. Off-screen DOM neighbors are hidden and their controls are inaccessible.

On minimize the client closes its socket. On visibility restore or network
recovery it reconnects, authenticates and fetches an HTTP snapshot in parallel.
Revisions prevent a slow HTTP response from overwriting newer WS state. There is
a ping watchdog and capped exponential backoff. Expired Telegram credentials,
closed rooms and protocol rejections stop retries and display errors; expired
initData requires reopening the Mini App.

## Gestures and authored HTML

`usePresentationGestures.ts` mounts the existing TMA SDK swipe behavior, calls
`swipeBehavior.disableVertical()`, expands the viewport and restores the previous
behavior on exit. Unsupported clients show an error rather than pretending that
swipe-to-close was disabled. Telegram 7.7+ is required; safe areas combine the
SDK's device/content insets with CSS `env(safe-area-inset-*)`.

Horizontal slides use `touch-action: pan-y`. Gallery gesture surfaces use
`touch-action: none` because both axes are custom gestures. Axis dominance,
distance thresholds, multi-touch cancellation, interactive-element exclusion,
and 24px edge gutters reduce gesture conflicts. Native iOS system edge gestures
cannot be guaranteed cancellable; gestures intentionally do not begin there.
Buttons provide non-gesture navigation and accessibility fallbacks.

Static and tab HTML/CSS render in a CSP-restricted, scriptless sandboxed iframe.
Arbitrary scripts and parent/app navigation are deliberately unsupported;
animations use CSS or allowlisted entry names (`fade`, `rise`, `none`).
Iframe gestures do not bubble into React: swipe on the surrounding stage/gutters
or use the slide navigation buttons. Typed tab routes dispatch into the app's
existing tab controller, close presentation mode and restore Telegram gestures.

## Checks

```sh
cd backend && venv/bin/python -m unittest test_presentation -v
cd frontend && npx tsc --noEmit
```

Device acceptance still requires Telegram iOS/Android: vertical-close suppression,
gallery axis handling, screen safe areas, muted autoplay/audio activation, and
minimize/resume under a real network loss. The automated backend checks cover
redaction, role enforcement, progression bounds, response privacy/deduplication,
invalid input, HTTP/WS parity and durable state after a manager restart.

# Interactive Presentation Mode

## Running and opening a room

Run migrations `migrations/030_presentation_rooms.sql` and
`migrations/031_presentation_broadcast.sql` against an existing database;
normal application startup also creates the tables using SQLAlchemy metadata.
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

Open **Admin → Manage presentations**, select a `.json` file (up to 2 MB),
click **Upload JSON**, then **Start broadcast** on a saved presentation. The server validates the DSL
and saves it in `presentation_rooms.payload.manifest` in the configured database.
No repository folder upload or rebuild is required for each presentation.
Media files must already have HTTPS URLs in the manifest; this form uploads only
the JSON, not image/video binaries. Do not place the manifest in `frontend/public`:
that would publicly expose future slides and answer keys.

The saved list persists across browser/device reloads and lists only rooms owned
by the authenticated admin, with paginated `GET /api/presentations/rooms`.
To remove a saved presentation, click the trash icon on the right of its card,
opposite **Start broadcast**, then confirm **Delete presentation** in the popup.
Deletion permanently removes its manifest, progression and responses, stops its
active broadcast and disconnects attendees. Cancelling leaves the room unchanged.
The admin-only `DELETE /api/presentations/rooms/{id}` endpoint permits deletion
only by the owning presenter.
The list endpoint and room creation both enforce admin authentication on the server.
Upload, saved-room listing and broadcast mutations enforce admin authentication;
only the owning presenter can start or stop a room's broadcast.
Owner filtering uses `BIGINT` for both the JSON-extracted Telegram ID and the
comparison parameter, so IDs exceeding PostgreSQL's 32-bit `INTEGER` range work.

### Live broadcast tab

The **Presentations** navigation tab retains `frontend/public/assets/nav/Fav.webp`
and is visible to the configured admin and the explicitly allowlisted test viewer.
The test viewer gets no admin/import/catalog controls; roles and slide activation
remain server-authorized. This navigation allowlist does not grant admin privileges
or change existing invitation-link access.

There is one active broadcast for the app, persisted in `presentation_broadcast`.
Starting another saved presentation replaces it. The admin is taken to the
**Presentations** tab to control slides and **Stop broadcast**; attendees opening
the tab automatically join the active room as viewers. With no broadcast, the
tab shows a waiting message and discovers a new broadcast within five seconds.
Discovery pauses while the app is hidden and runs immediately on return/online.
It returns only the active room ID, not the private saved catalog or future content.

`GET /api/presentations/broadcast` requires Telegram authentication and returns
`{"room_id": "<active ID or null>"}`. Admin-only
`POST /api/presentations/rooms/{id}/broadcast` starts/replaces the broadcast;
`DELETE /api/presentations/rooms/{id}/broadcast` stops it without deleting the
manifest, progression or responses. Starting a stopped room or replacing the
broadcast starts from slide zero and re-locks every later slide for all viewers.
The unlock reset and active broadcast are committed in one transaction, with a
higher room revision, before notifying connected clients. Starting the already
active room is idempotent and does not reset its progress. Reconnecting to a
running broadcast (including after a server restart) retains that run's progress.
Stored responses and gallery selections are preserved; future results and
gallery indices remain hidden until the presenter activates those slides again.
An attempt to stop a different, no-longer-active room returns 409.

Tab sessions use HTTP `?broadcast_only=true` and include `"broadcast_only": true`
in their first WS auth frame. These subscriptions are accepted only for the
currently active room. On stop/replacement/deletion they receive
`{"type":"broadcast_changed"}` and close with code 4005, clearing slide/media
content and rediscovering the broadcast. Regular invitation-link sessions can
resume a saved room independently of broadcast status, but also receive the
re-locking snapshot when its broadcast starts again. Clients clear their old
unlocked prefix and return to slide zero even if the presenter was already on
slide zero when the previous broadcast ended.

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

### Supported authoring fields

Existing manifests remain compatible. The server also accepts these authoring
aliases and stores/broadcasts their canonical equivalents:

| Authoring field | Canonical field |
| --- | --- |
| Static `imageUrl` (HTTPS string) | `image.url` |
| Static `contentHtml` (string or locale-to-HTML object) | `html` |
| Video `videoUrl` (HTTPS string) | `video.url` |
| Video `autoPlayMuted: true` | `muted: true` (autoplay defaults to true) |
| Poll option `text` (localized object) | `label` |

Do not supply an alias and its canonical field together; such ambiguous input is
rejected rather than silently choosing one. Unknown fields are still rejected,
and all media aliases pass through the same HTTPS/credential validation.

Optional manifest `title` is localized and appears in the saved list and room
header. Optional `theme` supports `primaryColor`, `backgroundColor`, `textColor`,
`accentColor` as hexadecimal colors (`#RGB`, `#RRGGBB`, `#RRGGBBAA`) and
`fontFamily` as `sans`, `serif`, or `monospace`. These values style the presentation
and its sandboxed HTML content. Title and theme are public room-level metadata:
do not embed future answers or confidential content in them.

All slides accept localized `subtitle`. Gallery photos may include a localized
`caption`, displayed below the image; `alt` remains a separate accessibility
description and falls back to the caption when absent. Static and tab HTML accept
localized objects, using the same language fallback as titles. Videos accept
`loop` (default false) while always starting muted and inline.

Static slides may explicitly set `"interactiveHtml": true` (default false) to
embed a complete HTML document, including its head, styles and inline scripts.
Use this only for reviewed author HTML: scripts run inside an opaque-origin
sandbox without access to the app, parent DOM, Telegram SDK, top navigation,
forms, fetch/WebSocket connections or external scripts. HTTPS images, stylesheets
and fonts are allowed; links using `target="_blank"` may open external pages
outside the sandbox. HTTPS `t.me` links are intercepted by the host.
Links to `CyprusWhiskyClubBot/NoMoreDram` (or the bot's main Mini App link with
`startapp`) open the existing in-app destination above the presentation, without
calling the Telegram link-opening SDK or launching another Mini App instance.
The presentation session and embedded document remain mounted; closing an entity
card, pressing **Return to presentation**, or using Telegram Back restores the
presentation. Live presenter updates and broadcast lifecycle still apply while
the destination is open. Supported start parameters use the same parser as
initial app launches: bottle, distillery, event, social event, presentation room
and public tabs. Existing account gates still apply to restricted tabs; invalid
or unsupported own-app parameters display an error instead of opening a new
instance. Other Telegram links continue through the host's Telegram SDK.
The host accepts only validated
link/swipe messages from that iframe's own window; it grants no direct SDK access.
If Telegram link opening is unavailable or fails, the slide displays an error.
The embedded document controls its own language switcher
and scroll animations. Interactive HTML mounts only while its slide is active,
so entering the slide starts its scripts and leaving it releases the document.
Deploy the updated backend and frontend before uploading manifests with this
field; uploading again creates a new room rather than changing an existing one.

Entry animations include `fade`, `rise`, `none`, `fade-up`, `slide-left`, and
`zoom-in`, with reduced-motion support. Poll settings explicitly support
`allowMultiple: false` and `showResultsLive: true`, matching the current single
response / live-results behavior. Other values are rejected, not ignored;
multiple-choice voting and deferred result reveal are not implemented.

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
  "gallery_photo_indices": {},
  "slide_count": 6,
  "title": null,
  "theme": null,
  "slides": {"0": {"id": "intro", "type": "static", "title": {"en": "Welcome"}, "subtitle": null, "animations": null, "html": "<h2>Welcome!</h2>", "css": "", "image": null}},
  "results": {}
}
```

WS endpoint: `/api/presentations/rooms/{id}/ws`.

```json
{"type":"auth","init_data":"<raw Telegram initData>"}
{"type":"advance","index":1}
{"type":"gallery_photo","slide_id":"photos","photo_index":2}
{"type":"vote","slide_id":"vote","option_id":"a"}
{"type":"words","slide_id":"aromas","words":["oak","fruit"]}
{"type":"sync"}
{"type":"ping"}
```

Only the stored presenter can advance. Forward activation is sequential, one
slide at a time; returning to a previous slide never decreases the unlock bound
within a run. Starting a new broadcast resets that bound to zero.
Slide zero is activated when the room is created. Viewer navigation is local
within the unlocked prefix; every presenter progression and every reconnect
jumps viewers back to the presenter's current slide. Viewers cannot request
future slide data, and server mutations do not trust client role or indices.
The viewer's locked-slide notice disappears after two seconds; another attempt
restarts that timeout. Transport/authentication errors are not auto-dismissed.

Gallery snapshots include `gallery_photo_indices`, keyed by activated gallery
slide ID with zero-based photo indices. Only the room presenter may send
`gallery_photo`, only for the currently active gallery and an in-range photo.
The selection is saved before broadcasting and survives reconnects, slide
changes and server restarts. Existing rooms default to photo zero without a
database migration; future gallery IDs and selections remain private.

Viewers browse gallery photos independently, including while disconnected.
Presenter photo updates do not interrupt that browsing. **Follow presenter**
returns to both the presenter's slide and its latest selected photo, even when
the viewer is already on that slide. The button is enabled whenever either the
slide or photo differs. Following is a one-time focus action, not a persistent
photo-follow mode; subsequent viewer swipes remain independent. A presenter slide
change or reconnect also restores the current photo with the slide.
Deploy the updated backend and frontend together; no manifest re-upload is needed.

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

Viewer slides occupy the entire viewport; controls are overlays rather than
layout rows. Viewers navigate unlocked slides with horizontal swipes, with
non-clickable progress dots at the bottom (locked slides stay dimmed). Square
icon-only Close and Follow buttons sit at the bottom right, above video controls.
The presentation heading and connected label are hidden for viewers; errors and
reconnection notices remain visible. Presenter navigation and broadcast controls
are unchanged.

Viewer galleries use vertical swipes and a left-center photo-dot indicator,
without the gallery subtitle or previous/next photo buttons. Captions remain
visible as overlays. Viewer videos have no native controls intercepting swipes:
tapping the video toggles an overlay with play/pause, seek and explicit audio
controls. The seek control waits for a finite media duration; keyboard users can
toggle the overlay with Enter/Space. Drag-generated clicks are suppressed so a
swipe does not also open the video panel. Viewer static HTML slides are
display-only, with a transparent full-area swipe surface over the iframe instead
of narrow edge rails; touches do not interact with or scroll the embedded HTML.
HTML in interactive tabs retains native scrolling and transparent swipe gutters.
Static slides with `interactiveHtml: true` also retain native interaction and
scrolling, extending to both screen edges without side padding or swipe overlays.
A sandboxed bridge forwards horizontal swipes to the stage; vertical scrolling,
language buttons and links remain native. Swiping across a link suppresses the
drag-generated click instead of also opening it. Scripts remain
disabled unless this static-slide flag is enabled; parent access is always disabled.

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
Presenter buttons provide non-gesture navigation and accessibility fallbacks.

Static and tab HTML/CSS render in a CSP-restricted, scriptless sandboxed iframe
by default. Reviewed static HTML can opt into inline scripts with
`interactiveHtml: true`, as documented above. Parent/app navigation remains
unsupported; default slides use CSS or the allowlisted entry animations.
Iframe gestures do not bubble into React: viewer static slides use a full-area
overlay to route touches to the stage, while tab HTML uses surrounding swipe
gutters. Interactive static HTML uses source-checked bridge messages instead,
with the same swipe thresholds, multi-touch cancellation and locked-slide bounds.
Presentation controls remain above the static overlay; presenter
slide navigation buttons remain available. Typed tab routes dispatch into the
app's existing tab controller, close presentation mode and restore Telegram gestures.

## Checks

```sh
cd backend && venv/bin/python -m unittest test_presentation -v
cd frontend && npx tsc --noEmit && node --test tests/miniAppDeepLinks.test.mjs
```

Device acceptance still requires Telegram iOS/Android: vertical-close suppression,
gallery axis handling, screen safe areas, muted autoplay/audio activation, and
minimize/resume under a real network loss. The automated backend checks cover
redaction, role enforcement, progression bounds, response privacy/deduplication,
invalid input, HTTP/WS parity and durable state after a manager restart.

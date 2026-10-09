# Social map backend

All `/api/social/*` routes require authenticated Telegram Mini App initData.
The map tab and social API are available to all authenticated users regardless
of `SOCIAL_EVENTS_ENABLED` (the former rollout flag is no longer used).
Admin-only operations still require separate server-side admin authorization;
ordinary users cannot create global events. The configured admin can inspect
events even before entering a social-profile age; ordinary users must enter an
age of at least 18 to use the relevant social actions.

Ordinary users can create one unexpired regular event at a time, including
events hidden by moderation. Once it expires they can create another. The
server serializes creation per user and returns HTTP 409 when a current event
already exists. `GET /api/social/events/mine/active` returns
`{"has_active_event": boolean}` for the creation UI. Admins have no quota.

For image support, configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_SOCIAL_BUCKET` with a **private** Supabase Storage bucket. Apply
`migrations/022_social_events.sql` to existing PostgreSQL installations.
Creating an event requires exactly one image: first `POST /api/social/media?kind=event`
with the image bytes (`Content-Type: application/octet-stream`, up to 5 MB),
then submit the returned owner-bound `key` as `photo_key` in `POST /api/social/events`.
The Mini App accepts JPEG, PNG or WebP files up to 20 MB and compresses them
to JPEG at most 1 MiB before sending them. The server independently verifies
the uploaded image and caps the stored JPEG at 1 MiB by reducing quality and
resolution as needed. Direct API uploads still have a 5 MiB input limit.
An event image key can be used only once. `description` must be 1–400 characters.
`POST /api/social/events` requires `location` (a 1–150 character string) and
`photo_key` (the uploaded event photo's key, not a URL); `capacity` may be
omitted or `null` for unlimited, otherwise it must be 2–100. Event responses
return `capacity: number | null`. Visible owner, friend, and attendee
mini-profiles always contain `age: null`; self-reported age is returned only
by the current user's `/profile` endpoint for the one-time 18+ gate. Anonymous
owners remain `owner: null` and are omitted from non-owner attendee lists.
After a user confirms their age, it remains on their own profile across visits;
only the configured admin may save a profile with `age: null`.
The moderator reports entry is in the admin tab, not on the map.
For `PUT /api/social/profile`, omitting `avatar_key` preserves the current
avatar; explicitly sending `avatar_key: null` removes it. Actual changes to
profile fields reset the manually assigned verification badge.
Apply `migrations/028_social_profile_avatar_hidden.sql` before deploying the
profile photo controls to an existing database. New profiles may use the
Telegram WebApp photo as a client-side fallback. Sending `avatar_hidden: true`
with `avatar_key: null` hides that fallback and clears an uploaded avatar;
uploading a new avatar restores it.
Signed image URLs last at most five minutes (and never past event expiry);
refresh them by fetching `GET /api/social/events` or `GET /api/social/events/{id}`.
`GET /api/social/events/map` returns all visible, unexpired event markers
as an array of `{id, latitude, longitude, event_type, starts_at, expires_at,
drink, image_url}` (UTC ISO timestamps). Global `image_url` is the first
`image_urls` entry; regular `image_url` is `null` (regular markers use drink
icons). Fetch the full event detail to get its signed photo URL.
It has the same social authentication, adult, friendship, blocking,
and visibility gates as the full list but contains no descriptions, owners,
or attendee information. Fetch `/api/social/events/{id}` on marker click for
full event details. The existing `/api/events` catalog also accepts
`upcoming=true` to filter to valid event dates whose two-hour window has not
ended (strictly after the current UTC instant), before applying `limit` and
`offset`; omitting it preserves the original catalog listing. Public
`GET /api/events/map?lang=en` returns an unpaginated array of geolocated
catalog events still within that same window, containing only
`{id, title, date, location, latitude, longitude}`. `title` uses the same
language selection and fallback as the catalog; `date` is the stored event
date string.
For admin-created global events, apply `migrations/027_global_social_events.sql`
to existing PostgreSQL databases before deploying the backend. Only an
authenticated admin can `POST /api/social/events/global` with `location`
(1–150 characters), `description` (1–5000 characters), Cyprus latitude
(34–36) and longitude (32–35), existing `drink` and `visibility` values,
`image_urls` (1–5 HTTPS URLs), and timezone-aware ISO `starts_at` and
`expires_at` datetimes. The expiry must be in the future and after the start;
ongoing events with a past start are allowed. Events are listed before their
start and remain visible until expiry.
Global events do not require an uploaded `photo_key` and do not accept joins.
Anyone who can see a global event can read and send chat messages without
joining; visibility, blocks, hidden status, expiry, and the social authentication and
age gates still apply. `friends` visibility requires friendship with the
admin organizer; `anonymous` hides the organizer as for regular events.
Event responses add `event_type: "regular" | "global"` and `image_urls`
(empty for regular events); a global event's `photo_url` is its first URL.
Global image bytes are never fetched or stored by the backend; URLs are
persisted and displayed directly in browsers, so unlike private regular photos
they are not revoked when an event is hidden or expires. Choose trusted image
hosts accordingly.
Social API responses use `Cache-Control: private, no-store`.
Media keys are opaque (`event/<random>.jpg` or `avatar/<random>.jpg`), never
prefixed with a Telegram ID. Older ID-prefixed media keys are not signed and
must be re-uploaded to restore their image URLs without leaking identities.

`POST /api/social/events/{event_id}/block` blocks the event owner without
disclosing their Telegram ID; anonymous events return only `{"status":"blocked"}`.
`GET /api/social/blocks` returns `[{"id": number}]`—never blocked users'
Telegram IDs. Unblock using `DELETE /api/social/blocks/{block_id}` with that
record ID. Direct `POST /api/social/blocks` still accepts `{"telegram_id": number}`
when the ID is already known.
Blocking a host or attendee revokes any pending/accepted join requests between
the pair, frees the seat, and removes the attendee's chat access even after
unblocking; rejoining then requires a fresh request and host acceptance.
Mutual-friend tags send the Telegram bot message `Вас отметили в событии!`.
Create-event `notifications` reports `sent` only after Telegram confirms it;
otherwise it reports `not_delivered` or `not_configured`. No deep link is
included without a configured, verified Mini App destination.
Tags start as `pending`, never appearing in `tagged_friends` until the tagged
friend accepts. `GET /api/social/tag-requests` returns pending, currently
visible requests as `[{"id": number, "location": string, "owner": Profile|null,
"starts_at": ISO8601, "expires_at": ISO8601}]`; anonymous owners are `null`.
The tagged friend can `POST /api/social/events/{event_id}/tags/accept` for
`{"status":"accepted"}` or `/tags/decline` for `{"status":"declined"}`.
Declined tags are not displayed, and hidden, expired, or blocked events cannot
be confirmed. Blocking also removes any tags between the pair.

Moderation (configured admin only): `GET /api/social/admin/reports` includes
`status: "open" | "resolved"`, `hidden`, `resolved_at`, and `resolved_by`.
`GET /api/social/admin/events/{event_id}` lets admins review events even when
hidden or expired. `POST /api/social/admin/events/{event_id}/hide` returns
`{"id": number, "hidden": true}` and immediately removes the event from normal
list/detail/chat/join/report/block routes for everyone, including the owner.
`POST /api/social/admin/reports/{report_id}/resolve` returns
`{"id": number, "status": "resolved"}`. Hiding and resolving are independent
moderator decisions. Signed URLs issued before hiding can remain usable until
their short expiration; they cannot be individually revoked by Supabase Storage.

`PUT /api/social/admin/events/{event_id}` replaces an existing regular or global
social map event's editable fields and returns its updated event JSON. Supply
`location`, `description`, `latitude`, `longitude`, `drink`, `visibility`, and
timezone-aware ISO `starts_at` and `expires_at` (future expiry after start).
Regular events additionally require `capacity` (`null` for unlimited; otherwise
2–100 and no less than accepted attendees plus host), permit up to 400
description characters, and optionally accept `photo_key`: omit it to retain
the existing image, or supply a new unused event photo uploaded by the admin.
Global events require `image_urls` (1–5 HTTPS URLs) and permit up to 5000
description characters. The event owner and existing tags, joins, chat, reports,
and cheers are not changed. Only the authenticated admin can edit events,
including those owned by other users.
`DELETE /api/social/admin/events/{event_id}` hard-deletes either type and its
related records and returns HTTP 204. Deleted or replaced regular photos become
unreferenced uploads; the daily cleanup job removes them after their 24-hour
upload-age threshold, not immediately at edit or deletion.

## Media retention

Apply `migrations/023_social_media_retention.sql` before deploying this backend
version and starting the cleanup job. Existing `social_media` rows receive
the migration time as `created_at`, so older unattached uploads get a 24-hour
grace period.

Run `python social_cleanup.py` from the `backend/` directory once daily (for
example, a Render Cron Job with schedule `0 3 * * *` UTC). If the Render root
directory is the repository root, use build command `sh backend/render-build.sh`
and cron command `cd backend && python social_cleanup.py`. Give that job the
same `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_SOCIAL_BUCKET` as the backend. It requires access to the same private
bucket; never put the service role key in the frontend. Do not use a SQL-only
cron to delete files: Storage objects must be removed through the Storage API.

Events and their private photos are removed 7 days after expiry. Global events
with external image URLs are removed without contacting those hosts. An open
report blocks deletion; resolved reports keep the event until at least 30 days
after the latest resolution. Removing an event cascades to its reports, tags, joins,
cheers, and chat. Uploads not referenced by an event or current profile
avatar are removed 24 hours after upload, including replaced/cleared avatars
and abandoned event photos. Current avatars are not affected by event expiry.
Cleanup processes records in batches, treats already-missing Storage objects
as deleted, and exits nonzero on Storage failures so the next run can retry.

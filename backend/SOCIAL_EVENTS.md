# Social map backend rollout

All `/api/social/*` routes require authenticated Telegram Mini App initData. By
default, they also require the caller's Telegram ID to equal `ADMIN_TELEGRAM_ID`
or the temporary map tester ID `369764930`. The tester can use regular social
events but has no admin privileges or access to global event creation. This
includes profile, friend, event, chat, report, media, and admin routes; hiding
the frontend tab is **not** an access control. Admin-only operations continue
to require their own admin authorization. The configured admin can inspect
events even before entering a social-profile age; ordinary users, including
the tester, must enter an age of at least 18 to use the relevant social actions.

For an intentional local-development rollout, set `SOCIAL_EVENTS_ENABLED=true`
in the **backend** environment. The default (unset, empty, or `false`) denies
everyone except the admin and map tester with HTTP 403. Other explicit true
values are `1`, `yes`, and `on` (case-insensitive). Do not enable this flag in
production until the social feature is ready for all authenticated users.
Frontend `Vite DEV` settings do not affect backend authorization.

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
Signed image URLs last at most five minutes (and never past event expiry);
refresh them by fetching `GET /api/social/events` or `GET /api/social/events/{id}`.
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
joining; visibility, blocks, hidden status, expiry, and the social access and
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

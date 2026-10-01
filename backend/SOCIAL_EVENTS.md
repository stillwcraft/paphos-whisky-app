# Social map backend rollout

All `/api/social/*` routes require authenticated Telegram Mini App initData. By
default, they also require the caller's Telegram ID to equal `ADMIN_TELEGRAM_ID`.
This includes profile, friend, event, chat, report, media, and admin routes;
hiding the frontend tab is **not** an access control. Admin-only operations
continue to require their own admin authorization. The configured admin can
inspect events even before entering a social-profile age; ordinary users must
enter an age of at least 18 to use the relevant social actions.

For an intentional local-development rollout, set `SOCIAL_EVENTS_ENABLED=true`
in the **backend** environment. The default (unset, empty, or `false`) denies
non-admin access with HTTP 403. Other explicit true values are `1`, `yes`, and
`on` (case-insensitive). Do not enable this flag in production until the social
feature is ready for all authenticated users. Frontend `Vite DEV` settings do
not affect backend authorization.

For image support, configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_SOCIAL_BUCKET` with a **private** Supabase Storage bucket. Apply
`migrations/022_social_events.sql` to existing PostgreSQL installations.
Creating an event requires exactly one image: first `POST /api/social/media?kind=event`
with the image bytes (`Content-Type: application/octet-stream`, up to 5 MB),
then submit the returned owner-bound `key` as `photo_key` in `POST /api/social/events`.
An event image key can be used only once. `description` must be 1–400 characters.
`POST /api/social/events` requires `location` (a 1–150 character string) and
`photo_key` (the uploaded event photo's key, not a URL); `capacity` may be
omitted or `null` for unlimited, otherwise it must be 2–100. Event responses
return `capacity: number | null`. Visible owner, friend, and attendee
mini-profiles include `age: number | null` (self-entered); anonymous owners
remain `owner: null` and are omitted from non-owner attendee lists.
For `PUT /api/social/profile`, omitting `avatar_key` preserves the current
avatar; explicitly sending `avatar_key: null` removes it. Actual changes to
profile fields reset the manually assigned verification badge.
Signed image URLs last at most five minutes (and never past event expiry);
refresh them by fetching `GET /api/social/events` or `GET /api/social/events/{id}`.
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

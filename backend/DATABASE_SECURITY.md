# Backend-only Supabase tables

The Mini App accesses application tables through FastAPI, not Supabase Data API.
FastAPI validates Telegram initData and enforces user/admin permissions. Supabase
Auth `auth.uid()` is not the application's Telegram user ID.

Application tables must have RLS enabled, with no client access through `anon`,
`authenticated`, or `PUBLIC`. Do not add permissive policies to silence the
`rls_disabled_in_public` warning. Private Storage uses a separate server-side
service-role key; its policies are not changed by this migration.

## Applying migration 032

1. Confirm that no other clients use these tables through Supabase Data API.
   Take a database backup using the project's normal backup procedure.
2. Use the **same database URL and role as the deployed backend**. Do not paste
   credentials into chat or commit them. A successful run as the SQL Editor's
   `postgres` role does not prove access for a different backend role.
3. Inspect the connection and existing RLS state:

   ```sql
   SELECT current_user, session_user;
   SELECT rolname, rolsuper, rolbypassrls
   FROM pg_roles WHERE rolname = current_user;
   SELECT c.relname, pg_get_userbyid(c.relowner) AS owner,
          c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
   ORDER BY c.relname;
   SELECT * FROM pg_policies WHERE schemaname = 'public';
   ```

4. First apply `migrations/032_backend_only_table_access.sql` on staging using
   that environment's backend connection. For a standard PostgreSQL URL and an
   already configured `DATABASE_URL`, run from `backend/`:

   ```bash
   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
     -f migrations/032_backend_only_table_access.sql
   ```

   `psql` does not accept SQLAlchemy driver prefixes such as
   `postgresql+psycopg2://`; use the equivalent `postgresql://` URL locally.
   The migration requires the connection role to own each application table
   (including inherited ownership). If ownership, existing FORCE RLS, or
   inherited client privileges make the change unsafe, it fails and rolls back
   the whole transaction. Do not bypass these errors by running as a different
   role or disabling RLS; a restricted backend role needs explicit grants and
   backend-only policies designed separately.

5. Check catalog reads, registration, reviews, social profiles/events/chat,
   admin writes, presentation room persistence/broadcast, and private photo
   upload/loading through FastAPI. With a publishable/anon key, direct Data API
   reads and writes to application tables must return permission denied.
   Repeat for an authenticated Supabase session if one is available. Verify
   the RLS flags with the query above and rerun Supabase Security Advisor.
6. Apply the same migration to production, using its backend connection, and
   repeat the checks. Deploy the backend change to protect newly created tables.

The migration is repeatable and only touches the 24 named application tables
that exist in `public`. It enables RLS, revokes table/column/owned-sequence
privileges from client roles and `PUBLIC`, and checks effective client table
privileges. It does not delete data, change table ownership, add client policies,
enable FORCE RLS, or alter `auth`/`storage` schemas. The table owner continues to
access rows without client policies unless FORCE RLS is enabled.

`database.py` also secures new PostgreSQL tables created from `Base.metadata`,
including individual `Table.create()` calls, in the creation transaction.
Existing tables still require migration 032: `create_all()` skips them.
Future SQL migrations or manual imports that create tables must explicitly
enable RLS and revoke client privileges before commit; add those tables to the
backend-only migration inventory as appropriate. Unlisted live tables require
separate review if Security Advisor still reports them. SQLite is unchanged.

Do not roll back by disabling RLS or restoring public grants. If backend access
fails, keep Data API closed and correct the backend connection/ownership or add
a narrowly scoped backend-role policy.

-- Run using the backend DATABASE_URL, not a different SQL Editor role.
-- Only application tables are affected; auth/storage and their policies are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
    app_tables CONSTANT text[] := ARRAY[
        'articles', 'bottle_backgrounds', 'bottles', 'distilleries',
        'event_bottles', 'events', 'infographics', 'registrations',
        'tasting_tags', 'user_bottle_actions', 'user_review_tags', 'user_reviews',
        'social_profiles', 'social_media', 'social_friend_requests', 'social_blocks',
        'social_events', 'social_tags', 'social_cheers', 'social_join_requests',
        'social_chat_messages', 'social_reports',
        'presentation_rooms', 'presentation_broadcast'
    ];
    target record;
    client_role text;
    grantees text := 'PUBLIC';
    column_names text;
    owned_sequence record;
    bypass_rls boolean;
    table_count integer := 0;
BEGIN
    SELECT rolsuper OR rolbypassrls INTO bypass_rls
    FROM pg_roles WHERE rolname = current_user;

    FOR client_role IN
        SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
        grantees := grantees || ', ' || quote_ident(client_role);
    END LOOP;

    FOR target IN
        SELECT c.oid, c.relname, c.relowner, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND c.relname = ANY(app_tables)
        ORDER BY c.relname
    LOOP
        -- Ownership preserves backend CRUD after revoking PUBLIC privileges.
        IF NOT pg_has_role(current_user, target.relowner, 'USAGE') THEN
            RAISE EXCEPTION
                'Role % must own public.% (or inherit its owner role). Run with the backend DATABASE_URL; restricted backend roles need a separate policy design.',
                current_user, target.relname;
        END IF;
        IF target.relforcerowsecurity AND NOT bypass_rls THEN
            RAISE EXCEPTION
                'public.% already has FORCE RLS; review backend policies before applying this migration.',
                target.relname;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target.relname);
        EXECUTE format(
            'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %s',
            target.relname, grantees
        );

        -- Table-level REVOKE does not remove existing column-level grants.
        SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
        INTO column_names
        FROM pg_attribute
        WHERE attrelid = target.oid AND attnum > 0 AND NOT attisdropped;
        EXECUTE format(
            'REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM %s',
            column_names, target.relname, grantees
        );

        FOR owned_sequence IN
            SELECT ns.nspname, seq.relname
            FROM pg_depend d
            JOIN pg_class seq ON seq.oid = d.objid AND seq.relkind = 'S'
            JOIN pg_namespace ns ON ns.oid = seq.relnamespace
            WHERE d.classid = 'pg_class'::regclass
              AND d.refclassid = 'pg_class'::regclass
              AND d.refobjid = target.oid
              AND d.deptype IN ('a', 'i')
        LOOP
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %s',
                owned_sequence.nspname, owned_sequence.relname, grantees
            );
        END LOOP;

        FOR client_role IN
            SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
        LOOP
            IF has_table_privilege(
                client_role, target.oid,
                'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
            ) OR has_any_column_privilege(
                client_role, target.oid, 'SELECT,INSERT,UPDATE,REFERENCES'
            ) THEN
                RAISE EXCEPTION
                    'Role % still has inherited privileges on public.%; review role memberships. No changes will be committed.',
                    client_role, target.relname;
            END IF;
        END LOOP;
        table_count := table_count + 1;
    END LOOP;

    IF table_count = 0 THEN
        RAISE EXCEPTION 'No application tables found in public; check the target database.';
    END IF;
    RAISE NOTICE 'Protected % application tables; backend owner access is preserved.', table_count;
END
$$;

COMMIT;

-- Enforces append-only by grant, not just convention: the application role
-- can SELECT/INSERT on runs but never UPDATE/DELETE.
-- :'app_password' is supplied by scripts/migrate.sh from NERVE_APP_PASSWORD.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nerve_app') THEN
        CREATE ROLE nerve_app LOGIN PASSWORD :'app_password';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE nerve TO nerve_app;
GRANT USAGE ON SCHEMA public TO nerve_app;
GRANT SELECT, INSERT ON runs TO nerve_app;
REVOKE UPDATE, DELETE ON runs FROM nerve_app;

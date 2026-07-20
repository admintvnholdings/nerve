-- Enforces append-only by grant, not just convention: the application role
-- can SELECT/INSERT on runs but never UPDATE/DELETE.
-- :'app_password' is supplied by scripts/migrate.sh from NERVE_APP_PASSWORD.

-- psql does not interpolate :'vars' inside dollar-quoted bodies, so the
-- conditional CREATE ROLE is built as text and executed via \gexec instead.
SELECT format('CREATE ROLE nerve_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nerve_app') \gexec

GRANT CONNECT ON DATABASE nerve TO nerve_app;
GRANT USAGE ON SCHEMA public TO nerve_app;
GRANT SELECT, INSERT ON runs TO nerve_app;
REVOKE UPDATE, DELETE ON runs FROM nerve_app;

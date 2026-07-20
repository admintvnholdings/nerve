#!/usr/bin/env bash
# Applies migrations/*.sql in filename order, once each, tracked in schema_migrations.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a
source .env
set +a

PSQL_SUPER=(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1)

echo "Waiting for postgres to be ready..."
for _ in $(seq 1 30); do
    "${PSQL_SUPER[@]}" -c 'select 1' >/dev/null 2>&1 && break
    sleep 1
done
"${PSQL_SUPER[@]}" -c 'select 1' >/dev/null || { echo "postgres did not become ready in time" >&2; exit 1; }

"${PSQL_SUPER[@]}" -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
);" >/dev/null

for file in migrations/*.sql; do
    name="$(basename "$file")"
    applied="$("${PSQL_SUPER[@]}" -tA -c "SELECT 1 FROM schema_migrations WHERE filename = '$name'")"
    if [ "$applied" = "1" ]; then
        echo "skip  $name (already applied)"
        continue
    fi
    echo "apply $name"
    "${PSQL_SUPER[@]}" -v app_password="'${NERVE_APP_PASSWORD}'" < "$file"
    "${PSQL_SUPER[@]}" -c "INSERT INTO schema_migrations (filename) VALUES ('$name')" >/dev/null
done

echo "Migrations applied."

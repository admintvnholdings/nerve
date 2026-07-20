#!/usr/bin/env bash
# Applies migrations/*.sql in filename order, once each, tracked in schema_migrations.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a
source .env
set +a

COMPOSE="docker compose"
PSQL_SUPER=("$COMPOSE" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1)

echo "Waiting for postgres to be ready..."
until "${PSQL_SUPER[@]}" -c 'select 1' >/dev/null 2>&1; do
    sleep 1
done

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
    "${PSQL_SUPER[@]}" -v app_password="'${NERVE_APP_PASSWORD}'" -f "$file"
    "${PSQL_SUPER[@]}" -c "INSERT INTO schema_migrations (filename) VALUES ('$name')" >/dev/null
done

echo "Migrations applied."

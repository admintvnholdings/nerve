#!/usr/bin/env bash
# Creates the litellm database (its own virtual-key store, separate from
# the nerve schema), brings up the litellm service, and mints one virtual
# key per component — normalizer, router (M2), artifact, skill (M3) — so
# spend is attributed per component from the first call (spec Section 9).
# Idempotent: safe to re-run; skips steps already done.
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

exists="$("${PSQL_SUPER[@]}" -tA -c "SELECT 1 FROM pg_database WHERE datname = 'litellm'")"
if [ "$exists" = "1" ]; then
    echo "skip  litellm database (already exists)"
else
    echo "create litellm database"
    "${PSQL_SUPER[@]}" -c "CREATE DATABASE litellm OWNER \"$POSTGRES_USER\"" >/dev/null
fi

echo "Starting litellm service..."
docker compose up -d litellm >/dev/null

echo "Waiting for litellm to be healthy..."
for _ in $(seq 1 60); do
    status="$(docker compose ps -q litellm | xargs -r docker inspect -f '{{.State.Health.Status}}' 2>/dev/null || true)"
    [ "$status" = "healthy" ] && break
    sleep 2
done
[ "$status" = "healthy" ] || { echo "litellm did not become healthy in time" >&2; exit 1; }

mint_key() {
    local alias="$1"
    curl -sf -X POST "http://127.0.0.1:4000/key/generate" \
        -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"key_alias\": \"${alias}\", \"models\": [\"economy\", \"workhorse\", \"flagship\"]}" \
        | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).key))'
}

if grep -q '^LITELLM_NORMALIZER_KEY=.\+' .env; then
    echo "skip  normalizer virtual key (already set in .env)"
else
    echo "mint  normalizer virtual key"
    key="$(mint_key normalizer)"
    printf 'LITELLM_NORMALIZER_KEY=%s\n' "$key" >> .env
fi

if grep -q '^LITELLM_ROUTER_KEY=.\+' .env; then
    echo "skip  router virtual key (already set in .env)"
else
    echo "mint  router virtual key"
    key="$(mint_key router)"
    printf 'LITELLM_ROUTER_KEY=%s\n' "$key" >> .env
fi

if grep -q '^LITELLM_ARTIFACT_KEY=.\+' .env; then
    echo "skip  artifact virtual key (already set in .env)"
else
    echo "mint  artifact virtual key"
    key="$(mint_key artifact)"
    printf 'LITELLM_ARTIFACT_KEY=%s\n' "$key" >> .env
fi

if grep -q '^LITELLM_SKILL_KEY=.\+' .env; then
    echo "skip  skill virtual key (already set in .env)"
else
    echo "mint  skill virtual key"
    key="$(mint_key skill)"
    printf 'LITELLM_SKILL_KEY=%s\n' "$key" >> .env
fi

echo "litellm setup complete."

#!/usr/bin/env bash
# Inserts one fake run record as nerve_app and reads it back.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a
source .env
set +a

COMPOSE="docker compose"
PSQL_APP=("$COMPOSE" exec -T postgres env PGPASSWORD="$NERVE_APP_PASSWORD" \
    psql -U nerve_app -d "$POSTGRES_DB" -v ON_ERROR_STOP=1)

echo "Inserting fake run..."
NEW_ID="$("${PSQL_APP[@]}" -tA -c "
INSERT INTO runs (
    source_device, raw_input, normalized_statement, normalizer_confidence,
    route_answers, route_confidence, outcome, confirmed_overridden,
    workflow_id, workflow_version, skills_invoked, status, error_class,
    duration_ms, cost_usd, tokens, outcome_shipped
) VALUES (
    'demo-cli',
    'remind me to water the plants every morning',
    '{\"intent\": \"create a recurring reminder\", \"entities\": {}, \"constraints\": [], \"urgency\": \"low\", \"goal\": \"a morning reminder to water plants exists\"}',
    0.92,
    '{\"q1_foundation\": false, \"q2_recurs\": true, \"q3_shape\": \"process\", \"q4_conditional\": false, \"q5_autonomous\": false}',
    0.88,
    'routine',
    'confirmed',
    'routine-authoring-workflow',
    '0.1.0',
    '[\"reminder-skill@0.1.0\"]',
    'shipped',
    NULL,
    4200,
    0.0031,
    850,
    true
) RETURNING id;
")"

echo "Inserted run_id: $NEW_ID"
echo "Reading it back..."
"${PSQL_APP[@]}" -c "SELECT id, created_at, outcome, status, outcome_shipped FROM runs WHERE id = '${NEW_ID}';"

echo "Confirming nerve_app cannot UPDATE/DELETE (expected: permission denied)..."
set +e
"${PSQL_APP[@]}" -c "DELETE FROM runs WHERE id = '${NEW_ID}';" 2>&1 | grep -i "permission denied" \
    && echo "OK: append-only enforced." \
    || echo "WARNING: delete was not rejected — check migrations/002."
set -e

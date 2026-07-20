# Nerve

See `docs/nerve-system-spec-v1.0.md` and `CLAUDE.md` for the full contract.
This file covers M1 (run record schema) and M2 (intake + router CLI).

## 1. Configure secrets

```
cp .env.example .env
# edit .env and set real values for POSTGRES_PASSWORD, NERVE_APP_PASSWORD,
# and ANTHROPIC_API_KEY (needed for M2 — LiteLLM's sole provider)
```

`.env` is gitignored — never commit real credentials.

## 2. Start the stack

```
docker compose up -d
```

Brings up `postgres` (`pgvector/pgvector:pg16`, bound to `127.0.0.1:5432`)
and `litellm` (bound to `127.0.0.1:4000`, fronting Anthropic per spec
Section 9 — economy/workhorse/flagship tiers).

## 3. Apply migrations

```
./scripts/migrate.sh
```

Applies `migrations/*.sql` in order (idempotent — tracks progress in a
`schema_migrations` table). Creates the `runs` table and a restricted
`nerve_app` role that can `SELECT`/`INSERT` but not `UPDATE`/`DELETE`.

## 4. Insert and query a fake run

```
./scripts/demo.sh
```

Inserts one fake run record as `nerve_app`, selects it back by id, and
confirms a `DELETE` against it is rejected (append-only enforced by grant).

Equivalent manual psql snippet, if you want to do it by hand instead:

```
docker compose exec postgres psql -U nerve_app -d nerve -c \
  "SELECT id, created_at, outcome, status, outcome_shipped FROM runs ORDER BY created_at DESC LIMIT 1;"
```

### M1 definition of done

`docker compose up -d` on a clean checkout → `./scripts/migrate.sh` →
`./scripts/demo.sh` inserts one fake run and reads it back correctly, with
`UPDATE`/`DELETE` rejected for the application role.

## 5. Set up LiteLLM virtual keys (M2)

```
./scripts/setup-litellm.sh
```

Creates the `litellm` database (its own virtual-key store, separate from
the `nerve` schema), waits for the service to be healthy, and mints two
virtual keys — `normalizer` and `router` — into `.env` so LiteLLM attributes
spend per component from the first call. Idempotent.

## 6. Install intake dependencies

```
cd intake && npm install && cd ..
```

## 7. Submit a task (M2)

```
./scripts/submit-task.sh "some task in plain text"
```

Runs the normalizer (spec Section 4.3 — structured statement, goal,
confidence, at most one clarifying question) → the pre-gate (Section 5 —
declines exact-duplicate resubmissions within 24h) → the 5-question router
(auto-answered with per-question confidence, outcome derived deterministically
from spec Section 5's table) → an explicit confirm/override prompt (silence-
default is disabled for M2 — every route requires an explicit answer,
regardless of confidence) → a run record write.

`execution`/`measures` are left null for every M2 run: M2 is "route out,"
not dispatch — outcome workflows aren't executed until M3.

### M2 definition of done

Run `./scripts/submit-task.sh` against a few representative tasks, including
a resubmission of one already-submitted task (which the pre-gate declines as
a duplicate), then read back `runs`:

```
docker compose exec postgres psql -U nerve_app -d nerve -c \
  "SELECT id, created_at, outcome, confirmed_overridden, route_confidence FROM runs ORDER BY created_at;"
```

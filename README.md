# Nerve — M1: run record schema

M1 scope only: one Postgres+pgvector service, the run record schema (spec
Section 6), a migration runner, and a fake-run insert/query demo. See
`docs/nerve-system-spec-v1.0.md` and `CLAUDE.md` for the full contract.

## 1. Configure secrets

```
cp .env.example .env
# edit .env and set real values for POSTGRES_PASSWORD and NERVE_APP_PASSWORD
```

`.env` is gitignored — never commit real credentials.

## 2. Start the stack

```
docker compose up -d
```

Brings up a single `postgres` service (`pgvector/pgvector:pg16`), bound to
`127.0.0.1:5432` only, with a named volume for persistence.

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

## Definition of done

`docker compose up -d` on a clean checkout → `./scripts/migrate.sh` →
`./scripts/demo.sh` inserts one fake run and reads it back correctly, with
`UPDATE`/`DELETE` rejected for the application role.

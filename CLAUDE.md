# Nerve — Claude Code operating instructions

You are working in the Nerve repository on tvg-ai-server. Read this file fully before planning anything.

## Authority

1. The specification at `docs/nerve-system-spec-v1.0.md` is the single source of truth. Read it completely before your first plan.
2. The spec's changelog is binding: read it before proposing changes; if a change to the spec is accepted, append a changelog row and bump the version. Never edit the spec silently.
3. Structural sections of the spec (1–8) stay vendor-agnostic. Concrete tools go in Section 9 (annex) only.
4. If anything in this file conflicts with the spec, the spec wins. Flag the conflict to the owner.

## Environment facts

- Host: tvg-ai-server, Ubuntu 24.04. Orchestration host only — never propose local LLM inference beyond sub-3B quantized models.
- Installed: git, curl, Docker Engine + compose plugin, Node.js, Claude Code. **Nothing else.** No Postgres, no Temporal, no Redis exist yet.
- All services run in Docker via a compose file in this repo. Never install services directly on the host OS.
- Do not expose any port beyond localhost/the Tailscale interface. Nothing faces the public internet.

## Standing behavior rules

- Milestones are gates (spec Section 11). Work only the milestone the owner names. If a task appears to need a later milestone's component, stop and report — do not pull it forward.
- Install or add a component only in the milestone that needs it. Infrastructure ahead of need is prohibited.
- Every schema, config, and workflow you create is a versioned artifact: meaningful git commits, one concern per commit.
- Ask before: adding any new service to compose, adding any dependency beyond the milestone's obvious needs, or touching anything outside this repo.
- Secrets never appear in code, compose files committed to git, or logs. Use an env file that is gitignored; note in your plan that the permanent secrets vault is a future component.

## Current mission: M1 only

**Goal:** the run record schema is live and provable.

In scope:
1. `docker-compose.yml` with exactly one service: PostgreSQL with the pgvector extension available (image choice yours; justify briefly).
2. Database `nerve`. Migration file(s) creating the run record table(s) implementing spec Section 6 exactly — five field groups: run_id (id, timestamp, source_device), intent (raw input, normalized statement), route (answers, outcome, confirmed/overridden), execution (workflow id+version, skills+versions, status, error class), measures (duration, cost, tokens, outcome_shipped). Append-only by convention and by revoking UPDATE/DELETE from the application role.
3. A migration runner approach (plain SQL files with a tiny apply script is acceptable — justify your choice, simplest wins).
4. A script or documented psql snippet that inserts one fake run record and a query that reads it back.
5. `README.md` in repo root: how to start the stack, apply migrations, insert and query the fake run.

Out of scope for M1 (do not plan, scaffold, or stub): Temporal, Redis, NATS, MinIO, LiteLLM, any workflow code, any UI, voice, STT, ingestion workers, vault indexing, the evaluator, backups.

**Definition of done:** `docker compose up -d` on a clean checkout, migrations applied, one fake run inserted, and the query returns it correctly. Show the owner the query output.

## Plan mode protocol

1. Read spec + this file. Produce a short M1 plan: files you will create, schema DDL sketch, image choice, migration approach.
2. Wait for owner approval of the plan before writing anything.
3. Build. Commit as you go.
4. Demonstrate the definition of done. Then stop — do not propose M2 unprompted.

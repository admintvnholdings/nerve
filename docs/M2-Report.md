# M2 Verification Report

**Milestone:** M2 — Intake + router as a workflow
**Date:** 2026-07-20
**Verified against:** spec v1.1 (Sections 4.3, 5, 6, 9), the agreed M2 plan, and the four approved amendments
**Method:** independent verification of code, running services, database run records, and secrets — not taken on faith

---

**Verdict: M2 is complete, correct, and spec-faithful — the definition of done holds up under live testing, all four amendments landed, and every catch from the plan review was handled.** No blockers. One genuine gap (no unit tests) and two minor notes, below.

## Definition of done — proven live
M2's DoD is *"text-only task in, route out, run record written."*

| Requirement | Result |
|---|---|
| Stack up | ✅ `postgres` + `litellm` both **Up (healthy)**, litellm answers `"I'm alive!"`, advertises `economy/workhorse/flagship` |
| Text in → route out | ✅ Router produced real 5-question `route_answers` (per-question confidence, LLM-generated via LiteLLM→Anthropic) |
| Run record written | ✅ 3 M2 records (`cli/artifact` confirmed, `cli/foundation` confirmed, `cli/declined`) + the M1 fake run still present |
| Duplicate-decline demo | ✅ Resubmitted landlord-email task → **declined as duplicate** of the prior `artifact` run, with the referenced run id in the reason |

## Spec fidelity — checked
- **Section 4.3 (normalizer)**: emits `{intent, entities, constraints, urgency, goal, confidence, clarifying_question}`, Simplification Pass folded into constraints, `goal=null` → Project signal, **exactly one** clarifying question then proceeds. Round-trip verified — real goals stored ("each new invoice PDF has its amount, due date, and vendor name added as a row in the CSV").
- **Section 5 (router)**: the five questions are answered by the LLM, but the **decision table is applied deterministically in `deriveOutcome`** — this is the spec's own "rules-first, LLM-fills" discipline, and it makes the routing logic testable independent of the model. The table matches Section 5 branch-for-branch (Foundation/Artifact/Skill/Project/Routine/Dynamic-workflow/Agent). Pre-gate: check-1 honestly stubbed (flagged as M7 evaluator input), check-2 = **exact-match** duplicate detection (deterministic, no pgvector pulled forward).
- **Section 6 (run record)**: written via `nerve_app` (SELECT+INSERT only). **`execution` and `measures` are ALL null for every M2 row** — verified — correct, because M2 routes but doesn't dispatch. Append-only **re-tested live**: `nerve_app` UPDATE and DELETE both → `permission denied`.

## The four amendments — all verified
1. **Model IDs corrected & version-bumped.** Spec → **v1.1** with a changelog row; annex now reads economy=`claude-haiku-4-5-20251001`, **workhorse=`claude-sonnet-5`** (the exact fix flagged in review — the "no sonnet-5" belief was backwards), flagship=`claude-opus-4-8`. Sonnet 5's expiring intro pricing + heavier tokenizer are annotated so the evaluator won't misread the September cost step-up as drift.
2. **Normalizer tier as config + documented escalate signal.** `CONFIG.normalizerTier`/`routerTier` are config; the escalate-to-workhorse trigger is documented (not automated — correctly deferred, no evaluator until M7).
3. **Threshold versioned, silence-default off.** `routeConfidenceThreshold: 0.7`, `silenceDefaultEnabled: false`. Confirmed in `cli.js`: with silence-default off, **blank Enter does *not* confirm** — it aborts without writing. `route_confidence` + `confirmed_overridden` are recorded for future calibration.
4. **Two per-component virtual keys, spend attribution live.** `setup-litellm.sh` mints `normalizer`/`router` keys; LiteLLM's `key/info` shows the **normalizer key already tracking ~$0.012 spend**. Not just configured — functioning.

## Plan-review catches — handled
- **`source_device` NOT NULL** → set by the CLI (`NERVE_SOURCE_DEVICE || 'cli'`), passed to `writeRunRecord`. No insert failures.
- **`config.yaml` secrets** → `api_key: os.environ/ANTHROPIC_API_KEY` (env-referenced, not inline).
- **Duplicate check deterministic** → exact `raw_input` match, no embeddings.

## Secrets & constraints
- `.env` gitignored and **untracked**; `.env.example` holds `sk-ant-changeme` placeholders only — **no real key leaked to git** (full history scanned). Real `ANTHROPIC_API_KEY` is in `.env`, so this is now live on **API credits** — separate billing from the Max subscription that runs Claude Code.
- Both services bound to **`127.0.0.1` only**. No Temporal/Redis/NATS/MinIO — correct: the router runs as a plain Node CLI, with Temporal deferred to M3 when parent/child dispatch first exists (the decision logic is pure functions, so M3 wraps rather than rewrites).
- Git: 3 clean M2 commits, one concern each; working tree clean.

## One gap + two minor notes
- **Gap — no automated tests.** `deriveOutcome` is the critical decision logic and is a pure function, so a handful of canned-input tests would be nearly free and would lock the Section 5 table against regression. Recommend adding before M3 builds on it.
- **Minor** — on a pre-gate decline, `route_confidence` borrows the normalizer's confidence (the column is `NOT NULL` and no route ran). Documented and sensible, just worth knowing the semantics when the evaluator later reads route-confidence distributions.
- **Minor** — `setup-litellm.sh` appends the minted keys to `.env`, which can leave a duplicate empty+real key pair if `.env` was seeded from `.env.example`; harmless (last assignment wins on `source`), cosmetic only.

## Bottom line
**M2 passes.** Intake + router is live, spec-exact, demonstrated end-to-end (route + duplicate-decline), append-only preserved, all amendments and earlier catches in place, secrets clean. The only thing to add before M3 is unit coverage on `deriveOutcome`. Clear to proceed to M3 (Artifact + Skill outcome workflows — where Temporal enters).

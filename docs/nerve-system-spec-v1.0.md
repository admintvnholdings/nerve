# Nerve — Task Router System Specification

**Inherits from:** Genesis Template v1.1 (root contract)
**Status:** Frozen for build (v1.0)
**Version:** 1.0

---

## 0. Document control

This document is a living artifact. Every revision appends a changelog row. Claude Code in plan mode must read the changelog before proposing changes and append to it after any accepted change.

| Version | Date | Change | Author |
|---------|------|--------|--------|
| 0.1 | 2026-07-20 | Initial draft from chat design session | Tiaan + Claude |
| 0.2 | 2026-07-20 | Backend lives on server/hosted, never the PC; all clients thin; app reframed as single pane of glass with three-verb scope rule; open decisions 1 and 5 resolved | Tiaan + Claude |
| 0.3 | 2026-07-20 | Knowledge vault layer specified (Section 3.1): vaults as human-canonical source, retrieval store as derived index, read/write boundaries, personal-vault exclusion enforced at ingestion; open decision 8 added for entity knowledge | Tiaan + Claude |
| 0.3.1 | 2026-07-20 | Annex corrected to actual vault inventory (screenshot verification): Genesis, Workshop, Engine, Me, zz_Archive exist; Zero and Toa designed but not yet created — Zero creation flagged as ingestion prerequisite | Tiaan + Claude |
| 0.4 | 2026-07-20 | App named **Nerve**. Zero and Toa permanently removed — no business-canonical vault; business knowledge enters retrieval via routed ingestion sources with provenance. Personal vault is Me | Tiaan + Claude |
| 0.5 | 2026-07-20 | Vault roles finalized on existing vaults: **Engine = business-canonical** (indexed), Workshop = working (research and test projects), Me = personal. Business-canonical role reinstated without creating new vaults | Tiaan + Claude |
| 0.6 | 2026-07-20 | Initial model routing table adopted (open decision 7 partially resolved): three cost tiers with escalate-on-review-only rule; concrete model assignments in annex. M1 execution model set to mid tier | Tiaan + Claude |
| 0.7 | 2026-07-20 | Maturation order made binding: skills improve first, workflows second, agents last — Learn loop attention follows the same order. Workshop legacy harvest added as the first routed project after M3: promote / mine / archive prior work, no manual migration, nothing deleted | Tiaan + Claude |
| 0.8 | 2026-07-20 | **Owner pre-approved.** Goal field added: normalized task statement (4.3) and run record intent group (6) gain `goal`, a one-sentence success statement confirmed or edited by the owner at route confirmation, or proposed by the normalizer if the owner supplies none; a task whose goal cannot be stated in one sentence routes to Project. `measures.outcome_shipped` (6) is now judged against the stated goal, not vague completion | Tiaan + Claude |
| 0.9 | 2026-07-20 | **Owner pre-approved.** Confidence numbers added: the normalizer and router emit confidence (0–1), recorded in the run record's intent/route groups (6); below a versioned threshold, explicit owner confirmation is mandatory, at/above it the route is eligible for silence-default confirmation (resolves open decision 3); thresholds are versioned artifacts, starting conservative. Calibration rule added to the evaluator (7): compares stated confidence against override rates, systematic miscalibration is a finding. Confidence never raises autonomy by itself — it only decides how loudly the system asks; never a reason to skip a guardrail or approval gate | Tiaan + Claude |
| 0.91 | 2026-07-20 | Root contract bumped to Genesis Template v1.1; Rule 8 execution-class hardening adopted — Simplification Pass at Intake (4.3), Guardrail Boundary + Proof of State required on Routine/Dynamic-workflow/Agent outcomes (8). Source: AI Recon `blueprints/genesis-template-v1.1.md` | Tiaan + Claude |
| 0.92 | 2026-07-20 | Decline/Defer pre-gate added ahead of the 5-question triage router (5): a cheap utility/duplication check terminates trivial or duplicate one-off tasks before full outcome dispatch, writing a run record with outcome = declined/deferred. Source: AI Recon `skills/relevance-gate-v1.0.md` | Tiaan + Claude |
| 0.93 | 2026-07-20 | Rules-first-then-LLM discipline documented for the triage router (5): the 5 questions are the rules layer; undiscriminated cases are logged as residue; ≥3 recurring identical overrides on one residue pattern becomes evaluator input (7) proposing a sharper question. Source: AI Recon `blueprints/strategies/rules-first-llm-residue-v1.0.md` | Tiaan + Claude |
| 0.94 | 2026-07-20 | Skill-authoring workflow's first action given a concrete contract format (frontmatter + When-to-use / Procedure / Failure-modes / Output, description field as the routing trigger, ≥3 trigger phrases, explicit negative scope); "compose, don't bloat" adopted as the mechanism behind the maturation-order rule (5). Source: AI Recon `blueprints/agent-skill-template-v1.0.md` | Tiaan + Claude |
| 0.95 | 2026-07-20 | Knowledge vault ingestion (3.1) gains a numeric confidence threshold (starting at 0.7, versioned, conservative-first) below which items stay flagged for review instead of auto-indexing, plus an append-only ingestion log (timestamp, source path, decision). Source: AI Recon `agentic-os/ingest-protocol.md` (pattern only — source vault paths not reused) | Tiaan + Claude |
| 0.96 | 2026-07-20 | Knowledge vault layer (3.1) gains explicit note lifecycle states (draft / canonical / thinking-artifact / superseded / archived), an earned-canonical rule, and a fold-in rule for overlapping notes. Source: AI Recon `agentic-os/knowledge-architecture-index-schema.md` | Tiaan + Claude |
| 0.97 | 2026-07-20 | Evaluator (7) proposed diffs split into bookkeeping (mechanical, auto-applicable up to a per-run cap) vs. substantive (owner approval required); kill/promotion recommendations batch rather than trickle. Source: AI Recon `skills/skill-learn-loop.SKILL.md`, `skills/skill-effectiveness-tracker.SKILL.md` | Tiaan + Claude |
| 0.98 | 2026-07-20 | Cross-cutting requirements (8) gain a fixed notify-on taxonomy (ready-for-review / blocked / decision-needed / guardrail-attempted); evaluator (7) weekly cadence gains a blocked-beyond-30-minutes escalation exception. Source: AI Recon `governance/AUTONOMOUS_GUARDRAILS.md` (pattern only — retired vault paths in the source are not reused) | Tiaan + Claude |
| 0.99 | 2026-07-20 | Cross-cutting requirements (8) Guardrails row now points to the owner's global authority-hierarchy / prompt-injection / nuke-confirmation rules as the binding source, without restating them in this spec. Source: AI Recon `governance/legislation.md`, `governance/SECURITY.md` | Tiaan + Claude |
| 1.0 | 2026-07-20 | Cross-cutting requirements (8) gain a PII/secrets severity-ladder guardrail (credentials always halt, no operator override; classify up under uncertainty, never down; verdict-only, never auto-redacts). Open decision 6 (evaluator cadence) gains a candidate numeric data point (>20% false-positive or >5% miss rate as a version-bump trigger), not yet adopted. Source: AI Recon `skills/pii-detect.SKILL.md`. **AI Recon findings incorporated; frozen for build.** | Tiaan + Claude |

**Editing rules (binding):**
1. Structural sections (1–8) stay vendor-agnostic. Tool names appear only in Section 9 (Implementation annex) and are marked swappable.
2. Changes to Genesis slot mappings (Section 2) require explicit owner approval before implementation.
3. Open decisions (Section 10) must be resolved and moved to their home section — never silently deleted.

---

## 1. Purpose and scope

The system's client application — the owner's single pane of glass — is named **Nerve**. Nerve fronts a personal AI operating system that accepts a **generalized task in natural language or voice**, from **any device the owner uses**, routes it through a **standard triage** to the correct build-or-do outcome, **executes** via composed modular workflows, **logs every run**, and **improves itself** on a schedule through an owner-approved feedback loop.

**In scope:** task intake (voice, text, structured), triage routing, dispatch to outcome workflows, run logging, scheduled self-evaluation, owner approval loop, desktop client, mobile access.

**Out of scope (v1):** multi-user access, entity-level agent hierarchies (future consumers of this system, not part of it), local model inference beyond small quantized models, public internet exposure of any endpoint.

---

## 2. Genesis slot mapping

The root contract defines seven slots. This system fills all seven:

| Genesis slot | This system's implementation |
|---|---|
| **Trigger** | Owner input (voice or text, any client), scheduled routines, or system events |
| **Intake** | Task normalizer — converts raw speech/text into a structured task statement (intent, context, constraints) |
| **Classify** | Triage questions 1–2: access gate, frequency |
| **Decide** | Triage questions 3–5: shape (capability / process / initiative), determinism, autonomy |
| **Route** | Dispatcher — maps the decision to one of seven outcomes and invokes its workflow |
| **Trigger-Next** | Outcome workflow executes; its completion may enqueue follow-on tasks back into Intake |
| **Learn** | Run log → scheduled evaluator → proposed diffs → owner approval → versioned updates to questions, skills, workflows |

**v1.1 update:** the root contract's Rule 8 requires three execution primitives on any artifact that drives automated/autonomous execution — Simplification Pass, Guardrail Boundary, Proof of State. Nerve's Simplification Pass lives in Intake (Section 4.3); Guardrail Boundary and Proof of State live in Section 8's cross-cutting requirements, binding on the Routine, Dynamic workflow, and Agent outcomes.

---

## 3. System architecture

Three planes on two machines plus mobile access:

**Client plane** (any device — all thin)
- The application backend lives on the orchestration host (or hosted elsewhere) — **never on the owner's PC**. The PC and the phone are both thin clients to the same backend; no client is a gateway for another.
- One responsive application serves every device: task entry, triage interaction, run history, approval queue. Device differences are layout, not features.
- Voice path: audio captured on device → speech-to-text → text task → same Intake as typed input. Voice is an input modality, not a separate pipeline.
- **Single-pane scope rule (binding):** this app is the owner's one interface to everything, and it stays buildable because it only ever does three verbs — **submit** (a task into Intake), **observe** (runs, logs, dashboards, cost), **approve** (routes, action classes, evaluator diffs). Any proposed feature must map to one of the three verbs or it is a new routed task, not an app feature. Monitoring any system = observe. Building anything = submit. Controlling anything = submit + approve.

**Orchestration plane** (server)
- Task intake service (normalizer).
- Triage router as a parent workflow.
- Seven outcome workflows as child workflows (see Section 5).
- Scheduler for routines and the evaluator.

**Data plane** (server)
- Run log store (append-only).
- Knowledge layer: human-curated markdown **vaults** as the canonical source, projected into a vector-indexed **retrieval store** (see 3.1).
- State store for in-flight workflow context.
- Secrets vault — separate trust boundary from the orchestration host.

### 3.1 Knowledge vault layer

Vaults are plain-markdown knowledge bases, human-curated, living on a cloud-synced drive. They are first-class in this system, with four binding rules:

1. **Vaults are the source of truth for human-curated knowledge; the retrieval store is a projection.** An ingestion worker watches the synced vault files, chunks and indexes them into the retrieval store, and propagates edits and deletions. The index can be dropped and rebuilt from its sources at any time with zero loss. Workflows *query* the retrieval store; humans *read and write* the vaults. Business knowledge also enters the retrieval store from **non-vault routed ingestion sources** (document warehouse, mail, files); every indexed chunk carries its source and provenance regardless of origin, with the business-canonical vault ranked as the highest-authority source. The ingestion worker emits a **confidence score (0–1)** per chunk/source; below a versioned threshold — starting conservative at **0.7** — the item stays flagged for review rather than auto-indexing. Every ingestion decision (index, flag, skip) is written to an **append-only ingestion log** (timestamp, source path, decision).
2. **Vault roles are declared, and exclusion is enforced at ingestion.** Roles: *business-canonical* (indexed, highest retrieval authority, queryable by all business workflows), *contract* (holds the root contract, templates, and versioned artifacts the Learn loop diffs — indexed, and additionally the target of approved evaluator updates), *working* (research and test projects — indexed or not per vault, default not), *archive* (never indexed), and *personal* (**never ingested into any business retrieval context — the exclusion lives in the ingestion worker, not in workflow prompts**, so no prompt error can leak it). Within an indexed vault, individual notes carry an explicit **lifecycle state** — draft / canonical / thinking-artifact / superseded / archived. Canonical status is **earned, not declared**: a note is canonical because it visibly governs a real action or decision, not because its frontmatter says so. Overlapping notes **fold in**: the surviving note absorbs the content, the loser is marked `superseded` with a `supersedes:` link, and superseded notes move to the archive vault rather than being deleted.
3. **The system writes to vaults only through routed tasks.** A knowledge-write is an action class requiring approval (Section 8 guardrails). The evaluator never writes vaults directly; its approved diffs to contract-vault artifacts are applied by a routed task like any other write. Run logs, state, and machine artifacts never live in vaults — vaults hold knowledge, not telemetry.
4. **Vault availability is decoupled from system availability.** Sync lag or an offline vault degrades retrieval freshness, never system operation; every indexed chunk carries its source path and sync timestamp so answers can disclose staleness.

**Connectivity rule:** all client↔server traffic rides the private mesh. Nothing is exposed to the public internet. Phone, PC, and server are mesh peers.

---

## 4. Client surfaces

### 4.1 The app (all devices)
- Served from the backend; opened in a browser on PC and phone for v1. Native or shell wrappers (desktop shell, mobile app) remain open options layered on the same backend later — nothing in v1 may preclude them.
- Task entry accepting free text ("generalized task" — no forced structure).
- Triage flow rendered as the five questions with tap answers, **or** auto-answered by the model from the task statement with owner confirmation ("I routed this to *skill* — confirm or override"). Each auto-answered question and the overall proposed route carries a **confidence score (0–1)**: below the versioned threshold, explicit owner confirmation is mandatory; at or above it, the route is eligible for silence-default confirmation (resolves former open decision 3, Section 10). **Confidence never raises autonomy by itself** — it only decides how loudly the system asks; it is never a reason to skip a guardrail or approval gate (Section 8).
- Run history, dashboards, and cost views reading the run log (**observe**).
- Approval queue: pending routes, action-class confirmations, and evaluator diffs with accept/reject (**approve**). No single device is ever *required* for approval.

### 4.2 PC-local data
- Designated folders on the owner's PC are a **data source, not a home for logic**: a small connector agent on the PC exposes them to workflows through the same connector interface as any other source. If the PC is off, the source is unavailable — the system keeps running.

### 4.3 Voice and generalized task intake
- Input contract: any utterance. The normalizer produces: `{intent, entities, constraints, urgency, source_device, goal, confidence}`. `goal` is a one-sentence success statement ("done means…") — supplied by the owner or, if absent, proposed by the normalizer; confirmed or edited by the owner at route confirmation. A task whose goal cannot be stated in one sentence routes to **Project** for decomposition. `confidence` (0–1) reflects the normalizer's certainty in its task interpretation.
- Before declaring intake complete, the normalizer runs a **Simplification Pass** (Genesis Template v1.1 Rule 8): strip every requirement not strictly necessary for the task's success check.
- If the normalizer's confidence is low, it asks **one** clarifying question, then proceeds. It never interrogates.
- The triage router may consume the normalized statement to pre-answer its own questions; the owner sees the proposed route before dispatch (confirmation is one tap; below-threshold confidence forces explicit confirmation per Section 4.1).

---

## 5. Triage router (Classify + Decide)

**Pre-gate (Decline/Defer):** before the 5 questions fire, two cheap checks run: (1) will this recur, or is it worth a one-off build/action at all? (2) does an existing skill/workflow already cover this? Failing either terminates the task as **declined** or **deferred** — a real exit, not a route to a fuller workflow — and still writes a run record (Section 6) with outcome = declined/deferred. This mirrors the main router's own discipline: cheap deterministic checks first, full triage only for what survives.

Five questions, seven outcomes. This is the canonical logic; the interactive widget, the desktop app, and the server workflow all implement exactly this table.

**Questions (in order):**
1. Does the task need data or systems not currently reachable? → yes: **Foundation**
2. Will this happen more than once? → no: **Artifact**
3. Is it a capability, a process, or an initiative? → capability: **Skill** / initiative: **Project**
4. (process) Do steps change on conditions or judgment? → no: **Routine**
5. (branching process) Should it run without the owner triggering it? → no: **Dynamic workflow** / yes: **Agent**

**Outcomes and their dispatch targets:**

| Outcome | Dispatched workflow | First action |
|---|---|---|
| Foundation | Connector-build workflow | Name source + one verification read |
| Artifact | Direct execution session | Produce the deliverable now |
| Skill | Skill-authoring workflow | Draft contract: inputs, outputs, single responsibility |
| Routine | Routine-authoring workflow | List steps + name trigger |
| Dynamic workflow | Workflow-design workflow | Map branch points and conditions |
| Agent | Agent-readiness audit workflow | Verify prerequisite layers exist; block if not |
| Project | Project-decomposition workflow | Break into tasks; each task re-enters triage |

**Skill-authoring workflow's first action, concretely:** a skill contract is frontmatter (name, description, version) + When-to-use / Procedure / Failure-modes / Output. The description field is the routing trigger — it must carry at least 3 trigger phrases and state what the skill explicitly does not do. **Compose, don't bloat:** when a skill needs a capability outside its stated responsibility, split into a new composed skill rather than extending the existing one — this is the concrete mechanism behind the maturation-order rule below.

**Composition rule:** the router is a parent; outcomes are children. Children may themselves dispatch grandchildren (a project decomposes into tasks that re-enter the router). Recursion depth is capped (Section 10).

**Rules-first discipline:** the 5 questions above are the rules layer — deterministic, same input same output. When no question cleanly discriminates a task (residue), the router logs it as residue rather than forcing a guess. Three or more recurring identical manual overrides on the same residue pattern is evaluator input (Section 7) that proposes a new or sharper question — the router only grows sharper by absorbing recurring residue, never by adding speculative branches.

**Maturation order (binding):** capabilities mature bottom-up — **skills first, workflows second, agents last**. The Learn loop's improvement attention follows the same order: skill diffs are proposed and applied before workflow diffs, and workflow maturity — measured in shipped runs without override — is a precondition for any agent wrapping that workflow. An agent is never improved directly; its underlying skills and workflows are, and the agent inherits the improvement.

---

## 6. Run record schema (Learn — instrumentation)

Every dispatched run writes exactly one record. Five field groups, mandatory from the first run:

```
run_id          unique id + timestamp + source_device
intent          raw input (text or transcription) + normalized task statement (incl. goal) + normalizer confidence (0–1)
route           answers given (or auto-answered, each with confidence) + overall route confidence + outcome selected (incl. declined/deferred) + confirmed/overridden flag
execution       workflow id + version, skills invoked + versions, status (shipped / abandoned / failed), error class if failed
measures        wall-clock duration, model cost, tokens, outcome_shipped (boolean, judged against the run's stated goal: named external recipient or owner-confirmed completion of that goal — not vague completion)
```

Declined/deferred runs (Section 5 pre-gate) populate `run_id`, `intent`, and `route` only — `execution` and `measures` are not applicable, since no workflow was dispatched.

Rules: append-only; no record is ever edited or deleted; schema changes are versioned and additive.

---

## 7. Evaluator and approval loop (Learn — improvement)

- **Trigger:** scheduled (weekly default) — never continuous, except the blocked-task escalation below.
- **Reads:** run log only. Never the knowledge store, never live workflows.
- **Looks for:** routes confirmed then overridden (bad question wording), outcomes dispatched but never shipped (routing or friction problem), branches that never fire (dead logic), cost outliers per outcome (overloaded skill), rising override rate on auto-answers (normalizer drift), **systematic miscalibration between stated confidence and actual override rates** (confidence calibration drift), **recurring identical residue routings (≥3x) on the same pattern** (Section 5) — a candidate for a new or sharper triage question.
- **Produces:** proposed diffs against specific versioned artifacts — a question's wording, a skill's contract, a workflow's branches. Each diff carries the evidence (run ids) that motivated it. Each proposed diff is classified **bookkeeping** (mechanical: threshold or wording tuning, no new branch logic) or **substantive** (a new branch, a new outcome type, a decision-logic rewrite). Kill/promotion recommendations batch rather than trickle: ≥3 in one run surface together as a batch, not one at a time.
- **Hard boundary:** substantive diffs land in the owner approval queue and are never applied by the evaluator itself. Bookkeeping diffs may **auto-apply**, up to a versioned per-run cap (default 5) — this auto-apply behavior is itself a bounded, owner-approved rule, not an exception to owner control. Approved (or auto-applied) diffs are applied as new versions with the changelog updated. Rejected diffs are logged with the rejection reason (that reason is itself evaluator input next cycle).
- **Cadence exception:** a task blocked beyond the versioned time threshold (starting at 30 minutes — see Section 8's notify-on taxonomy) escalates immediately rather than waiting for the next scheduled evaluator run.
- The evaluator's own prompt/logic is a versioned artifact subject to the same loop — it can propose improvements to itself, under the same approval gate.

---

## 8. Cross-cutting requirements

| Concern | Requirement |
|---|---|
| Memory / state | Workflow state survives restarts; task context persists across a multi-step run |
| Knowledge | Vault layer per Section 3.1: vaults canonical, retrieval store derived; workflow writes to vaults are routed, approved tasks |
| Secrets | No credential in code, config files, or the run log. Single vault, short-lived tokens where the vault supports them |
| Guardrails | Outcomes that touch external systems (send, publish, spend) require owner confirmation per action class; the permission table is a versioned artifact. Authority hierarchy and prompt-injection defense follow the owner's global operating rules (outside this spec) — Nerve inherits them and does not restate them here |
| Execution-class hardening | Per Genesis Template v1.1 Rule 8: any Routine, Dynamic workflow, or Agent outcome must declare a **Guardrail Boundary** (explicit scope + one hard-stop threshold) and satisfy **Proof of State** (a binary, machine-verifiable success check — reasoning alone never declares success; absent a check, the run terminates "unverifiable," not "shipped") |
| PII / secrets in content | Any content leaving the vault boundary or entering a routed write is classified on a six-category severity ladder (no-pii → … → credentials); **credentials always halt with no operator override**; classify up under uncertainty, never down. Detection is verdict-only — it flags/halts, it never auto-redacts |
| Notifications | Fixed notify-on taxonomy to avoid alert noise: ready-for-review, blocked, decision-needed, guardrail-attempted. A task blocked beyond a versioned time threshold (starting at 30 minutes) escalates immediately rather than waiting for the next scheduled evaluator run |
| Tracking & logging | Run records (Section 6) + application logs shipped to one queryable store; workflow engine execution history retained |
| Cost | Per-run cost recorded; monthly budget threshold triggers a notification task through the router itself |
| Evaluation | Section 7; additionally, any new workflow must pass at least one recorded test run before it may be dispatched automatically |
| Triggers | Owner input, schedules, and system events all enter through the same Intake — no side doors |

---

## 9. Implementation annex (swappable — not part of the structural contract)

Current concrete choices on the owner's stack. Any row may be replaced without changing Sections 1–8.

| Slot | Current choice |
|---|---|
| Orchestration host | tvg-ai-server (Ubuntu 24.04) — orchestration only; no large local inference (GPU limited to sub-3B quantized) |
| Workflow engine | Temporal (parent/child workflows, durable state, execution history) |
| Model routing | LiteLLM (per-key spend tracking feeds `measures.cost`), introduced at M2. Current tier assignments (swappable): economy = Claude Haiku 4.5 ($1/$5 per MTok); workhorse = Claude Sonnet 4.6 ($3/$15); flagship = Claude Opus-class ($5/$25). Hosted aggregators (e.g. OpenRouter) may sit behind LiteLLM as provider rows — never replace it. Claude Code build sessions (incl. M1) run on the workhorse tier; verify auth mode (subscription vs. API credits) before long sessions |
| Run log + retrieval | PostgreSQL; pgvector for retrieval index |
| Fast state / messaging | Redis / NATS |
| Object storage | MinIO |
| Private mesh | Tailscale (PC, phone, server as peers) |
| Secrets vault | Raspberry Pi vault (planned — **blocker for agent-level outcomes**) |
| Speech-to-text | Open slot — candidate: local Whisper-class model on PC (fits GPU constraint if small) or hosted STT; decide in plan mode |
| App delivery | Resolved v0.2: responsive web app served from the backend; native/shell wrappers are open later options |
| Knowledge layer | Obsidian vaults on cloud-synced A: drive — roles per 3.1: **"Engine" = business-canonical** (indexed, highest authority); Genesis vault (00. Core) = contract; "Workshop" = working (research and test projects, default not indexed); "Me" = personal (ingestion-excluded); "zz_Archive" = archive (never indexed). Non-vault business sources (document warehouse, mail, files) also ingest into pgvector with provenance |
| Task lifecycle | ClickUp holds tasks produced by Project decomposition |

---

## 10. Open decisions (resolve in plan mode)

1. ~~App packaging~~ **Resolved v0.2:** server-hosted responsive app first; native/shell wrappers remain open later options on the same backend.
2. STT placement: on-device (PC/phone) vs. server-side vs. hosted — privacy vs. GPU constraint trade-off.
3. ~~Auto-route confirmation~~ **Resolved v0.9:** confidence-gated (Section 4.1/4.3) — below the versioned confidence threshold, explicit owner confirmation is mandatory; at or above it, the route is eligible for silence-default confirmation. Thresholds start conservative and are versioned artifacts under the Learn loop.
4. Recursion cap for project decomposition (recommend: depth 2 for v1).
5. ~~Client topology~~ **Resolved v0.2:** every client talks directly to the server backend; no client is a gateway for another.
6. Evaluator cadence: weekly default — confirm or adjust after first month of run data. **Data point (v1.0, not yet adopted):** a comparable pattern (AI Recon `skills/pii-detect.SKILL.md`'s own Learn slot) uses a monthly review with a version-bump trigger at >20% false-positive or >5% miss rate — a candidate numeric trigger for revisiting cadence, pending Nerve's own run data.
7. Model/provider selection: deferred by design — the model-routing slot means each task tier selects a model at runtime and any provider can be swapped per row of the annex. **Partially resolved v0.6 — initial routing table adopted (vendor-agnostic tiers; concrete models in annex):**
   - *Economy tier* — classification, triage auto-answers, extraction, routine steps.
   - *Workhorse tier* — building, workflow execution, general reasoning. **Default tier: any task not explicitly assigned elsewhere runs here.**
   - *Flagship tier* — evaluator runs, plan reviews, contract-artifact diffs.
   - *Escalation rule:* escalate one tier only when a review of the lower tier's output genuinely fails — never preemptively. De-escalate after the review.
   - The routing table is a versioned artifact under the Learn loop; per-tier cost lands in `measures.cost` per run, giving the evaluator the data to propose tier reassignments.
8. Entity-level knowledge placement: retrieval-store-only vs. separate unlinked vaults per entity vs. both. Deliberately open — do not resolve in plan mode; resolve after the first entity workflow actually consumes knowledge and the access pattern is observable in run records.

---

## 11. Build order (milestones for plan mode)

1. **M1 — Instrumentation before anything:** run record schema live in the database; a manual "fake run" can be written and queried.
2. **M2 — Intake + router as a workflow:** text-only task in, route out, run record written. No voice, no UI beyond a CLI or minimal page.
3. **M3 — Two outcome workflows** (Artifact and Skill) as children; end-to-end dispatch with logged runs.
4. **M4 — Desktop app v0:** task entry, route confirmation, run history.
5. **M5 — Mesh + mobile access:** phone submits a task and confirms a route.
6. **M6 — Voice intake:** STT slot filled; utterance → normalized task → route.
7. **M7 — Evaluator v0 + approval queue:** first scheduled review over ≥30 real runs.
8. Remaining outcome workflows and the agent-readiness audit only after M7 — per the maturation order (Section 5): skills mature first, workflows second, agents last.
9. **Legacy harvest — the first routed project after M3.** The Workshop vault (A: drive) holds previously built skills and material. It is not migrated manually and nothing in it is deleted. A harvest workflow inventories Workshop, evaluates each prior artifact against the root contract, and proposes one disposition per item: **promote** (rewrite as a Genesis-compliant skill through the skill-authoring workflow), **mine** (extract durable knowledge into the business-canonical vault), or **archive** (move to the archive vault). Workshop remains not indexed; the harvest reads it directly as a declared, provenance-tagged source. Prior work is treated as raw material to improve upon — never as a standard to preserve or a pile to ignore.

**Gate rule between milestones:** each milestone ships only when its runs appear correctly in the run log. Instrumentation is the definition of done.

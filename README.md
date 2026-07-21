# Nerve

See `docs/nerve-system-spec-v1.0.md` and `CLAUDE.md` for the full contract.
This file covers M1 (run record schema), M2 (intake + router CLI), M3
(Artifact/Skill outcome dispatch via Temporal), M4 (desktop app v0), M5
(mesh + mobile access), M6 (voice intake), and M7 (evaluator + approval
queue).

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

Brings up `postgres` (`pgvector/pgvector:pg16`, bound to `127.0.0.1:5432`,
data on the `/data` array — not the root disk), `litellm` (bound to
`127.0.0.1:4000`, fronting Anthropic per spec Section 9 —
economy/workhorse/flagship tiers), `temporal` (bound to `127.0.0.1:7233`,
schema auto-applied against the same postgres instance), `worker` (the M3
Temporal worker — no exposed port), `web` (the M4/M5/M6 backend, bound to
`127.0.0.1:3000`, the Tailscale IP on `3000`/`3443`), and `stt` (the M6
local speech-to-text service — no exposed port, internal only).

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
the `nerve` schema), waits for the service to be healthy, and mints one
virtual key per component — `normalizer`, `router` (M2), `artifact`,
`skill` (M3) — into `.env` so LiteLLM attributes spend per component from
the first call. Idempotent.

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

## 8. Dispatch Artifact/Skill outcomes (M3)

When a confirmed or overridden route is `artifact` or `skill`,
`submit-task.sh` starts the matching Temporal workflow (task queue
`nerve-outcomes`, run by the `worker` service) and waits for it to
complete before writing the run record. Every other outcome — including
`aborted` — is unchanged from M2: no dispatch.

- **Artifact** (`intake/workflows/artifactWorkflow.js`): "direct execution
  session — produce the deliverable now" (spec Section 5). Whole job for
  a one-off deliverable.
- **Skill** (`intake/workflows/skillWorkflow.js`): "skill-authoring
  workflow — draft contract: inputs, outputs, single responsibility"
  (spec Section 5). Drafts the skill contract only — full authoring,
  testing, and registration mature later (Section 5's bottom-up order).

Both run on the workhorse LiteLLM tier ("building" per Section 9), with
their own bounded retry (3 attempts, 30s each, summed cost/tokens across
attempts — not just the last) independent of Temporal's own retry layer.

The deliverable's content is written to `./output/<outcome>/<run_id>.md`
— never into the run record, which stores only a pointer (`output_ref`)
plus metadata (`workflow_id`, `workflow_version`, `status`, `duration_ms`,
`cost_usd`, `tokens`, `outcome_shipped`). `outcome_shipped` stays **null**
(spec v1.3) until a real goal-verification mechanism exists (M7) —
completion itself is tracked via `status`.

### M3 definition of done

Submit one task that routes to `artifact` and one that routes to `skill`
(confirming each), then:

```
docker compose exec postgres psql -U nerve_app -d nerve -x -c \
  "SELECT id, outcome, status, workflow_id, workflow_version, duration_ms, cost_usd, tokens, outcome_shipped, output_ref FROM runs WHERE outcome IN ('artifact','skill') ORDER BY created_at DESC LIMIT 2;"
cat output/artifact/<run_id>.md
cat output/skill/<run_id>.md
```

Both rows show populated `execution`/`measures`/`output_ref`; both files
exist on disk; spend is visible on the `artifact`/`skill` virtual keys in
LiteLLM.

## 9. Desktop app v0 (M4)

`web` (`intake/web/server.js`) serves both a small JSON API and a static
page (`intake/web/public/index.html`) on `127.0.0.1:3000` — task entry,
route confirmation, run history (spec Section 11 M4 / 4.1's submit/
approve/observe verbs). Same underlying logic as the CLI
(`intake/lib/*`, `dispatch.js`); `source_device` is always `web` here so
the two interfaces are distinguishable in the run log.

**Access:** originally `127.0.0.1`-only (v0); M5 (below) adds mesh access
on top without removing this. From your own machine, an SSH tunnel still
works:

```
ssh -L 3000:127.0.0.1:3000 <user>@tvg-ai-server
# then open http://127.0.0.1:3000 in your own browser
```

**Confirmation semantics are identical to the CLI** — same shared
`intake/config.js`: silence-default disabled, every route requires an
explicit Confirm/Override click, an override is recorded exactly like the
CLI's override.

**Abandoned tasks:** submit → clarify → confirm is a multi-request flow
held in an in-memory `Map` inside the `web` process (no new datastore —
a known v0 limitation: state is lost on restart, single-instance only). A
task the owner never returns to is swept after `PENDING_TASK_TTL_MS`
(default 15 minutes): if a route had already been proposed, it's written
as `aborted` — same semantics as the CLI's own abort handling (M2
closure), just triggered by elapsed time instead of a blank Enter. If the
task was abandoned *before* a route ever existed (an unanswered
clarifying question), no pre-gate or router call is made to invent one —
it's written as `unrouted` (spec v1.4) directly from the normalized
statement. Override `PENDING_TASK_TTL_MS` / `PENDING_TASK_SWEEP_INTERVAL_MS`
in compose for testing.

### M4 definition of done

Through the browser (or `curl`, exercising the same API): submit a task,
answer a clarifying question if asked, confirm or override the proposed
route, and watch it dispatch and land in the run history table — then
leave a second task unconfirmed and let the TTL sweep age it into an
`aborted` row. Read back `runs` and confirm both `cli` and `web` rows
appear side by side:

```
docker compose exec postgres psql -U nerve_app -d nerve -c \
  "SELECT id, created_at, source_device, outcome, confirmed_overridden, status FROM runs ORDER BY created_at DESC LIMIT 10;"
```

## 10. Mesh + mobile access (M5)

`web` is now reachable two ways — the binding is two literal IPs, never
`0.0.0.0`:

```yaml
ports:
  - "127.0.0.1:3000:3000"        # SSH-tunnel fallback (M4)
  - "100.107.203.17:3000:3000"   # Tailscale — mesh + mobile (M5)
```

Tailscale itself is host-level and pre-existing on this machine — not a
compose service, not something any milestone installed. From any device
already enrolled in the same tailnet (phone included), just open
`http://100.107.203.17:3000` — same page, same API, nothing mobile-
specific beyond a viewport tag and light responsive CSS (table scrolls
horizontally, inputs/buttons are touch-sized on narrow screens). No
second implementation.

**The Tailscale IP is hardcoded, not derived.** It's stable per-device but
not guaranteed permanent — if the binding silently stops working, it's
almost certainly because the IP changed. Re-check with `tailscale ip -4`
and update `docker-compose.yml` if it no longer matches.

**Trust boundary — read before enrolling any new device.** Nerve has no
app-level login. Reachability is gated entirely by Tailscale's own
device-level authentication, which is sound *only* because this tailnet
is single-identity — one owner, their own devices (verify with
`tailscale status`). **If any device or user outside the owner's identity
is ever enrolled — including employee infrastructure such as an Open
WebUI rollout — app-level authentication becomes mandatory before that
enrollment, not after.** This isn't a default to revisit eventually; it's
a precondition. See spec Section 8's Guardrails row (v1.5).

**Open question, not solved here:** every API-originated run still
records `source_device = 'web'`, regardless of whether it came from the
phone, a PC browser, or the SSH tunnel. M5's own scope doesn't require
telling those apart. Flagged as evaluator input (Section 7) for later —
per-device calibration would need a real distinguishing signal (e.g. a
client-supplied device label), not built now.

### Troubleshooting

| Symptom | Check |
|---|---|
| Page unreachable from the tailnet, but the SSH tunnel still works | `tailscale ip -4` on the server — if it no longer matches the IP in `docker-compose.yml`'s `web.ports`, update the binding and re-`docker compose up -d web` |
| Nothing loads at all from any tailnet device, port confirmed listening (`ss -tlnp \| grep 3000`) | UFW: `sudo ufw status verbose` — a default-deny `INPUT` policy silently drops the connection before it reaches Docker. Fix: `sudo ufw allow in on tailscale0 to any port 3000 proto tcp`. This bit us during the actual M5 build — zero incoming connections ever reached the port from the tailnet until this rule was added |

### M5 definition of done

From the iPhone (or any enrolled device), over the tailnet, on the same
page: submit a task and confirm its route. Then:

```
docker compose exec postgres psql -U nerve_app -d nerve -c \
  "SELECT id, created_at, source_device, outcome, confirmed_overridden FROM runs ORDER BY created_at DESC LIMIT 5;"
```

## 11. Voice intake (M6)

Voice is a way to fill the existing textarea, not a separate pipeline
(spec Section 4.3: "same Intake as typed input"). A Record button
next to the textarea captures audio via the browser's `MediaRecorder`,
uploads it to a new `POST /api/transcribe` endpoint, and the returned
transcript pre-fills the (still editable) textarea — the owner reviews
and clicks the same existing Submit button. Everything downstream
(`normalize`/`pregate`/`router`/`dispatch`/the schema) is unchanged and
has no awareness voice exists. CLI untouched — no sensible microphone
analog for an SSH-connected terminal.

**STT is local, not hosted (spec Section 10 open decision 2, resolved):**
`stt` runs `faster-whisper large-v3-turbo` (CPU, int8 quantization) via
the [speaches](https://speaches.ai) server, internal-only — no ports
published to the host, no external API, no egress. Escalation ladder if
quality/speed ever becomes a real problem: try a heavier local model
first; hosted (Groq) only on a *documented* quality failure, with owner
approval — dormant until then, not a fallback that silently engages.

**Bounds enforced server-side** (`POST /api/transcribe`): audio MIME
types only (rejects anything not `audio/*`), and a ~10MB size cap.
Duration itself (~3 minutes) is enforced primarily client-side (the
Record button auto-stops at that point) — the size cap is the real
server-side backstop, sized generously for 3 minutes at up to 256kbps
(well above typical voice-optimized Opus, which runs 24–64kbps) with a
2x safety margin, rather than adding an audio-probing dependency
(`ffprobe`) a v0 voice feature doesn't need yet.

**Mic access needs HTTPS — and the right URL.** Browsers only allow
`getUserMedia` on a secure context (HTTPS, or the special-cased
`127.0.0.1`/`localhost`). The Tailscale IP over plain HTTP (port 3000)
does **not** qualify — that's why `web` now also serves HTTPS on 3443,
using a certificate issued through Tailscale's own control plane (no
public exposure, no self-signed-cert warnings):

```
https://tvg-ai-server-1.taild4a3b1.ts.net:3443
```

**Use the hostname, not the raw IP** — the certificate's subject is the
`.ts.net` hostname, not `100.107.203.17`; connecting by IP gets a
certificate-mismatch error (curl: `SSL: no alternative certificate
subject name matches target host name`). MagicDNS resolves the hostname
automatically for any device on the tailnet. Port 3000 (HTTP) still
works exactly as before for typed tasks and run history — it just won't
offer the mic.

**Cert renewal:** Tailscale certs are short-lived (~90 days,
Let's Encrypt-backed). `scripts/renew-tailscale-cert.sh` re-issues
(idempotent) and restarts `web`; installed as a monthly cron job
(`crontab -l`) so this doesn't silently expire. If it ever does anyway:
symptom is the HTTPS port refusing TLS or serving an expired cert; fix
is running that script by hand.

**Ledger note:** transcription happens *before* a run exists — it's
compute-only cost (no LLM tokens billed, since it's local), and never
appears in any run's `measures.cost`/`tokens`. There's no ledger
divergence (nothing is billed to misattribute), but the timing gap —
STT cost is invisible to the run log entirely — is documented here
rather than silently true.

**Known limitation, not solved here:** `source_device` stays `'web'`
for voice-originated submissions, same as typed ones — no distinct
modality field. Same open-question treatment as M5's phone/PC
indistinguishability (Section 10 above) — evaluator input, not solved
now.

### M6 definition of done

From the iPhone, over `https://tvg-ai-server-1.taild4a3b1.ts.net:3443`:
record a voice note, review the transcript that fills the textarea, edit
if needed, submit through the identical flow, confirm the proposed
route. Then:

```
docker compose exec postgres psql -U nerve_app -d nerve -c \
  "SELECT id, created_at, source_device, raw_input, outcome, confirmed_overridden FROM runs ORDER BY created_at DESC LIMIT 3;"
```

## 12. Evaluator + approval queue (M7)

```
./scripts/arm-evaluator-schedule.sh   # idempotent — arms the weekly cycle (Monday 03:00 UTC)
./scripts/run-evaluator.sh            # manual trigger — same workflow, on demand
```

Reads the run log only (never the knowledge store, never live
workflows — spec Section 7). Every actionable number is code-computed
(`intake/evaluator/analyze.js`); the flagship-tier LLM
(`LITELLM_EVALUATOR_KEY`) only writes a narrative summary over those
numbers, so nothing actionable can be a hallucinated statistic. Checks:
dead branches, friction/abort rate, per-outcome override rate,
per-outcome cost outliers, confidence calibration — each gated on a
minimum sample size; below gate, a check produces an **observation**
(informational), not a **finding** (actionable). The residue-
instrumentation gap (Section 7 requires residue analysis; the router
never logs it) is always emitted as its own structural finding rather
than faked or buried.

Findings land in the "Approval queue" section of the same web app —
approve/reject, both requiring a reason, both permanently logged
(`evaluator_finding_transitions`, append-only — a finding's status is
mutable, but how it got there never is).

**Auto-apply is structurally inert at v0** — `evaluatorAutoApplyEnabled:
false` and `evaluatorAutoApplyCap: 0`, both need to change (by
changelog, spec Section 7) before anything auto-applies; the code
throws rather than fake an `auto_applied` status if that gate is ever
reached without a real apply mechanism behind it.

### M7 definition of done

≥30 real runs, one manually-triggered evaluator cycle, findings visible
in the approval queue with evidence run ids / n / gate, at least one
approved and one rejected with recorded reasons:

```
docker compose exec postgres psql -U nerve_app -d nerve -c \
  "SELECT target_artifact, category, n, gate_threshold, evidence_strength, status, decision_reason FROM evaluator_findings WHERE kind = 'finding' ORDER BY target_artifact;"
```

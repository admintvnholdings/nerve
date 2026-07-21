// Versioned config values (spec Section 4.1/0.9, 9). Changes to these are
// M2 build-time decisions now; once the evaluator exists (M7) they become
// its output, applied through the changelog like any other diff.
export const CONFIG = {
  // Section 9 open decision 7: economy tier covers classification,
  // triage auto-answers, and extraction — both the normalizer and the
  // router fall in that bucket for M2.
  //
  // Escalation signal (not automated — no evaluator until M7): bump
  // normalizerTier to 'workhorse' if, over a review window, the
  // goal-edit rate or the rate of owner overrides on normalizer
  // confidence runs high.
  normalizerTier: 'economy',
  routerTier: 'economy',

  // Route confidence threshold (spec Section 4.1/0.9): below this,
  // explicit owner confirmation is mandatory. At/above it, the route
  // becomes *eligible* for silence-default confirmation once
  // silenceDefaultEnabled is true.
  routeConfidenceThreshold: 0.7,

  // Starts disabled: every route requires explicit confirmation,
  // regardless of confidence — true for both the CLI and the M4 web app,
  // one shared value. Loosen only once override data justifies it, and
  // only via a changelog entry — never silently.
  silenceDefaultEnabled: false,

  // Pre-gate check 2 (Section 5): lookback window for duplicate-intent
  // detection against the run log. Exact raw_input match only — semantic
  // near-duplicate detection is a natural later enhancement, not built here.
  duplicateLookbackHours: 24,

  // Section 9: Artifact/Skill dispatch (M3) is "building" — workhorse
  // tier, not economy (reserved for classification/extraction/triage).
  artifactTier: 'workhorse',
  skillTier: 'workhorse',

  // Retry policy for the two M3 activities (produceArtifact,
  // draftSkillContract). 3 attempts balances transient LiteLLM/network
  // hiccups against silently hammering a persistently bad prompt; 30s per
  // attempt is generous for a short (few-hundred-token) completion without
  // letting one hung connection block the workflow indefinitely. Retries
  // run inside the activity (not Temporal's automatic retry) so cost/
  // tokens from every attempt sum into the result — Temporal's own retry
  // would discard a failed attempt's already-billed usage.
  activityMaxAttempts: 3,
  activityAttemptTimeoutMs: 30_000,
  // Temporal's own startToCloseTimeout on the activity call: comfortably
  // covers 3 sequential 30s attempts plus overhead, without Temporal's
  // retry layer engaging (maximumAttempts: 1 at the workflow level).
  activityStartToCloseTimeoutMs: 150_000,

  // M4's pendingTaskTtlMs/pendingTaskSweepIntervalMs deliberately do NOT
  // live here: this file gets bundled into Temporal's workflow sandbox
  // (workflows import CONFIG for static values like
  // activityStartToCloseTimeoutMs), and that sandbox has no `process`
  // global — `process.env` at module scope throws ReferenceError at
  // bundle-load time, not just returns undefined. Those two values are
  // only ever used by web/server.js (never inside a workflow), so they're
  // defined there instead, as local constants reading process.env.

  // M6 voice intake (spec Section 10 open decision 2, resolved: local,
  // no egress). Model is a request param to the local speaches server,
  // not a server-wide default, so it lives here rather than in compose.
  sttModel: 'deepdml/faster-whisper-large-v3-turbo-ct2',
  // ~3 minutes is the primary cap, enforced client-side (the record
  // button auto-stops the recording at this point). The server enforces
  // a corresponding byte-size cap as the real backstop, since duration
  // isn't otherwise verified server-side without adding an audio-probing
  // dependency (ffprobe) that a v0 voice feature doesn't need yet: 3min
  // at a generous 256kbps ceiling (well above typical voice-optimized
  // Opus, which runs 24-64kbps) is 5.76MB; doubled for container-format
  // overhead and safety margin.
  voiceMaxDurationSeconds: 180,
  voiceMaxBytes: 10 * 1024 * 1024,
  voiceAllowedMimePrefix: 'audio/',

  // M7 evaluator (spec Section 7, Section 9 tier table: "flagship —
  // evaluator runs, plan reviews, contract-artifact diffs").
  evaluatorTier: 'flagship',

  // Corrected at v1.7: Section 7 previously said bookkeeping diffs "may
  // auto-apply, up to a versioned per-run cap (default 5)" — superseded
  // at v1.0 review to cap 0/classify-only, but the changelog row never
  // landed. Both gates default to the conservative state; either one
  // alone would already block auto-apply, cap 0 makes it structural
  // rather than incidental. Loosen only by changelog, only after N
  // cycles at >=95% unmodified owner approval of bookkeeping diffs
  // (spec Section 7) — not a runtime value, a human decision gate.
  evaluatorAutoApplyEnabled: false,
  evaluatorAutoApplyCap: 0,

  // Minimum sample size per check before a signal counts as a finding
  // (actionable) rather than an observation (informational only).
  // Small round numbers — conservative enough that single-digit samples
  // don't produce noise dressed up as signal.
  evaluatorOverrideRateMinN: 5,
  evaluatorFrictionMinN: 5,
  evaluatorCostOutlierMinN: 5,
  evaluatorCalibrationMinN: 10,
  // Dead-branch check gates on total corpus size, not per-outcome n —
  // an outcome having zero occurrences means little until the corpus is
  // large enough that "hasn't come up yet" becomes an unlikely explanation.
  evaluatorDeadBranchCorpusMinN: 20,
  // Spec Section 11's M7 DoD: "first scheduled review over >=30 real
  // runs." Distinct from evaluatorDeadBranchCorpusMinN (20) — this is
  // the milestone's own bar, tracked and stated explicitly rather than
  // silently implied by the per-check gates.
  evaluatorMinRunsForFirstReview: 30,
};

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

  // Starts disabled: M2 requires explicit confirmation on every route,
  // regardless of confidence. Loosen only once override data justifies
  // it, and only via a changelog entry — never silently.
  silenceDefaultEnabled: false,

  // Pre-gate check 2 (Section 5): lookback window for duplicate-intent
  // detection against the run log. Exact raw_input match only — semantic
  // near-duplicate detection is a natural later enhancement, not built here.
  duplicateLookbackHours: 24,
};

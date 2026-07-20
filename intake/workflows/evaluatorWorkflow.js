// M7: spec Section 7 — "Trigger: scheduled (weekly default)." One
// activity call; the workflow itself is a thin wrapper, matching the M3
// Artifact/Skill workflows' pattern for the same reason (the real work
// is one bounded unit, not multi-step orchestration).
import { proxyActivities } from '@temporalio/workflow';

const { runEvaluatorCycle } = proxyActivities({
  // Generous: reads the whole run log, several DB writes, one flagship
  // LLM call. Not on the same bounded-retry-inside-the-activity pattern
  // as M3's activities (no external per-attempt cost to sum) — a single
  // Temporal-level retry is fine here.
  startToCloseTimeout: '120s',
  retry: { maximumAttempts: 2 },
});

export async function evaluatorWorkflow() {
  return runEvaluatorCycle();
}

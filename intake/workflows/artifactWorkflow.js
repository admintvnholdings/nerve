// Spec Section 5: Artifact's dispatch target is a "direct execution
// session" whose first (and, for a one-off deliverable, only) action is
// "produce the deliverable now" — that's the entire M3 job, so this
// workflow is a thin single-activity wrapper, not an under-built stub.
import { proxyActivities } from '@temporalio/workflow';
import { CONFIG } from '../config.js';

const { produceArtifact } = proxyActivities({
  startToCloseTimeout: `${CONFIG.activityStartToCloseTimeoutMs}ms`,
  // The activity manages its own bounded retry internally (so it can sum
  // cost/tokens across attempts) — Temporal's own retry stays off.
  retry: { maximumAttempts: 1 },
});

export async function artifactWorkflow({ runId, normalized }) {
  return produceArtifact({ runId, normalized });
}

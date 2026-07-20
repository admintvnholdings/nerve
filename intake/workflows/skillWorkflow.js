// Spec Section 5: the skill-authoring workflow's first action is "draft
// contract: inputs, outputs, single responsibility" — that's M3's whole
// scope for this outcome (full skill authoring, testing, and registration
// mature later, per Section 5's bottom-up maturation order).
import { proxyActivities } from '@temporalio/workflow';
import { CONFIG } from '../config.js';

const { draftSkillContract } = proxyActivities({
  startToCloseTimeout: `${CONFIG.activityStartToCloseTimeoutMs}ms`,
  retry: { maximumAttempts: 1 },
});

export async function skillWorkflow({ runId, normalized }) {
  return draftSkillContract({ runId, normalized });
}

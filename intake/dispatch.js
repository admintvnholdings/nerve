// M3: starts the Temporal workflow for outcomes that actually dispatch
// (Artifact, Skill). Every other outcome stays exactly as M2 — route
// decided, no dispatch, execution/measures/output_ref null.
import { Connection, Client } from '@temporalio/client';

const WORKFLOW_META = {
  artifact: { type: 'artifactWorkflow', workflowId: 'artifact-direct-execution', workflowVersion: '0.1.0' },
  skill: { type: 'skillWorkflow', workflowId: 'skill-authoring-workflow', workflowVersion: '0.1.0' },
};

export function dispatchable(outcome) {
  return outcome in WORKFLOW_META;
}

export async function dispatch(outcome, runId, normalized) {
  const meta = WORKFLOW_META[outcome];
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233',
  });
  const client = new Client({ connection });
  const startedAt = Date.now();

  try {
    const handle = await client.workflow.start(meta.type, {
      taskQueue: 'nerve-outcomes',
      workflowId: `dispatch-${runId}`,
      args: [{ runId, normalized }],
    });
    const result = await handle.result();
    return {
      workflowId: meta.workflowId,
      workflowVersion: meta.workflowVersion,
      status: 'shipped',
      errorClass: null,
      durationMs: Date.now() - startedAt,
      costUsd: result.costUsd,
      tokens: result.tokens,
      outcomeShipped: true,
      outputRef: result.outputRef,
    };
  } catch (err) {
    return {
      workflowId: meta.workflowId,
      workflowVersion: meta.workflowVersion,
      status: 'failed',
      errorClass: err.name || 'Error',
      durationMs: Date.now() - startedAt,
      costUsd: null,
      tokens: null,
      outcomeShipped: false,
      outputRef: null,
    };
  } finally {
    await connection.close();
  }
}

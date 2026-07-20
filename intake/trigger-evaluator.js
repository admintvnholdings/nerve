#!/usr/bin/env node
// M7: manual trigger — runs the exact same evaluatorWorkflow the weekly
// schedule invokes, for on-demand verification without waiting a week.
import { randomUUID } from 'node:crypto';
import { Connection, Client } from '@temporalio/client';

async function main() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233',
  });
  const client = new Client({ connection });

  try {
    const handle = await client.workflow.start('evaluatorWorkflow', {
      taskQueue: 'nerve-outcomes',
      workflowId: `evaluator-manual-${randomUUID()}`,
      args: [],
    });
    console.log(`Started ${handle.workflowId}, waiting for result...`);
    const result = await handle.result();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await connection.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

#!/usr/bin/env node
// Temporal worker: runs the Artifact/Skill outcome workflows (M3) and the
// evaluator workflow (M7) on the nerve-outcomes task queue. Long-running
// service — belongs in compose, not invoked ad hoc like the CLI.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as outcomeActivities from './activities.js';
import { runEvaluatorCycle } from './evaluator/activity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    workflowsPath: path.join(__dirname, 'workflows', 'index.js'),
    activities: { ...outcomeActivities, runEvaluatorCycle },
    taskQueue: 'nerve-outcomes',
  });

  console.log('Worker started on task queue "nerve-outcomes"');
  await worker.run();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

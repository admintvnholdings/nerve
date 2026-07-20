#!/usr/bin/env node
// M7: arms the weekly evaluator schedule (spec Section 7: "Trigger:
// scheduled (weekly default)"). Idempotent — creating a schedule that
// already exists with the same id is a no-op (Temporal returns
// AlreadyExists, which this treats as success).
import { Connection, Client, ScheduleAlreadyRunning } from '@temporalio/client';

const SCHEDULE_ID = 'nerve-evaluator-weekly';

async function main() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233',
  });
  const client = new Client({ connection });

  try {
    await client.schedule.create({
      scheduleId: SCHEDULE_ID,
      spec: {
        // Weekly default, Monday 03:00 UTC — off-hours, matches the
        // evaluator's own "reads the run log only" low-impact profile.
        cronExpressions: ['0 3 * * 1'],
      },
      action: {
        type: 'startWorkflow',
        workflowType: 'evaluatorWorkflow',
        taskQueue: 'nerve-outcomes',
        workflowId: 'evaluator-scheduled-run',
      },
    });
    console.log(`Schedule "${SCHEDULE_ID}" created: weekly, Monday 03:00 UTC.`);
  } catch (err) {
    if (err.name === 'ScheduleAlreadyRunning' || /already exists/i.test(err.message)) {
      console.log(`Schedule "${SCHEDULE_ID}" already exists — armed, nothing to do.`);
    } else {
      throw err;
    }
  } finally {
    await connection.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

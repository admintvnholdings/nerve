// M7: the Temporal activity that runs one evaluator cycle. Reads the run
// log only (spec Section 7) — never the knowledge store, never live
// workflows.
import { randomUUID } from 'node:crypto';
import { makePool } from '../lib/runRecord.js';
import { analyzeRuns } from './analyze.js';
import { synthesizeSummary } from './synthesize.js';
import { CONFIG } from '../config.js';

export async function runEvaluatorCycle() {
  const pool = makePool();
  try {
    const { rows: runs } = await pool.query('SELECT * FROM runs ORDER BY created_at');
    const { rows: pastRejections } = await pool.query(
      `SELECT target_artifact, decision_reason FROM evaluator_findings
       WHERE status = 'rejected' ORDER BY decided_at DESC LIMIT 20`,
    );

    const items = analyzeRuns(runs);
    const summary = await synthesizeSummary({ items, pastRejections });

    const runBatchId = randomUUID();
    let autoAppliedThisRun = 0;
    let findingCount = 0;
    let observationCount = 0;

    for (const item of items) {
      let status = item.kind === 'observation' ? 'observation' : 'pending';

      if (item.kind === 'finding' && item.category === 'bookkeeping' && CONFIG.evaluatorAutoApplyEnabled) {
        if (autoAppliedThisRun < CONFIG.evaluatorAutoApplyCap) {
          // Gate structurally closed at v0 (cap defaults to 0 — see
          // config.js). If ever reached, fail loudly rather than mark a
          // finding "auto_applied" when nothing was actually applied:
          // the real apply mechanism (editing the target artifact +
          // committing) doesn't exist yet. Build that when the spec's
          // enabling condition is actually met, not before.
          throw new Error(
            `evaluatorAutoApplyEnabled is true and cap allows this finding, but no apply mechanism exists yet for "${item.targetArtifact}". Do not enable auto-apply until one is built.`,
          );
        }
      }

      const { rows: [finding] } = await pool.query(
        `INSERT INTO evaluator_findings (
           run_batch_id, kind, category, target_artifact, current_value, proposed_value,
           evidence_run_ids, n, gate_threshold, evidence_strength, rationale, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          runBatchId, item.kind, item.category, item.targetArtifact,
          item.currentValue ?? null, item.proposedValue ?? null,
          JSON.stringify(item.evidenceRunIds ?? []), item.n ?? 0, item.gateThreshold ?? null,
          item.evidenceStrength, item.rationale, status,
        ],
      );
      await pool.query(
        `INSERT INTO evaluator_finding_transitions (finding_id, from_status, to_status, reason, actor)
         VALUES ($1, 'new', $2, 'evaluator cycle produced this finding/observation', 'system')`,
        [finding.id, status],
      );

      if (item.kind === 'finding') findingCount += 1; else observationCount += 1;
    }

    return { runBatchId, totalRuns: runs.length, findingCount, observationCount, summary };
  } finally {
    await pool.end();
  }
}

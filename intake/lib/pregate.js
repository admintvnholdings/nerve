// Spec Section 5 pre-gate: two cheap checks before the full 5-question
// triage. Pure function apart from the db query passed in — kept separate
// from the CLI runner so M3 can wrap this as a workflow activity unchanged.
export async function preGate({ rawInput, pool, lookbackHours }) {
  // Check 1 (will this recur / worth a one-off build?): M2 stub. There is
  // no run history yet to judge recurrence value against, so this always
  // passes. Flagged here as evaluator input (Section 7) once real
  // decline/override data exists — not built until M7.
  const check1 = {
    passed: true,
    reason: 'stub: recurrence-worth check deferred to evaluator (not yet built)',
  };
  if (!check1.passed) {
    return { decision: 'deferred', reason: check1.reason };
  }

  // Check 2 (does existing coverage already handle this?): real
  // duplicate-intent lookback against the run log. Exact raw_input match
  // only — semantic near-duplicate detection is a later enhancement.
  const { rows } = await pool.query(
    `SELECT id, outcome FROM runs
     WHERE raw_input = $1 AND created_at > now() - ($2 || ' hours')::interval
     ORDER BY created_at DESC LIMIT 1`,
    [rawInput, lookbackHours],
  );
  const duplicate = rows[0];
  if (duplicate) {
    return {
      decision: 'declined',
      reason: `duplicate of run ${duplicate.id} (outcome: ${duplicate.outcome}) within the last ${lookbackHours}h`,
    };
  }

  return { decision: 'proceed' };
}

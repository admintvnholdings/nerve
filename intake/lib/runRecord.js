// Writes via nerve_app (migrations/002_lock_down_app_role.sql): SELECT +
// INSERT only, append-only enforced by grant. execution/measures/
// output_ref stay null except for M3's two dispatched outcomes (Artifact,
// Skill) — every other outcome is still "route out," not dispatch.
import pg from 'pg';

const VALID_OUTCOMES = new Set([
  'foundation', 'artifact', 'skill', 'routine',
  'dynamic_workflow', 'agent', 'project',
  'declined', 'deferred',
]);

export function makePool() {
  return new pg.Pool({
    // CLI runs on the host (127.0.0.1 default); the M4 web server runs in
    // a container and sets PGHOST=postgres via compose.
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT) || 5432,
    user: 'nerve_app',
    password: process.env.NERVE_APP_PASSWORD,
    database: process.env.POSTGRES_DB || 'nerve',
  });
}

export async function writeRunRecord(pool, {
  id, sourceDevice, rawInput, normalizedStatement, normalizerConfidence,
  routeAnswers, routeConfidence, outcome, confirmedOverridden,
  workflowId = null, workflowVersion = null, skillsInvoked = null,
  status = null, errorClass = null, durationMs = null, costUsd = null,
  tokens = null, outcomeShipped = null, outputRef = null,
}) {
  if (!VALID_OUTCOMES.has(outcome)) {
    throw new Error(`Invalid outcome "${outcome}" — must be one of: ${[...VALID_OUTCOMES].join(', ')}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO runs (
       id, source_device, raw_input, normalized_statement, normalizer_confidence,
       route_answers, route_confidence, outcome, confirmed_overridden,
       workflow_id, workflow_version, skills_invoked, status, error_class,
       duration_ms, cost_usd, tokens, outcome_shipped, output_ref
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING id, created_at`,
    [
      id, sourceDevice, rawInput, JSON.stringify(normalizedStatement), normalizerConfidence,
      JSON.stringify(routeAnswers), routeConfidence, outcome, confirmedOverridden,
      workflowId, workflowVersion, skillsInvoked === null ? null : JSON.stringify(skillsInvoked),
      status, errorClass, durationMs, costUsd, tokens, outcomeShipped, outputRef,
    ],
  );
  return rows[0];
}

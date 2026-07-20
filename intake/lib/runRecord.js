// Writes via nerve_app (migrations/002_lock_down_app_role.sql): SELECT +
// INSERT only, append-only enforced by grant. execution/measures stay null
// for every M2 run — M2 is "route out," not dispatch; that begins at M3.
import pg from 'pg';

const VALID_OUTCOMES = new Set([
  'foundation', 'artifact', 'skill', 'routine',
  'dynamic_workflow', 'agent', 'project',
  'declined', 'deferred',
]);

export function makePool() {
  return new pg.Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'nerve_app',
    password: process.env.NERVE_APP_PASSWORD,
    database: process.env.POSTGRES_DB || 'nerve',
  });
}

export async function writeRunRecord(pool, {
  sourceDevice, rawInput, normalizedStatement, normalizerConfidence,
  routeAnswers, routeConfidence, outcome, confirmedOverridden,
}) {
  if (!VALID_OUTCOMES.has(outcome)) {
    throw new Error(`Invalid outcome "${outcome}" — must be one of: ${[...VALID_OUTCOMES].join(', ')}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO runs (
       source_device, raw_input, normalized_statement, normalizer_confidence,
       route_answers, route_confidence, outcome, confirmed_overridden
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, created_at`,
    [
      sourceDevice, rawInput, JSON.stringify(normalizedStatement), normalizerConfidence,
      JSON.stringify(routeAnswers), routeConfidence, outcome, confirmedOverridden,
    ],
  );
  return rows[0];
}

// Shared by the API handlers and the stale-task sweep: pre-gate, then
// router if it survives. Kept out of server.js so both call sites run
// the exact same logic instead of two hand-maintained copies.
import { preGate } from '../lib/pregate.js';
import { routeAuto } from '../lib/router.js';
import { writeRunRecord } from '../lib/runRecord.js';
import { CONFIG } from '../config.js';

export const SOURCE_DEVICE = 'web';

// Returns either a terminal pre-gate result (already written to the run
// log — declined/deferred) or a proposed route for the caller to hold
// pending confirmation.
export async function preGateThenRoute({ pool, id, rawInput, normalized }) {
  const gate = await preGate({ rawInput, pool, lookbackHours: CONFIG.duplicateLookbackHours });
  if (gate.decision !== 'proceed') {
    const record = await writeRunRecord(pool, {
      id,
      sourceDevice: SOURCE_DEVICE,
      rawInput,
      normalizedStatement: normalized,
      normalizerConfidence: normalized.confidence,
      routeAnswers: { pregate: gate },
      routeConfidence: normalized.confidence,
      outcome: gate.decision,
      confirmedOverridden: null,
    });
    return { terminal: true, status: gate.decision, reason: gate.reason, record };
  }
  const route = await routeAuto({ normalized });
  return { terminal: false, route };
}

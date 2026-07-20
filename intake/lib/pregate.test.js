// Locks the Section 5 pre-gate decline path. No DB or mocking library —
// pool is a plain stub object implementing the one method preGate calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preGate } from './pregate.js';

function fakePool(rows) {
  return { query: async () => ({ rows }) };
}

test('no matching recent run -> proceed', async () => {
  const result = await preGate({
    rawInput: 'water the plants',
    pool: fakePool([]),
    lookbackHours: 24,
  });
  assert.deepEqual(result, { decision: 'proceed' });
});

test('duplicate recent run -> declined, names the prior run', async () => {
  const result = await preGate({
    rawInput: 'water the plants',
    pool: fakePool([{ id: 'abc-123', outcome: 'artifact' }]),
    lookbackHours: 24,
  });
  assert.equal(result.decision, 'declined');
  assert.match(result.reason, /abc-123/);
  assert.match(result.reason, /artifact/);
});

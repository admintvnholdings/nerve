// Locks spec Section 5's decision table branch-for-branch. deriveOutcome
// is pure — no mocks needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveOutcome } from './router.js';

const q = (answer, confidence) => ({ answer, confidence });
const NULLQ = null;

test('q1 unreachable -> foundation, stops before later questions', () => {
  const { outcome, overallConfidence } = deriveOutcome({
    q1_unreachable: q(true, 0.9),
    q2_recurs: q(false, 0.1), // must not affect the result
    q3_shape: q('capability', 0.1),
    q4_steps_vary: NULLQ,
    q5_unattended: NULLQ,
  });
  assert.equal(outcome, 'foundation');
  assert.equal(overallConfidence, 0.9);
});

test('q2 does not recur -> artifact', () => {
  const { outcome, overallConfidence } = deriveOutcome({
    q1_unreachable: q(false, 0.9),
    q2_recurs: q(false, 0.8),
    q3_shape: q('initiative', 0.1), // must not affect the result
    q4_steps_vary: NULLQ,
    q5_unattended: NULLQ,
  });
  assert.equal(outcome, 'artifact');
  assert.equal(overallConfidence, 0.8);
});

test('q3 capability -> skill', () => {
  const { outcome, overallConfidence } = deriveOutcome({
    q1_unreachable: q(false, 0.9),
    q2_recurs: q(true, 0.8),
    q3_shape: q('capability', 0.7),
    q4_steps_vary: NULLQ,
    q5_unattended: NULLQ,
  });
  assert.equal(outcome, 'skill');
  assert.equal(overallConfidence, 0.7);
});

test('q3 initiative -> project', () => {
  const { outcome, overallConfidence } = deriveOutcome({
    q1_unreachable: q(false, 0.9),
    q2_recurs: q(true, 0.8),
    q3_shape: q('initiative', 0.6),
    q4_steps_vary: NULLQ,
    q5_unattended: NULLQ,
  });
  assert.equal(outcome, 'project');
  assert.equal(overallConfidence, 0.6);
});

test('q3 process, q4 steps do not vary -> routine', () => {
  const { outcome, overallConfidence } = deriveOutcome({
    q1_unreachable: q(false, 0.9),
    q2_recurs: q(true, 0.8),
    q3_shape: q('process', 0.7),
    q4_steps_vary: q(false, 0.5),
    q5_unattended: NULLQ,
  });
  assert.equal(outcome, 'routine');
  assert.equal(overallConfidence, 0.5);
});

test('q3 process, q4 varies, q5 not unattended -> dynamic_workflow', () => {
  const { outcome, overallConfidence } = deriveOutcome({
    q1_unreachable: q(false, 0.9),
    q2_recurs: q(true, 0.8),
    q3_shape: q('process', 0.7),
    q4_steps_vary: q(true, 0.6),
    q5_unattended: q(false, 0.4),
  });
  assert.equal(outcome, 'dynamic_workflow');
  assert.equal(overallConfidence, 0.4);
});

test('q3 process, q4 varies, q5 unattended -> agent', () => {
  const { outcome, overallConfidence } = deriveOutcome({
    q1_unreachable: q(false, 0.9),
    q2_recurs: q(true, 0.8),
    q3_shape: q('process', 0.7),
    q4_steps_vary: q(true, 0.6),
    q5_unattended: q(true, 0.3),
  });
  assert.equal(outcome, 'agent');
  assert.equal(overallConfidence, 0.3);
});

test('overallConfidence is the min across only the questions on the resolved path', () => {
  const { overallConfidence } = deriveOutcome({
    q1_unreachable: q(false, 0.99),
    q2_recurs: q(true, 0.55), // lowest on this path
    q3_shape: q('capability', 0.8),
    q4_steps_vary: NULLQ,
    q5_unattended: NULLQ,
  });
  assert.equal(overallConfidence, 0.55);
});

test('missing a required answer throws rather than guessing', () => {
  assert.throws(
    () => deriveOutcome({
      q1_unreachable: q(false, 0.9),
      q2_recurs: q(true, 0.8),
      q3_shape: q('process', 0.7),
      q4_steps_vary: NULLQ, // required once shape is "process" — missing
      q5_unattended: NULLQ,
    }),
    /missing required answer for q4_steps_vary/,
  );
});

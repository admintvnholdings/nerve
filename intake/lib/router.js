// Spec Section 5: the triage router's five questions. The model only
// answers the questions (each with a confidence); this module owns the
// decision table deterministically — "rules-first" per Section 5's own
// framing, and keeps the mapping testable independent of the LLM.
import { chatJSON } from './llmClient.js';
import { CONFIG } from '../config.js';

const SYSTEM_PROMPT = `You are answering the Nerve triage router's five questions (spec Section 5) for a normalized task. Respond with ONLY a JSON object (no prose, no markdown fences):
{
  "q1_unreachable": { "answer": boolean, "confidence": number },
  "q2_recurs": { "answer": boolean, "confidence": number },
  "q3_shape": { "answer": "capability" | "process" | "initiative", "confidence": number },
  "q4_steps_vary": { "answer": boolean, "confidence": number } | null,
  "q5_unattended": { "answer": boolean, "confidence": number } | null
}

Question definitions, in order:
1. q1_unreachable: does the task need data or systems not currently reachable?
2. q2_recurs: will this happen more than once?
3. q3_shape: is it a capability, a process, or an initiative?
4. q4_steps_vary: only relevant if q3 is "process" — do the steps change on conditions or judgment? Set to null if q3 is not "process".
5. q5_unattended: only relevant if q3 is "process" and q4_steps_vary is true — should it run without the owner triggering it? Set to null otherwise.

Answer every question that could plausibly apply, even one that a prior answer would already resolve — the caller applies the decision table, not you.`;

function need(answers, key) {
  const q = answers[key];
  if (!q || typeof q.answer === 'undefined') {
    throw new Error(`Router response missing required answer for ${key}`);
  }
  return q;
}

// Section 5's exact table, applied in order, stopping at the first
// resolving question.
export function deriveOutcome(answers) {
  const path = [];
  const use = (key) => {
    const q = need(answers, key);
    path.push(q.confidence);
    return q.answer;
  };

  if (use('q1_unreachable')) return finish('foundation', path);
  if (!use('q2_recurs')) return finish('artifact', path);

  const shape = use('q3_shape');
  if (shape === 'capability') return finish('skill', path);
  if (shape === 'initiative') return finish('project', path);
  // shape === 'process'
  if (!use('q4_steps_vary')) return finish('routine', path);
  return finish(use('q5_unattended') ? 'agent' : 'dynamic_workflow', path);
}

function finish(outcome, path) {
  return { outcome, overallConfidence: Math.min(...path) };
}

export async function routeAuto({ normalized }) {
  const answers = await chatJSON({
    apiKey: process.env.LITELLM_ROUTER_KEY,
    model: CONFIG.routerTier,
    system: SYSTEM_PROMPT,
    user: JSON.stringify(normalized),
  });
  const { outcome, overallConfidence } = deriveOutcome(answers);
  return { answers, outcome, overallConfidence };
}

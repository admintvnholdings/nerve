// M7: flagship-tier LLM call (spec Section 9: "flagship — evaluator
// runs, plan reviews, contract-artifact diffs"). Its only job is a
// narrative summary on top of code-verified facts — every number in
// `items` was computed by analyze.js, not the model, so nothing
// actionable can be a hallucinated statistic.
import { chatText } from '../lib/llmClient.js';
import { CONFIG } from '../config.js';

const SYSTEM_PROMPT = `You are Nerve's evaluator (spec Section 7), writing the narrative summary for one scheduled review cycle. You are given the cycle's code-computed findings/observations (numbers already verified — do not restate them incorrectly or invent new ones) and a list of findings rejected in past cycles with their reasons. Write a short (3-6 sentence) plain-text summary: what's actionable this cycle, what's still below the data-quality gate, and whether any of today's findings resemble a past rejection (name it and its reason if so). Output plain text only — no markdown, no JSON, no code fences.`;

export async function synthesizeSummary({ items, pastRejections }) {
  const user = JSON.stringify({ items, pastRejections });
  const { text } = await chatText({
    apiKey: process.env.LITELLM_EVALUATOR_KEY,
    model: CONFIG.evaluatorTier,
    system: SYSTEM_PROMPT,
    user,
    maxAttempts: CONFIG.activityMaxAttempts,
    attemptTimeoutMs: CONFIG.activityAttemptTimeoutMs,
  });
  return text;
}

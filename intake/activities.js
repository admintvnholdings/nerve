// Temporal activities for the two M3 outcome workflows. Each does the LLM
// call (with its own bounded retry — see config.js) and writes the
// deliverable to disk; the run record only ever stores a pointer
// (output_ref) plus metadata, never the content itself (spec Section 6 is
// telemetry, not vault/content storage).
import fs from 'node:fs/promises';
import path from 'node:path';
import { chatText } from './lib/llmClient.js';
import { CONFIG } from './config.js';

const OUTPUT_ROOT = path.join(process.cwd(), 'output');

async function writeOutput(outcome, runId, text) {
  const dir = path.join(OUTPUT_ROOT, outcome);
  await fs.mkdir(dir, { recursive: true });
  const relPath = path.join('output', outcome, `${runId}.md`);
  await fs.writeFile(path.join(process.cwd(), relPath), text, 'utf8');
  return relPath;
}

const ARTIFACT_SYSTEM_PROMPT = `You are Nerve's Artifact outcome (spec Section 5: "Direct execution session — produce the deliverable now"). Given a normalized task, produce the deliverable itself — plain text, ready to use as-is (e.g. the drafted email, the written note, the requested document). No preamble, no markdown fences, no commentary about what you're doing — just the deliverable.`;

export async function produceArtifact({ runId, normalized }) {
  const { text, totalTokens, totalCostUsd, attempts } = await chatText({
    apiKey: process.env.LITELLM_ARTIFACT_KEY,
    model: CONFIG.artifactTier,
    system: ARTIFACT_SYSTEM_PROMPT,
    user: JSON.stringify(normalized),
    maxAttempts: CONFIG.activityMaxAttempts,
    attemptTimeoutMs: CONFIG.activityAttemptTimeoutMs,
  });
  const outputRef = await writeOutput('artifact', runId, text);
  return { outputRef, tokens: totalTokens, costUsd: totalCostUsd, attempts };
}

const SKILL_SYSTEM_PROMPT = `You are Nerve's Skill outcome (spec Section 5: "Skill-authoring workflow — draft contract: inputs, outputs, single responsibility"). Given a normalized task describing a recurring capability, draft the skill contract as plain markdown: frontmatter (name, description, version) followed by When-to-use / Procedure / Failure-modes / Output sections. The description field is the routing trigger — it must carry at least 3 trigger phrases and state what the skill explicitly does not do (spec Section 5). This is a draft contract only — do not implement the skill's logic. Output the raw markdown directly — no outer \`\`\` code fence wrapping the whole document, no preamble, no commentary.`;

export async function draftSkillContract({ runId, normalized }) {
  const { text, totalTokens, totalCostUsd, attempts } = await chatText({
    apiKey: process.env.LITELLM_SKILL_KEY,
    model: CONFIG.skillTier,
    system: SKILL_SYSTEM_PROMPT,
    user: JSON.stringify(normalized),
    maxAttempts: CONFIG.activityMaxAttempts,
    attemptTimeoutMs: CONFIG.activityAttemptTimeoutMs,
  });
  const outputRef = await writeOutput('skill', runId, text);
  return { outputRef, tokens: totalTokens, costUsd: totalCostUsd, attempts };
}

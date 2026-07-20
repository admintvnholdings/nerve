#!/usr/bin/env node
// M2 entrypoint (spec Section 11): text task in, route out, run record
// written. No UI beyond this CLI.
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { normalize } from './lib/normalize.js';
import { preGate } from './lib/pregate.js';
import { routeAuto } from './lib/router.js';
import { makePool, writeRunRecord } from './lib/runRecord.js';
import { CONFIG } from './config.js';

const rl = readline.createInterface({ input: stdin, output: stdout });
const ask = (prompt) => rl.question(prompt).then((a) => a.trim());

async function main() {
  const rawInput = process.argv.slice(2).join(' ').trim() || (await ask('Task: '));
  if (!rawInput) throw new Error('No task text given.');
  const sourceDevice = process.env.NERVE_SOURCE_DEVICE || 'cli';
  const pool = makePool();

  try {
    let normalized = await normalize({ rawInput, sourceDevice });

    if (normalized.clarifying_question) {
      console.log(`\nClarifying question: ${normalized.clarifying_question}`);
      const answer = await ask('Your answer: ');
      normalized = await normalize({ rawInput, sourceDevice, priorAnswer: answer });
    }

    console.log('\nNormalized task:');
    console.log(JSON.stringify(normalized, null, 2));

    const gate = await preGate({
      rawInput,
      pool,
      lookbackHours: CONFIG.duplicateLookbackHours,
    });

    if (gate.decision !== 'proceed') {
      const record = await writeRunRecord(pool, {
        sourceDevice,
        rawInput,
        normalizedStatement: normalized,
        normalizerConfidence: normalized.confidence,
        // No 5-question routing happened — this is the pre-gate's own
        // verdict, not a route. route_confidence borrows the normalizer's
        // confidence since no route confidence was computed.
        routeAnswers: { pregate: gate },
        routeConfidence: normalized.confidence,
        outcome: gate.decision,
        confirmedOverridden: null,
      });
      console.log(`\n${gate.decision.toUpperCase()}: ${gate.reason}`);
      console.log(`Run recorded: ${record.id} at ${record.created_at.toISOString()}`);
      return;
    }

    const route = await routeAuto({ normalized });

    console.log('\nProposed route:');
    console.log(JSON.stringify(route, null, 2));

    const silenceEligible = CONFIG.silenceDefaultEnabled
      && route.overallConfidence >= CONFIG.routeConfidenceThreshold;

    const prompt = silenceEligible
      ? `Confirm outcome "${route.outcome}"? [Enter=confirm / type an override outcome]: `
      : `Explicit confirmation required (confidence ${route.overallConfidence} vs threshold ${CONFIG.routeConfidenceThreshold}, silence-default ${CONFIG.silenceDefaultEnabled ? 'enabled' : 'disabled'}).\nType "confirm" to accept "${route.outcome}", or type an override outcome: `;

    const answer = await ask(prompt);

    let finalOutcome;
    let confirmedOverridden;

    if (silenceEligible && answer === '') {
      finalOutcome = route.outcome;
      confirmedOverridden = 'confirmed';
    } else if (answer.toLowerCase() === 'confirm') {
      finalOutcome = route.outcome;
      confirmedOverridden = 'confirmed';
    } else if (answer !== '') {
      finalOutcome = answer.toLowerCase();
      confirmedOverridden = 'overridden';
    } else {
      // No explicit confirmation given. Still writes a run record — every
      // run is logged, including the ones the owner walks away from,
      // otherwise the data that later calibrates silence-default, tier
      // escalation, and confidence thresholds is survivor-biased toward
      // only confirmed/overridden routes. outcome stays the *proposed*
      // route (never confirmed or overridden); confirmed_overridden
      // records that distinctly as 'aborted'.
      finalOutcome = route.outcome;
      confirmedOverridden = 'aborted';
    }

    const record = await writeRunRecord(pool, {
      sourceDevice,
      rawInput,
      normalizedStatement: normalized,
      normalizerConfidence: normalized.confidence,
      routeAnswers: route.answers,
      routeConfidence: route.overallConfidence,
      outcome: finalOutcome,
      confirmedOverridden,
    });

    console.log(`\n${confirmedOverridden.toUpperCase()}: ${finalOutcome}`);
    console.log(`Run recorded: ${record.id} at ${record.created_at.toISOString()}`);
  } finally {
    rl.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exitCode = 1;
});

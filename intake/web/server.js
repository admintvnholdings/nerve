#!/usr/bin/env node
// M4: Desktop app v0 backend — task entry, route confirmation, run
// history (spec Section 11 M4 / 4.1). Same underlying logic as the CLI
// (../lib/*, ../dispatch.js) — a second interface onto it, not a rewrite.
// source_device is always 'web' here so the two interfaces stay
// distinguishable in the run log.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { normalize } from '../lib/normalize.js';
import { makePool, writeRunRecord } from '../lib/runRecord.js';
import { dispatchable, dispatch } from '../dispatch.js';
import { preGateThenRoute, SOURCE_DEVICE } from './pipeline.js';
import * as pendingStore from './pendingStore.js';
import { CONFIG } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = makePool();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/tasks', async (req, res) => {
  try {
    const rawInput = (req.body?.text || '').trim();
    if (!rawInput) return res.status(400).json({ error: 'text is required' });

    const id = randomUUID();
    const normalized = await normalize({ rawInput, sourceDevice: SOURCE_DEVICE });

    if (normalized.clarifying_question) {
      pendingStore.create(id, { stage: 'awaiting_clarification', rawInput, normalized });
      return res.json({
        taskId: id, status: 'clarify', question: normalized.clarifying_question, normalized,
      });
    }

    const result = await preGateThenRoute({ pool, id, rawInput, normalized });
    if (result.terminal) {
      return res.json({ taskId: id, status: result.status, reason: result.reason, runId: result.record.id });
    }
    pendingStore.create(id, { stage: 'route_proposed', rawInput, normalized, route: result.route });
    return res.json({
      taskId: id,
      status: 'route_proposed',
      normalized,
      route: result.route,
      routeConfidenceThreshold: CONFIG.routeConfidenceThreshold,
      silenceDefaultEnabled: CONFIG.silenceDefaultEnabled,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/clarify', async (req, res) => {
  try {
    const { id } = req.params;
    const pending = pendingStore.get(id);
    if (!pending || pending.stage !== 'awaiting_clarification') {
      return res.status(404).json({ error: 'no pending task awaiting clarification with that id' });
    }
    const answer = (req.body?.answer || '').trim();
    const normalized = await normalize({
      rawInput: pending.rawInput, sourceDevice: SOURCE_DEVICE, priorAnswer: answer,
    });

    const result = await preGateThenRoute({ pool, id, rawInput: pending.rawInput, normalized });
    if (result.terminal) {
      pendingStore.remove(id);
      return res.json({ taskId: id, status: result.status, reason: result.reason, runId: result.record.id });
    }
    pendingStore.update(id, { stage: 'route_proposed', normalized, route: result.route });
    return res.json({
      taskId: id,
      status: 'route_proposed',
      normalized,
      route: result.route,
      routeConfidenceThreshold: CONFIG.routeConfidenceThreshold,
      silenceDefaultEnabled: CONFIG.silenceDefaultEnabled,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const pending = pendingStore.get(id);
    if (!pending || pending.stage !== 'route_proposed') {
      return res.status(404).json({ error: 'no pending task awaiting confirmation with that id' });
    }
    const { action, outcome } = req.body || {};
    if (action !== 'confirm' && action !== 'override') {
      return res.status(400).json({ error: 'action must be "confirm" or "override"' });
    }

    const finalOutcome = action === 'confirm'
      ? pending.route.outcome
      : (outcome || '').trim().toLowerCase();
    const confirmedOverridden = action === 'confirm' ? 'confirmed' : 'overridden';

    let dispatchResult = {};
    if (dispatchable(finalOutcome)) {
      dispatchResult = await dispatch(finalOutcome, id, pending.normalized);
    }

    const record = await writeRunRecord(pool, {
      id,
      sourceDevice: SOURCE_DEVICE,
      rawInput: pending.rawInput,
      normalizedStatement: pending.normalized,
      normalizerConfidence: pending.normalized.confidence,
      routeAnswers: pending.route.answers,
      routeConfidence: pending.route.overallConfidence,
      outcome: finalOutcome,
      confirmedOverridden,
      workflowId: dispatchResult.workflowId,
      workflowVersion: dispatchResult.workflowVersion,
      skillsInvoked: dispatchResult.workflowId ? [] : null,
      status: dispatchResult.status,
      errorClass: dispatchResult.errorClass,
      durationMs: dispatchResult.durationMs,
      costUsd: dispatchResult.costUsd,
      tokens: dispatchResult.tokens,
      outcomeShipped: dispatchResult.outcomeShipped,
      outputRef: dispatchResult.outputRef,
    });
    pendingStore.remove(id);

    return res.json({
      taskId: id, status: confirmedOverridden, outcome: finalOutcome,
      runId: record.id, outputRef: dispatchResult.outputRef || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/runs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await pool.query(
      `SELECT id, created_at, source_device, raw_input, outcome, confirmed_overridden,
              status, duration_ms, cost_usd, tokens, outcome_shipped, output_ref
       FROM runs ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Same abort semantics as the CLI (M2 closure): every run is logged,
// including the ones the owner walks away from — applied here to tasks
// abandoned mid-flow in the web app.
async function sweepStalePendingTasks() {
  const now = Date.now();
  for (const [id, task] of pendingStore.entries()) {
    if (now - task.lastActivityAt < CONFIG.pendingTaskTtlMs) continue;
    pendingStore.remove(id);
    try {
      if (task.stage === 'route_proposed') {
        await writeRunRecord(pool, {
          id,
          sourceDevice: SOURCE_DEVICE,
          rawInput: task.rawInput,
          normalizedStatement: task.normalized,
          normalizerConfidence: task.normalized.confidence,
          routeAnswers: task.route.answers,
          routeConfidence: task.route.overallConfidence,
          outcome: task.route.outcome,
          confirmedOverridden: 'aborted',
        });
        console.log(`Swept stale task ${id}: aborted (proposed outcome ${task.route.outcome})`);
      } else {
        // Never got past the clarifying question — finalize with what we
        // have, ignoring the unanswered question, the same way the CLI's
        // own pipeline would if handed only the original input.
        const result = await preGateThenRoute({
          pool, id, rawInput: task.rawInput, normalized: task.normalized,
        });
        if (result.terminal) {
          console.log(`Swept stale task ${id}: ${result.status}`);
        } else {
          await writeRunRecord(pool, {
            id,
            sourceDevice: SOURCE_DEVICE,
            rawInput: task.rawInput,
            normalizedStatement: task.normalized,
            normalizerConfidence: task.normalized.confidence,
            routeAnswers: result.route.answers,
            routeConfidence: result.route.overallConfidence,
            outcome: result.route.outcome,
            confirmedOverridden: 'aborted',
          });
          console.log(`Swept stale task ${id}: aborted (proposed outcome ${result.route.outcome})`);
        }
      }
    } catch (err) {
      console.error(`Sweep failed for pending task ${id}:`, err.message);
    }
  }
}
setInterval(() => {
  sweepStalePendingTasks().catch((err) => console.error('Sweep error:', err));
}, CONFIG.pendingTaskSweepIntervalMs);

const PORT = process.env.WEB_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nerve web app listening on :${PORT}`);
});

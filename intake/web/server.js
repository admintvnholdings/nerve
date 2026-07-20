#!/usr/bin/env node
// M4: Desktop app v0 backend — task entry, route confirmation, run
// history (spec Section 11 M4 / 4.1). Same underlying logic as the CLI
// (../lib/*, ../dispatch.js) — a second interface onto it, not a rewrite.
// source_device is always 'web' here so the two interfaces stay
// distinguishable in the run log.
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import express from 'express';
import multer from 'multer';
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

// M6: voice is just a way to fill the textarea — this is the only new
// endpoint. Everything downstream (normalize/pregate/router/dispatch/
// schema) is unchanged and unaware voice exists.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CONFIG.voiceMaxBytes },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith(CONFIG.voiceAllowedMimePrefix)) {
      return cb(new Error(`Only audio uploads are accepted (got ${file.mimetype})`));
    }
    cb(null, true);
  },
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file is required' });

    const form = new FormData();
    form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname || 'recording');
    form.append('model', CONFIG.sttModel);

    const sttRes = await fetch(`${process.env.STT_BASE_URL}/v1/audio/transcriptions`, {
      method: 'POST',
      body: form,
    });
    if (!sttRes.ok) {
      const text = await sttRes.text();
      throw new Error(`STT service failed (${sttRes.status}): ${text}`);
    }
    const { text } = await sttRes.json();
    res.json({ text });
  } catch (err) {
    console.error('Transcription error:', err.message);
    const status = err.message.startsWith('Only audio uploads') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});
// multer's own file-too-large error arrives via this error-handling
// middleware (4-arg signature), not the route handler's catch.
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `Recording too large — max ${CONFIG.voiceMaxBytes} bytes (~${CONFIG.voiceMaxDurationSeconds}s)`,
    });
  }
  next(err);
});

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

// Same "every run is logged" principle as the CLI's abort handling (M2
// closure), applied to tasks abandoned mid-flow in the web app — but a
// task abandoned before a route ever existed (still waiting on the
// clarifying answer) is NOT routed to manufacture one: no LLM call, no
// fabricated route. It's recorded as unrouted (spec v1.4) instead.
// Removed from pendingStore only after a successful write — if the write
// fails, the task stays pending and the next sweep retries it, rather
// than silently vanishing.
async function sweepStalePendingTasks() {
  const now = Date.now();
  for (const [id, task] of pendingStore.entries()) {
    if (now - task.lastActivityAt < CONFIG.pendingTaskTtlMs) continue;
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
        // Abandoned before the clarifying question was ever answered —
        // no pre-gate, no router, no route. confirmed_overridden stays
        // null: 'aborted' means a route was proposed (v1.2), which isn't
        // true here.
        await writeRunRecord(pool, {
          id,
          sourceDevice: SOURCE_DEVICE,
          rawInput: task.rawInput,
          normalizedStatement: task.normalized,
          normalizerConfidence: task.normalized.confidence,
          routeAnswers: { unrouted: true, reason: 'abandoned before clarifying question was answered' },
          routeConfidence: task.normalized.confidence,
          outcome: 'unrouted',
          confirmedOverridden: null,
        });
        console.log(`Swept stale task ${id}: unrouted (no clarifying answer)`);
      }
      pendingStore.remove(id);
    } catch (err) {
      console.error(`Sweep failed for pending task ${id}, will retry next sweep:`, err.message);
    }
  }
}
setInterval(() => {
  sweepStalePendingTasks().catch((err) => console.error('Sweep error:', err));
}, CONFIG.pendingTaskSweepIntervalMs);

const PORT = process.env.WEB_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nerve web app listening on :${PORT} (HTTP)`);
});

// M6: HTTPS is a prerequisite for microphone access (getUserMedia requires
// a secure context; the Tailscale IP over plain HTTP doesn't qualify,
// unlike 127.0.0.1). Cert is issued via Tailscale's own control plane
// (tailscale cert) — no public exposure, no self-signed-cert warnings.
// Optional: HTTP-only environments (e.g. before the cert exists) skip
// this rather than crash.
const CERT_PATH = process.env.TLS_CERT_PATH;
const KEY_PATH = process.env.TLS_KEY_PATH;
if (CERT_PATH && KEY_PATH && fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
  const HTTPS_PORT = process.env.WEB_HTTPS_PORT || 3443;
  https.createServer({
    cert: fs.readFileSync(CERT_PATH),
    key: fs.readFileSync(KEY_PATH),
  }, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`Nerve web app listening on :${HTTPS_PORT} (HTTPS, mic access enabled)`);
  });
} else {
  console.log('TLS_CERT_PATH/TLS_KEY_PATH not set or files missing — HTTPS disabled, no mic access.');
}

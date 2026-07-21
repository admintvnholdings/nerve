// M7: pure, deterministic evaluator analysis (spec Section 7). Reads the
// run log only — never the knowledge store, never live workflows. All
// numbers here are code-computed, not LLM-guessed: the flagship-tier LLM
// call (see synthesize.js) only writes a narrative summary on top of
// these code-verified facts, so nothing actionable can be a hallucinated
// statistic.
import { CONFIG } from '../config.js';

const ALL_OUTCOMES = [
  'foundation', 'artifact', 'skill', 'routine', 'dynamic_workflow',
  'agent', 'project', 'declined', 'deferred', 'unrouted',
];

const DATA_QUALITY_NOTE = 'This corpus mixes organic usage with deliberate M2/M4 closure-test scenarios that intentionally exercised override/abort paths (see README/CLAUDE.md history) — rates derived from it may not reflect steady-state owner behavior.';

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Always emitted — a structural gap, not data-derived. Spec Section 7
// requires residue analysis; nothing in the router instruments it.
function residueGapFinding() {
  return {
    kind: 'finding',
    category: 'substantive',
    targetArtifact: 'spec.section5.residue_instrumentation',
    currentValue: 'not instrumented',
    proposedValue: 'Section 5 change: the router logs residue (a task no question cleanly discriminates) as its own category, distinct from a resolved outcome, so recurring residue patterns (>=3x, per Section 5) become visible to the evaluator.',
    evidenceRunIds: [],
    n: 0,
    gateThreshold: null,
    evidenceStrength: 'structural',
    rationale: 'Section 7 requires residue analysis ("recurring identical residue routings (>=3x) on the same pattern" as evaluator input). The router never instruments residue as its own category — deriveOutcome() either resolves deterministically via the 5 questions or throws on a malformed answer; there is no residue data to analyze. This is a structural gap, not a data-driven finding, and fixing it is a Section 5/router change — out of M7\'s own scope. Proposed remedy: route as a task once approved.',
  };
}

function deadBranchFindings(runs) {
  const gate = CONFIG.evaluatorDeadBranchCorpusMinN;
  const total = runs.length;
  if (total < gate) {
    return [{
      kind: 'observation',
      category: null,
      targetArtifact: 'router.deriveOutcome.branches',
      currentValue: null,
      proposedValue: null,
      evidenceRunIds: [],
      n: total,
      gateThreshold: gate,
      evidenceStrength: 'below_gate',
      rationale: `Dead-branch check needs >=${gate} total runs before "never fired" is meaningful rather than "hasn't come up yet"; only ${total} exist.`,
    }];
  }
  const seen = new Set(runs.map((r) => r.outcome));
  return ALL_OUTCOMES.filter((o) => !seen.has(o)).map((outcome) => ({
    kind: 'finding',
    category: 'substantive',
    targetArtifact: `router.deriveOutcome.branches.${outcome}`,
    currentValue: 'never fired',
    proposedValue: `Review whether the 5-question table can actually reach "${outcome}" in practice, or whether it's genuinely rare at this run volume.`,
    evidenceRunIds: [],
    n: total,
    gateThreshold: gate,
    evidenceStrength: 'adequate',
    rationale: `Outcome "${outcome}" has never appeared in ${total} runs (spec Section 7: "branches that never fire"). No run ids to cite — this finding is about an absence, not a presence.`,
  }));
}

// Maps to Section 7's "outcomes dispatched but never shipped (routing or
// friction problem)" — an aborted run is exactly a route the owner saw
// and didn't accept.
function frictionFindings(runs) {
  const decided = runs.filter((r) => ['confirmed', 'overridden', 'aborted'].includes(r.confirmed_overridden));
  const gate = CONFIG.evaluatorFrictionMinN;
  const n = decided.length;
  const aborted = decided.filter((r) => r.confirmed_overridden === 'aborted');
  const rate = n ? aborted.length / n : 0;
  const evidenceRunIds = decided.map((r) => r.id);

  if (n < gate) {
    return [{
      kind: 'observation',
      category: null,
      targetArtifact: 'web.pendingTaskTtl.frictionRate',
      currentValue: null,
      proposedValue: null,
      evidenceRunIds,
      n,
      gateThreshold: gate,
      evidenceStrength: 'below_gate',
      rationale: `Abort/friction rate is ${(rate * 100).toFixed(0)}% (${aborted.length}/${n}), but n=${n} is below the gate of ${gate} — not enough data yet.`,
    }];
  }
  if (rate <= 0.2) return [];
  return [{
    kind: 'finding',
    category: 'bookkeeping',
    targetArtifact: 'web.pendingTaskTtl.frictionRate',
    currentValue: `${(rate * 100).toFixed(0)}% of decided routes ended aborted`,
    proposedValue: 'Consider whether pendingTaskTtlMs is too short for real usage, or whether the route-confirmation UI needs to be more frictionless.',
    evidenceRunIds,
    n,
    gateThreshold: gate,
    evidenceStrength: 'adequate',
    rationale: `${(rate * 100).toFixed(0)}% (${aborted.length}/${n}) of routes proposed to the owner were neither confirmed nor overridden (Section 7: "outcomes dispatched but never shipped"). ${DATA_QUALITY_NOTE}`,
  }];
}

function overrideRateFindings(runs) {
  const gate = CONFIG.evaluatorOverrideRateMinN;
  const decided = runs.filter((r) => ['confirmed', 'overridden'].includes(r.confirmed_overridden));
  const byOutcome = groupBy(decided, (r) => r.outcome);
  const items = [];
  for (const [outcome, group] of byOutcome) {
    const n = group.length;
    const overridden = group.filter((r) => r.confirmed_overridden === 'overridden');
    const rate = overridden.length / n;
    const evidenceRunIds = group.map((r) => r.id);
    if (n < gate) {
      items.push({
        kind: 'observation',
        category: null,
        targetArtifact: `router.overrideRate.${outcome}`,
        currentValue: null,
        proposedValue: null,
        evidenceRunIds,
        n,
        gateThreshold: gate,
        evidenceStrength: 'below_gate',
        rationale: `Override rate for "${outcome}" is ${(rate * 100).toFixed(0)}% (${overridden.length}/${n}), n=${n} below gate ${gate}.`,
      });
      continue;
    }
    if (rate <= 0.2) continue;
    items.push({
      kind: 'finding',
      category: 'bookkeeping',
      targetArtifact: `router.overrideRate.${outcome}`,
      currentValue: `${(rate * 100).toFixed(0)}% override rate`,
      proposedValue: `Review the 5-question wording/weighting that leads to "${outcome}" — a high override rate suggests the auto-answered route often doesn't match owner intent (Section 7: "rising override rate on auto-answers, normalizer drift").`,
      evidenceRunIds,
      n,
      gateThreshold: gate,
      evidenceStrength: 'adequate',
      rationale: `Override rate for "${outcome}" is ${(rate * 100).toFixed(0)}% (${overridden.length}/${n}), above the 20% attention threshold. ${DATA_QUALITY_NOTE}`,
    });
  }
  return items;
}

function costOutlierFindings(runs) {
  const gate = CONFIG.evaluatorCostOutlierMinN;
  const withCost = runs.filter((r) => r.cost_usd !== null && r.cost_usd !== undefined);
  const byOutcome = groupBy(withCost, (r) => r.outcome);
  const items = [];
  for (const [outcome, group] of byOutcome) {
    const n = group.length;
    const costs = group.map((r) => Number(r.cost_usd));
    const evidenceRunIds = group.map((r) => r.id);
    if (n < gate) {
      items.push({
        kind: 'observation',
        category: null,
        targetArtifact: `cost.${outcome}`,
        currentValue: null,
        proposedValue: null,
        evidenceRunIds,
        n,
        gateThreshold: gate,
        evidenceStrength: 'below_gate',
        rationale: `Cost distribution for "${outcome}" has n=${n}, below gate ${gate} — outlier detection not yet meaningful.`,
      });
      continue;
    }
    const med = median(costs);
    const outliers = group.filter((r) => Number(r.cost_usd) > med * 3 && med > 0);
    if (!outliers.length) continue;
    items.push({
      kind: 'finding',
      category: 'bookkeeping',
      targetArtifact: `cost.${outcome}`,
      currentValue: `median $${med.toFixed(4)}, ${outliers.length} run(s) >3x median`,
      proposedValue: `Review the ${outcome === 'skill' ? 'draftSkillContract' : 'produceArtifact'} prompt/activity for the outlier run(s) — token usage well above the norm may indicate prompt bloat or a retry storm.`,
      evidenceRunIds: outliers.map((r) => r.id),
      n,
      gateThreshold: gate,
      evidenceStrength: 'adequate',
      rationale: `${outliers.length} of ${n} "${outcome}" runs cost >3x the outcome's median ($${med.toFixed(4)}) (Section 7: "cost outliers per outcome").`,
    });
  }
  return items;
}

function calibrationFindings(runs) {
  const gate = CONFIG.evaluatorCalibrationMinN;
  const decided = runs.filter((r) => ['confirmed', 'overridden'].includes(r.confirmed_overridden) && r.route_confidence !== null);
  const n = decided.length;
  if (n < gate) {
    return [{
      kind: 'observation',
      category: null,
      targetArtifact: 'router.confidenceCalibration',
      currentValue: null,
      proposedValue: null,
      evidenceRunIds: decided.map((r) => r.id),
      n,
      gateThreshold: gate,
      evidenceStrength: 'below_gate',
      rationale: `Confidence calibration check needs n=${gate}, have ${n} — not evaluated.`,
    }];
  }
  const high = decided.filter((r) => Number(r.route_confidence) >= 0.8);
  const low = decided.filter((r) => Number(r.route_confidence) < 0.8);
  if (!high.length || !low.length) {
    return [{
      kind: 'observation',
      category: null,
      targetArtifact: 'router.confidenceCalibration',
      currentValue: null,
      proposedValue: null,
      evidenceRunIds: decided.map((r) => r.id),
      n,
      gateThreshold: gate,
      evidenceStrength: 'below_gate',
      rationale: `Calibration check needs both a >=0.8 and a <0.8 confidence bucket populated; one bucket is empty (n=${n} total). Not evaluated.`,
    }];
  }
  const highOverrideRate = high.filter((r) => r.confirmed_overridden === 'overridden').length / high.length;
  const lowOverrideRate = low.filter((r) => r.confirmed_overridden === 'overridden').length / low.length;
  const evidenceRunIds = decided.map((r) => r.id);
  if (lowOverrideRate > highOverrideRate) return []; // calibrated as expected — no finding
  return [{
    kind: 'finding',
    category: 'substantive',
    targetArtifact: 'router.confidenceCalibration',
    currentValue: `high-confidence override rate ${(highOverrideRate * 100).toFixed(0)}% (n=${high.length}), low-confidence ${(lowOverrideRate * 100).toFixed(0)}% (n=${low.length})`,
    proposedValue: 'Investigate whether stated route confidence tracks actual correctness — low-confidence routes should be overridden at least as often as high-confidence ones.',
    evidenceRunIds,
    n,
    gateThreshold: gate,
    evidenceStrength: 'adequate',
    rationale: `Low-confidence routes were not overridden more often than high-confidence ones (Section 7: "systematic miscalibration between stated confidence and actual override rates"). ${DATA_QUALITY_NOTE}`,
  }];
}

// Always emitted, stated explicitly rather than left implicit in the
// per-check gates: spec Section 11's M7 DoD calls for >=30 real runs
// before the first scheduled review. This cycle may run under that bar
// on the owner's explicit instruction — the shortfall is recorded, not
// silently absorbed.
function corpusSizeObservation(runs) {
  const gate = CONFIG.evaluatorMinRunsForFirstReview;
  const n = runs.length;
  const met = n >= gate;
  return {
    kind: 'observation',
    category: null,
    targetArtifact: 'evaluator.corpusSize',
    currentValue: `${n} runs`,
    proposedValue: null,
    evidenceRunIds: runs.map((r) => r.id),
    n,
    gateThreshold: gate,
    evidenceStrength: met ? 'adequate' : 'below_gate',
    rationale: met
      ? `Corpus has ${n} runs, meeting spec Section 11's M7 DoD bar of >=${gate} real runs.`
      : `Corpus has ${n} runs, below spec Section 11's M7 DoD bar of >=${gate} real runs (short by ${gate - n}). This cycle proceeds anyway on explicit owner instruction — per-check gates below still apply independently and may still produce findings.`,
  };
}

export function analyzeRuns(runs) {
  return [
    corpusSizeObservation(runs),
    residueGapFinding(),
    ...deadBranchFindings(runs),
    ...frictionFindings(runs),
    ...overrideRateFindings(runs),
    ...costOutlierFindings(runs),
    ...calibrationFindings(runs),
  ];
}

-- M7: evaluator v0 + approval queue (spec Section 7).
--
-- Deliberately NOT append-only like runs — findings are decisions-in-
-- progress (pending -> approved/rejected/auto_applied), not immutable
-- history. What's append-only instead is the audit trail: every status
-- transition is a permanent row in evaluator_finding_transitions,
-- reason-carrying, never overwritten. evaluator_findings.status/
-- decided_at/decided_by/decision_reason are a denormalized "current
-- state" convenience — the transitions table is the source of truth.

CREATE TABLE evaluator_findings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          timestamptz NOT NULL DEFAULT now(),
    -- groups findings produced by the same evaluator execution, so "N
    -- cycles" (the auto-apply enabling condition, spec Section 7) is
    -- queryable: count(distinct run_batch_id).
    run_batch_id        uuid NOT NULL,

    -- 'observation' = below its check's min-sample gate, informational
    -- only, never actionable. 'finding' = actionable, enters the
    -- approval queue.
    kind                text NOT NULL CHECK (kind IN ('finding', 'observation')),
    -- Section 7: bookkeeping (mechanical tuning) vs substantive (new
    -- branch logic). Null for observations, which aren't diffs.
    category            text CHECK (category IN ('bookkeeping', 'substantive')),

    target_artifact     text NOT NULL,
    current_value       text,
    proposed_value      text,
    evidence_run_ids    jsonb NOT NULL DEFAULT '[]',
    n                   integer NOT NULL DEFAULT 0,
    gate_threshold      integer,
    -- First-class evidence-strength field per the M7 build note: every
    -- finding states how much data actually backs it.
    evidence_strength   text NOT NULL CHECK (evidence_strength IN ('structural', 'below_gate', 'adequate')),
    rationale           text NOT NULL,

    status              text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'auto_applied', 'observation')),
    decided_at          timestamptz,
    decided_by          text,
    decision_reason     text
);

CREATE INDEX evaluator_findings_run_batch_idx ON evaluator_findings (run_batch_id);
CREATE INDEX evaluator_findings_status_idx ON evaluator_findings (status);

CREATE TABLE evaluator_finding_transitions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id  uuid NOT NULL REFERENCES evaluator_findings(id),
    from_status text NOT NULL,
    to_status   text NOT NULL,
    reason      text,
    actor       text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evaluator_finding_transitions_finding_idx ON evaluator_finding_transitions (finding_id);

GRANT SELECT, INSERT ON evaluator_findings TO nerve_app;
GRANT SELECT, INSERT ON evaluator_finding_transitions TO nerve_app;
-- Narrow column grant: nerve_app can move a finding through its status
-- lifecycle, but never rewrite what the evaluator originally found.
GRANT UPDATE (status, decided_at, decided_by, decision_reason) ON evaluator_findings TO nerve_app;

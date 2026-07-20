-- Run record schema (spec Section 6): one append-only table, five field groups.
-- Declined/deferred runs populate only run_id/intent/route; execution/measures stay null.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE runs (
    -- run_id group
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at              timestamptz NOT NULL DEFAULT now(),
    source_device           text NOT NULL,

    -- intent group
    raw_input               text NOT NULL,
    normalized_statement    jsonb NOT NULL,
    normalizer_confidence   numeric(3,2) NOT NULL CHECK (normalizer_confidence BETWEEN 0 AND 1),

    -- route group
    route_answers           jsonb NOT NULL,
    route_confidence        numeric(3,2) NOT NULL CHECK (route_confidence BETWEEN 0 AND 1),
    outcome                 text NOT NULL CHECK (outcome IN
                                ('foundation', 'artifact', 'skill', 'routine',
                                 'dynamic_workflow', 'agent', 'project',
                                 'declined', 'deferred')),
    confirmed_overridden    text CHECK (confirmed_overridden IN ('confirmed', 'overridden')),

    -- execution group (not applicable for declined/deferred)
    workflow_id             text,
    workflow_version        text,
    skills_invoked          jsonb,
    status                  text CHECK (status IN ('shipped', 'abandoned', 'failed')),
    error_class             text,

    -- measures group (not applicable for declined/deferred)
    duration_ms             integer,
    cost_usd                numeric(10,4),
    tokens                  integer,
    outcome_shipped         boolean
);

CREATE INDEX runs_created_at_idx ON runs (created_at);
CREATE INDEX runs_outcome_idx ON runs (outcome);

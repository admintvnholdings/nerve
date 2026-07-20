-- M2 closure: an aborted confirmation (owner declined to confirm or
-- override a proposed route) must still write a run record — the spec's
-- premise is every run is logged, and skipping aborts would survivor-bias
-- exactly the data that later calibrates silence-default, tier escalation,
-- and confidence thresholds. Extends confirmed_overridden rather than
-- adding a column: it is still answering the same question (what did the
-- owner do with the proposed route?), just with a third possible answer.
-- Additive per Section 6's schema-change rule — existing rows unaffected.
ALTER TABLE runs DROP CONSTRAINT runs_confirmed_overridden_check;
ALTER TABLE runs ADD CONSTRAINT runs_confirmed_overridden_check
    CHECK (confirmed_overridden IN ('confirmed', 'overridden', 'aborted'));

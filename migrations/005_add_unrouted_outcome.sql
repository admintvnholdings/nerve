-- M4 closure: a task can now be abandoned before pre-gate or the router
-- ever ran (owner never answered the clarifying question). The nine
-- existing outcome values each describe a decision — pre-gate's or the
-- router's; this is the absence of one, not a tenth kind of decision, so
-- it needs its own value rather than overloading declined/deferred
-- (which would poison their semantics for the evaluator).
-- confirmed_overridden stays null for these rows, not 'aborted' — v1.2
-- defines 'aborted' specifically as "a route was proposed"; this doesn't
-- qualify.
ALTER TABLE runs DROP CONSTRAINT runs_outcome_check;
ALTER TABLE runs ADD CONSTRAINT runs_outcome_check
    CHECK (outcome IN
        ('foundation', 'artifact', 'skill', 'routine',
         'dynamic_workflow', 'agent', 'project',
         'declined', 'deferred', 'unrouted'));

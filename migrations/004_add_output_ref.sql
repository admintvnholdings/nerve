-- M3: the run record must point at its deliverable. Nullable — only
-- populated for outcomes that actually dispatch and produce a file
-- (Artifact, Skill in M3; other outcomes stay null same as
-- execution/measures). Content itself lives on disk (./output/), not in
-- the run log — Section 6 is telemetry, not vault/content storage.
ALTER TABLE runs ADD COLUMN output_ref text;

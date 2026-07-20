#!/usr/bin/env bash
# Arms the weekly evaluator schedule (spec Section 7). Idempotent.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a
source .env
set +a

exec node intake/setup-evaluator-schedule.js

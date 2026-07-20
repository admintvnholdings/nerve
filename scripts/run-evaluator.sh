#!/usr/bin/env bash
# Manually triggers one evaluator cycle — the same workflow the weekly
# schedule invokes, for on-demand verification.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a
source .env
set +a

exec node intake/trigger-evaluator.js

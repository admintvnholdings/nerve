#!/usr/bin/env bash
# Runs the M2 intake/router CLI with .env loaded, same convention as
# migrate.sh/demo.sh. Talks to litellm and postgres over 127.0.0.1 — both
# must be up (docker compose up -d).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a
source .env
set +a

exec node intake/cli.js "$@"

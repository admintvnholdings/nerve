#!/usr/bin/env bash
# M6: Tailscale HTTPS certs are short-lived (~90 days, Let's Encrypt-
# backed). Re-issuing is idempotent — safe to run monthly regardless of
# actual expiry. Restarts web so it picks up the renewed files (Node
# reads them once at startup, not per-connection).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
HOSTNAME="tvg-ai-server-1.taild4a3b1.ts.net"

tailscale cert --cert-file "certs/${HOSTNAME}.crt" --key-file "certs/${HOSTNAME}.key" "$HOSTNAME"
docker compose restart web
echo "Renewed and restarted web at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

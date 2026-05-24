#!/usr/bin/env bash
set -euo pipefail

echo "[baseline] pnpm dev baseline save --root . --out .forgelens --name current"
pnpm dev baseline save --root . --out .forgelens --name current

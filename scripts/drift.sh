#!/usr/bin/env bash
set -euo pipefail

echo "[drift] pnpm dev drift --from current --root . --out .forgelens"
pnpm dev drift --from current --root . --out .forgelens

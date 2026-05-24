#!/usr/bin/env bash
set -euo pipefail

echo "[scan] pnpm dev scan --root . --out .forgelens --format all --verbose"
pnpm dev scan --root . --out .forgelens --format all --verbose

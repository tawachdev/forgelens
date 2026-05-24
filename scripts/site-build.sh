#!/usr/bin/env bash
set -euo pipefail

echo "[site] pnpm --dir site build"
pnpm --dir site build

#!/usr/bin/env bash
set -euo pipefail

echo "[check] pnpm typecheck"
pnpm typecheck

echo "[check] pnpm test"
pnpm test

echo "[check] pnpm build"
pnpm build

echo "[check] git diff --check"
git diff --check

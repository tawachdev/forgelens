#!/usr/bin/env bash
set -euo pipefail

echo "[release-check] pnpm typecheck"
pnpm typecheck

echo "[release-check] pnpm test"
pnpm test

echo "[release-check] pnpm build"
pnpm build

echo "[release-check] pnpm --dir site build"
pnpm --dir site build

echo "[release-check] npm pack --dry-run"
npm pack --dry-run

echo "[release-check] git diff --check"
git diff --check

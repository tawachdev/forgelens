#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  rm -f npm-pack.json
  rm -f forgelens-*.tgz
}

trap cleanup EXIT

echo "[release-check] pnpm lint"
pnpm lint

echo "[release-check] pnpm format:check"
pnpm format:check

echo "[release-check] pnpm typecheck"
pnpm typecheck

echo "[release-check] pnpm test"
pnpm test

echo "[release-check] pnpm build"
pnpm build

echo "[release-check] npm pack --dry-run"
npm pack --dry-run

echo "[release-check] npm pack --json > npm-pack.json"
npm pack --json > npm-pack.json

echo "[release-check] node scripts/ci-smoke-tarball.mjs"
node scripts/ci-smoke-tarball.mjs

echo "[release-check] git diff --check"
git diff --check

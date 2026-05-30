# CI Quick-Fix Guide

Use this guide when GitHub Actions `CI` fails.

## 1) Find the failing run

```bash
gh run list --workflow CI --limit 5
```

Copy the latest failing `run-id`.

## 2) Read failed logs only

```bash
gh run view <run-id> --log-failed
```

Focus on the first failing step (`Format check`, `Typecheck`, `Test`, or `Build`).

## 3) Fix locally with the same checks

Run the same command that failed in CI:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 4) Common failures in this repo

### Format check failed

```bash
pnpm exec biome format --write <file>
pnpm format:check
```

### Typecheck failed

```bash
pnpm typecheck
```

Fix TypeScript errors in changed files first.

### Test failed

```bash
pnpm test
```

Read the first failing test and fix only related behavior.

## 5) Push and monitor

```bash
git push origin main
gh run watch <new-run-id> --exit-status
```

Done when all jobs pass:
- `verify (ubuntu-latest)`
- `verify (macos-latest)`
- `verify (windows-latest)`

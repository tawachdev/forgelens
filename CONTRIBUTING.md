# Contributing to ForgeLens

Thanks for helping improve ForgeLens.

## Local setup

```bash
pnpm install
pnpm build
pnpm test
```

## Development rules

- Keep changes small and focused.
- Keep detector behavior deterministic and evidence-based.
- Never print or store secret env values.
- `scan` and `doctor` must stay read-only for source files.
- `scan` may write only inside selected output folder.

## Add or update a detector

1. Pick the matching detector file in `src/detectors/`.
2. Keep provider detection heuristic and confidence-based (`high`, `medium`, `low`).
3. Add evidence files and short practical notes.
4. If static analysis is unclear, use `unknown` or manual-review wording.
5. Update report writers only if output shape changes.

## Tests required

When detector behavior changes, add or update tests in `tests/`.

- Stack/provider behavior: `tests/provider-detection.test.ts`
- Full scan output: `tests/scan.test.ts`
- Drift behavior: `tests/drift.test.ts`
- Safety and prompt checks: `tests/doctor-clean-prompt.test.ts`

Add or update fixtures under `tests/fixtures/` only when needed.

## Verification before PR

Run these commands:

```bash
pnpm typecheck
pnpm test
pnpm build
```

If you changed release or packaging behavior, also run:

```bash
npm pack --dry-run
npm pack --json > npm-pack.json
node scripts/ci-smoke-tarball.mjs
```

## Commit style

Use clear commit messages with scope, for example:

- `feat(drift): compare git ranges without tar dependency`
- `test(ci): add cross-platform tarball smoke test`
- `docs: add contributing and security policy`

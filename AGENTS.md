# ForgeLens Agent Guide

Use this file before editing this repository.

## Project Shape

ForgeLens is a local-first TypeScript CLI. It scans a repository with static analysis and writes Markdown context files for AI coding agents.

Important paths:

- `src/cli.ts`: Commander CLI commands.
- `src/scan.ts`: Main scan orchestration.
- `src/detectors/`: Static detectors for routes, auth, database, env, UI/UX, performance, and focus areas.
- `src/writers/markdown.ts`: Markdown report rendering.
- `src/writers/json.ts`: Tool-readable JSON report rendering.
- `src/types.ts`: Shared report types.
- `tests/`: Vitest tests and fixtures.

## Safety Rules

- `scan` and `doctor` must not modify source files.
- `scan` may write only inside the selected output folder.
- Never print `.env` secret values. Only print env file names and env key names.
- Keep detector output evidence-based. Use `unknown`, `none`, or manual review notes when static analysis cannot know.
- Do not add network/API calls to scanning.

## Implementation Rules

- Keep detectors deterministic and provider-agnostic.
- Prefer small focused detectors over one large mixed detector.
- Add or update tests when generated report files, detector behavior, or CLI prompt output changes.
- Keep public report text practical for AI agents: what to read first, why it matters, and what still needs manual review.
- Keep JSON output free of secret values. It may include env key names, never env values.

## Verification

Run these before handoff:

```bash
pnpm typecheck
pnpm test
pnpm build
```

There is no lint script at the moment. Do not claim lint passed unless a lint script is added and run.

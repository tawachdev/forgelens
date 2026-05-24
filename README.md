# ForgeLens

ForgeLens is a local-first CLI that scans a codebase and generates clean repository context files for AI coding agents.

## Status

- ForgeLens is currently `v0.1.0`.
- ForgeLens is published on npm.
- It is a local-first CLI for deterministic static analysis.
- It is useful for generating AI repo context before edits.
- It is not a full semantic analyzer.
- It is not a security audit.

## Why this tool exists

AI coding agents work better when repo structure, auth boundaries, routes, and risk areas are explicit.
Without clean context, agents guess more, make riskier edits, and miss architecture rules.

ForgeLens solves this by producing deterministic Markdown context from static analysis.

## Who this is for

- Developers using Codex, Claude Code, Cursor, OpenCode, and similar tools
- Teams that want shared repo understanding before AI-assisted edits

## What ForgeLens does

- Scans repository in read-only mode
- Detects project signals (framework, routes, server actions, database, auth, middleware, env files, UI/UX, performance risks)
- Classifies database/auth detections with confidence (`high`, `medium`, `low`)
- Shows evidence files for each detected signal
- Generates an `AI_FOCUS_MAP.md` so agents know what to read first
- Generates an `AI_COMPACT_CONTEXT.md` for context-limit situations
- Scores the top focus files by static risk signals
- Flags env/config drift using env key names only, never secret values
- Can write tool-readable JSON with `--format json` or `--format all`
- Compares old and new JSON reports to detect context drift around risky boundaries
- Writes context files to output folder only (default `.forgelens/`)

## Supported signals/providers

Database/provider signals:
- Supabase
- Prisma
- Drizzle
- TypeORM
- Mongoose/MongoDB
- Firebase/Firestore
- PostgreSQL clients
- MySQL clients
- SQLite
- SQL migrations
- custom database layer
- unknown

Auth/provider signals:
- Clerk
- NextAuth/Auth.js
- Supabase Auth
- Firebase Auth
- Lucia
- Better Auth
- JWT custom auth
- cookie/session custom auth
- middleware-based auth
- custom auth
- unknown

## Requirements

- Node.js 18+
- Works with npm, pnpm, yarn, and bun projects where package metadata is available

## Install

Quick start (no global install):

```bash
npx forgelens scan
```

Global install:

```bash
npm install -g forgelens
forgelens scan
```

Local development usage:

```bash
pnpm install
pnpm build
pnpm link --global
forgelens scan
```

## Developer shortcuts

```text
make check          Run typecheck, tests, build, and diff check
make scan           Generate ForgeLens reports
make baseline       Save current ForgeLens baseline
make drift          Compare against saved baseline
make site           Build Astro site
make release-check  Run all release checks
```

## CLI commands

```bash
forgelens scan
forgelens doctor
forgelens baseline save
forgelens drift
forgelens clean --yes
forgelens prompt codex
```

## Common usage

```bash
forgelens scan --root . --out .forgelens --format markdown --verbose
forgelens scan --root . --out .forgelens --format json
forgelens scan --root . --out .forgelens --format all
forgelens baseline save --name main
forgelens drift --baseline .forgelens/baseline/REPO_REPORT.json --current .forgelens/REPO_REPORT.json --out .forgelens
forgelens drift --from main --out .forgelens
forgelens drift --git main..HEAD --out .forgelens
forgelens doctor --root . --out .forgelens
forgelens clean --root . --out .forgelens --yes
forgelens prompt codex
```

## Generated files

Inside `.forgelens/`:

- `FORGE_CONTEXT.md`
- `ARCHITECTURE_MAP.md`
- `ROUTES_MAP.md`
- `DATABASE_MAP.md`
- `SERVER_ACTIONS_MAP.md`
- `SECURITY_RULES.md`
- `ENV_REPORT.md`
- `AI_FOCUS_MAP.md`
- `AI_COMPACT_CONTEXT.md`
- `UI_UX_REPORT.md`
- `PERFORMANCE_RISK_REPORT.md`
- `RISK_REPORT.md`

With `--format json` or `--format all`:

- `REPO_REPORT.json`

With `forgelens drift --out .forgelens`:

- `DRIFT_REPORT.md`
- `DRIFT_REPORT.json`

## Sample output (short)

Example from `DATABASE_MAP.md`:

```md
## Detected Providers
- prisma (confidence: high)
  evidence: `prisma/schema.prisma`
  notes: Prisma dependency and schema files
```

Example from `SECURITY_RULES.md`:

```md
## Auth providers/signals detected
- nextauth-authjs (confidence: high)
  evidence: `lib/auth.ts`

## Environment files (names only)
- `.env.example`
- `.env.local`
```

Example from `AI_FOCUS_MAP.md`:

```md
| Priority | Area | Why it matters | Files |
|---|---|---|---|
| high | Auth and sessions | Review login, roles, and access boundaries before changing protected behavior. | `middleware.ts`, `lib/auth.ts` |

## Top Files
| Priority | Score | File | Reasons |
|---|---:|---|---|
| high | 65 | `app/admin/actions.ts` | server action; admin route |
```

Example from `AI_COMPACT_CONTEXT.md`:

```md
## Top Files
- `app/admin/actions.ts`
- `app/api/orders/route.ts`
```

Example from `ENV_REPORT.md`:

```md
## Env Key Groups
### Public client
- `NEXT_PUBLIC_SUPABASE_URL`

## Referenced Keys Missing From Examples
- `NEXT_PUBLIC_SUPABASE_URL`
```

Example from `RISK_REPORT.md`:

```md
- Server actions detected (2): `app/admin/actions.ts`, `app/orders/actions.ts`. Verify auth and input validation.
- API routes detected (1): `app/api/health/route.ts`. Verify auth and input validation.
```

Example from `DRIFT_REPORT.md`:

```md
### API route drift

- Severity: high
- Added: `app/api/admin/export/route.ts`
- Note: New or removed API routes change exposed server boundaries.
```

## Example workflow with AI agents

1. Run `forgelens scan` in your repo.
2. Open generated `.forgelens/*.md` files.
3. Paste `forgelens prompt codex` output into Codex (or equivalent prompt in Claude Code/Cursor/OpenCode).
4. Ask agent to plan and edit with those context files first.

## Drift workflow

1. Save a known-good baseline report:

```bash
forgelens baseline save --name main
```

2. After code changes, scan again:

```bash
forgelens scan --format all --out .forgelens
```

3. Compare old vs new context:

```bash
forgelens drift --from main --out .forgelens
```

You can also compare git refs without checking out old code:

```bash
forgelens drift --git main..HEAD --out .forgelens
```

Drift detection focuses on risky edges: auth providers, middleware, admin/API routes, server actions, database schema/migrations/clients, env keys, risky files, and high-priority focus files.

## Landing page

A static launch/demo page lives in `site/`.

```bash
open site/index.html
```

It is dependency-free and designed for a short product video.

## Safety promise

- Source code is never modified by scan/doctor.
- ForgeLens writes only in the selected output folder.
- Env file names and env key names can be reported, but secret values are never printed.
- No network/API calls are required for detection.

## Limitations

- Static analysis only; dynamic/runtime behavior is not executed.
- Confidence is evidence-based, not guaranteed truth.
- Custom frameworks and unusual repo layouts may require manual review.

## Important warning

ForgeLens is not a security audit and not a replacement for code review, AppSec review, or penetration testing.

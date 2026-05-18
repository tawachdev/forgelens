# ForgeLens

ForgeLens is a local-first CLI that scans a codebase and generates clean repository context files for AI coding agents.

## Why this tool exists

AI coding agents work better when repo structure, auth boundaries, routes, and risk areas are explicit.
Without clean context, agents guess more, make riskier edits, and miss architecture rules.

ForgeLens solves this by producing deterministic Markdown context from static analysis.

## Who this is for

- Developers using Codex, Claude Code, Cursor, OpenCode, and similar tools
- Teams that want shared repo understanding before AI-assisted edits

## What ForgeLens does

- Scans repository in read-only mode
- Detects project signals (framework, routes, server actions, database, auth, middleware, env files)
- Classifies database/auth detections with confidence (`high`, `medium`, `low`)
- Shows evidence files for each detected signal
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

## Install

```bash
npm install -g forgelens
```

Use without global install:

```bash
npx forgelens scan
```

## CLI commands

```bash
forgelens scan
forgelens doctor
forgelens clean --yes
forgelens prompt codex
```

## Common usage

```bash
forgelens scan --root . --out .forgelens --format markdown --verbose
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
- `RISK_REPORT.md`

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

Example from `RISK_REPORT.md`:

```md
- Server actions detected (2): `app/admin/actions.ts`, `app/orders/actions.ts`. Verify auth and input validation.
- API routes detected (1): `app/api/health/route.ts`. Verify auth and input validation.
```

## Example workflow with AI agents

1. Run `forgelens scan` in your repo.
2. Open generated `.forgelens/*.md` files.
3. Paste `forgelens prompt codex` output into Codex (or equivalent prompt in Claude Code/Cursor/OpenCode).
4. Ask agent to plan and edit with those context files first.

## Safety promise

- Source code is never modified by scan/doctor.
- ForgeLens writes only in the selected output folder.
- Env file names can be reported, but secret values are never printed.
- No network/API calls are required for detection.

## Limitations

- Static analysis only; dynamic/runtime behavior is not executed.
- Confidence is evidence-based, not guaranteed truth.
- Custom frameworks and unusual repo layouts may require manual review.

## Important warning

ForgeLens is not a security audit and not a replacement for code review, AppSec review, or penetration testing.

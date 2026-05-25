# ForgeLens Project Map

ForgeLens helps AI agents read less and focus better before editing code.

## Main Flow

1. `src/cli.ts` parses commands.
2. `src/scan.ts` runs detectors in parallel.
3. Detectors return typed static signals.
4. `src/detectors/focus.ts` ranks the important areas.
5. `src/writers/markdown.ts` writes context reports into `.forgelens/`.
6. `src/baseline.ts` saves named baseline snapshots.
7. `src/drift.ts` compares baseline/current or git-range reports.

## Generated Reports

- `AI_FOCUS_MAP.md`: first file to read; ranks auth, server actions, API routes, database, env, UI/UX, and performance hotspots.
- `AI_COMPACT_CONTEXT.md`: small context-limit friendly summary with top files and reasons.
- `FORGE_CONTEXT.md`: short repository summary.
- `ARCHITECTURE_MAP.md`: project shape and key files.
- `ROUTES_MAP.md`: App Router and Pages API routes.
- `DATABASE_MAP.md`: database providers, schema files, migrations, and clients.
- `SERVER_ACTIONS_MAP.md`: server action files.
- `SECURITY_RULES.md`: auth, middleware, sensitive areas, and review checklist.
- `ENV_REPORT.md`: env file names, env key names, missing examples, and public env risks without secret values.
- `UI_UX_REPORT.md`: pages, components, forms, loading/empty/error states, responsive signals, and accessibility risk hints.
- `PERFORMANCE_RISK_REPORT.md`: large files, client components, image usage, fetch calls, and external API failure points.
- `RISK_REPORT.md`: combined static risk summary and unknowns.
- `REPO_REPORT.json`: optional tool-readable output when using `--format json` or `--format all`.
- `DRIFT_REPORT.md`: comparison of old vs new reports for risky context drift.
- `DRIFT_REPORT.json`: tool-readable drift output.
- Public website is deployed separately; source stays private.

## Detector Boundaries

- `project.ts`: framework, language, package manager, scripts, dependencies.
- `routes.ts`: Next.js app/pages route files.
- `database.ts`: database provider and migration/schema signals.
- `auth.ts`: auth provider and session signals.
- `server-actions.ts`: `"use server"` files.
- `security.ts`: middleware, sensitive paths, risky code patterns.
- `env.ts`: env key names and config drift without values.
- `ui-ux.ts`: UI files and static UX state hints.
- `performance.ts`: bundle/runtime/failure risk hints.
- `focus.ts`: priority read order built from all detector outputs.
- `baseline.ts`: scan and save named baselines.
- `drift.ts`: compares baseline/current reports and flags stale context around risky edges.
- `writers/json.ts`: writes the tool-readable report.

## Product Direction

Next strong improvements:

- Add framework support beyond Next.js.
- Add detector confidence to UI/UX, env, and performance reports.
- Add more fixtures for real-world app shapes.
- Add optional report snapshots for stable generated output review.
- Add drift severity tuning from real repos.
- Keep public CLI/docs and private product site separated.

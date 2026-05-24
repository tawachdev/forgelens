# Changelog

## Unreleased

### Added

- `AI_FOCUS_MAP.md` to rank the highest-value files and areas before editing.
- `AI_COMPACT_CONTEXT.md` for context-limit situations.
- `ENV_REPORT.md` for env file names, referenced env key names, missing example keys, and public env risk hints without printing secret values.
- `UI_UX_REPORT.md` for pages, components, forms, loading/empty/error states, responsive signals, and accessibility risk hints.
- `PERFORMANCE_RISK_REPORT.md` for large files, client components, image usage, fetch calls, uncached fetch hints, and external API failure points.
- `REPO_REPORT.json` with `--format json` or `--format all` for tool-readable output.
- File-level focus scores with reasons and priority.
- `forgelens drift` to compare two `REPO_REPORT.json` files and flag stale context around auth, routes, server actions, database, env, security, and focus files.
- `forgelens baseline save` to save named baseline reports.
- `forgelens drift --from <name>` and `forgelens drift --git base..head` workflows.
- `DRIFT_REPORT.md` and `DRIFT_REPORT.json` when drift output is written to a folder.
- Grouped env key sections in `ENV_REPORT.md`.
- Static landing page under `site/` for product demos.
- Project-specific `AGENTS.md` and `docs/PROJECT_MAP.md` for faster future agent work.

### Changed

- `forgelens prompt codex` now starts with `AI_COMPACT_CONTEXT.md` for tight context and includes the new reports.
- `FORGE_CONTEXT.md`, `ARCHITECTURE_MAP.md`, and `RISK_REPORT.md` include the new focus, env, UI/UX, and performance signals.
- Detector scans ignore test fixtures by default and avoid treating detector/test text as real app provider evidence.
- Generated Workbox, sourcemap, and generated-code artifacts are ignored by default.

## 0.1.0 - 2026-05-18

Initial CLI MVP release-readiness baseline.

### Added

- `forgelens scan` command to generate 7 context Markdown files.
- `forgelens doctor` command for read-only safety/readiness checks.
- `forgelens clean` command with deletion safety guards and confirmation.
- `forgelens prompt codex` command for copy-ready Codex context prompt.

### Detection model

- Provider-agnostic signal detection for auth and database layers.
- Evidence + confidence model (`high`, `medium`, `low`).
- Unknown/custom fallbacks when signal strength is weak.

### Safety notes

- Source files are not modified by scan/doctor.
- Output is scoped to selected output folder.
- Env file names only; secrets are not printed.
- Static analysis only; not a security audit.

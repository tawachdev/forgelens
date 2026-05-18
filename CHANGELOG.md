# Changelog

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

# ForgeLens v0.3 Roadmap

Target: make daily usage faster, safer, and clearer for AI coding workflows.

## 1) Command UX Finalization

Goal:
- Keep one clear command style across CLI, pnpm, make, and shell aliases.

Scope:
- Keep primary names: `check`, `ux`, `save`, `diff`, `clean`, `context`.
- Keep legacy aliases for backward compatibility.
- Improve help output examples for each command.

Done when:
- `forgelens --help` and command help are consistent.
- `pnpm` and `make` shortcuts map 1:1 to CLI behavior.

## 2) Report Quality Upgrade

Goal:
- Increase trust in generated reports and reduce noisy findings.

Scope:
- Improve risk wording (clear severity and reason).
- Add better evidence snippets in security/auth findings.
- Improve `UI_UX_REPORT` and `PERFORMANCE_RISK_REPORT` readability.

Done when:
- Reports are easier to act on without manual guessing.
- Existing fixtures still pass with stable output expectations.

## 3) Drift Accuracy Upgrade

Goal:
- Make `compare/drift` output more useful for real PR review.

Scope:
- Better grouping by risk type (auth, data, routes, env).
- Clear summary at top: what changed, what is risky, what to review first.
- Keep git range mode (`main..HEAD`) as first-class workflow.

Done when:
- Drift report highlights high-risk deltas first.
- Teams can use drift output directly in PR review.

## 4) CI and Release Hardening

Goal:
- Keep CI green and release flow predictable across OS targets.

Scope:
- Keep strict format/lint/typecheck/test/build gates.
- Add CI guard notes for action runtime deprecations (Node 20 -> 24 migration).
- Keep tarball smoke checks stable on macOS, Linux, and Windows.

Done when:
- CI is consistently green on 3 OS targets.
- Release checks are deterministic.

## 5) Docs and Onboarding Polish

Goal:
- New users understand workflow in minutes.

Scope:
- Add one “daily flow” section in README.
- Add one “CI failure quick-fix” section.
- Keep docs aligned with real command names.

Done when:
- A new user can run scan, save baseline, run compare, and fix CI format failures quickly.

## Suggested Delivery Order

1. Command UX Finalization  
2. Docs and Onboarding Polish  
3. Drift Accuracy Upgrade  
4. Report Quality Upgrade  
5. CI and Release Hardening

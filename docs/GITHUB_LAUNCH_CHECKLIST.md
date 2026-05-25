# GitHub Launch Checklist

This is a manual checklist for repository polish before/after launch.

## 1) GitHub About section

Set these in the GitHub repository UI:

- Description: `Local-first CLI for AI coding workflow tracking and risk-aware repo context.`
- Website: Vercel site URL after deploy
- Pin README as default landing content

## 2) Suggested topics

Use these repository topics:

- `ai`
- `ai-coding-agent`
- `codex`
- `claude-code`
- `cursor`
- `copilot`
- `gemini-cli`
- `typescript`
- `cli`
- `static-analysis`
- `developer-tools`
- `dev-workflow`

## 3) Branch protection

Protect `main`:

- Require pull request before merge
- Require status checks to pass:
  - `CI / verify`
- Block force pushes
- Block branch deletions

## 4) Release basics

- Create a GitHub release for each npm publish tag.
- Include changelog summary and migration notes (if any).

## 5) Security basics

- Enable Dependabot alerts
- Enable secret scanning alerts
- Enable dependency graph

## 6) Local pre-release command

Run this before publishing:

```bash
make release-check
```

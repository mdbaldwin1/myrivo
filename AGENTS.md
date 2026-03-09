# Myrivo - Agent Operating Guide

## Purpose

This file defines collaboration, quality, and delivery rules for all coding agents working in this repository.

## Workflow and Branching

- `main` is the release branch.
- `develop` is the default integration branch.
- Never push directly to `main` or `develop`.
- All work happens in short-lived feature branches named `codex/<scope>-<summary>`.
- Open PRs into `develop` for regular work.
- Only release promotion PRs merge `develop` into `main`.
- Use squash merge for feature PRs into `develop`.
- Use merge commit for `develop` into `main`.

## Worktree and Session Safety

- If multiple agent sessions are active, use a dedicated git worktree per session.
- Do not switch branches in a shared worktree.
- Keep one logical task per branch.

## Planning and Execution

- Before implementation, produce a short plan: goals, affected areas, risks, validation.
- Keep changes scoped and incremental; avoid unrelated refactors.
- If requirements are ambiguous, clarify before coding.

## Quality Gates (Required)

- PRs must be up to date with target branch and pass all required checks.
- No lint warnings or errors in changed packages.
- Maintain or improve test coverage for changed behavior.
- Add or update tests for bug fixes, new features, and regressions.
- Type checking must pass.
- Build must pass for changed apps/packages.

## UI and Component Standards

- Use Tailwind CSS for application styling; avoid inline style objects except for exceptional third-party integration constraints.
- Keep one React component per file. Do not define multiple components in a single file.
- Prefer composition over large files; break pages into reusable, testable components.
- Centralize design tokens (colors, spacing, radii) in top-level theme variables so visual experiments and A/B tests do not require component rewrites.
- Keep component APIs explicit and minimal. Favor typed props and avoid hidden side effects.

## Configurability Standards

- Anything likely to change by business decision (pricing, limits, feature flags, integration mappings, theme tokens) must be configurable and not hardcoded deep inside handlers/components.
- Keep configuration in dedicated modules or environment-driven config layers with validation.
- Persist transaction-time configuration snapshots where required for auditability (for example, fee basis points on each order).

## CI/CD Automation Standards

- CI must run lint, typecheck, tests, and build on every PR.
- Deploy pipelines should be automated for preview and production environments with explicit branch-based promotion rules.
- Keep deployment and operations runbooks updated whenever pipelines or required secrets change.

## Validation Commands

Use the project’s package-level scripts for touched areas. At minimum:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build` (when applicable)

If the repo later becomes a monorepo, run scoped workspace commands for only touched workspaces plus shared dependencies.

## Pull Request Standards

- Use conventional commits: `feat:`, `fix:`, `perf:`, `refactor:`, `test:`, `docs:`, `chore:`.
- PR description should include:
  - Problem statement
  - Approach summary
  - Risks/tradeoffs
  - Validation performed
- Keep PRs reviewable; prefer smaller PRs over large batches.

## Security and Secrets

- Never commit secrets, credentials, or API tokens.
- Use environment variables and `.env.local`-style local files that are gitignored.
- Do not log sensitive values.
- Apply least-privilege to service credentials and rotate compromised credentials immediately.

## Documentation and Change Tracking

- Update architecture or ADR docs when design decisions change.
- Keep onboarding/setup instructions current.
- Maintain `CHANGELOG.md` for user-visible changes under `[Unreleased]`.

## Agent Behavior

- Be explicit about assumptions.
- Prefer root-cause fixes over superficial patches.
- Preserve existing patterns unless there is strong reason to improve them.
- Avoid destructive git commands (for example `git reset --hard`) unless explicitly requested.

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context, or install hooks (`bd hooks install`) for auto-injection.

**Quick reference:**
- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work
- `bd sync` - Sync with git (run at session end)

For full workflow details: `bd prime`

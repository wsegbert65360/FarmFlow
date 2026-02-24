---
title: Testing Strategy
sidebar_label: Testing Strategy
---

# FarmFlow Auto-Testing Strategy

This document outlines the automated testing approach designed to keep FarmFlow complete and stable across every change.

## Goal

Deliver an automated testing pyramid that balances **fast feedback**, **reliable regression coverage**, and **long-term stability telemetry** while minimizing flakiness.

## Overview

|Layer|Owner (runner)|Scope|Frequency|Success criteria|
|---|---|---|---|---|
|Type + Syntax Validation|`npx tsc --noEmit`, `eslint`, `prettier`|Project-wide types, lint, formatting|Every PR|`tsc` passes; no lint violations|
|Unit + Small Integration Tests|Vitest (hooks/services/utils)|Local business logic and pure utilities|Every PR|Relevant files gain targeted tests; coverage improves over time|
|Local Integration / Migration Tests|Vitest (database migrations + PowerSync utilities)|Database adapters, migrations, sync helpers|Every PR|Deterministic fixtures cover every schema change|
|E2E Smoke|Playwright single `Desktop Chrome` project|Critical UX paths, auth, field CRUD, sync indicator|Every PR|`npx playwright test` returns 0; `trace:` retained for first retry|
|Regression (Full Matrix)|Playwright mobile/tablet/desktop + visual diffs|Full UI flows, chaos interactions, stress behaviors|Nightly (main) + pre-release|No new regressions; flagged specs are quarantined until ownership is restored|

## Playwright Configuration Sanity
- Configure the base URL via `PLAYWRIGHT_BASE_URL` with fallbacks (`npm run preview`, `npx serve dist`) so local and CI runs share the same endpoint.
- Centralize helpers in `tests/playwright-fixtures.ts` (shared `mockLogin`, `seedAppData`, `waitForPowerSync`, etc.) to remove duplication in specs.
- Keep `trace: 'on-first-retry'`, `screenshot`, and `video` enabled so failed runs generate actionable artifacts.

## CI/CD Gates
1. **PR workflow:**
   - `npm run lint`, `npx tsc --noEmit`
   - `npm run test:unit`
   - `npm run test:integration`
   - `npm run test:e2e:smoke` (Playwright Desktop)
   - Upload Playwright HTML + JUnit artifacts, along with trace/video artifacts for failures.
2. **Nightly / release candidate:**
   - Full Playwright matrix (mobile/tablet/desktop)
   - Chaos/robust suites (`robust_audit`, `total_coverage`, `full_season_e2e`)
   - Visual regression comparisons (via Playwright snapshot diffs or equivalent tooling)

## Flake Handling & Reporting
- Log retries and record flaky tests to `test-results/flaky.log` during CI runs.
- Quarantine unstable specs by tagging them with `@quarantine` wrappers and maintaining a remediation backlog.
- Report results through Playwright HTML + JUnit artifacts. Use GitHub Actions comments/snippets via `github-script` or `actions/upload-artifact` to link to reports.
- Keep a weekly **Test Health** note (`docs/test-health.md`) tracking:
  - Flaky spec list and owners
  - Average runtime per suite
  - Broken specs and follow-up actions

## Maintenance & Developer Workflow
- `npm run test:all` should run type checks, lint, unit, integration, and smoke suites locally for a consistent developer experience.
- Use fixture helpers (auth/seeding) to keep Playwright tests deterministic and reduce timeout drift.
- Update `scripts/validate-schema` when migration changes occur and incorporate them into the integration suite.
- Regularly review failing specs; add quarantine tags when necessary and keep the backlog visible.

## Next Steps
1. Introduce Vitest + integration suites with `test:unit`, `test:integration`, and `test:all` scripts.
2. Normalize Playwright helpers and base URLs via shared fixtures.
3. Split CI into fast PR checks + nightly regression runs, all publishing traces/videos.
4. Capture flake metrics and maintain the weekly health doc.
5. Share this strategy so the whole team follows the same quality goals.

When you're ready, I can proceed with implementing the steps in Act Mode.
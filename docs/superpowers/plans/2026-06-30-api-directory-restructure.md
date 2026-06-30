# API Directory Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make API automation files easy to distinguish by purpose: real business interface tests, contract checks, unit/tooling checks, maintenance tests, support code, test data, and AI process documents.

**Architecture:** Keep production-facing API support code under `api/`, stable request factories under `test-data/api/`, and executable Playwright tests under `tests/api/` with purpose-based subdirectories. Keep AI design and implementation notes under `docs/superpowers/` so they are not confused with runnable tests.

**Tech Stack:** Playwright Test, TypeScript, npm scripts, Markdown repository documentation.

---

### Task 1: Move API Specs By Purpose

**Files:**
- Move `tests/api/admin-config.api.spec.ts` to `tests/api/business/admin-config.api.spec.ts`
- Move `tests/api/menu-catalog.api.spec.ts` to `tests/api/business/menu-catalog.api.spec.ts`
- Move `tests/api/order-payment.api.spec.ts` to `tests/api/business/order-payment.api.spec.ts`
- Move `tests/api/sale-item.api.spec.ts` to `tests/api/business/sale-item.api.spec.ts`
- Move `tests/api/contract-smoke.api.spec.ts` to `tests/api/contracts/contract-smoke.api.spec.ts`
- Move `tests/api/api-contract-matrix.unit.spec.ts` to `tests/api/contracts/api-contract-matrix.unit.spec.ts`
- Move `tests/api/api-contract-smoke.unit.spec.ts` to `tests/api/contracts/api-contract-smoke.unit.spec.ts`
- Move `tests/api/api-client-path.unit.spec.ts` to `tests/api/unit/api-client-path.unit.spec.ts`
- Move `tests/api/api-config.unit.spec.ts` to `tests/api/unit/api-config.unit.spec.ts`
- Move `tests/api/api-core.unit.spec.ts` to `tests/api/unit/api-core.unit.spec.ts`
- Move `tests/api/api-fixture.unit.spec.ts` to `tests/api/unit/api-fixture.unit.spec.ts`
- Move `tests/api/api-resource-registry.unit.spec.ts` to `tests/api/unit/api-resource-registry.unit.spec.ts`
- Move `tests/api/api-test-data.unit.spec.ts` to `tests/api/unit/api-test-data.unit.spec.ts`
- Move `tests/api/cleanup.api.spec.ts` to `tests/api/maintenance/cleanup.api.spec.ts`

- [x] Create the four target directories.
- [x] Move the files with `Move-Item`.
- [x] Update relative imports so moved files compile.

### Task 2: Document The Boundaries

**Files:**
- Create `tests/api/README.md`
- Create `api/README.md`
- Create `test-data/api/README.md`
- Create or update `docs/superpowers/README.md`

- [x] Explain what belongs in each `tests/api` subdirectory.
- [x] Explain that `api/clients`, `api/core`, and `api/contracts` are support code, not runnable specs.
- [x] Explain that `test-data/api` contains factories and stable samples only.
- [x] Explain that `docs/superpowers` contains AI design and execution notes only.

### Task 3: Update Runner Entry Points

**Files:**
- Modify `package.json`
- Modify docs that mention old API spec paths.

- [x] Keep `test:api` running all API specs.
- [x] Add `test:api:business` for `tests/api/business`.
- [x] Point `test:api:contract` at `tests/api/contracts`.
- [x] Add `test:api:unit` for `tests/api/unit`.
- [x] Point `test:api:cleanup` at `tests/api/maintenance`.
- [x] Update docs and coverage matrix spec file paths that referenced old flat test paths.

### Task 4: Verify

**Files:**
- All moved and modified files.

- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run test:api:unit -- --reporter=line`.
- [x] Run `npm run test:api:contract -- --reporter=line`.
- [x] Run `npm run test:api:business -- --grep "应已登记" --reporter=line` for non-destructive business smoke.
- [x] Run `npm run test:api:cleanup -- --list`.
- [x] Run `git diff --check`.
- [x] Commit with a directory-structure message.

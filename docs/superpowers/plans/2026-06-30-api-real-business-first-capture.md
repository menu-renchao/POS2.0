# API Real Business First Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the first provided captured API requests into real business `test.step(...)` coverage without hard-coded environment IDs.

**Architecture:** Keep scenario-level Playwright specs, but add one explicit step per upgraded endpoint. Use IDs created or queried during the test run. Do not persist cookies, database passwords, or captured production IDs in code.

**Tech Stack:** Playwright Test, TypeScript API clients, existing `ResourceRegistry`, existing `expectJsonEnvelope` helpers.

---

### Task 1: Menu Group Batch Copy And Delete

**Files:**
- Modify: `tests/api/business/menu-catalog.api.spec.ts`
- Modify: `api/contracts/first-batch-api-cases.ts`
- Modify: `docs/api/112接口覆盖映射.md`

- [x] Write failing coverage test expectation by updating matrix status for `POST /api/menu/menuGroup/batch/copy` and `DELETE /api/menu/menuGroup/batch/delete` from `contract-only` to `positive-business`.
- [x] Run `npx playwright test tests/api/contracts/api-contract-matrix.unit.spec.ts --project=api --reporter=line` and confirm it still validates the matrix.
- [x] In the destructive menu catalog scenario, after creating a controlled menu group, call `copyMenuGroups({ menuId, groupIds: [menuGroupId] })`.
- [x] Create a second controlled menu group and delete it with `deleteMenuGroups({ groupIds: [batchDeleteGroupId] })` so no captured ID is hard-coded.
- [x] Ensure cleanup skips resources already deleted and still cleans any remaining resources.

### Task 2: Sale Item Batch Sequence And Update From Captured Request

**Files:**
- Modify: `tests/api/business/sale-item.api.spec.ts`
- Modify: `api/contracts/first-batch-api-cases.ts`
- Modify: `docs/api/112接口覆盖映射.md`

- [x] Write failing coverage expectation by changing `PUT /api/menu/menuSaleItem/batch/sequence` and `PUT /api/menu/menuSaleItem/batch/update` to positive coverage.
- [x] In the destructive sale item scenario, create or query controlled sale item IDs during runtime.
- [x] Call `sequenceSaleItems({ saleItemIds: [...] })` using runtime IDs only.
- [x] Call `updateSaleItems({ saleItemIds: [...], price: 8.88 })` using runtime IDs only.
- [x] Read the updated sale item and assert the response envelope; do not assert permanent shared menu state.

### Task 3: Order Batch Save And Delivery Track Preparation

**Files:**
- Modify: `tests/api/business/order-payment.api.spec.ts`
- Modify: `api/contracts/first-batch-api-cases.ts`
- Optionally create: `api/core/api-db-config.ts` only if database lookup is implemented.

- [ ] For `POST /api/order/save/batch`, build the request from orders created or queried during the test run; do not use captured order IDs.
- [x] Keep `POST /api/order/dailyClose` unchanged because the user explicitly said not to process it.
- [ ] For `GET /api/order/listDeliveryTrack`, do not write database credentials into code. If implemented, read `API_DB_HOST`, `API_DB_PORT`, `API_DB_USER`, `API_DB_PASSWORD`, and `API_DB_NAME` from environment variables.
- [ ] If no `deliveryId` can be found at runtime, skip with a Chinese reason that requests a fresh delivery-track sample.

### Task 4: Payment Batch Request Clarification

**Files:**
- Modify: `docs/api/112接口覆盖映射.md`

- [x] Do not upgrade `POST /api/payment/record/save/batch` from the attached request because the captured curl path is `POST /api/payment/record/save`.
- [x] Mark `POST /api/payment/record/save/batch` as still needing a real batch request.
- [x] Keep existing `POST /api/payment/record/save` coverage unchanged.

### Task 5: Verification And Commit

**Files:**
- All modified files.

- [x] Run `npx tsc --noEmit`.
- [x] Run `API_KEY=test-key npx playwright test tests/api/contracts/api-contract-matrix.unit.spec.ts tests/api/unit/api-test-data.unit.spec.ts --project=api --reporter=line`.
- [x] With cookie auth and destructive mode only if approved for the dedicated environment, run targeted specs for the upgraded batch endpoints.
- [x] Scan for captured cookie/session/password strings before committing.
- [ ] Commit the batch with a message describing the upgraded real-business coverage.

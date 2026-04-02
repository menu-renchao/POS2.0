# Order Dishes Charge Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add charge dialog page capabilities and business flows for the order-dishes page so tests can apply preset and custom charges in whole-order and item-charge modes.

**Architecture:** Keep all charge dialog structure, selectors, low-level actions, and structured reads inside `pages/order-dishes.page.ts` because the dialog is a transient part of the order page. Put preset-charge, whole-order vs item-charge orchestration, cleanup, and snapshot recovery in `flows/order-dishes.flow.ts`. Drive the work with an iframe contract test first, then one minimal real E2E test that proves charge application works through the live UI entry flow.

**Tech Stack:** TypeScript, Playwright Test

---

### Task 1: Write the failing contract test first

**Files:**
- Create: `tests/e2e/order-dishes-charge.spec.ts`

**Step 1: Write the failing test**

Add a contract fixture page for the charge dialog and a test that references new `OrderDishesPage` charge methods plus new `OrderDishesFlow` orchestration methods.

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/order-dishes-charge.spec.ts`
Expected: FAIL because the charge page/flow APIs do not exist yet.

### Task 2: Implement the page object additions

**Files:**
- Modify: `pages/order-dishes.page.ts`

**Step 1: Write minimal implementation**

Add:
- charge dialog locators
- open / close dialog actions
- whole-order vs item-charge mode switch
- dish selection and preset/custom option actions
- clear selected / clear all actions
- structured charge snapshot reading

**Step 2: Run focused contract test**

Run: `npx playwright test tests/e2e/order-dishes-charge.spec.ts`
Expected: still FAIL, but now at missing flow behavior or incomplete wiring.

### Task 3: Implement flow orchestration

**Files:**
- Modify: `flows/order-dishes.flow.ts`

**Step 1: Write minimal implementation**

Add flow methods for:
- preset quick charge by name
- whole-order or item-charge operation
- custom percentage / fixed amount charge
- guaranteed dialog cleanup on success or failure

**Step 2: Run focused contract test**

Run: `npx playwright test tests/e2e/order-dishes-charge.spec.ts`
Expected: PASS.

### Task 4: Add minimal live verification

**Files:**
- Create: `tests/e2e/order-dishes-charge-live.spec.ts`

**Step 1: Write the live test**

Use the normal homepage entry flow, enter order-dishes through the UI, apply one charge scenario, and assert the resulting order snapshot shows the charge.

**Step 2: Run live verification**

Run: `npx playwright test tests/e2e/order-dishes-charge-live.spec.ts --project=chrome`
Expected: PASS in the real environment.

### Task 5: Final verification

**Files:**
- No new files expected

**Step 1: Run targeted E2E coverage**

Run: `npx playwright test tests/e2e/order-dishes-charge.spec.ts tests/e2e/order-dishes-charge-live.spec.ts`
Expected: PASS.

**Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: PASS.

# License Selection Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a Playwright page object and flow that select an available homepage license by type, defaulting to `PC`.

**Architecture:** Keep page-level actions in `pages/license-selection.page.ts`, add the business composition in `flows/license-selection.flow.ts`, and expose the page object through `fixtures/test.fixture.ts`. Drive implementation with a smoke test that proves default `PC` selection and submit behavior against the live homepage.

**Tech Stack:** TypeScript, Playwright Test

---

### Task 1: Write the failing smoke tests

**Files:**
- Create: `tests/smoke/license-selection.smoke.spec.ts`
- Modify: `fixtures/test.fixture.ts`

**Step 1: Write the failing test**

Create tests that reference:
- a `licenseSelectionPage` fixture
- a `enterWithAvailableLicense` flow
- a `selectAvailableLicenseByType()` page method

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/smoke/license-selection.smoke.spec.ts`
Expected: FAIL because the new fixture, page object, and flow do not exist yet.

### Task 2: Implement the page object and flow

**Files:**
- Create: `pages/license-selection.page.ts`
- Create: `flows/license-selection.flow.ts`
- Modify: `fixtures/test.fixture.ts`
- Modify: `pages/home.page.ts`

**Step 1: Write minimal implementation**

Add:
- `expectVisible()`
- `selectAvailableLicenseByType(type = 'PC')`
- `clickEnter()`
- `enterWithAvailableLicense(page, type = 'PC')`

**Step 2: Run the focused smoke test**

Run: `npx playwright test tests/smoke/license-selection.smoke.spec.ts`
Expected: PASS.

### Task 3: Verify the project remains healthy

**Files:**
- No new files expected

**Step 1: Run smoke coverage**

Run: `npm run test:smoke`
Expected: PASS.

**Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: PASS.

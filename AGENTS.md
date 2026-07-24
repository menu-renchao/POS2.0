# AGENTS.md

## Objective

This repository is a maintainable Playwright + TypeScript UI automation project for a POS/order frontend. Optimize for clarity, reuse, and long-term Codex maintenance, not one-off scripts.

## Interaction

- Address the user as `金将军`.
- Use respectful Chinese throughout replies.

## Automation Rules

- Use Playwright Test as the default runner.
- Prefer `data-testid` locators first for stable elements. Only fall back to other locator strategies such as `getByRole`, `getByLabel`, or `getByText` when no reliable `data-testid` is available.
- Prefer semantic locators such as `getByRole`, `getByLabel`, and `getByText`.
- Automation does not need to cover Chinese UI business copy. Do not require multilingual locators or Chinese/English fallback selectors for application controls unless the product explicitly exposes both variants as stable DOM contracts. This does not change the requirement that test titles, report steps, and `@step(...)` descriptions use Chinese.
- Page object selectors must match the actual DOM contract of the target page. Use the one selector that the page really exposes; do not broaden scope with `.or()` chains, alias attribute lists, multilingual regexes, or parent-page fallbacks just to make a locator pass.
- Do not enumerate or traverse candidate selectors to guess the target element. If the page lacks a stable selector, add or request a `data-testid` instead of stacking fallback locators.
- Do not default to brittle CSS chains, nth-child selectors, or XPath.
- Do not use `waitForTimeout` in tests or helpers.
- Prefer `utils/wait.ts` `waitUntil()` for condition polling that may retry multiple times. Avoid `expect(...).toPass()` and `expect.poll()` in page objects, flows, helpers, and tests when they would create noisy intermediate failures in reports. Assert only the final settled result.
- Any page action that edits one or more `input` fields and then immediately confirms/submits a change that triggers an API request or saves data must wait at least `200ms` before clicking the confirm/submit button so the input state can settle.
- Every method in `pages/` and `flows/` must use Chinese `@step(...)` descriptions for report display.
- Do not keep page/flow action descriptions only in comments; convert those descriptions into executable report steps.
- Every `describe` and `test` title must be written in Chinese.
- Test-case-level report steps must also use Chinese.
- Test-case-level metadata should use Playwright native `test(title, details, body)` style.
- Jira links should be declared in the `details.annotation` field. Keep searchable issue keys such as `POS-30543` in the spec file; shared helpers may only build the full Jira URL or annotation object from that key.

## Page And Flow Boundaries

- `pages/` only holds page structure, locators, page-level actions, and page-level reads.
- `pages/` can do things like: click a button, fill an input, switch a tab, read a table number, return a locator or page data.
- All stable selectors in `pages/` must be centralized on the page object, either as class-level locator fields or dedicated private locator factory methods.
- Centralized locators should be defined once with the page's real selector. Do not re-resolve the same element through `resolveVisibleLocator()`-style candidate lists unless the page genuinely renders equivalent controls in mutually exclusive regions.
- Do not scatter raw `getByRole(...)`, `getByText(...)`, `locator(...)`, or selector strings throughout page action/read methods when those selectors belong to the page structure.
- If a selector is reused, semantically important, or represents a stable page element such as a button, dialog, input, tab, list, or summary area, define it once and consume it through the centralized page locator API.
- Do not create a separate page object for a strongly coupled transient dialog or popup that only exists as one immediate step of its parent page flow, such as a guest-count dialog opened from table selection. Keep that dialog on the owning page object unless it can be entered, reused, and reasoned about independently.
- When a dialog does not expose a close or exit button, treat clicking the blank/backdrop area as the designed exit path instead of inventing a close-button locator; this is especially relevant on Recall pages.
- `pages/` must not contain business selection strategy or cross-step intent such as “select any available table”, “pick the first usable license”, “enter the system with employee context”, or other business-level decisions.
- `flows/` only holds business intent, multi-step orchestration, and selection strategy.
- `flows/` can combine multiple page actions, decide which record to pick, decide fallback order, and return business-level results.
- `flows/` must not redefine page locators or duplicate low-level page interaction details that belong in `pages/`.
- Do not mix `page` and `flow` responsibilities in the same method. If a method contains business policy or selection logic, move it to `flows/`. If a method only describes a single page action or read, keep it in `pages/`.

## POM Readability

- Keep page objects small and focused. When a page file starts carrying multiple independent areas or workflows, split it by page region or capability instead of continuing to grow one class. See `docs/page-object-guidelines.md`.
- Avoid long locator fallback chains. Prefer one real DOM contract per element; if mutually exclusive render scopes exist, encapsulate the scope difference once in `pages/shared/locator-scope.ts` rather than repeating `.or(...)` guesses per method.
- Use method names with stable semantics: `click` for raw actions, `open`/`enter` for navigation, `fill`/`select` for state changes, `read` for data reads, and `expect` for assertions.
- Do not hide business strategy, retry policy, or recovery logic inside lightweight-sounding page methods. If the method contains selection policy or multi-step fallback, move that intent to `flows/` or split it into explicit page steps.
- Prefer typed page APIs over raw strings when the allowed values are finite and stable, such as home entries (`HomeEntry` in `pages/shared/page-method-contracts.ts`), filter types, or operation modes.
- Make postconditions explicit. A caller should be able to tell from the method name and return type whether the action only clicks, leaves the user on the same page, or guarantees arrival at the next page.
- Same-page actions return `Promise<void>`; cross-page actions return the destination page object after minimal load checks. Do not default to `return this` for same-page actions.
- Avoid duplicate flow entrypoints that expose the same behavior through both class methods and one-to-one wrapper functions unless there is a clear reporting or fixture need.
- Keep snapshot/read APIs narrow. Use small read methods for focused data, and let aggregate snapshot methods compose those reads instead of embedding all parsing logic in one large method.
- Hotspot page facades (`order-dishes.page.ts`, `recall.page.ts`) should stay thin delegators; implementation belongs in `pages/order-dishes/` or `pages/recall/` section files.

## Recommended Test Metadata Style

```ts
test(
  '应能通过授权选择和员工口令登录进入 POS 主页',
  {
    tag: ['@smoke'],
    annotation: [
      { type: 'issue', description: 'https://devtickets.atlassian.net/browse/POS-46667' },
      { type: 'issue', description: 'https://devtickets.atlassian.net/browse/POS-46668' },
    ],
  },
  async ({ homePage }) => {
    // ...
  },
);
```

## Test Tagging Rules

- Use Playwright native `tag` metadata for test tags.
- Tags should describe the business scope covered by the test, not the source directory, migration batch, or implementation origin.
- Do not use migration-only tags such as `@py-migrate`; the `tests/py-migrate` path and Playwright project name already provide that grouping.
- A test may have multiple business tags when it spans multiple areas.
- Prefer these current business tags where applicable: `@库存`, `@点单`, `@分单`, `@小费`, `@加收`, `@现金支付`, `@信用卡支付`.
- Payment tests must use the specific payment method tag, such as `@现金支付` or `@信用卡支付`, instead of a generic payment tag.
- Broad tags may be placed on `test.describe(...)` when every nested test shares that scope; add narrower tags on individual tests only for extra business coverage.
- Keep stable suite-purpose tags such as `@smoke` when they express execution intent rather than business scope.

## POS Domain Guidance

- Do not model the system like a SaaS app with one global login session.
- Treat "login" as employee context entry or employee switching during operations.
- Prefer expressing employee context through flows and fixtures.
- Keep room for optional API-assisted setup or `storageState`, but do not make that the default strategy.
- For configuration that belongs to the admin entry, prefer API-based setup and avoid UI configuration unless the admin UI behavior itself is under test or no API is available.

## Navigation Rules

- Do not open POS inner pages by direct URL, hash, or deep link such as `#orderDishes`.
- Always enter the app from `http://192.168.247:22080/kpos/front/myhome.html`, then navigate through the UI flow to the target page.
- Apply the same rule to every in-app page, not only the order-dishes page.

## Test Design

- Smoke tests should validate stable availability signals only.
- E2E tests should express business intent instead of click-by-click scripts.
- When a request does not explicitly require table selection, order-entry tests should use the default no-table path; Recall checks should validate the first visible order record directly.
- Add stronger semantic locators or test ids before introducing fragile selectors.
- Inventory page and flow navigation must not depend on hard-coded container or panel ids such as `inventoryCategoryPanelId`; use visible business text or stable page-owned selectors instead.
- Price-related page reads should return numeric values from the page object layer. Do not re-parse currency strings in test cases when the page object can already provide numbers.
- Data-driven test inputs should be separated from spec files when they represent reusable domain data, business samples, or case matrices.
- Prefer TypeScript files under `test-data/` for test data so literals keep type checking, `as const` narrowing, factories, and IDE refactoring support.
- Keep stable POS domain samples such as menu groups, dishes, options, customers, quantities, and expected deltas in `test-data/`; keep only scenario orchestration and assertions in spec files.
- Use small factory functions in `test-data/` for dynamic values such as unique customer names. Do not inline `Date.now()` or other dynamic sample generation in spec bodies.
- Keep traceability metadata such as Jira issue keys in spec files so global search lands on the owning test. Use `test-data/` case arrays only for pure input/expected-value matrices that do not need direct issue-key searchability.

## Project Structure

- Keep page objects lean. Put page-level structure and low-level actions in `pages/`.
- Put business intent and multi-step behavior in `flows/`.
- Put shared Playwright extensions in `fixtures/`.
- Put environment and sample domain data in `test-data/`.
- Put pure helpers in `utils/`.

## Architecture Gate

- Run `npm run lint:ui-architecture` after modifying Page, Flow, Fixture, or UI spec code.
- `docs/ui-architecture-baseline.json` is a decreasing debt ceiling, not a permanent exception list.
- A remediation may lower a baseline value after removing debt; it must never raise a value to make the gate pass.
- New hard waits and `waitForInputSettled()` calls without a concrete Locator are prohibited at zero baseline.

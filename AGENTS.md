# AGENTS.md

## Objective

This repository is a maintainable Playwright + TypeScript UI automation project for a POS/order frontend. Optimize for clarity, reuse, and long-term Codex maintenance, not one-off scripts.

## Interaction

- Address the user as `金将军`.
- Use respectful Chinese throughout replies.

## Automation Rules

- Use Playwright Test as the default runner.
- Prefer semantic locators such as `getByRole`, `getByLabel`, and `getByText`.
- Do not default to brittle CSS chains, nth-child selectors, or XPath.
- Do not use `waitForTimeout` in tests or helpers.
- Every method in `pages/` and `flows/` must use Chinese `@step(...)` descriptions for report display.
- Do not keep page/flow action descriptions only in comments; convert those descriptions into executable report steps.
- Every `describe` and `test` title must be written in Chinese.
- Test-case-level report steps must also use Chinese.
- Test-case-level metadata should use Playwright native `test(title, details, body)` style.
- Jira links should be declared in the `details.annotation` field, not via a custom wrapper helper.

## Page And Flow Boundaries

- `pages/` only holds page structure, locators, page-level actions, and page-level reads.
- `pages/` can do things like: click a button, fill an input, switch a tab, read a table number, return a locator or page data.
- `pages/` must not contain business selection strategy or cross-step intent such as “select any available table”, “pick the first usable license”, “enter the system with employee context”, or other business-level decisions.
- `flows/` only holds business intent, multi-step orchestration, and selection strategy.
- `flows/` can combine multiple page actions, decide which record to pick, decide fallback order, and return business-level results.
- `flows/` must not redefine page locators or duplicate low-level page interaction details that belong in `pages/`.
- Do not mix `page` and `flow` responsibilities in the same method. If a method contains business policy or selection logic, move it to `flows/`. If a method only describes a single page action or read, keep it in `pages/`.

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

## POS Domain Guidance

- Do not model the system like a SaaS app with one global login session.
- Treat "login" as employee context entry or employee switching during operations.
- Prefer expressing employee context through flows and fixtures.
- Keep room for optional API-assisted setup or `storageState`, but do not make that the default strategy.

## Test Design

- Smoke tests should validate stable availability signals only.
- E2E tests should express business intent instead of click-by-click scripts.
- Add stronger semantic locators or test ids before introducing fragile selectors.

## Project Structure

- Keep page objects lean. Put page-level structure and low-level actions in `pages/`.
- Put business intent and multi-step behavior in `flows/`.
- Put shared Playwright extensions in `fixtures/`.
- Put environment and sample domain data in `test-data/`.
- Put pure helpers in `utils/`.

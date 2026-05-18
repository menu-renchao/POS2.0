# Payment Page Design

**Date:** 2026-04-25

**Goal:** Add a maintainable Playwright payment page object and payment flow so the automation project can complete cash and credit-card payment from the POS order flow, while keeping payment entry isolated from order and recall pages.

## Context

The current project already has stable homepage, order-dishes, and recall abstractions, but it does not have a dedicated payment page object. The new requirement is limited to:

- cash payment
- credit-card payment with a fixed test card
- reading the left payment summary area
- handling the print-receipt choice after payment

The user confirmed the simplest valid real verification path is enough. Because payment is unrelated to table selection, the live tests should enter through:

- `Home -> To Go -> Order Dishes -> Pay`

This keeps the test aligned with the repository rule to enter from the homepage UI, while avoiding unrelated table-selection noise.

## Design

- Create `pages/payment.page.ts` as an independent payment page object.
- Keep payment entry methods on the owning pages only:
  - `OrderDishesPage.openPayment()`
  - `RecallPage.openPayment()` (page capability only, no live recall payment test in this task)
- Create `flows/payment.flow.ts` for business orchestration:
  - pay by cash and choose whether to print
  - pay by credit card with the fixed test card and choose whether to print
- Add one contract test for the payment page and flow behavior.
- Add two minimal live E2E tests from the `To Go` path:
  - cash payment
  - credit-card payment

## Page / Flow Boundary

`pages/payment.page.ts` will own:

- payment-page load signal
- balance-due payment-method selection
- payment-type selection
- credit-card form filling
- pay button click
- print-receipt dialog handling
- structured `_summaryContent` snapshot reading

`flows/payment.flow.ts` will own:

- orchestration order
- fixed credit-card test data
- payment completion sequencing
- print-choice completion
- cleanup / recovery when the print dialog appears and a later step fails

## Locator Strategy

- Prefer stable attributes and ids first.
- Use the explicitly provided ids for the key-in form:
  - `#cardNof`
  - `#carddate`
  - `#carddateY`
  - `#cardfHolderName`
- Use shallow, centralized locator factories for payment selectors that do not expose `data-testid`.
- Avoid embedding raw locators directly in flow methods.

## Test Scope

- Contract test:
  - prove the payment page can select cash / credit-card paths
  - prove `_summaryContent` is parsed into a structured snapshot
  - prove receipt-choice handling completes
- Live tests:
  - start from homepage and enter `To Go`
  - create the smallest viable order
  - open payment
  - complete cash or credit-card payment
  - finish the receipt-choice step
  - assert a stable completion signal from the post-payment page state

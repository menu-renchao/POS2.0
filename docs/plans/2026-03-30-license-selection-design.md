# License Selection Page Design

**Date:** 2026-03-30

**Goal:** Add a maintainable Playwright page object and flow for selecting a license by type from the POS homepage license panel.

## Context

The homepage exposes a license selection panel before entering the POS shell. The panel contains:

- an input with placeholder `Select or create a new license!`
- an `Enter` action
- a list with columns `POS LICENSE`, `TYPE`, and `STATUS`

Real-world behavior confirmed from the live page:

- clicking a license row fills the input with that license name
- clicking `Enter` submits the selected license
- selecting a mismatched type produces a visible business error
- selecting a matching `PC` license starts loading into the app

## Design

- Create `pages/license-selection.page.ts` for page-level actions.
- Create `flows/license-selection.flow.ts` for the business step of entering with an available license.
- Default the `type` parameter to `PC`.
- Only select rows whose `STATUS` is exactly `Not in use`.
- If no matching row exists, throw a clear error.

## Locator Strategy

- Use semantic locators for the input and `Enter` button.
- Use lightweight class-based locators for the list rows because the row structure does not expose semantic roles.
- Keep selectors shallow: `.selectbx .tablebx > .skOneRow`.

## Test Scope

- Verify that default selection picks a `PC` license with `Not in use` status and writes its name into the input.
- Verify that submitting an available `Android` license triggers the known type-mismatch business error, proving the `Enter` action runs without pushing the smoke suite into an unstable business state.

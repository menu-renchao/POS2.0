# Playwright UI Automation Design

**Date:** 2026-03-30

**Goal:** Initialize a long-lived Playwright + TypeScript UI automation project for the POS frontend in the current directory.

## Context

The target system is a POS/order frontend, not a SaaS app with a single global login session. "Login" should be modeled as employee-context switching during business operations, not as a universal preloaded authentication state.

## Recommended Structure

- Root config files stay at the repository root.
- `tests/` contains runnable tests and setup only.
- `pages/` contains lean page objects.
- `flows/` contains business-oriented flows such as employee context entry or switching.
- `fixtures/` contains shared Playwright fixtures.
- `test-data/` contains environment and sample domain data.
- `utils/` contains pure helpers.
- `playwright/.auth/` is reserved for optional technical state files, but not treated as the default login strategy.

## Design Rules

- Use Playwright Test with TypeScript.
- Prefer semantic locators by default.
- Do not encode brittle CSS/XPath selectors in the starter example.
- Do not use `waitForTimeout`.
- Keep page objects lean and move business meaning into flows.
- Model employee context in flows/fixtures, not in `globalSetup`.
- Preserve room for future API-assisted setup or optional `storageState`.

## Minimal Smoke Scope

The target homepage currently exposes stable signals through the document title and URL. The starter smoke test should therefore validate:

1. The page opens successfully.
2. The title resolves to `8Pos`.
3. The URL matches `/kpos/front2/myhome.html`.

This creates a runnable baseline without hardcoding fragile UI selectors before the product exposes stronger semantic hooks.

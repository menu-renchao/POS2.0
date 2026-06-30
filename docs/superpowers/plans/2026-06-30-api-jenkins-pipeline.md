# API Jenkins Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Jenkins pipeline for Playwright API tests with configurable target host, port, and context path.

**Architecture:** Keep the existing UI `Jenkinsfile` unchanged and add `Jenkinsfile.api` as the isolated API job entrypoint. The pipeline validates parameters, exports `API_BASE_URL`, installs dependencies, runs the selected API test scope, and publishes artifacts.

**Tech Stack:** Jenkins Declarative Pipeline, Windows `bat` steps, npm, Playwright Test, Allure Jenkins plugin.

---

### Task 1: Add API Pipeline Entry

**Files:**
- Create: `Jenkinsfile.api`

- [x] **Step 1: Define parameter validation helpers**

Add helper functions for IPv4, hostname, port, context path, branch, and test-scope command resolution at the top of `Jenkinsfile.api`.

- [x] **Step 2: Define Jenkins parameters**

Add `API_HOST`, `API_PORT`, `API_CONTEXT_PATH`, `API_TEST_SCOPE`, and dynamic `GIT_BRANCH`. Use `192.168.0` as the host prefill, not as a runnable default. Load `GIT_BRANCH` from remote branches with Active Choices and fall back to `main`.

- [x] **Step 3: Add validation and checkout stages**

Add `Validate Parameters` to build `API_BASE_URL`, then `Checkout` to switch to the requested branch.

- [x] **Step 4: Add dependency, cleanup, test, and publish stages**

Run `npm ci`, remove previous report folders, run the selected API command, publish Allure results, and archive Playwright artifacts.

### Task 2: Document Jenkins Usage

**Files:**
- Modify: `tests/api/README.md`

- [x] **Step 1: Add a Jenkins section**

Document that Jenkins should use `Jenkinsfile.api`, explain the host prefill behavior, and list the available `API_TEST_SCOPE` values.

### Task 3: Verify

**Files:**
- No source file changes.

- [x] **Step 1: Check formatting-sensitive diff**

Run: `git diff --check`

Expected: no whitespace errors.

- [x] **Step 2: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: exit code `0`.

- [x] **Step 3: Run API unit tests**

Run: `npx playwright test tests/api/unit --project=api --reporter=line`

Expected: all API unit tests pass.

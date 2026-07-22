# Jenkins UI Pipeline Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure `Jenkinsfile.ui` lists and runs only Playwright UI tests from the `py-migrate` project while retaining API-backed UI setup and data preparation.

**Architecture:** The Jenkins test-tree generator will accept Playwright CLI filters and an overridable output path for isolated regression testing. `Jenkinsfile.ui` will pass the UI directory and project filter during discovery, constrain fallback scans and selected files to `tests/py-migrate`, and repeat the project filter during execution.

**Tech Stack:** Jenkins Declarative Pipeline (Groovy), Playwright Test, Node.js ESM, Node.js built-in test runner

## Global Constraints

- UI test scope is the Playwright `py-migrate` project and the `tests/py-migrate` directory.
- `all` means all UI tests, not all Playwright tests in the repository.
- UI global setup, API clients, and API-backed data preparation remain available.
- `Jenkinsfile.api` and API tests are outside this change.
- Do not modify or commit unrelated working-tree changes.

---

### Task 1: Add filtered Jenkins test-tree generation

**Files:**
- Create: `tests/scripts/generate-jenkins-test-tree.unit.test.mjs`
- Modify: `scripts/generate-jenkins-test-tree.mjs:1-24`

**Interfaces:**
- Consumes: optional CLI arguments after `node scripts/generate-jenkins-test-tree.mjs` and optional `JENKINS_TEST_TREE_OUTPUT` environment variable.
- Produces: the same JSON tree schema at the configured output path; CLI arguments are passed to `playwright test` before `--list --reporter=json`.

- [ ] **Step 1: Write the failing regression test**

Create a Node test that launches the real generator with UI filters and an isolated output file:

```js
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const generator = resolve(repoRoot, 'scripts/generate-jenkins-test-tree.mjs');

test('应只生成 py-migrate UI 项目的 Jenkins 用例树', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'pos-ui-test-tree-'));
  const outputPath = join(tempDir, 'test-tree.json');

  try {
    const result = spawnSync(
      process.execPath,
      [generator, 'tests/py-migrate', '--project=py-migrate'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          JENKINS_TEST_TREE_OUTPUT: outputPath,
        },
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const tree = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.deepEqual(tree.suites, ['all', 'py-migrate']);
    assert.ok(tree.files.all.length > 0);
    assert.ok(tree.files.all.every((file) => file.startsWith('tests/py-migrate/')));
    assert.ok(!Object.keys(tree.cases).some((file) => file.startsWith('tests/api/')));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/scripts/generate-jenkins-test-tree.unit.test.mjs`

Expected: FAIL because the current generator ignores `JENKINS_TEST_TREE_OUTPUT`, so the isolated output file does not exist.

- [ ] **Step 3: Implement CLI argument and output-path support**

Update the generator setup:

```js
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = resolve(repoRoot, 'node_modules', 'playwright', 'cli.js');
const outputPath = process.env.JENKINS_TEST_TREE_OUTPUT
  ? resolve(process.env.JENKINS_TEST_TREE_OUTPUT)
  : resolve(repoRoot, '.jenkins', 'test-tree.json');
const playwrightFilters = process.argv.slice(2);

const result = spawnSync(
  process.execPath,
  [playwrightCli, 'test', ...playwrightFilters, '--list', '--reporter=json'],
```

Do not change parsing or the JSON schema.

- [ ] **Step 4: Run the regression test and verify GREEN**

Run: `node --test tests/scripts/generate-jenkins-test-tree.unit.test.mjs`

Expected: PASS with one passing test and no API paths in the generated temporary tree.

- [ ] **Step 5: Run existing script tests**

Run: `npm run test:scripts`

Expected: PASS with all existing Node script tests passing.

### Task 2: Restrict Jenkinsfile.ui discovery and execution to UI

**Files:**
- Modify: `Jenkinsfile.ui:90-430,565-661`
- Test: `tests/scripts/generate-jenkins-test-tree.unit.test.mjs`

**Interfaces:**
- Consumes: the filtered `.jenkins/test-tree.json` produced by Task 1.
- Produces: Jenkins parameters containing only UI suites/files/cases and a run command restricted to `tests/py-migrate --project=py-migrate`.

- [ ] **Step 1: Capture the current failing scope evidence**

Run:

```powershell
npm run jenkins:test-tree
$tree = Get-Content -Raw -Encoding UTF8 '.jenkins/test-tree.json' | ConvertFrom-Json
if ($tree.files.all -match '^tests/api/') { throw 'Jenkins UI tree still contains API tests' }
```

Expected: FAIL with `Jenkins UI tree still contains API tests`, demonstrating the current unfiltered default includes API tests.

- [ ] **Step 2: Restrict generated and fallback parameter data**

Apply these exact behavioral changes in `Jenkinsfile.ui`:

```groovy
// Generate only the UI project tree.
bat 'npm run jenkins:test-tree -- tests/py-migrate --project=py-migrate'
```

In the `TEST_SUITE` fallback, inspect only `tests/py-migrate` and return `['all', 'py-migrate']` when UI specs exist. In `TEST_FILE` and `TEST_CASE_GREP` fallbacks, use this fixed scope instead of the repository-wide `tests` directory:

```groovy
def suitePath = 'tests/py-migrate'
```

When reading the cached tree, continue using `all` or `py-migrate`; the filtered tree contains no other suite names.

- [ ] **Step 3: Restrict selected files and runtime command**

Replace the generic file validation and target fallback with UI-only checks:

```groovy
for (selectedFile in selectedFiles) {
    if (!selectedFile.matches('tests/py-migrate/[A-Za-z0-9_./-]+\\.spec\\.ts')) {
        error "Invalid UI TEST_FILE value: ${selectedFile}"
    }
}
def testTarget = selectedFiles ? selectedFiles.join(' ') : 'tests/py-migrate'
```

Run Playwright with the explicit UI project filter:

```groovy
bat "node node_modules/@playwright/test/cli.js test ${testTarget} --project=py-migrate${headedFlag}${grepFlag}"
```

Keep global setup and all API-backed UI preparation unchanged.

- [ ] **Step 4: Verify the UI tree excludes API tests**

Run:

```powershell
npm run jenkins:test-tree -- tests/py-migrate --project=py-migrate
$tree = Get-Content -Raw -Encoding UTF8 '.jenkins/test-tree.json' | ConvertFrom-Json
if (-not $tree.files.all) { throw 'UI tree is empty' }
if ($tree.files.all | Where-Object { $_ -match '^tests/api/' }) { throw 'UI tree contains API tests' }
if ($tree.files.all | Where-Object { $_ -notmatch '^tests/py-migrate/' }) { throw 'UI tree contains a non-UI path' }
```

Expected: PASS with no thrown error.

- [ ] **Step 5: Verify Jenkinsfile.ui contains both scope guards**

Run:

```powershell
$jenkins = Get-Content -Raw 'Jenkinsfile.ui'
if ($jenkins -notmatch 'jenkins:test-tree -- tests/py-migrate --project=py-migrate') { throw 'UI discovery filter is missing' }
if ($jenkins -notmatch 'test \$\{testTarget\} --project=py-migrate') { throw 'UI execution filter is missing' }
if ($jenkins -notmatch "tests/py-migrate/\[A-Za-z0-9_\./-\]") { throw 'UI file validation is missing' }
```

Expected: PASS with no thrown error.

- [ ] **Step 6: Run project checks**

Run: `npm run test:scripts`

Expected: PASS with all script tests passing.

Run: `npx tsc --noEmit`

Expected: PASS with exit code 0.

- [ ] **Step 7: Review the final diff without touching unrelated changes**

Run: `git diff --check -- Jenkinsfile.ui scripts/generate-jenkins-test-tree.mjs tests/scripts/generate-jenkins-test-tree.unit.test.mjs`

Expected: PASS with no whitespace errors. Confirm `git diff` contains only UI pipeline scoping, argument passthrough, and its regression test.

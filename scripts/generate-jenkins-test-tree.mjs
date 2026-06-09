import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = resolve(repoRoot, 'node_modules', 'playwright', 'cli.js');
const outputPath = resolve(repoRoot, '.jenkins', 'test-tree.json');

const result = spawnSync(
  process.execPath,
  [playwrightCli, 'test', '--list', '--reporter=json'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: 'true',
    },
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  if (result.stdout) {
    console.error(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }
  process.exit(result.status ?? 1);
}

function parsePlaywrightJson(stdout) {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new Error('Playwright JSON reporter did not print a JSON object.');
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}

function normalizeSpecPath(file) {
  let normalized = file.replace(/\\/g, '/');
  const rootPrefix = `${repoRoot.replace(/\\/g, '/')}/`;
  if (normalized.startsWith(rootPrefix)) {
    normalized = normalized.slice(rootPrefix.length);
  }
  if (!normalized.startsWith('tests/')) {
    normalized = `tests/${normalized.replace(/^\/+/, '')}`;
  }
  return normalized;
}

function suiteNameForFile(file) {
  const parts = file.split('/');
  if (parts.length >= 3 && parts[0] === 'tests') {
    return parts[1];
  }
  return null;
}

function addUnique(target, value) {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

const report = parsePlaywrightJson(result.stdout);
const filesBySuite = { all: [] };
const casesByFile = {};

function visitSuite(suite) {
  for (const spec of suite.specs ?? []) {
    if (!spec.file || !spec.title) {
      continue;
    }

    const file = normalizeSpecPath(spec.file);
    const suiteName = suiteNameForFile(file);
    addUnique(filesBySuite.all, file);
    if (suiteName) {
      filesBySuite[suiteName] ??= [];
      addUnique(filesBySuite[suiteName], file);
    }

    casesByFile[file] ??= [];
    addUnique(casesByFile[file], spec.title);
  }

  for (const childSuite of suite.suites ?? []) {
    visitSuite(childSuite);
  }
}

for (const suite of report.suites ?? []) {
  visitSuite(suite);
}

for (const suiteFiles of Object.values(filesBySuite)) {
  suiteFiles.sort();
}

const sortedCasesByFile = {};
for (const file of Object.keys(casesByFile).sort()) {
  sortedCasesByFile[file] = casesByFile[file];
}

const tree = {
  suites: Object.keys(filesBySuite).sort((left, right) => {
    if (left === 'all') return -1;
    if (right === 'all') return 1;
    return left.localeCompare(right);
  }),
  files: Object.fromEntries(
    Object.keys(filesBySuite)
      .sort((left, right) => {
        if (left === 'all') return -1;
        if (right === 'all') return 1;
        return left.localeCompare(right);
      })
      .map((suiteName) => [suiteName, filesBySuite[suiteName]]),
  ),
  cases: sortedCasesByFile,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(tree, null, 2)}\n`, 'utf8');

console.log(
  `Generated ${outputPath} with ${tree.suites.length} suites, ${tree.files.all.length} files, and ${Object.values(tree.cases).reduce((total, cases) => total + cases.length, 0)} cases.`,
);

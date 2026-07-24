import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_BASELINE_PATH = path.join(
  REPOSITORY_ROOT,
  'docs',
  'ui-architecture-baseline.json',
);

const SOURCE_ROOTS = Object.freeze([
  { directory: 'pages', scope: 'pages' },
  { directory: 'flows', scope: 'flows' },
  { directory: path.join('tests', 'py-migrate'), scope: 'specs' },
  { directory: 'fixtures', scope: 'fixtures' },
]);

export const UI_ARCHITECTURE_RULES = Object.freeze([
  'candidateLocatorResolvers',
  'locatorOrFallbacks',
  'xpathSelectors',
  'testIdAttributeAliases',
  'multilingualLocatorFallbacks',
  'rawLocatorCallsInFlows',
  'rawLocatorCallsInSpecs',
  'samePageReturns',
  'hardWaits',
  'inputWaitsWithoutLocator',
  'immediateFlowConstructorsInSpecs',
  'defaultConstructedFlowDependencies',
  'flowServiceLocatorParameters',
  'broadDomTraversal',
  'unclassifiedGlobalConfigMutations',
]);

export function analyzeUiArchitectureSource(filePath, content, scope) {
  const normalizedPath = filePath.replaceAll('\\', '/');
  const locatorCallPattern =
    /\.(?:locator|getByRole|getByText|getByTestId|getByLabel|getByPlaceholder)\s*\(/g;

  return {
    file: normalizedPath,
    counts: {
      candidateLocatorResolvers: countMatches(
        content,
        /\b(?:resolve|find)(?:First)?VisibleLocator\s*\(|\b(?:[A-Za-z][A-Za-z0-9]*)?(?:Candidates?|CandidateLocators)\s*=\s*\[|\b(?:[A-Za-z][A-Za-z0-9]*)?Candidates?\s*:\s*(?:readonly\s+)?Locator\s*\[\]/gi,
      ),
      locatorOrFallbacks: countMatches(content, /\.or\s*\(/g),
      xpathSelectors: countMatches(
        content,
        /xpath=|\.locator\s*\(\s*['"`]\s*\/\//g,
      ),
      testIdAttributeAliases: countMatches(
        content,
        /data-testid[^\r\n]{0,160}data-test-id|data-test-id[^\r\n]{0,160}data-testid/g,
      ),
      multilingualLocatorFallbacks: countMatches(
        content,
        /\.(?:getByRole|getByText|getByLabel|getByPlaceholder)[^\r\n]*\/[^\r\n/]*[\u3400-\u9fff][^\r\n/]*\|[^\r\n/]*\//g,
      ),
      rawLocatorCallsInFlows:
        scope === 'flows' ? countMatches(content, locatorCallPattern) : 0,
      rawLocatorCallsInSpecs:
        scope === 'specs' ? countMatches(content, locatorCallPattern) : 0,
      samePageReturns:
        countMatches(
          content,
          /Promise\s*<\s*this\s*>|\breturn\s+this\s*;/g,
        ) +
        countMatches(
          content,
          /async\s+(?!enter[A-Z])[A-Za-z][A-Za-z0-9]*\s*\(\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*([A-Za-z][A-Za-z0-9]*Page)\b[\s\S]{0,500}?\)\s*:\s*Promise\s*<\s*\2\s*>[\s\S]{0,1600}?\breturn\s+\1\s*;/g,
        ),
      hardWaits: countMatches(content, /\.waitForTimeout\s*\(/g),
      inputWaitsWithoutLocator: countMatches(
        content,
        /waitForInputSettled\s*\(\s*(?:undefined(?:\s*,[^)]*)?)?\s*\)/g,
      ),
      immediateFlowConstructorsInSpecs:
        scope === 'specs'
          ? countMatches(content, /\bnew\s+[A-Z][A-Za-z0-9]*Flow\s*\(/g)
          : 0,
      defaultConstructedFlowDependencies:
        scope === 'flows'
          ? countMatches(
              content,
              /(?:private|protected|public)?\s*(?:readonly\s+)?[A-Za-z][A-Za-z0-9]*\s*=\s*new\s+[A-Z][A-Za-z0-9]*Flow\s*\(/g,
            )
          : 0,
      flowServiceLocatorParameters:
        scope === 'flows'
          ? countMatches(content, /\b(?:FlowFixtures|TestFlows)\b/g)
          : 0,
      broadDomTraversal:
        countBroadQuerySelectorAll(content) +
        countMatches(
          content,
          /while\s*\([^)]*\)\s*\{[\s\S]{0,1200}?\.parentElement\b/g,
        ),
      unclassifiedGlobalConfigMutations:
        scope === 'specs' &&
        !normalizedPath.endsWith('/print.spec.ts') &&
        /\b(?:systemConfiguration|systemConfigurationApi)\s*\.\s*(?:updateByName|updateManyByName|updateSystemConfigurations)\s*\(/.test(
          content,
        ) &&
        !content.includes('@ui-exclusive-config')
          ? 1
          : 0,
    },
  };
}

export async function scanUiArchitecture(repositoryRoot = REPOSITORY_ROOT) {
  const files = [];

  for (const sourceRoot of SOURCE_ROOTS) {
    const absoluteRoot = path.join(repositoryRoot, sourceRoot.directory);
    const sourceFiles = await collectTypeScriptFiles(absoluteRoot);

    for (const absoluteFile of sourceFiles) {
      const relativeFile = path.relative(repositoryRoot, absoluteFile);
      const content = await readFile(absoluteFile, 'utf8');
      files.push(
        analyzeUiArchitectureSource(relativeFile, content, sourceRoot.scope),
      );
    }
  }

  files.sort((left, right) => left.file.localeCompare(right.file));

  const totals = Object.fromEntries(
    UI_ARCHITECTURE_RULES.map((rule) => [
      rule,
      files.reduce((total, file) => total + file.counts[rule], 0),
    ]),
  );

  return { files, totals };
}

export function validateUiArchitectureBaseline(scan, baseline) {
  const errors = [];

  for (const rule of UI_ARCHITECTURE_RULES) {
    const allowed = baseline.maximums?.[rule];
    const actual = scan.totals[rule];

    if (!Number.isInteger(allowed) || allowed < 0) {
      errors.push(`基线缺少有效规则上限：${rule}`);
      continue;
    }

    if (actual > allowed) {
      const hotspots = scan.files
        .filter((file) => file.counts[rule] > 0)
        .sort((left, right) => right.counts[rule] - left.counts[rule])
        .slice(0, 5)
        .map((file) => `${file.file}(${file.counts[rule]})`)
        .join(', ');
      errors.push(
        `${rule} 从允许的 ${allowed} 增加到 ${actual}。热点：${hotspots || '无'}`,
      );
    }
  }

  return errors;
}

export function formatUiArchitectureSummary(scan) {
  return UI_ARCHITECTURE_RULES.map(
    (rule) => `${rule}: ${scan.totals[rule]}`,
  ).join('\n');
}

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath);
    }
  }

  return files;
}

function countMatches(content, pattern) {
  return [...content.matchAll(pattern)].length;
}

function countBroadQuerySelectorAll(content) {
  const selectorCalls =
    content.matchAll(
      /querySelectorAll(?:<[^>]+>)?\s*\(\s*(['"`])([^'"`]*)\1\s*\)/g,
    );
  let count = 0;

  for (const selectorCall of selectorCalls) {
    const selector = selectorCall[2] ?? '';
    const containsBareBroadBranch = selector
      .split(',')
      .some((branch) => /^(?:\*|button|div|section)$/.test(branch.trim()));

    if (containsBareBroadBranch) {
      count += 1;
    }
  }

  return count;
}

async function run() {
  const baselinePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : DEFAULT_BASELINE_PATH;
  const [scan, baselineText] = await Promise.all([
    scanUiArchitecture(),
    readFile(baselinePath, 'utf8'),
  ]);
  const baseline = JSON.parse(baselineText);
  const errors = validateUiArchitectureBaseline(scan, baseline);

  console.log(formatUiArchitectureSummary(scan));

  if (errors.length > 0) {
    console.error('\nUI 架构门禁失败：');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nUI 架构门禁通过：现存债务未超过递减基线。');
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (entryPath === fileURLToPath(import.meta.url)) {
  await run();
}

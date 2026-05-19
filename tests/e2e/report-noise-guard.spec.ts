import { expect, test } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

type Violation = {
  file: string;
  line: number;
  content: string;
  pattern: string;
};

const guardedDirectories = ['pages', 'flows', 'fixtures', 'tests', 'utils'];
const ignoredFiles = new Set(['report-noise-guard.spec.ts']);
const maxOrChainPerLine = 4;
const maxPageFacadeLines = 600;
const maxPageSectionLines = 1_400;
const pageFacadeFiles = ['pages/order-dishes.page.ts', 'pages/recall.page.ts'];
const forbiddenPatterns = [
  {
    name: 'expect.poll()',
    matcher: /expect\s*\.\s*poll\s*\(/,
  },
  {
    name: '.toPass()',
    matcher: /\.toPass\s*\(/,
  },
];

test.describe('报告降噪规范契约', () => {
  test('业务代码中不应重新引入会制造假红灯的重试断言写法', async () => {
    const violations = await collectViolations();

    expect(violations).toEqual([]);
  });

  test('页面对象不应回潮为超长 locator 猜测链或膨胀的单体 facade', async () => {
    const violations = await collectStructuralViolations();

    expect(violations).toEqual([]);
  });
});

async function collectViolations(): Promise<Violation[]> {
  const repoRoot = process.cwd();
  const violations: Violation[] = [];

  for (const directory of guardedDirectories) {
    const directoryPath = path.join(repoRoot, directory);
    const filePaths = await collectTypeScriptFiles(directoryPath);

    for (const filePath of filePaths) {
      if (ignoredFiles.has(path.basename(filePath))) {
        continue;
      }

      const fileContent = await readFile(filePath, 'utf8');
      const lines = fileContent.split(/\r?\n/);

      lines.forEach((lineContent, index) => {
        for (const forbiddenPattern of forbiddenPatterns) {
          if (!forbiddenPattern.matcher.test(lineContent)) {
            continue;
          }

          violations.push({
            file: path.relative(repoRoot, filePath),
            line: index + 1,
            content: lineContent.trim(),
            pattern: forbiddenPattern.name,
          });
        }
      });
    }
  }

  return violations;
}

async function collectStructuralViolations(): Promise<Violation[]> {
  const repoRoot = process.cwd();
  const violations: Violation[] = [];
  const pagesDirectory = path.join(repoRoot, 'pages');
  const pageFiles = await collectTypeScriptFiles(pagesDirectory);

  for (const filePath of pageFiles) {
    if (ignoredFiles.has(path.basename(filePath))) {
      continue;
    }

    const relativeFile = path.relative(repoRoot, filePath);
    const fileContent = await readFile(filePath, 'utf8');
    const lines = fileContent.split(/\r?\n/);
    const lineCount = lines.length;

    if (pageFacadeFiles.includes(relativeFile.replace(/\\/g, '/')) && lineCount > maxPageFacadeLines) {
      violations.push({
        file: relativeFile,
        line: lineCount,
        content: `facade 文件行数为 ${lineCount}，上限 ${maxPageFacadeLines}`,
        pattern: 'page-facade-size',
      });
    }

    if (
      relativeFile.includes(`${path.sep}order-dishes${path.sep}`) ||
      relativeFile.includes(`${path.sep}recall${path.sep}`)
    ) {
      if (lineCount > maxPageSectionLines) {
        violations.push({
          file: relativeFile,
          line: lineCount,
          content: `section 文件行数为 ${lineCount}，上限 ${maxPageSectionLines}`,
          pattern: 'page-section-size',
        });
      }
    }

    lines.forEach((lineContent, index) => {
      const orCount = (lineContent.match(/\.or\(/g) ?? []).length;

      if (orCount > maxOrChainPerLine) {
        violations.push({
          file: relativeFile,
          line: index + 1,
          content: lineContent.trim(),
          pattern: `locator-or-chain>${maxOrChainPerLine}`,
        });
      }
    });
  }

  return violations;
}

async function collectTypeScriptFiles(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

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

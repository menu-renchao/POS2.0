import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const testsRoot = path.resolve(__dirname, '..');
const currentFile = path.resolve(__filename);

async function collectSpecFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return await collectSpecFiles(fullPath);
      }

      if (entry.isFile() && /\.(?:spec|smoke)\.ts$/.test(entry.name)) {
        return [fullPath];
      }

      return [];
    }),
  );

  return files.flat();
}

test.describe('Playwright UI License 前置配置', () => {
  test('UI 用例不应再执行 License 选择步骤', async () => {
    const specFiles = (await collectSpecFiles(testsRoot)).filter((file) => file !== currentFile);
    const offenders: string[] = [];

    for (const file of specFiles) {
      const content = await readFile(file, 'utf8');

      if (/LicenseSelectionFlow|licenseSelectionPage/.test(content)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

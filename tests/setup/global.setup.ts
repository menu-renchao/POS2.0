import type { FullConfig } from '@playwright/test';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { appConfig } from '../../test-data/env';

const PROJECT_ROOT = resolve(__dirname, '..', '..');
const STALE_OUTPUT_DIRS = ['test-results', 'allure-results', 'allure-report'];
const KEEP_EXISTING_REPORTS = process.env.PLAYWRIGHT_KEEP_EXISTING_REPORTS === 'true';

function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid PLAYWRIGHT_BASE_URL: ${url}`, { cause: error });
  }
}

async function globalSetup(_config: FullConfig): Promise<void> {
  if (!KEEP_EXISTING_REPORTS) {
    for (const dir of STALE_OUTPUT_DIRS) {
      const dirPath = resolve(PROJECT_ROOT, dir);

      if (existsSync(dirPath)) {
        rmSync(dirPath, { recursive: true, force: true });
      }
    }
  }

  validateUrl(appConfig.baseURL);
}

export default globalSetup;

import type { FullConfig } from '@playwright/test';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { appConfig } from '../../test-data/env';
import { clearOccupiedTablesBeforeRun } from './table-cleanup';

const PROJECT_ROOT = resolve(__dirname, '..', '..');
const STALE_OUTPUT_DIRS = ['test-results', 'allure-results', 'allure-report'];

function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid PLAYWRIGHT_BASE_URL: ${url}`, { cause: error });
  }
}

function shouldClearOccupiedTables(): boolean {
  return process.env.UI_CLEAR_TABLES_BEFORE_RUN?.trim().toLowerCase() === 'true';
}

async function globalSetup(_config: FullConfig): Promise<void> {
  for (const dir of STALE_OUTPUT_DIRS) {
    const dirPath = resolve(PROJECT_ROOT, dir);

    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }

  validateUrl(appConfig.baseURL);

  if (shouldClearOccupiedTables()) {
    const clearedOrderCount = await clearOccupiedTablesBeforeRun();
    console.log(`[global setup] Cleared ${clearedOrderCount} occupied table order(s).`);
  }
}

export default globalSetup;

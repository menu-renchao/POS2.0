import type { FullConfig } from '@playwright/test';
import { appConfig } from '../../test-data/env';

function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid PLAYWRIGHT_BASE_URL: ${url}`, { cause: error });
  }
}

async function globalSetup(_config: FullConfig): Promise<void> {
  validateUrl(appConfig.baseURL);
}

export default globalSetup;

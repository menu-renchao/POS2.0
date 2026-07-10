import { defineConfig, devices } from '@playwright/test';
import { appConfig } from './test-data/env';

const posClientHeaders = {
  'x-client-sn': 'mansuper',
  'x-client-type': '0',
};

const desktopChromeChannel = process.env.CI ? {} : { channel: 'chrome' as const };
const videoMode = process.env.PLAYWRIGHT_VIDEO === 'true' ? 'retain-on-failure' : 'off';
const runApiCleanupAfterTests = process.env.API_RUN_CLEANUP_AFTER_TESTS === 'true';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list', { printSteps: process.env.PLAYWRIGHT_LIST_PRINT_STEPS === 'true' }],
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: 'allure-results',
        suiteTitle: false,
      },
    ],
  ],
  globalSetup: require.resolve('./tests/setup/global.setup'),
  use: {
    baseURL: appConfig.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: videoMode,
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'api',
      testMatch: /(?:^|[\\/])api[\\/].*\.spec\.ts$/,
      ...(runApiCleanupAfterTests
        ? {
            testIgnore: /(?:^|[\\/])api[\\/]maintenance[\\/].*\.spec\.ts$/,
            teardown: 'api-cleanup',
          }
        : {}),
    },
    {
      name: 'api-cleanup',
      testMatch: /(?:^|[\\/])api[\\/]maintenance[\\/].*\.spec\.ts$/,
    },
    {
      name: 'py-migrate',
      testMatch: /(?:^|[\\/])py-migrate[\\/].*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        ...desktopChromeChannel,
        extraHTTPHeaders: posClientHeaders,
        viewport: { width: 1920, height: 1080 },
        headless: !!process.env.CI,
      },
    },
  ],
});

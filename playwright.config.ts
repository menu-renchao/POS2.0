import { defineConfig, devices } from '@playwright/test';
import { appConfig } from './test-data/env';

const posClientHeaders = {
  'x-client-sn': 'device001',
  'x-client-type': '0',
};

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
  globalTeardown: require.resolve('./tests/setup/global.teardown'),
  use: {
    baseURL: appConfig.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'chrome',
      testIgnore: /(?:^|[\\/])(?:api|py-migrate)(?:[\\/]|$)/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        extraHTTPHeaders: posClientHeaders,
        viewport: { width: 1920, height: 1080 },
        headless: !!process.env.CI,
      },
    },
    {
      name: 'api',
      testMatch: /(?:^|[\\/])api[\\/].*\.(?:api|unit)\.spec\.ts$/,
      use: {
        viewport: null,
      },
    },
    {
      name: 'py-migrate',
      testMatch: /(?:^|[\\/])py-migrate[\\/].*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        extraHTTPHeaders: posClientHeaders,
        viewport: { width: 1920, height: 1080 },
        headless: !!process.env.CI,
      },
    },
  ],
});

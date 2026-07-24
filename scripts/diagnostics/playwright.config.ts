import { defineConfig, devices } from '@playwright/test';
import { appConfig } from '../../test-data/env';

const desktopChromeChannel = process.env.CI ? {} : { channel: 'chrome' as const };

export default defineConfig({
  testDir: '.',
  testMatch: /report-dom-diagnostic\.ts$/,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list', { printSteps: true }]],
  globalSetup: require.resolve('../../tests/setup/global.setup'),
  use: {
    ...devices['Desktop Chrome'],
    ...desktopChromeChannel,
    baseURL: appConfig.baseURL,
    extraHTTPHeaders: {
      'x-client-sn': 'mansuper',
      'x-client-type': '0',
    },
    headless: false,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'diagnostics',
    },
  ],
});

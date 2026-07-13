import { pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

export const CODEGEN_URL = 'http://192.168.247:22080/kpos/front/myhome.html';

export const CODEGEN_CONTEXT_OPTIONS = Object.freeze({
  extraHTTPHeaders: Object.freeze({
    'x-client-sn': 'mansuper',
    'x-client-type': '0',
  }),
  viewport: Object.freeze({ width: 950, height: 540 }),
});

export async function runCodegen(browserType = chromium) {
  const browser = await browserType.launch({ headless: false });
  let pauseReached = false;

  try {
    const context = await browser.newContext(CODEGEN_CONTEXT_OPTIONS);
    const page = await context.newPage();

    await page.goto(CODEGEN_URL);
    pauseReached = true;
    await page.pause();
  } catch (error) {
    if (!pauseReached || browser.isConnected()) {
      throw error;
    }
  } finally {
    if (browser.isConnected()) {
      await browser.close();
    }
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';

if (import.meta.url === entryUrl) {
  try {
    await runCodegen();
  } catch (error) {
    console.error('Codegen 启动失败：', error);
    process.exitCode = 1;
  }
}

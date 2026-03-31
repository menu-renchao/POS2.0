import { expect, type Page } from '@playwright/test';

export async function expectPathname(page: Page, expectedPath: string): Promise<void> {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `Expected pathname to be ${expectedPath}`,
    })
    .toBe(expectedPath);
}

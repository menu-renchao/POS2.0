import type { FrameLocator, Page } from '@playwright/test';

/** iframe 微前端与宿主页互斥渲染时的统一作用域。 */
export type FrameOrHostScope = {
  appFrame: FrameLocator;
  page: Page;
};

export function createHomeScope(page: Page): FrameOrHostScope {
  return {
    page,
    appFrame: page.frameLocator('#newLoginContainer iframe'),
  };
}

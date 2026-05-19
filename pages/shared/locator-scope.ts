import type { FrameLocator, Locator, Page } from '@playwright/test';
import { waitUntil } from '../../utils/wait';

/** iframe 微前端与宿主页互斥渲染时的统一作用域。 */
export type FrameOrHostScope = {
  appFrame: FrameLocator;
  page: Page;
};

export function createOrderDishesScope(page: Page): FrameOrHostScope {
  return {
    page,
    appFrame: page.frameLocator('iframe[data-wujie-id="orderDishes"]'),
  };
}

export function createHomeScope(page: Page): FrameOrHostScope {
  return {
    page,
    appFrame: page.frameLocator('#newLoginContainer iframe'),
  };
}

/** 在 iframe 与宿主页中查找同一选择器，取首个匹配。 */
export function scopedLocator(scope: FrameOrHostScope, selector: string): Locator {
  return scope.appFrame.locator(selector).or(scope.page.locator(selector)).first();
}

/** 在 iframe 与宿主页中分别构造 locator 后合并，取首个匹配。 */
export function mergeFrameOrHost(
  scope: FrameOrHostScope,
  build: (targets: FrameOrHostScope) => Locator,
): Locator {
  return build({
    appFrame: scope.appFrame,
    page: scope.page,
  });
}

export async function resolveFirstVisibleLocator(
  candidates: Locator[],
  message: string,
  timeout = 5_000,
): Promise<Locator> {
  const resolvedLocator = await waitUntil(
    async () => {
      for (const candidate of candidates) {
        if (await candidate.isVisible().catch(() => false)) {
          return candidate;
        }
      }

      return null;
    },
    (locator): locator is Locator => locator !== null,
    {
      timeout,
      message,
    },
  );

  if (!resolvedLocator) {
    throw new Error(message);
  }

  return resolvedLocator;
}

export async function findFirstVisibleLocator(candidates: Locator[]): Promise<Locator | null> {
  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }

  return null;
}

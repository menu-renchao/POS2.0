import { expect, test, type Locator } from '@playwright/test';
import {
  DEFAULT_INPUT_MINIMUM_SETTLE_MS,
  waitForInputSettled,
} from '../../../utils/input-stability';

test.describe('输入稳定等待工具', () => {
  test('连续两次读取相同值时不得在 200ms 前提前返回', async () => {
    const input = createInputLocator(() => 'stable-value');
    const startedAt = Date.now();

    await waitForInputSettled(input);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(
      DEFAULT_INPUT_MINIMUM_SETTLE_MS - 10,
    );
  });

  test('输入值持续稳定满观察窗口后应返回', async () => {
    const values = ['draft', 'draft', 'final'];
    const input = createInputLocator(() => values.shift() ?? 'final');
    const startedAt = Date.now();

    await waitForInputSettled(input, {
      minimumSettleMs: 0,
      pollIntervalMs: 20,
      stableWindowMs: 80,
      timeout: 500,
    });

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(110);
  });

  test('输入始终无法读取时应报告 Locator 和最后读取状态', async () => {
    const input = createInputLocator(() => {
      throw new Error('detached');
    });

    await expect(
      waitForInputSettled(input, {
        minimumSettleMs: 0,
        pollIntervalMs: 10,
        stableWindowMs: 0,
        timeout: 50,
      }),
    ).rejects.toThrow(
      '输入稳定等待失败：locator=Locator@customer-name，最后读取值=尚未成功读取',
    );
  });

  test('应能读取 iframe 中的输入值', async ({ page }) => {
    await page.setContent(
      '<iframe srcdoc="<input aria-label=&quot;passcode&quot; value=&quot;11&quot;>"></iframe>',
    );
    const input = page.frameLocator('iframe').getByRole('textbox', {
      name: 'passcode',
    });

    await expect(
      waitForInputSettled(input, {
        minimumSettleMs: 0,
        pollIntervalMs: 10,
        stableWindowMs: 20,
        timeout: 200,
      }),
    ).resolves.toBeUndefined();
  });

  test('应能读取数字键盘使用的自定义 textbox 值', async ({ page }) => {
    await page.setContent('<div role="textbox">1.25</div>');

    await expect(
      waitForInputSettled(page.getByRole('textbox'), {
        minimumSettleMs: 0,
        pollIntervalMs: 10,
        stableWindowMs: 20,
        timeout: 200,
      }),
    ).resolves.toBeUndefined();
  });
});

function createInputLocator(readValue: () => string): Locator {
  return {
    evaluate: async () => readValue(),
    toString: () => 'Locator@customer-name',
  } as unknown as Locator;
}

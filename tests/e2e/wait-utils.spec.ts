import { expect, test } from '@playwright/test';
import { waitUntil } from '../../utils/wait';

test.describe('无噪音轮询工具契约', () => {
  test('应能在条件满足前持续重试并返回最终值', async () => {
    let attempt = 0;

    const result = await waitUntil(
      async () => {
        attempt += 1;
        return attempt;
      },
      (value) => value >= 3,
      {
        timeout: 1_000,
        interval: 10,
        message: 'waitUntil did not retry until the condition was satisfied.',
      },
    );

    expect(result).toBe(3);
    expect(attempt).toBe(3);
  });

  test('应能在超时时抛出包含最后值的错误', async () => {
    await expect(async () => {
      await waitUntil(
        async () => 1,
        () => false,
        {
          timeout: 30,
          interval: 10,
          message: 'Timed out while waiting for a condition.',
        },
      );
    }).rejects.toThrow(/Timed out while waiting for a condition\..*Last value: 1/);
  });
});

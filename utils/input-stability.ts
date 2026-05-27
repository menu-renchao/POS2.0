import type { Locator } from '@playwright/test';
import { waitUntil } from './wait';

export const DEFAULT_INPUT_STABILIZATION_TIMEOUT = 400;
const VALUE_POLL_INTERVAL = 50;

/**
 * 等待输入状态稳定后再执行后续提交操作。
 *
 * 当提供 inputLocator 时：轮询检测输入值是否连续两次读取一致（值已稳定）。
 * 当未提供 inputLocator 时：回退到最小防抖延迟。
 */
export async function waitForInputSettled(
  inputLocator?: Locator,
  timeout: number = DEFAULT_INPUT_STABILIZATION_TIMEOUT,
): Promise<void> {
  if (inputLocator) {
    await waitForValueStability(inputLocator, timeout);
    return;
  }

  await debounceDelay(timeout);
}

async function waitForValueStability(
  inputLocator: Locator,
  timeout: number,
): Promise<void> {
  await waitUntil(
    async () => {
      const first = await readInputValue(inputLocator);
      await debounceDelay(VALUE_POLL_INTERVAL);
      const second = await readInputValue(inputLocator);
      return { first, second };
    },
    ({ first, second }) => first !== null && second !== null && first === second,
    {
      timeout,
      interval: VALUE_POLL_INTERVAL,
      message: '输入值未在超时内稳定。',
    },
  ).catch(() => {
    // 值稳定性检测超时不应阻断后续操作，
    // 回退行为等同于原始的固定延迟方案。
  });
}

async function readInputValue(inputLocator: Locator): Promise<string | null> {
  return inputLocator
    .evaluate((element) => (element as HTMLInputElement).value)
    .catch(() => null);
}

async function debounceDelay(timeout: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, timeout);
  });
}

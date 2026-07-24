import type { Locator } from '@playwright/test';
import { waitUntil } from './wait';

export const DEFAULT_INPUT_STABILIZATION_TIMEOUT = 1_000;
export const DEFAULT_INPUT_MINIMUM_SETTLE_MS = 200;
export const DEFAULT_INPUT_STABLE_WINDOW_MS = 200;
const DEFAULT_INPUT_POLL_INTERVAL_MS = 50;

export type InputStabilityOptions = {
  minimumSettleMs?: number;
  pollIntervalMs?: number;
  stableWindowMs?: number;
  timeout?: number;
};

type InputStabilityState = {
  elapsedMs: number;
  stableForMs: number;
  value: string;
};

/**
 * 等待输入值满足提交前稳定契约。
 *
 * 返回前必须同时满足：
 * - 输入值可读取；
 * - 输入值在 stableWindowMs 内没有变化；
 * - 从本次等待开始至少经过 minimumSettleMs。
 */
export async function waitForInputSettled(
  inputLocator: Locator,
  options: InputStabilityOptions = {},
): Promise<void> {
  const minimumSettleMs =
    options.minimumSettleMs ?? DEFAULT_INPUT_MINIMUM_SETTLE_MS;
  const stableWindowMs =
    options.stableWindowMs ?? DEFAULT_INPUT_STABLE_WINDOW_MS;
  const pollIntervalMs =
    options.pollIntervalMs ?? DEFAULT_INPUT_POLL_INTERVAL_MS;
  const timeout = options.timeout ?? DEFAULT_INPUT_STABILIZATION_TIMEOUT;

  assertNonNegativeDuration('minimumSettleMs', minimumSettleMs);
  assertNonNegativeDuration('stableWindowMs', stableWindowMs);
  assertPositiveDuration('pollIntervalMs', pollIntervalMs);
  assertPositiveDuration('timeout', timeout);

  const startedAt = Date.now();
  let lastValue: string | undefined;
  let lastValueChangedAt = startedAt;
  let lastState: InputStabilityState | undefined;

  try {
    await waitUntil(
      async () => {
        const value = await readInputValue(inputLocator);
        const observedAt = Date.now();

        if (lastValue === undefined || value !== lastValue) {
          lastValue = value;
          lastValueChangedAt = observedAt;
        }

        lastState = {
          elapsedMs: observedAt - startedAt,
          stableForMs: observedAt - lastValueChangedAt,
          value,
        };

        return lastState;
      },
      (state) =>
        state.elapsedMs >= minimumSettleMs &&
        state.stableForMs >= stableWindowMs,
      {
        timeout,
        interval: pollIntervalMs,
        message: `输入值未在 ${timeout}ms 内满足稳定契约。`,
      },
    );
  } catch (error) {
    const locatorDescription = inputLocator.toString();
    const lastValueDescription =
      lastState === undefined ? '尚未成功读取' : JSON.stringify(lastState.value);
    const causeMessage = error instanceof Error ? error.message : String(error);

    throw new Error(
      `输入稳定等待失败：locator=${locatorDescription}，最后读取值=${lastValueDescription}。${causeMessage}`,
      { cause: error },
    );
  }
}

async function readInputValue(inputLocator: Locator): Promise<string> {
  return await inputLocator.evaluate((element) => {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)
        .value;
    }

    if (
      element.getAttribute('contenteditable') === 'true' ||
      (element as HTMLElement).isContentEditable
    ) {
      return element.textContent ?? '';
    }

    if (element.getAttribute('role') === 'textbox') {
      return element.textContent ?? '';
    }

    throw new Error(`目标元素不是可读取的输入控件：${tagName}`);
  });
}

function assertNonNegativeDuration(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} 必须是大于等于 0 的有限数字，实际为 ${value}。`);
  }
}

function assertPositiveDuration(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} 必须是大于 0 的有限数字，实际为 ${value}。`);
  }
}

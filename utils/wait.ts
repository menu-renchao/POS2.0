export type WaitUntilOptions = {
  timeout?: number;
  interval?: number;
  message?: string;
};

export async function waitUntil<T>(
  probe: () => Promise<T> | T,
  predicate: (value: T) => boolean,
  options: WaitUntilOptions = {},
): Promise<T> {
  const {
    timeout = 5_000,
    interval = 100,
    message = 'Condition was not satisfied within the timeout.',
  } = options;
  const startedAt = Date.now();

  let lastValue: T | undefined;

  while (Date.now() - startedAt <= timeout) {
    lastValue = await probe();

    if (predicate(lastValue)) {
      return lastValue;
    }

    await delay(interval);
  }

  const lastValueText =
    lastValue === undefined ? 'undefined' : safeStringify(lastValue);

  throw new Error(`${message} Last value: ${lastValueText}`);
}

function delay(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

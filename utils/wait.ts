export type WaitUntilOptions = {
  timeout?: number;
  interval?: number;
  message?: string;
  probeTimeout?: number;
};

export async function waitUntil<T>(
  probe: () => Promise<T> | T,
  predicate: (value: T) => boolean,
  options: WaitUntilOptions = {},
): Promise<T> {
  const {
    timeout = 5_000,
    interval = 100,
    probeTimeout,
    message = 'Condition was not satisfied within the timeout.',
  } = options;
  const startedAt = Date.now();

  let lastValue: T | undefined;

  while (Date.now() - startedAt <= timeout) {
    const remainingTimeout = timeout - (Date.now() - startedAt);
    const currentProbeTimeout = Math.max(
      1,
      Math.min(probeTimeout ?? remainingTimeout, remainingTimeout),
    );

    lastValue = await runWithTimeout(
      probe,
      currentProbeTimeout,
      `${message} Probe did not settle within ${currentProbeTimeout}ms.`,
    );

    if (predicate(lastValue)) {
      return lastValue;
    }

    await delay(interval);
  }

  const lastValueText =
    lastValue === undefined ? 'undefined' : safeStringify(lastValue);

  throw new Error(`${message} Last value: ${lastValueText}`);
}

async function runWithTimeout<T>(
  probe: () => Promise<T> | T,
  timeout: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve().then(probe),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeout);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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

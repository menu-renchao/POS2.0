export const DEFAULT_INPUT_STABILIZATION_TIMEOUT = 200;

export async function waitForInputSettled(
  timeout: number = DEFAULT_INPUT_STABILIZATION_TIMEOUT,
): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, timeout);
  });
}

import { test } from '@playwright/test';

export function annotateKnownProductFailure(
  reason: string | undefined,
): void {
  if (!reason) {
    return;
  }

  test.info().annotations.push({
    type: '已知产品问题',
    description: reason,
  });
}

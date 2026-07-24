import type { Page } from '@playwright/test';
import { waitUntil } from '../../utils/wait';

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function readVisiblePosAlertText(
  page: Page,
  timeout = 10_000,
): Promise<string> {
  const alertDialog = page.getByRole('alertdialog').last();

  return await waitUntil(
    async () => {
      if (!(await alertDialog.isVisible().catch(() => false))) {
        return '';
      }

      return normalizeText(await alertDialog.innerText());
    },
    (message) => message.length > 0,
    {
      timeout,
      message: 'POS 页面未在限定时间内显示可读取的告警弹窗。',
    },
  );
}

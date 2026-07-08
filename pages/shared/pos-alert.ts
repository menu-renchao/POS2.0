import { type Locator, type Page } from '@playwright/test';
import { waitUntil } from '../../utils/wait';

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readFirstVisibleText(candidates: Locator[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }

    const text = normalizeText(await candidate.innerText().catch(() => ''));
    if (text) {
      return text;
    }
  }

  return null;
}

export async function readVisiblePosAlertText(page: Page, timeout = 10_000): Promise<string> {
  const candidates = [
    page.getByRole('alertdialog').last(),
    page.getByRole('alert').last(),
    page.locator('[role="dialog"]:visible').last(),
    page.locator('#floatmsgbx:visible, #responsePopuWin:visible').last(),
    page.locator('.ant-message-notice:visible, .ant-modal:visible, .swal2-popup:visible').last(),
  ];

  const text = await waitUntil(
    async () => await readFirstVisibleText(candidates),
    (message): message is string => Boolean(message),
    {
      timeout,
      message: 'POS 页面未在预期时间内展示可读取的提示信息。',
    },
  );

  if (text === null) {
    throw new Error('POS 页面未在预期时间内展示可读取的提示信息。');
  }

  return text;
}

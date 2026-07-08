import { type Locator, type Page } from '@playwright/test';
import { waitUntil } from '../../utils/wait';

const PROMPT_BUTTON_TEXT = /^(Confirm|Cancel|Yes|No)$/i;

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

async function readDialogBodyText(dialog: Locator): Promise<string | null> {
  return await readFirstVisibleText([
    dialog.locator('[role="document"]'),
    dialog.locator('[role="status"]'),
    dialog.locator('[role="alert"]'),
    dialog.locator('.ant-modal-content'),
    dialog.locator('.ant-modal-body'),
    dialog.locator('.swal2-title'),
    dialog.locator('.swal2-html-container'),
    dialog.locator('.swal2-content'),
    dialog.locator('.ant-message-notice-content'),
  ]);
}

async function readLastVisibleRoleDialogText(dialogs: Locator): Promise<string | null> {
  const count = await dialogs.count().catch(() => 0);

  for (let index = count - 1; index >= 0; index -= 1) {
    const dialog = dialogs.nth(index);

    if (!(await dialog.isVisible().catch(() => false))) {
      continue;
    }

    const dialogText = await readDialogBodyText(dialog);
    if (dialogText) {
      return dialogText;
    }
  }

  return null;
}

async function readLastVisibleConfirmDialogText(dialogs: Locator): Promise<string | null> {
  const count = await dialogs.count().catch(() => 0);

  for (let index = count - 1; index >= 0; index -= 1) {
    const dialog = dialogs.nth(index);

    if (!(await dialog.isVisible().catch(() => false))) {
      continue;
    }

    const hasPromptButton = await dialog
      .getByRole('button', { name: PROMPT_BUTTON_TEXT })
      .isVisible()
      .catch(() => false);

    if (!hasPromptButton) {
      continue;
    }

    const dialogText = await readDialogBodyText(dialog);
    if (dialogText) {
      return dialogText;
    }
  }

  return null;
}

export async function readVisiblePosAlertText(page: Page, timeout = 10_000): Promise<string> {
  const knownPosPromptDialog = page.locator('[role="dialog"][data-testid="pos-ui-modal"]:visible');
  const antModalDialog = page.locator('.ant-modal[data-testid="pos-ui-modal"]:visible');
  const sweetAlertDialog = page.locator('.swal2-popup:visible');
  const knownPosHintContainers = [
    page.locator('.ant-message-notice:visible .ant-message-notice-content:visible').last(),
    page.locator('#floatmsgbx:visible').last(),
    page.locator('#responsePopuWin:visible').last(),
    page.locator('.swal2-popup:visible .swal2-title:visible').last(),
    page.locator('.swal2-popup:visible .swal2-content:visible').last(),
  ];

  const text = await waitUntil(
    async () => {
      const fromAlertDialog = await readLastVisibleRoleDialogText(page.getByRole('alertdialog'));
      if (fromAlertDialog) {
        return fromAlertDialog;
      }

      const fromAlert = await readFirstVisibleText([page.getByRole('alert').last()]);
      if (fromAlert) {
        return fromAlert;
      }

      const fromPosUiPromptDialog = await readLastVisibleConfirmDialogText(knownPosPromptDialog);
      if (fromPosUiPromptDialog) {
        return fromPosUiPromptDialog;
      }

      const fromAntModalPrompt = await readLastVisibleConfirmDialogText(antModalDialog);
      if (fromAntModalPrompt) {
        return fromAntModalPrompt;
      }

      const fromSweetAlertDialog = await readLastVisibleConfirmDialogText(sweetAlertDialog);
      if (fromSweetAlertDialog) {
        return fromSweetAlertDialog;
      }

      return await readFirstVisibleText(knownPosHintContainers);
    },
    (message): message is string => Boolean(message),
    {
      timeout,
      message: 'POS page did not show readable alert text within timeout.',
    },
  );

  if (text === null) {
    throw new Error('POS page did not show readable alert text within timeout.');
  }

  return text;
}

import { expect, type Locator, type Page } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';

export type TipInputDialogMode = 'standard' | 'payment-record';

const BIG_TIP_CONFIRMATION_MESSAGE =
  'The tip is more than 50% of the meal. Confirm to add?';

export class TipInputDialog {
  private readonly bigTipConfirmDialog: Locator;
  private readonly confirmButton: Locator;
  private readonly dialog: Locator;
  private readonly input: Locator;
  private readonly keyboardConfirmButton: Locator;

  constructor(
    private readonly page: Page,
    private readonly mode: TipInputDialogMode,
  ) {
    this.dialog =
      mode === 'payment-record'
        ? page.getByRole('dialog', { name: /^.+ Tips$/ })
        : page.getByRole('dialog', { name: 'Tips', exact: true });
    this.input = this.dialog.getByRole('textbox');
    this.confirmButton = this.dialog.getByRole('button', {
      name: 'Confirm',
      exact: true,
    });
    this.keyboardConfirmButton = page.locator(
      '[data-testid="pos-keyboard-confirm"]:visible',
    );
    this.bigTipConfirmDialog = page
      .getByRole('alertdialog', { name: 'Tips', exact: true })
      .filter({ hasText: BIG_TIP_CONFIRMATION_MESSAGE });
  }

  @step('页面校验：小费输入弹窗已显示')
  async expectVisible(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 10_000 });
    await expect(this.input).toBeVisible({ timeout: 5_000 });
  }

  @step((amountInCents: number) =>
    `页面操作：在小费输入弹窗中输入 ${amountInCents} 分`,
  )
  async fillAmount(amountInCents: number): Promise<void> {
    await this.expectVisible();
    const digits = formatTipInputDigits(amountInCents);

    if (this.mode === 'payment-record') {
      const clearButton = this.dialog.getByRole('button', {
        name: '清除',
        exact: true,
      });
      await expect(clearButton).toBeVisible({ timeout: 5_000 });
      await clearButton.click();
      await this.enterByKeypad(digits);
    } else {
      await this.dialog.getByRole('button', {
        name: 'C',
        exact: true,
      }).click();
      for (const digit of digits) {
        await this.dialog.getByRole('button', {
          name: digit,
          exact: true,
        }).click();
      }
    }

    await waitForInputSettled(this.input);
  }

  @step('页面操作：确认小费输入弹窗')
  async confirm(): Promise<void> {
    await this.expectVisible();
    await waitForInputSettled(this.input);

    if (this.mode === 'payment-record') {
      await expect(this.keyboardConfirmButton).toBeVisible({
        timeout: 5_000,
      });
      await this.keyboardConfirmButton.click();
    }

    await expect(this.confirmButton).toBeVisible({ timeout: 5_000 });
    await this.confirmButton.click();
  }

  @step('页面读取：检查大额小费提示是否显示')
  async isBigTipConfirmationVisible(): Promise<boolean> {
    return await this.bigTipConfirmDialog.isVisible().catch(() => false);
  }

  @step('页面操作：确认大额小费提示')
  async confirmBigTip(): Promise<string> {
    await expect(this.bigTipConfirmDialog).toBeVisible({
      timeout: 10_000,
    });
    const message =
      (
        await this.bigTipConfirmDialog
          .getByText(BIG_TIP_CONFIRMATION_MESSAGE, { exact: true })
          .first()
          .textContent()
      )
        ?.replace(/\s+/g, ' ')
        .trim() || BIG_TIP_CONFIRMATION_MESSAGE;
    await this.bigTipConfirmDialog
      .getByRole('button', { name: /^Yes$/i })
      .click();
    return message;
  }

  @step('页面操作：通过数字键盘输入小费')
  private async enterByKeypad(digits: string): Promise<void> {
    for (const digit of digits) {
      const digitButton = this.page.getByTestId(
        `pos-keyboard-button-${digit}`,
      );
      await expect(digitButton).toBeVisible({ timeout: 5_000 });
      await digitButton.click({ timeout: 2_000 });
    }
  }
}

function formatTipInputDigits(amountInCents: number): string {
  if (!Number.isFinite(amountInCents) || amountInCents < 0) {
    throw new Error(`Invalid tip amount in cents: ${amountInCents}`);
  }
  return String(Math.round(amountInCents));
}

import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import type { PaymentPageContext } from './payment-page-context';

export class PaymentTipDialog {
  private readonly openButton: Locator;
  private readonly confirmButton: Locator;
  private readonly input: Locator;
  private readonly suggestionButtons: Locator;
  private readonly currencyKey: (key: string) => Locator;

  constructor(private readonly ctx: PaymentPageContext) {
    this.openButton = ctx.frame.getByTestId('payment-panel-action-tips');
    this.confirmButton = ctx.frame.getByTestId(
      'preset-numeric-input-modal-confirm-button',
    );
    const dialog = ctx.frame.getByRole('dialog').filter({
      has: this.confirmButton,
    });
    this.input = dialog.locator('input').first();
    this.suggestionButtons = dialog.getByRole('button', {
      name: /^\d+(?:\.\d+)?%$/,
    });
    this.currencyKey = (key: string) =>
      ctx.frame.getByTestId(
        key === '00'
          ? 'preset-currency-keypad-input-double-zero'
          : `preset-currency-keypad-input-number-${key}`,
      );
  }

  @step((amountInCents: number) => `页面操作：在 Payment 页添加小费 ${amountInCents} 分`)
  async add(amountInCents: number): Promise<void> {
    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      throw new Error(`Invalid tip amount in cents: ${amountInCents}`);
    }

    await this.openButton.click();
    const amountDigits = String(amountInCents);
    const wholeDigits = amountDigits.endsWith('00')
      ? amountDigits.slice(0, -2)
      : amountDigits;
    for (const digit of wholeDigits) {
      await this.currencyKey(digit).click();
    }
    if (amountDigits.endsWith('00')) {
      await this.currencyKey('00').click();
    }

    await waitForInputSettled(this.input);
    await this.confirmButton.click();
    await expect(this.confirmButton).toBeHidden();
  }

  @step('页面读取：打开 Tips 并读取建议小费百分比列表')
  async readSuggestedPercentages(): Promise<number[]> {
    await this.openButton.click();
    await expect(this.suggestionButtons.first()).toBeVisible({ timeout: 5_000 });
    const labels = await this.suggestionButtons.allTextContents();

    return labels.map((label) => {
      const percentage = Number(label.replace('%', '').trim());
      if (!Number.isFinite(percentage)) {
        throw new Error(`无法解析建议小费百分比：${label}`);
      }
      return percentage;
    });
  }
}

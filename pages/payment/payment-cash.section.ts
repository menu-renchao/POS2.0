import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import type { PaymentPageContext } from './payment-page-context';

export class PaymentCashSection {
  private readonly paymentTypeCashButton: Locator;
  private readonly amountDisplay: Locator;
  private readonly keypadButton: (digit: string) => Locator;
  private lastEditedInput: Locator | null = null;

  constructor(private readonly ctx: PaymentPageContext) {
    this.paymentTypeCashButton = ctx.frame.getByRole('button', { name: /\bCash$/ });
    this.amountDisplay = ctx.frame.getByRole('textbox');
    this.keypadButton = (digit: string) =>
      ctx.frame.getByRole('button', {
        name: digit === 'backspace' ? /Backspace/ : digit,
        exact: digit !== 'backspace',
      });
  }

  @step((amountInCents: number) => `页面操作：输入本次现金支付金额 ${amountInCents} 分`)
  async fillAmountTendered(amountInCents: number): Promise<void> {
    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      throw new Error(`Invalid payment amount in cents: ${amountInCents}`);
    }

    await this.amountDisplay.click();
    const currentValue = await this.amountDisplay.inputValue().catch(() => '');
    for (let index = 0; index < currentValue.replace(/\D/g, '').length + 4; index += 1) {
      await this.keypadButton('backspace').click();
    }

    const amountDigits = String(amountInCents);
    const wholeDigits = amountDigits.endsWith('00')
      ? amountDigits.slice(0, -2)
      : amountDigits;
    for (const digit of wholeDigits) {
      await this.keypadButton(digit).click();
    }
    if (amountDigits.endsWith('00')) {
      await this.keypadButton('00').click();
    }

    await waitForInputSettled(this.amountDisplay);
    this.lastEditedInput = this.amountDisplay;
  }

  @step('页面操作：在 Payment type 区域点击 Cash')
  async clickPaymentTypeCash(): Promise<void> {
    await this.waitForOverlayToClear();
    if (this.lastEditedInput) {
      await waitForInputSettled(this.lastEditedInput);
    }
    await expect(this.paymentTypeCashButton).toBeEnabled({ timeout: 5_000 });
    await this.paymentTypeCashButton.click({ timeout: 10_000 });
    this.lastEditedInput = null;
  }

  private async waitForOverlayToClear(): Promise<void> {
    await waitUntil(
      async () => await this.ctx.loadingOverlay.isVisible().catch(() => false),
      (visible) => !visible,
      {
        timeout: 15_000,
        message: '支付加载遮罩未在超时内消失。',
      },
    );
  }
}

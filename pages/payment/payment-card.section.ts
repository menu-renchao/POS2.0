import { expect, type Locator } from '@playwright/test';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import type { PaymentPageContext } from './payment-page-context';

export class PaymentCardSection {
  private readonly creditCardButton: Locator;

  constructor(private readonly ctx: PaymentPageContext) {
    this.creditCardButton = ctx.frame.getByTestId(
      'payment-panel-btn-credit-card',
    );
  }

  @step('页面操作：在 Payment type 区域点击 Credit Card')
  async clickCreditCard(): Promise<void> {
    await this.waitForOverlayToClear();
    await expect(this.creditCardButton).toBeVisible({ timeout: 5_000 });
    await expect(this.creditCardButton).toBeEnabled({ timeout: 5_000 });
    await this.creditCardButton.click({ timeout: 10_000 });
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

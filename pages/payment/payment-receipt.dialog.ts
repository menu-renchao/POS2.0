import { expect, type Locator } from '@playwright/test';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import type { PaymentPageContext } from './payment-page-context';

export class PaymentReceiptDialog {
  private readonly dialog: Locator;
  private readonly cancelButton: Locator;
  private readonly confirmButton: Locator;

  constructor(private readonly ctx: PaymentPageContext) {
    this.dialog = ctx.page.locator('#print-customer-dialog');
    this.cancelButton = this.dialog.locator('#print-customer-cancel');
    this.confirmButton = this.dialog.locator('#print-customer-submit');
  }

  @step('页面操作：按参数处理是否打印小票弹窗')
  async choose(printReceipt: boolean): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 15_000 });
    const targetButton = printReceipt ? this.confirmButton : this.cancelButton;
    await expect(targetButton).toBeVisible({ timeout: 15_000 });
    await targetButton.click();
    await expect(this.dialog).toBeHidden({ timeout: 15_000 });
  }

  @step('页面操作：如有打印小票弹窗则关闭，避免污染后续状态')
  async dismissIfVisible(): Promise<void> {
    if (!(await this.isVisible())) {
      return;
    }
    await this.cancelButton.click();
    await expect(this.dialog).toBeHidden({ timeout: 5_000 });
  }

  @step('页面读取：确认当前是否显示打印小票弹窗')
  async isVisible(): Promise<boolean> {
    return await this.dialog.isVisible().catch(() => false);
  }

  @step((expectedButtonText = 'NO RECEIPT') =>
    `页面操作：如支付成功页仍显示，则点击 ${expectedButtonText} 关闭`,
  )
  async confirmSuccessIfVisible(expectedButtonText = 'NO RECEIPT'): Promise<void> {
    if (!(await this.isSuccessConfirmVisible())) {
      return;
    }

    const buttonText = (await this.ctx.successConfirmButton.innerText())
      .replace(/\s+/g, ' ')
      .trim();
    if (buttonText.toUpperCase() !== expectedButtonText.toUpperCase()) {
      throw new Error(
        `支付成功页关闭按钮文案应为 ${expectedButtonText}，实际为：${buttonText}`,
      );
    }

    await this.ctx.successConfirmButton.click();
    await waitUntil(
      async () => await this.isSuccessConfirmVisible(),
      (visible) => !visible,
      {
        timeout: 5_000,
        message: `点击 ${expectedButtonText} 后支付成功页未在超时内关闭。`,
      },
    );
  }

  async isSuccessConfirmVisible(): Promise<boolean> {
    return await this.ctx.successConfirmButton.isVisible().catch(() => false);
  }
}

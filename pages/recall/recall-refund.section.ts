import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import type { OrderDetailsContext } from '../shared/order-details/order-details-context';

export class RecallRefundSection {
  private readonly amountRefundDialog: Locator;
  private readonly globalLoadingOverlay: Locator;
  private readonly itemRefundConfirmationDialog: Locator;
  private readonly itemRefundConfirmButton: Locator;
  private readonly refundByItemMenuItem: Locator;

  constructor(
    private readonly page: Page,
    private readonly ctx: OrderDetailsContext,
  ) {
    this.refundByItemMenuItem = page.getByRole('menuitem', {
      name: 'Refund by Item',
      exact: true,
    });
    this.amountRefundDialog = page
      .getByTestId('pos-ui-modal')
      .filter({
        has: page.getByRole('heading', { name: 'Refund', exact: true }),
      });
    this.itemRefundConfirmationDialog = page.getByRole('dialog', {
      name: 'Refund By Item(s)',
      exact: true,
    });
    this.itemRefundConfirmButton =
      this.itemRefundConfirmationDialog.getByRole('button', {
        name: 'Confirm Refund',
        exact: true,
      });
    this.globalLoadingOverlay = page.locator('#floatmsgbx');
  }

  @step((paymentIndex: number) =>
    `页面操作：对 Recall 订单详情第 ${paymentIndex + 1} 笔支付流水发起退款`,
  )
  async refundPaymentRecord(paymentIndex: number): Promise<void> {
    await this.expectReady();
    await this.clickPaymentSectionRefundButton(paymentIndex);
    await this.confirmPaymentRefundDialog();
    await this.waitForGlobalLoadingOverlayHidden();
  }

  @step((paymentIndex: number) =>
    `页面操作：对 Recall 订单详情第 ${paymentIndex + 1} 笔支付流水执行作废`,
  )
  async voidPaymentRecord(paymentIndex: number): Promise<void> {
    await this.expectReady();
    await this.closePosKeyboardIfVisible();
    const voidButton = this.ctx.paymentSection
      .getByRole('button', { name: 'Void', exact: true })
      .nth(paymentIndex);
    await expect(voidButton).toBeVisible({ timeout: 10_000 });
    await voidButton.scrollIntoViewIfNeeded();
    await voidButton.click();

    const confirmationDialog = this.page.getByRole('alertdialog', {
      name: /^Void$/i,
    });
    await expect(confirmationDialog).toBeVisible({ timeout: 10_000 });
    await confirmationDialog.getByRole('button', { name: /^Yes$/i }).click();
    await expect(confirmationDialog).toBeHidden({ timeout: 10_000 });
    await this.waitForGlobalLoadingOverlayHidden();
  }

  @step((paymentIndex: number, dishName: string) =>
    `页面操作：从 Recall 第 ${paymentIndex + 1} 笔支付流水按菜退款 ${dishName}`,
  )
  async refundOrderItem(
    paymentIndex: number,
    dishName: string,
  ): Promise<void> {
    await this.expectReady();
    await this.clickPaymentSectionRefundButton(paymentIndex);

    await expect(this.refundByItemMenuItem).toBeVisible({ timeout: 5_000 });
    await this.refundByItemMenuItem.click();

    const refundDialog = this.itemRefundDialog(dishName);
    await expect(refundDialog).toBeVisible({ timeout: 10_000 });
    await refundDialog.getByText(dishName, { exact: true }).click();
    await refundDialog.getByTestId('modal-confirm-button').click();
    await expect(refundDialog).toBeHidden({ timeout: 10_000 });

    await expect(this.itemRefundConfirmButton).toBeVisible({
      timeout: 10_000,
    });
    await this.closePosKeyboardIfVisible();
    await this.itemRefundConfirmButton.click();
    await expect(this.itemRefundConfirmationDialog).toBeHidden({
      timeout: 10_000,
    });
    await this.waitForGlobalLoadingOverlayHidden();
  }

  @step((paymentIndex: number) =>
    `页面断言：Recall 第 ${paymentIndex + 1} 笔支付流水不提供按菜退款`,
  )
  async expectOrderItemRefundUnavailable(paymentIndex: number): Promise<void> {
    await this.expectReady();
    await this.clickPaymentSectionRefundButton(paymentIndex);

    await waitUntil(
      async () => ({
        amountDialogVisible: await this.amountRefundDialog
          .isVisible()
          .catch(() => false),
        amountMenuVisible: await this.refundByAmountMenuItem()
          .isVisible()
          .catch(() => false),
      }),
      (state) => state.amountDialogVisible || state.amountMenuVisible,
      {
        timeout: 5_000,
        interval: 100,
        message: '点击退款后未显示按金额退款入口或退款弹窗。',
      },
    );
    await expect(this.refundByItemMenuItem).toBeHidden();
    await this.page.keyboard.press('Escape');
  }

  private async expectReady(): Promise<void> {
    await expect(this.ctx.dialog).toBeVisible({ timeout: 10_000 });
    await expect(this.ctx.paymentSection).toBeVisible({ timeout: 10_000 });
  }

  private async clickPaymentSectionRefundButton(
    paymentIndex: number,
  ): Promise<void> {
    await this.closePosKeyboardIfVisible();
    const refundButton = this.ctx.paymentSection
      .getByRole('button', { name: 'Refund', exact: true })
      .nth(paymentIndex);
    await expect(refundButton).toBeVisible({ timeout: 10_000 });
    await refundButton.scrollIntoViewIfNeeded();
    await refundButton.click({ timeout: 10_000 });
  }

  private async confirmPaymentRefundDialog(): Promise<void> {
    await this.selectAmountRefundModeIfVisible();
    const confirmButton =
      this.amountRefundDialog.getByTestId('modal-confirm-button');
    await expect(this.amountRefundDialog).toBeVisible({ timeout: 10_000 });
    await expect(confirmButton).toBeVisible({ timeout: 10_000 });
    await this.closePosKeyboardIfVisible();
    await confirmButton.click();
    await expect(this.amountRefundDialog).toBeHidden({ timeout: 10_000 });
  }

  private async selectAmountRefundModeIfVisible(): Promise<void> {
    const refundByAmountOption = this.refundByAmountMenuItem();
    const visible = await refundByAmountOption
      .isVisible()
      .catch(() => false);
    if (!visible) {
      return;
    }
    await refundByAmountOption.click({ timeout: 10_000 });
    await expect(refundByAmountOption).toBeHidden({ timeout: 5_000 });
  }

  private refundByAmountMenuItem(): Locator {
    return this.page
      .getByRole('menuitem', { name: 'Refund by Amount', exact: true })
      .first();
  }

  private itemRefundDialog(dishName: string): Locator {
    return this.page
      .getByTestId('pos-ui-modal')
      .filter({ has: this.page.getByText(dishName, { exact: true }) })
      .filter({ has: this.page.getByTestId('modal-confirm-button') });
  }

  private async closePosKeyboardIfVisible(): Promise<void> {
    const keyboardCloseButton = this.page
      .getByTestId('pos-keyboard-button-{close}')
      .last();
    if (!(await keyboardCloseButton.isVisible().catch(() => false))) {
      return;
    }
    await keyboardCloseButton.click();
  }

  private async waitForGlobalLoadingOverlayHidden(): Promise<void> {
    if (!(await this.globalLoadingOverlay.isVisible().catch(() => false))) {
      return;
    }
    await waitUntil(
      async () =>
        !(await this.globalLoadingOverlay.isVisible().catch(() => false)),
      (hidden) => hidden,
      {
        timeout: 15_000,
        message: 'Recall 全局 Loading 遮罩未在预期时间内消失。',
      },
    );
  }
}

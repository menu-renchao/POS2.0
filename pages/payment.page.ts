import { expect, type Page } from '@playwright/test';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { PaymentCardSection } from './payment/payment-card.section';
import { PaymentCashSection } from './payment/payment-cash.section';
import { PaymentPageContext } from './payment/payment-page-context';
import { PaymentReceiptDialog } from './payment/payment-receipt.dialog';
import { PaymentSummarySection } from './payment/payment-summary.section';
import { PaymentTipDialog } from './payment/payment-tip.dialog';

export type PaymentSummaryRow = {
  label: string;
  value: string | null;
};

export type PaymentSummarySnapshot = {
  rows: PaymentSummaryRow[];
  text: string;
};

/**
 * Payment 页面门面只负责页面加载、跨 section 状态与向后兼容的窄委托。
 * 具体现金、卡、Tips、小票及汇总实现分别由对应能力组件持有。
 */
export class PaymentPage {
  readonly cash: PaymentCashSection;
  readonly card: PaymentCardSection;
  readonly tips: PaymentTipDialog;
  readonly receipt: PaymentReceiptDialog;
  readonly summary: PaymentSummarySection;
  private readonly ctx: PaymentPageContext;

  constructor(page: Page) {
    this.ctx = new PaymentPageContext(page);
    this.cash = new PaymentCashSection(this.ctx);
    this.card = new PaymentCardSection(this.ctx);
    this.tips = new PaymentTipDialog(this.ctx);
    this.receipt = new PaymentReceiptDialog(this.ctx);
    this.summary = new PaymentSummarySection(this.ctx);
  }

  @step('页面操作：确认支付页面已经加载完成')
  async expectLoaded(): Promise<void> {
    await expect(this.ctx.frameElement).toBeVisible({ timeout: 15_000 });
    await expect(this.ctx.surface).toBeVisible({ timeout: 15_000 });
    await expect(this.ctx.balanceDueControl).toBeVisible({ timeout: 15_000 });
    await expect(this.ctx.paymentTypeControl).toBeVisible({ timeout: 15_000 });
  }

  @step('页面操作：在 Payment type 区域点击 Cash')
  async clickPaymentTypeCash(): Promise<void> {
    if (
      (await this.isPaymentSuccessConfirmVisible()) ||
      (await this.isPrintReceiptDialogVisible()) ||
      !(await this.isPaymentPanelVisible())
    ) {
      return;
    }
    this.throwIfPaymentFailed(await this.readPaymentFailureText());
    await this.cash.clickPaymentTypeCash();
  }

  @step((amountInCents: number) => `页面操作：输入本次现金支付金额 ${amountInCents} 分`)
  async fillAmountTendered(amountInCents: number): Promise<void> {
    await this.cash.fillAmountTendered(amountInCents);
  }

  @step((amountInCents: number) => `页面操作：在 Payment 页添加小费 ${amountInCents} 分`)
  async addTip(amountInCents: number): Promise<void> {
    await this.tips.add(amountInCents);
  }

  @step('页面读取：打开 Tips 并读取建议小费百分比列表')
  async readSuggestedTipPercentages(): Promise<number[]> {
    await this.expectLoaded();
    return await this.tips.readSuggestedPercentages();
  }

  @step((text: string) => `页面断言：Payment 支付流程展示 ${text}`)
  async expectPaymentFlowText(text: string): Promise<void> {
    await expect(this.ctx.paymentFlow).toContainText(text);
  }

  @step('页面读取：读取 Payment 当前未付金额')
  async readBalanceDue(): Promise<number> {
    const paymentFlowText = await this.ctx.paymentFlow.innerText();
    const balanceMatch = paymentFlowText.match(
      /Balance due\s*\$([\d,]+(?:\.\d{2})?)/i,
    );
    const balanceDue = Number(balanceMatch?.[1].replace(/,/g, ''));
    if (!Number.isFinite(balanceDue)) {
      throw new Error(`无法从 Payment 支付流程读取未付金额：${paymentFlowText}`);
    }
    return balanceDue;
  }

  @step('页面操作：在 Payment type 区域点击 Credit Card')
  async clickPaymentTypeCreditCard(): Promise<void> {
    this.throwIfPaymentFailed(await this.readPaymentFailureText());
    await this.card.clickCreditCard();
  }

  @step('页面操作：按参数处理是否打印小票弹窗')
  async handlePrintReceiptChoice(printReceipt: boolean): Promise<void> {
    await this.receipt.choose(printReceipt);
  }

  @step('页面操作：如有打印小票弹窗则关闭，避免污染后续状态')
  async dismissPrintReceiptDialogIfVisible(): Promise<void> {
    await this.receipt.dismissIfVisible();
  }

  @step((expectedButtonText = 'NO RECEIPT') =>
    `页面操作：如支付成功页仍显示，则点击 ${expectedButtonText} 关闭`,
  )
  async confirmPaymentSuccessIfVisible(
    expectedButtonText = 'NO RECEIPT',
  ): Promise<void> {
    await this.receipt.confirmSuccessIfVisible(expectedButtonText);
  }

  @step('页面操作：关闭支付面板并返回订单详情')
  async closePaymentPanel(): Promise<void> {
    if (!(await this.isPaymentPanelVisible())) {
      return;
    }

    await this.ctx.backButton.click();
    const returnState = await waitUntil(
      async () => ({
        confirmVisible: await this.ctx.partialPaidLeaveConfirmButton
          .isVisible()
          .catch(() => false),
        panelVisible: await this.isPaymentPanelVisible(),
      }),
      (state) => state.confirmVisible || !state.panelVisible,
      {
        timeout: 10_000,
        message: 'Payment panel did not enter a closeable state after clicking Back.',
      },
    );

    if (returnState.confirmVisible) {
      await this.ctx.partialPaidLeaveConfirmButton.click();
    }
    await waitUntil(
      async () => await this.isPaymentPanelVisible(),
      (panelVisible) => !panelVisible,
      {
        timeout: 10_000,
        message: 'Payment panel remained active after returning to order details.',
      },
    );
  }

  @step('页面读取：读取左侧支付详情')
  async readSummaryContent(): Promise<PaymentSummarySnapshot> {
    return await this.summary.read();
  }

  @step('页面读取：确认当前是否显示打印小票弹窗')
  async isPrintReceiptDialogVisible(): Promise<boolean> {
    return await this.receipt.isVisible();
  }

  @step('页面读取：确认支付面板当前是否仍然可见')
  async isPaymentPanelVisible(): Promise<boolean> {
    return await this.ctx.isPanelVisible();
  }

  @step('页面读取：确认支付成功确认按钮当前是否可见')
  async isPaymentSuccessConfirmVisible(): Promise<boolean> {
    return await this.receipt.isSuccessConfirmVisible();
  }

  @step('页面读取：读取支付失败弹窗信息')
  async readPaymentFailureText(): Promise<string | null> {
    if (!(await this.ctx.failureDialog.isVisible().catch(() => false))) {
      return null;
    }
    return (await this.ctx.failureDialog.innerText()).replace(/\s+/g, ' ').trim();
  }

  private throwIfPaymentFailed(paymentFailureText: string | null): void {
    if (paymentFailureText) {
      throw new Error(`支付终端返回失败：${paymentFailureText}`);
    }
  }
}

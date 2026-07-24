import { expect, type Page } from '@playwright/test';
import { step } from '../../../utils/step';
import { waitUntil } from '../../../utils/wait';
import { RecallOrderActionsSection } from '../../recall/recall-order-actions.section';
import type { RecallOrderDetails } from '../../recall/recall.types';
import { OrderDetailsContext } from './order-details-context';
import { OrderDetailsHeaderSection } from './order-details-header.section';
import { OrderDetailsItemsSection } from './order-details-items.section';
import { OrderDetailsPaymentSection } from './order-details-payment.section';
import { OrderDetailsSummarySection } from './order-details-summary.section';

export class OrderDetailsComponent {
  readonly actions: RecallOrderActionsSection;
  readonly header: OrderDetailsHeaderSection;
  readonly items: OrderDetailsItemsSection;
  readonly payment: OrderDetailsPaymentSection;
  readonly summary: OrderDetailsSummarySection;
  private readonly ctx: OrderDetailsContext;

  constructor(private readonly page: Page) {
    this.ctx = new OrderDetailsContext(page);
    this.actions = new RecallOrderActionsSection(page, this.ctx.dialog);
    this.header = new OrderDetailsHeaderSection(this.ctx);
    this.items = new OrderDetailsItemsSection(this.ctx);
    this.payment = new OrderDetailsPaymentSection(this.ctx);
    this.summary = new OrderDetailsSummarySection(this.ctx);
  }

  @step('页面校验：订单详情弹窗已完成最小加载')
  async expectReady(): Promise<void> {
    await expect(this.ctx.dialog).toBeVisible({ timeout: 10_000 });
    await waitUntil(
      async () => ({
        dialogText: (await this.ctx.dialog.textContent())?.trim() ?? '',
        hasItems: await this.ctx.dishItems.first().isVisible().catch(() => false),
        hasSummary: await this.ctx.priceSummaryToggle
          .isVisible()
          .catch(() => false),
      }),
      (state) =>
        !/^loading(?:\.\.\.)?$/i.test(state.dialogText) &&
        (state.hasItems || state.hasSummary),
      {
        timeout: 10_000,
        interval: 100,
        message: '订单详情弹窗未完成最小加载。',
      },
    );
  }

  @step('页面读取：读取当前订单详情快照')
  async readOrderDetailsSnapshot(): Promise<RecallOrderDetails> {
    await this.expectReady();
    const [
      customerInfo,
      memberInfo,
      orderContext,
      items,
      payments,
      paymentStatus,
      priceSummary,
      availableActions,
    ] = await Promise.all([
      this.header.readCustomerInfo(),
      this.header.readMemberInfo(),
      this.header.readOrderContext(),
      this.items.readItems(),
      this.payment.readPayments(),
      this.header.readPaymentStatus(),
      this.summary.read(),
      this.actions.readAvailable(),
    ]);
    const orderNumber = (
      await this.ctx.dialog.locator('[class*="_number_"]').innerText()
    )
      .replace(/\s+/g, ' ')
      .trim();

    return {
      orderNumber,
      paymentStatus,
      customerInfo,
      memberInfo,
      orderContext,
      payments,
      items,
      priceSummary,
      availableActions,
    };
  }

  @step('页面操作：点击订单详情中的 Print 并等待小票打印接口成功')
  async clickPrintInOrderDetailsAndReadReceiptStatus(): Promise<number> {
    await this.expectReady();
    const [receiptResponse] = await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith(
            '/kpos/api/print/receipt',
          ),
        { timeout: 15_000 },
      ),
      this.actions.click('print'),
    ]);
    if (!receiptResponse.ok()) {
      throw new Error(
        `订单详情小票打印接口失败：${receiptResponse.status()} ${receiptResponse.url()}`,
      );
    }
    return receiptResponse.status();
  }
}

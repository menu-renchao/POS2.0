import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { OrderDishesPage } from './order-dishes.page';
import { PaymentPage } from './payment.page';
import { RecallFilterBarSection } from './recall/recall-filter-bar.section';
import { RecallOrderDetailsDialog } from './recall/recall-order-details.dialog';
import { RecallVoidDialog } from './recall/recall-void.dialog';

export type {
  RecallCustomerInfo,
  RecallMemberInfo,
  RecallOrderContext,
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderItemAddition,
  RecallOrderPaymentRecord,
} from './recall/recall.types';

import type {
  RecallCustomerInfo,
  RecallMemberInfo,
  RecallOrderContext,
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderPaymentRecord,
} from './recall/recall.types';

export class RecallPage {
  private readonly filterBar: RecallFilterBarSection;
  private readonly orderDetails: RecallOrderDetailsDialog;
  private readonly voidDialog: RecallVoidDialog;
  private readonly newOrderButton: Locator;
  private readonly exitRecallButton: Locator;

  constructor(private readonly page: Page) {
    this.filterBar = new RecallFilterBarSection(page);
    this.orderDetails = new RecallOrderDetailsDialog(page, this.filterBar);
    this.voidDialog = new RecallVoidDialog(page, this.orderDetails);
    this.newOrderButton = this.page.locator('[data-testid="recall2-header-new-order"]:visible');
    this.exitRecallButton = this.page
      .locator('.rcreturnbx_bth_exit')
      .or(this.page.getByRole('button', { name: /^Back$/i }))
      .first();
  }

  async expectLoaded(): Promise<void> {
    return this.filterBar.expectLoaded();
  }

  async selectPaymentStatus(
    ...args: Parameters<RecallFilterBarSection['selectPaymentStatus']>
  ): Promise<void> {
    return this.filterBar.selectPaymentStatus(...args);
  }

  async selectOrderStatus(
    ...args: Parameters<RecallFilterBarSection['selectOrderStatus']>
  ): Promise<void> {
    return this.filterBar.selectOrderStatus(...args);
  }

  async selectOrderType(...args: Parameters<RecallFilterBarSection['selectOrderType']>): Promise<void> {
    return this.filterBar.selectOrderType(...args);
  }

  async selectPaymentType(
    ...args: Parameters<RecallFilterBarSection['selectPaymentType']>
  ): Promise<void> {
    return this.filterBar.selectPaymentType(...args);
  }

  async selectProductLine(
    ...args: Parameters<RecallFilterBarSection['selectProductLine']>
  ): Promise<void> {
    return this.filterBar.selectProductLine(...args);
  }

  async openManualSearchDialog(): Promise<void> {
    return this.filterBar.openManualSearchDialog();
  }

  async selectManualSearchTag(
    ...args: Parameters<RecallFilterBarSection['selectManualSearchTag']>
  ): Promise<void> {
    return this.filterBar.selectManualSearchTag(...args);
  }

  async fillManualSearchKeyword(
    ...args: Parameters<RecallFilterBarSection['fillManualSearchKeyword']>
  ): Promise<void> {
    return this.filterBar.fillManualSearchKeyword(...args);
  }

  async submitManualSearch(): Promise<void> {
    return this.filterBar.submitManualSearch();
  }

  async closeManualSearchDialog(): Promise<void> {
    return this.filterBar.closeManualSearchDialog();
  }

  async clearAllSearchConditions(): Promise<void> {
    return this.filterBar.clearAllSearchConditions();
  }

  async removeUnpaidPaymentStatusFilterIfPresent(): Promise<void> {
    return this.filterBar.removeUnpaidPaymentStatusFilterIfPresent();
  }

  async readVisibleOrderNumbers(): Promise<string[]> {
    return this.filterBar.readVisibleOrderNumbers();
  }

  async readLatestVisibleOrderNumber(): Promise<string> {
    return this.filterBar.readLatestVisibleOrderNumber();
  }

  async readManualSearchKeyword(): Promise<string> {
    return this.filterBar.readManualSearchKeyword();
  }

  async readActiveFilterTexts(): Promise<string[]> {
    return this.filterBar.readActiveFilterTexts();
  }

  async openOrderDetails(
    ...args: Parameters<RecallOrderDetailsDialog['openOrderDetails']>
  ): Promise<void> {
    return this.orderDetails.openOrderDetails(...args);
  }

  async openFirstVisibleOrderDetails(): Promise<void> {
    return this.orderDetails.openFirstVisibleOrderDetails();
  }

  async openOrderForEditing(
    ...args: Parameters<RecallOrderDetailsDialog['openOrderForEditing']>
  ): Promise<OrderDishesPage> {
    return this.orderDetails.openOrderForEditing(...args);
  }

  async openFirstVisibleOrderForEditing(): Promise<OrderDishesPage> {
    return this.orderDetails.openFirstVisibleOrderForEditing();
  }

  async openRecentOrderDetails(): Promise<void> {
    return this.orderDetails.openRecentOrderDetails();
  }

  async openRecentOrderForEditing(): Promise<OrderDishesPage> {
    return this.orderDetails.openRecentOrderForEditing();
  }

  async openPayment(): Promise<PaymentPage> {
    return this.orderDetails.openPayment();
  }

  async expandOrderDetailsPriceSummary(): Promise<void> {
    return this.orderDetails.expandOrderDetailsPriceSummary();
  }

  async readOrderCustomerInfo(): Promise<RecallCustomerInfo | null> {
    return this.orderDetails.readOrderCustomerInfo();
  }

  async readOrderMemberInfo(): Promise<RecallMemberInfo | null> {
    return this.orderDetails.readOrderMemberInfo();
  }

  async readOrderPaymentStatus(): Promise<string | null> {
    return this.orderDetails.readOrderPaymentStatus();
  }

  async readOrderItems(): Promise<RecallOrderItem[]> {
    return this.orderDetails.readOrderItems();
  }

  async readOrderPriceSummary(): Promise<Record<string, number>> {
    return this.orderDetails.readOrderPriceSummary();
  }

  async readDisplayedOrderPriceSummary(): Promise<Record<string, number>> {
    return this.orderDetails.readDisplayedOrderPriceSummary();
  }

  async readOrderContext(): Promise<RecallOrderContext> {
    return this.orderDetails.readOrderContext();
  }

  async readOrderPayments(): Promise<RecallOrderPaymentRecord[]> {
    return this.orderDetails.readOrderPayments();
  }

  async readPaymentCardTip(
    ...args: Parameters<RecallOrderDetailsDialog['readPaymentCardTip']>
  ): Promise<string | null> {
    return this.orderDetails.readPaymentCardTip(...args);
  }

  async addOrderDetailsTip(
    ...args: Parameters<RecallOrderDetailsDialog['addOrderDetailsTip']>
  ): Promise<string | null> {
    return this.orderDetails.addOrderDetailsTip(...args);
  }

  async addPaymentCardTip(
    ...args: Parameters<RecallOrderDetailsDialog['addPaymentCardTip']>
  ): Promise<string | null> {
    return this.orderDetails.addPaymentCardTip(...args);
  }

  async readOrderDetailsSnapshot(): Promise<RecallOrderDetails> {
    return this.orderDetails.readOrderDetailsSnapshot();
  }

  async voidCurrentOrder(...args: Parameters<RecallVoidDialog['voidCurrentOrder']>): Promise<void> {
    return this.voidDialog.voidCurrentOrder(...args);
  }

  async voidFirstVisibleOrder(...args: Parameters<RecallVoidDialog['voidFirstVisibleOrder']>): Promise<void> {
    return this.voidDialog.voidFirstVisibleOrder(...args);
  }

  async voidRecentVisibleOrder(
    ...args: Parameters<RecallVoidDialog['voidRecentVisibleOrder']>
  ): Promise<void> {
    return this.voidDialog.voidRecentVisibleOrder(...args);
  }

  async closeOrderDetailsDialog(): Promise<void> {
    return this.orderDetails.closeOrderDetailsDialog();
  }

  @step('页面操作：退出 Recall 页面')
  async exitRecall(): Promise<void> {
    await this.orderDetails.dismissOrderDetailsDialogIfNeeded();

    const exitButtonState = await waitUntil(
      async () => ({
        exitButtonVisible: await this.exitRecallButton.isVisible().catch(() => false),
        orderDetailsVisible: await this.orderDetails.orderDetailsDialog.isVisible().catch(() => false),
        url: this.page.url(),
      }),
      ({ exitButtonVisible, orderDetailsVisible, url }) =>
        exitButtonVisible || (!/#recall/i.test(url) && !orderDetailsVisible),
      {
        timeout: 5_000,
        interval: 100,
        message: 'Recall 页面退出按钮在关闭订单详情后仍未恢复可用。',
      },
    ).catch(() => null);

    if (!exitButtonState?.exitButtonVisible) {
      return;
    }

    await this.exitRecallButton.click({ timeout: 3_000 }).catch(async () => {
      await this.exitRecallButton.evaluate((exitButton) => {
        (exitButton as HTMLElement).click();
      });
    });

    const exitedAfterDirectClick = await this.waitForLeavingRecallPage().catch(() => false);

    if (exitedAfterDirectClick) {
      return;
    }

    await this.exitRecallButton.evaluate((exitButton) => {
      (exitButton as HTMLElement).click();
    });
    await this.waitForLeavingRecallPage();
  }

  private async waitForLeavingRecallPage(): Promise<boolean> {
    await waitUntil(
      async () => ({
        url: this.page.url(),
        recallHeaderVisible: await this.newOrderButton.isVisible().catch(() => false),
      }),
      ({ url, recallHeaderVisible }) => !/#recall/i.test(url) || !recallHeaderVisible,
      {
        timeout: 5_000,
        interval: 100,
        message: 'Recall 页面在退出操作后仍未离开。',
      },
    );

    return true;
  }
}

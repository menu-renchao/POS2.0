import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { OrderDishesPage } from './order-dishes.page';
import { PaymentPage } from './payment.page';
import { SplitOrderPage } from './split-order.page';
import { RecallFilterBarSection } from './recall/recall-filter-bar.section';
import { RecallOrderDetailsDialog } from './recall/recall-order-details.dialog';
import { RecallVoidDialog } from './recall/recall-void.dialog';

export type {
  RecallCustomerInfo,
  RecallMemberInfo,
  RecallOrderContext,
  RecallOrderDetailAction,
  RecallOrderDetailActions,
  RecallOrderDetailsMoreAction,
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderItemAddition,
  RecallOrderPaymentRecord,
} from './recall/recall.types';

import type {
  RecallCustomerInfo,
  RecallMemberInfo,
  RecallOrderContext,
  RecallOrderDetailActions,
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderPaymentRecord,
} from './recall/recall.types';

export class RecallPage {
  public readonly filterBar: RecallFilterBarSection;
  public readonly orderDetails: RecallOrderDetailsDialog;
  public readonly voidDialog: RecallVoidDialog;
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

  async readTargetOrderNumbers(
    ...args: Parameters<RecallOrderDetailsDialog['readTargetOrderNumbers']>
  ): Promise<string[]> {
    return this.orderDetails.readTargetOrderNumbers(...args);
  }

  async selectTargetOrder(...args: Parameters<RecallOrderDetailsDialog['selectTargetOrder']>): Promise<void> {
    return this.orderDetails.selectTargetOrder(...args);
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

  async readDisplayedOrderPriceSummaryText(): Promise<string> {
    return this.orderDetails.readDisplayedOrderPriceSummaryText();
  }

  async readOrderContext(): Promise<RecallOrderContext> {
    return this.orderDetails.readOrderContext();
  }

  async readOrderPayments(): Promise<RecallOrderPaymentRecord[]> {
    return this.orderDetails.readOrderPayments();
  }

  async readOrderPaymentAmounts(): Promise<number[]> {
    return this.orderDetails.readOrderPaymentAmounts();
  }

  async refundPaymentRecord(
    ...args: Parameters<RecallOrderDetailsDialog['refundPaymentRecord']>
  ): Promise<void> {
    return this.orderDetails.refundPaymentRecord(...args);
  }

  async readPaymentCardTip(
    ...args: Parameters<RecallOrderDetailsDialog['readPaymentCardTip']>
  ): Promise<string | null> {
    return this.orderDetails.readPaymentCardTip(...args);
  }

  async readPaymentCardTipAmount(
    ...args: Parameters<RecallOrderDetailsDialog['readPaymentCardTipAmount']>
  ): Promise<number | null> {
    return this.orderDetails.readPaymentCardTipAmount(...args);
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

  @step((serverName: string) => `页面操作：将 Recall 订单服务员切换为 ${serverName}`)
  async changeOrderServer(serverName: string): Promise<void> {
    return this.orderDetails.changeOrderServer(serverName);
  }

  async readOrderDetailsSnapshot(): Promise<RecallOrderDetails> {
    return this.orderDetails.readOrderDetailsSnapshot();
  }

  async readOrderDetailsText(): Promise<string> {
    return this.orderDetails.readOrderDetailsText();
  }

  @step('页面读取：读取 Recall 订单详情可用操作')
  async readOrderDetailAvailableActions(): Promise<RecallOrderDetailActions> {
    return this.orderDetails.readOrderDetailAvailableActions();
  }

  @step('页面操作：点击 Recall 订单详情中的 Send 按钮')
  async clickSendInOrderDetails(): Promise<void> {
    return this.orderDetails.clickSendInOrderDetails();
  }

  @step('页面操作：点击 Recall 订单详情中的 Send 按钮并读取成功提示')
  async clickSendInOrderDetailsAndReadKitchenTicketStatus(): Promise<number> {
    return this.orderDetails.clickSendInOrderDetailsAndReadKitchenTicketStatus();
  }

  @step('页面操作：点击 Recall 订单详情中的 Print 按钮')
  async clickPrintInOrderDetails(): Promise<void> {
    return this.orderDetails.clickPrintInOrderDetails();
  }

  @step('页面操作：从 Recall 订单详情点击 Split 并进入分单面板')
  async openSplitInOrderDetails(
    options?: Parameters<RecallOrderDetailsDialog['openSplitInOrderDetails']>[0],
  ): Promise<SplitOrderPage> {
    return this.orderDetails.openSplitInOrderDetails(options);
  }

  @step('页面操作：点击 Recall 订单详情中的 Discount 按钮')
  async clickDiscountInOrderDetails(): Promise<void> {
    return this.orderDetails.clickDiscountInOrderDetails();
  }

  @step('页面操作：点击 Recall 订单详情中的 More 按钮')
  async clickOrderDetailsMoreButton(): Promise<void> {
    return this.orderDetails.clickOrderDetailsMoreButton();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Charge 按钮')
  async clickChargeInMoreMenu(): Promise<void> {
    return this.orderDetails.clickChargeInMoreMenu();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Move Item 按钮')
  async clickMoveItemInMoreMenu(): Promise<void> {
    return this.orderDetails.clickMoveItemInMoreMenu();
  }

  @step('页面操作：选择 Recall 订单详情中的第一个菜品')
  async selectFirstOrderDishItem(): Promise<void> {
    return this.orderDetails.selectFirstOrderDishItem();
  }

  @step('页面校验：Move Dishes Out 操作面板已显示')
  async expectMoveDishesOutReady(): Promise<void> {
    return this.orderDetails.expectMoveDishesOutReady();
  }

  @step('页面操作：选择将菜品移动到已有订单')
  async clickMoveDishesToExistingOrder(): Promise<void> {
    return this.orderDetails.clickMoveDishesToExistingOrder();
  }

  @step('页面校验：Move Dishes Out 可移动到新订单')
  async expectMoveDishesToNewOrderReady(): Promise<void> {
    return this.orderDetails.expectMoveDishesToNewOrderReady();
  }

  @step('页面操作：选择将菜品移动到新订单')
  async clickMoveDishesToNewOrder(): Promise<void> {
    return this.orderDetails.clickMoveDishesToNewOrder();
  }

  @step('页面校验：Recall 已进入移菜目标订单选择状态')
  async expectMoveDishesTargetSelectionReady(): Promise<void> {
    return this.orderDetails.expectMoveDishesTargetSelectionReady();
  }

  @step((orderNumber: string) => `页面操作：选择订单 ${orderNumber} 作为移菜目标订单`)
  async clickMoveDishesTargetOrder(orderNumber: string): Promise<void> {
    return this.orderDetails.clickMoveDishesTargetOrder(orderNumber);
  }

  @step((targetOrderNumber: string) =>
    `页面校验：移菜后的目标订单 ${targetOrderNumber} 详情已显示`,
  )
  async expectMovedOrderDetailsReady(targetOrderNumber: string): Promise<void> {
    return this.orderDetails.expectMovedOrderDetailsReady(targetOrderNumber);
  }

  @step((sourceOrderNumber: string) =>
    `页面校验：从订单 ${sourceOrderNumber} 移出的菜品已显示在新订单详情中`,
  )
  async expectMovedToNewOrderDetailsReady(sourceOrderNumber: string): Promise<void> {
    return this.orderDetails.expectMovedToNewOrderDetailsReady(sourceOrderNumber);
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Combine 按钮')
  async clickCombineInMoreMenu(): Promise<void> {
    return this.orderDetails.clickCombineInMoreMenu();
  }

  @step('页面校验：Recall 已进入合单目标订单选择状态')
  async expectCombineTargetSelectionReady(): Promise<void> {
    return this.orderDetails.expectCombineTargetSelectionReady();
  }

  @step((orderNumber: string) => `页面操作：选择订单 ${orderNumber} 作为合单目标订单`)
  async clickCombineTargetOrder(orderNumber: string): Promise<void> {
    return this.orderDetails.clickCombineTargetOrder(orderNumber);
  }

  @step('页面操作：存在加收合单警告时确认继续')
  async confirmCombineChargeWarningIfNeeded(): Promise<void> {
    return this.orderDetails.confirmCombineChargeWarningIfNeeded();
  }

  @step((targetOrderNumber: string) =>
    `页面校验：Recall 合单后的目标订单 ${targetOrderNumber} 详情已显示`,
  )
  async expectCombinedOrderDetailsReady(targetOrderNumber: string): Promise<void> {
    return this.orderDetails.expectCombinedOrderDetailsReady(targetOrderNumber);
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Tips 按钮')
  async clickTipsInMoreMenu(): Promise<void> {
    return this.orderDetails.clickTipsInMoreMenu();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Paging 按钮')
  async clickPagingInMoreMenu(): Promise<void> {
    return this.orderDetails.clickPagingInMoreMenu();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Call Off 按钮')
  async clickCallOffInMoreMenu(): Promise<void> {
    return this.orderDetails.clickCallOffInMoreMenu();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Clear Table 按钮')
  async clickClearTableInMoreMenu(): Promise<void> {
    return this.orderDetails.clickClearTableInMoreMenu();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Copy 按钮')
  async clickCopyInMoreMenu(): Promise<void> {
    return this.orderDetails.clickCopyInMoreMenu();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Void 按钮')
  async clickVoidInMoreMenu(): Promise<void> {
    return this.orderDetails.clickVoidInMoreMenu();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Sort 按钮')
  async clickSortInMoreMenu(): Promise<void> {
    return this.orderDetails.clickSortInMoreMenu();
  }

  async voidCurrentOrder(...args: Parameters<RecallVoidDialog['voidCurrentOrder']>): Promise<void> {
    return this.voidDialog.voidCurrentOrder(...args);
  }

  @step('页面操作：尝试作废当前 Recall 订单详情并读取阻断提示')
  async attemptVoidCurrentOrder(
    ...args: Parameters<RecallVoidDialog['attemptVoidCurrentOrder']>
  ): Promise<string | null> {
    return this.voidDialog.attemptVoidCurrentOrder(...args);
  }

  async readVoidReasonCount(): Promise<number> {
    return this.voidDialog.readVoidReasonCount();
  }

  async voidCurrentOrderKeepingDetails(
    ...args: Parameters<RecallVoidDialog['voidCurrentOrderKeepingDetails']>
  ): Promise<void> {
    return this.voidDialog.voidCurrentOrderKeepingDetails(...args);
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

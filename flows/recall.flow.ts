import {
  RecallPage,
  type RecallOrderDetails,
} from '../pages/recall.page';
import { HomePage } from '../pages/home.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
import { PaymentPage } from '../pages/payment.page';
import { type SplitOrderReturnPage, SplitOrderPage } from '../pages/split-order.page';
import {
  type RecallManualSearchTag,
  type RecallOrderStatus,
  type RecallOrderType,
  type RecallPaymentStatus,
  type RecallPaymentType,
  type RecallProductLine,
} from '../test-data/recall-search-options';
import type {
  RecallDatePreset,
  RecallDateRange,
  RecallSortableColumn,
} from '../test-data/recall-list';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

export type RecallManualSearchParams = {
  tag: RecallManualSearchTag;
  keyword: string;
};

export type RecallSearchParams = {
  paymentStatus?: RecallPaymentStatus;
  orderStatus?: RecallOrderStatus;
  orderType?: RecallOrderType;
  paymentType?: RecallPaymentType;
  productLine?: RecallProductLine;
  manualSearch?: RecallManualSearchParams;
  clearFirst?: boolean;
};

export type RecallVoidOptions = {
  reason?: string;
  restoreInventory?: boolean;
};

export type RecallPersistedOrderCleanupOptions = RecallVoidOptions & {
  requireSplitChildren: boolean;
};

export class RecallFlow {
  @step('业务步骤：从首页进入 Recall 页面')
  async openRecallFromHome(homePage: HomePage): Promise<RecallPage> {
    return await homePage.enterRecall();
  }

  @step('业务步骤：按综合条件搜索 Recall 订单')
  async searchOrders(recallPage: RecallPage, params: RecallSearchParams): Promise<void> {
    const {
      paymentStatus,
      orderStatus,
      orderType,
      paymentType,
      productLine,
      manualSearch,
      clearFirst = true,
    } = params;

    await recallPage.expectLoaded();

    if (clearFirst) {
      await recallPage.filterBar.clearAllSearchConditions();
    }

    if (paymentStatus && paymentStatus !== 'Unpaid') {
      await recallPage.filterBar.selectPaymentStatus(paymentStatus);
    }

    if (orderStatus) {
      await recallPage.filterBar.selectOrderStatus(orderStatus);
    }

    if (orderType) {
      await recallPage.filterBar.selectOrderType(orderType);
    }

    if (paymentType) {
      await recallPage.filterBar.selectPaymentType(paymentType);
    }

    if (productLine) {
      await recallPage.filterBar.selectProductLine(productLine);
    }

    if (manualSearch) {
      await recallPage.filterBar.openManualSearchDialog();
      await recallPage.filterBar.selectManualSearchTag(manualSearch.tag);
      await recallPage.filterBar.fillManualSearchKeyword(manualSearch.keyword);
      await recallPage.filterBar.submitManualSearch();
      await recallPage.filterBar.removeUnpaidPaymentStatusFilterIfPresent();
    }

  }

  @step('业务步骤：清空 Recall 当前所有搜索条件')
  async clearSearchConditions(recallPage: RecallPage): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.filterBar.clearAllSearchConditions();
  }

  @step('业务步骤：读取当前 Recall 列表中的最新订单号')
  async readLatestVisibleOrderNumber(recallPage: RecallPage): Promise<string> {
    const visibleOrderNumbers = await waitUntil(
      async () => await recallPage.filterBar.readVisibleOrderNumbers(),
      (orderNumbers) => orderNumbers.length > 0,
      {
        timeout: 10_000,
        message: 'Recall order list did not load any order numbers in time.',
      },
    );

    const [latestOrderNumber] = [...visibleOrderNumbers].sort((leftOrderNumber, rightOrderNumber) => {
      const leftValue = Number(leftOrderNumber.replace(/^#/, ''));
      const rightValue = Number(rightOrderNumber.replace(/^#/, ''));
      return rightValue - leftValue;
    });

    if (!latestOrderNumber) {
      throw new Error('Unable to determine the latest visible Recall order number.');
    }

    return latestOrderNumber;
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：查看订单 ${orderNumber} 的详情并进入子单 ${targetOrderNumber}，在读取完成后关闭弹窗`
      : `业务步骤：查看订单 ${orderNumber} 的详情并在读取完成后关闭弹窗`,
  )
  async viewOrderDetails(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<RecallOrderDetails> {
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);

    try {
      await recallPage.orderDetails.expandOrderDetailsPriceSummary();
      return await recallPage.orderDetails.readOrderDetailsSnapshot();
    } finally {
      await recallPage.orderDetails.closeOrderDetailsDialog();
    }
  }

  @step('业务步骤：查看 Recall 第一张可见订单卡片详情')
  async viewFirstVisibleOrderDetails(recallPage: RecallPage): Promise<RecallOrderDetails> {
    await recallPage.orderDetails.openFirstVisibleOrderDetails();
    await recallPage.orderDetails.expandOrderDetailsPriceSummary();
    return await recallPage.orderDetails.readOrderDetailsSnapshot();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并进入编辑点单页`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并进入编辑点单页`,
  )
  async editOrder(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<OrderDishesPage> {
    await recallPage.expectLoaded();
    return await recallPage.orderDetails.openOrderForEditing(orderNumber, targetOrderNumber);
  }

  @step('业务步骤：从 Recall 第一张可见订单卡片进入编辑点单页')
  async editFirstVisibleOrder(recallPage: RecallPage): Promise<OrderDishesPage> {
    await recallPage.expectLoaded();
    return await recallPage.orderDetails.openFirstVisibleOrderForEditing();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并送厨`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并送厨`,
  )
  async sendOrderToKitchen(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickSendInOrderDetails();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并进入支付页面`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并进入支付页面`,
  )
  async openPayment(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<PaymentPage> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.orderDetails.openPayment();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并打印`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并打印`,
  )
  async printOrder(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickPrintInOrderDetails();
  }

  @step((_recallPage: RecallPage, preset: RecallDatePreset) =>
    `业务步骤：应用 Recall 日期预设 ${preset} 并读取日期范围`,
  )
  async applyDatePreset(
    recallPage: RecallPage,
    preset: RecallDatePreset,
  ): Promise<RecallDateRange> {
    await recallPage.expectLoaded();
    await recallPage.dateFilter.selectPreset(preset);
    return await recallPage.dateFilter.readSelectedRange();
  }

  @step((_recallPage: RecallPage, column: RecallSortableColumn) =>
    `业务步骤：在 Recall 列表连续切换 ${column} 列的排序方向`,
  )
  async readBothSortDirections(
    recallPage: RecallPage,
    column: RecallSortableColumn,
  ): Promise<{
    first: { direction: 'ascending' | 'descending'; values: string[] };
    second: { direction: 'ascending' | 'descending'; values: string[] };
  }> {
    await recallPage.expectLoaded();
    await recallPage.list.switchToListView();
    const firstDirection = await recallPage.list.clickSort(column);
    const firstValues = await recallPage.list.readVisibleColumnValues(column);
    const secondDirection = await recallPage.list.clickSort(column);
    const secondValues = await recallPage.list.readVisibleColumnValues(column);
    const first = { direction: firstDirection, values: firstValues };
    const second = { direction: secondDirection, values: secondValues };
    return { first, second };
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并确认打单成功`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并确认打单成功`,
  )
  async printOrderAndReadKitchenTicketStatus(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<number> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.orderDetails.clickPrintInOrderDetailsAndReadKitchenTicketStatus();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并读取打单结果`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并读取打单结果`,
  )
  async printOrderAndReadKitchenTicketResult(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): ReturnType<
    RecallPage['orderDetails']['clickPrintInOrderDetailsAndReadKitchenTicketResult']
  > {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.orderDetails.clickPrintInOrderDetailsAndReadKitchenTicketResult();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并打印小票`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并打印小票`,
  )
  async printReceiptAndReadStatus(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<number> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.orderDetails.clickPrintInOrderDetailsAndReadReceiptStatus();
  }

  @step((_: RecallPage, orderNumber: string) => `业务步骤：重打 Recall 订单 ${orderNumber} 的收据`)
  async reprintReceiptAndReadStatus(
    recallPage: RecallPage,
    orderNumber: string,
  ): Promise<number> {
    await recallPage.orderDetails.openOrderDetails(orderNumber);
    return await recallPage.orderDetails.clickReprintInOrderDetailsAndReadReceiptStatus();
  }

  @step((_: RecallPage, orderNumber: string, dishNames: readonly string[]) =>
    `业务步骤：对 Recall 订单 ${orderNumber} 的菜品 ${dishNames.join('、')} 执行 Resend`,
  )
  async resendDishes(
    recallPage: RecallPage,
    orderNumber: string,
    dishNames: readonly string[],
  ): ReturnType<RecallPage['orderDetails']['resendDishes']> {
    await recallPage.orderDetails.openOrderDetails(orderNumber);
    return await recallPage.orderDetails.resendDishes(dishNames);
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并进入分单面板`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并进入分单面板`,
  )
  async openSplitOrder(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
    options?: Parameters<RecallPage['orderDetails']['openSplitInOrderDetails']>[0],
  ): Promise<SplitOrderPage> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.orderDetails.openSplitInOrderDetails(options);
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并打开折扣入口`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并打开折扣入口`,
  )
  async openDiscount(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickDiscountInOrderDetails();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并打开更多操作`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并打开更多操作`,
  )
  async openMoreActions(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickOrderDetailsMoreButton();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Charge`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Charge`,
  )
  async openChargeFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickChargeInMoreMenu();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Move Item`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Move Item`,
  )
  async openMoveItemFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickMoveItemInMoreMenu();
  }

  @step((_: RecallPage, sourceOrderNumber: string, targetOrderNumber: string) =>
    `业务步骤：将订单 ${sourceOrderNumber} 的第一个菜品移动到已有订单 ${targetOrderNumber}`,
  )
  async moveFirstDishToExistingOrder(
    recallPage: RecallPage,
    sourceOrderNumber: string,
    targetOrderNumber: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(sourceOrderNumber);
    await recallPage.orderDetails.expandOrderDetailsPriceSummary();
    await recallPage.orderDetails.selectFirstOrderDishItem();
    await recallPage.orderDetails.clickMoveItemInMoreMenu();
    await recallPage.orderDetails.expectMoveDishesOutReady();
    await recallPage.orderDetails.clickMoveDishesToExistingOrder();
    await recallPage.orderDetails.expectMoveDishesTargetSelectionReady();
    await recallPage.orderDetails.clickMoveDishesTargetOrder(targetOrderNumber);
    await recallPage.orderDetails.expectMovedOrderDetailsReady(targetOrderNumber);
  }

  @step((_: RecallPage, sourceOrderNumber: string) =>
    `业务步骤：将订单 ${sourceOrderNumber} 的第一个菜品移动到新订单`,
  )
  async moveFirstDishToNewOrder(
    recallPage: RecallPage,
    sourceOrderNumber: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(sourceOrderNumber);
    await recallPage.orderDetails.selectFirstOrderDishItem();
    await recallPage.orderDetails.clickMoveItemInMoreMenu();
    await recallPage.orderDetails.expectMoveDishesToNewOrderReady();
    await recallPage.orderDetails.clickMoveDishesToNewOrder();
    await recallPage.orderDetails.expectMovedToNewOrderDetailsReady(sourceOrderNumber);
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Combine`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Combine`,
  )
  async openCombineFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickCombineInMoreMenu();
  }

  @step((_: RecallPage, sourceOrderNumber: string, targetOrderNumber: string) =>
    `业务步骤：从 Recall 将订单 ${sourceOrderNumber} 与订单 ${targetOrderNumber} 合并`,
  )
  async combineOrders(
    recallPage: RecallPage,
    sourceOrderNumber: string,
    targetOrderNumber: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(sourceOrderNumber);
    await recallPage.orderDetails.clickCombineInMoreMenu();
    await recallPage.orderDetails.expectCombineTargetSelectionReady();
    await recallPage.orderDetails.clickCombineTargetOrder(targetOrderNumber);
    await recallPage.orderDetails.confirmCombineChargeWarningIfNeeded();
    await recallPage.orderDetails.expectCombinedOrderDetailsReady(targetOrderNumber);
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Tips`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Tips`,
  )
  async openTipsFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickTipsInMoreMenu();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber: string, amountInCents: number) =>
    `业务步骤：为订单 ${orderNumber} 的子单 ${targetOrderNumber} 添加 ${amountInCents} 分 tips`,
  )
  async addOrderDetailsTip(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber: string,
    amountInCents: number,
  ): Promise<string | null> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    const message = await recallPage.orderDetails.addOrderDetailsTip(amountInCents);
    await recallPage.orderDetails.closeOrderDetailsDialog();
    return message;
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Paging`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Paging`,
  )
  async openPagingFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickPagingInMoreMenu();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Call Off`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Call Off`,
  )
  async openCallOffFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickCallOffInMoreMenu();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Copy`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Copy`,
  )
  async openCopyFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<OrderDishesPage> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickCopyInMoreMenu();
    return await recallPage.orderDetails.confirmCopyAndEnterOrderDishes();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Void`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Void`,
  )
  async openVoidFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickVoidInMoreMenu();
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：尝试作废订单 ${orderNumber} 的子单 ${targetOrderNumber} 并读取阻断提示`
      : `业务步骤：尝试作废订单 ${orderNumber} 并读取阻断提示`,
  )
  async attemptVoidOrder(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
    options: RecallVoidOptions = {},
  ): Promise<string | null> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.voidDialog.attemptVoidCurrentOrder(options);
  }

  @step(
    (_: RecallPage, orderNumber: string, targetOrderNumbers: string[]) =>
      `业务步骤：从 Recall 作废分单 ${orderNumber} 的 ${targetOrderNumbers.length} 个子单`,
  )
  private async voidSplitChildren(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumbers: string[],
    options: RecallVoidOptions = {},
  ): Promise<void> {
    await recallPage.expectLoaded();
    if (targetOrderNumbers.length < 2) {
      throw new Error(`分单 ${orderNumber} 清理时未读取到至少两个子单。`);
    }

    for (const targetOrderNumber of targetOrderNumbers) {
      await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
      await recallPage.voidDialog.voidCurrentOrder(options);
    }
  }

  @step((_: RecallPage, orderNumber: string) => `业务步骤：从 Recall 作废未分单母单 ${orderNumber}`)
  private async voidUnsplitOrder(
    recallPage: RecallPage,
    orderNumber: string,
    options: RecallVoidOptions = {},
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber);
    await recallPage.voidDialog.voidCurrentOrder(options);
  }

  @step(
    (
      _homePage: HomePage,
      _recallPage: RecallPage,
      orderNumber: string,
      _pendingSplitOrderPage: SplitOrderPage | undefined,
      _returnedPage: SplitOrderReturnPage | undefined,
      options: RecallPersistedOrderCleanupOptions,
    ) =>
      `业务步骤：按${options.requireSplitChildren ? '已持久化子单' : '允许折回母单'}结构清理订单 ${orderNumber}`,
  )
  async cleanupPersistedSplitOrder(
    homePage: HomePage,
    recallPage: RecallPage,
    orderNumber: string,
    pendingSplitOrderPage: SplitOrderPage | undefined,
    returnedPage: SplitOrderReturnPage | undefined,
    options: RecallPersistedOrderCleanupOptions,
  ): Promise<void> {
    let cleanupReturnPage = returnedPage;

    if (pendingSplitOrderPage) {
      cleanupReturnPage = await pendingSplitOrderPage.submitAndReturnPage().catch(async () => {
        await pendingSplitOrderPage.clickCancelSplit().catch(() => undefined);
        return await pendingSplitOrderPage.submitAndReturnPage().catch(() => undefined);
      });
    }

    const cleanupRecallPage = cleanupReturnPage
      ? await this.openRecallFromSplitReturnPage(cleanupReturnPage, homePage)
      : await this.openRecallFromSplitReturnPage(recallPage, homePage);
    await cleanupRecallPage.expectLoaded();
    await cleanupRecallPage.orderDetails.openOrderDetails(orderNumber);
    const targetOrderNumbers = options.requireSplitChildren
      ? await waitUntil(
          async () => await cleanupRecallPage.orderDetails.readTargetOrderNumbers(),
          (orderNumbers) => orderNumbers.length >= 2,
          {
            timeout: 10_000,
            interval: 100,
            message: `Recall 订单 ${orderNumber} 未展示至少两个持久化子单。`,
          },
        )
      : await cleanupRecallPage.orderDetails.readTargetOrderNumbers();

    if (targetOrderNumbers.length > 0) {
      await cleanupRecallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumbers[0]);
    }

    await cleanupRecallPage.orderDetails.clickClearTableInMoreMenu();

    if (targetOrderNumbers.length > 0) {
      await this.voidSplitChildren(cleanupRecallPage, orderNumber, targetOrderNumbers, options);
      return;
    }

    await this.voidUnsplitOrder(cleanupRecallPage, orderNumber, options);
  }

  @step('业务步骤：从分单提交返回页进入 Recall')
  async openRecallFromSplitReturnPage(
    returnedPage: SplitOrderReturnPage,
    _homePage: HomePage,
  ): Promise<RecallPage> {
    if (returnedPage instanceof RecallPage) {
      await returnedPage.expectLoaded();
      return returnedPage;
    }

    if (returnedPage instanceof OrderDishesPage) {
      return await returnedPage.navigation.clickRecall();
    }

    return await returnedPage.enterRecall();
  }

  @step('业务步骤：对当前 Recall 订单详情中的所有正向支付流水发起退款')
  async refundAllPaymentRecords(recallPage: RecallPage): Promise<void> {
    await recallPage.expectLoaded();
    const paymentAmounts = (await recallPage.orderDetails.readOrderPaymentAmounts()).filter((amount) => amount > 0);

    for (let index = 0; index < paymentAmounts.length; index += 1) {
      const refundedCountBefore = (await recallPage.orderDetails.readOrderPaymentAmounts()).filter((amount) => amount < 0).length;

      await recallPage.orderDetails.refundPaymentRecord(index);
      await waitUntil(
        async () => {
          const amounts = await recallPage.orderDetails.readOrderPaymentAmounts();
          return amounts.filter((amount) => amount < 0).length;
        },
        (refundedCount) => refundedCount > refundedCountBefore,
        {
          timeout: 15_000,
          message: `Recall 第 ${index + 1} 笔支付退款后未读取到新增负向流水。`,
        },
      );
    }
  }

  @step((_: RecallPage, orderNumber: string, dishName: string) =>
    `业务步骤：从 Recall 订单 ${orderNumber} 对菜品 ${dishName} 发起按菜退款`,
  )
  async refundOrderItem(
    recallPage: RecallPage,
    orderNumber: string,
    dishName: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber);
    await recallPage.orderDetails.refundOrderItem(0, dishName);
  }

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Sort`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Sort`,
  )
  async openSortFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.orderDetails.clickSortInMoreMenu();
  }
}

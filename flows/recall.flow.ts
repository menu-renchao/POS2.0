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
  async searchOrders(recallPage: RecallPage, params: RecallSearchParams): Promise<RecallPage> {
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
      await recallPage.clearAllSearchConditions();
      await waitUntil(
        async () => (await recallPage.readActiveFilterTexts()).length,
        (activeFilterCount) => activeFilterCount === 0,
        {
          timeout: 5_000,
          message: 'Recall 筛选条件在清空后仍残留激活标签。',
        },
      ).catch(() => undefined);
    }

    if (paymentStatus && paymentStatus !== 'Unpaid') {
      await recallPage.selectPaymentStatus(paymentStatus);
    }

    if (orderStatus) {
      await recallPage.selectOrderStatus(orderStatus);
    }

    if (orderType) {
      await recallPage.selectOrderType(orderType);
    }

    if (paymentType) {
      await recallPage.selectPaymentType(paymentType);
    }

    if (productLine) {
      await recallPage.selectProductLine(productLine);
    }

    if (manualSearch) {
      await recallPage.openManualSearchDialog();
      await recallPage.selectManualSearchTag(manualSearch.tag);
      await recallPage.fillManualSearchKeyword(manualSearch.keyword);
      await recallPage.submitManualSearch();
      await recallPage.removeUnpaidPaymentStatusFilterIfPresent();
    }

    return recallPage;
  }

  @step('业务步骤：清空 Recall 当前所有搜索条件')
  async clearSearchConditions(recallPage: RecallPage): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.clearAllSearchConditions();
    return recallPage;
  }

  @step('业务步骤：读取当前 Recall 列表中的最新订单号')
  async readLatestVisibleOrderNumber(recallPage: RecallPage): Promise<string> {
    const visibleOrderNumbers = await waitUntil(
      async () => await recallPage.readVisibleOrderNumbers(),
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
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);

    try {
      await recallPage.expandOrderDetailsPriceSummary();
      return await recallPage.readOrderDetailsSnapshot();
    } finally {
      await recallPage.closeOrderDetailsDialog();
    }
  }

  @step('业务步骤：查看 Recall 第一张可见订单卡片详情')
  async viewFirstVisibleOrderDetails(recallPage: RecallPage): Promise<RecallOrderDetails> {
    await recallPage.openFirstVisibleOrderDetails();
    await recallPage.expandOrderDetailsPriceSummary();
    return await recallPage.readOrderDetailsSnapshot();
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
    return await recallPage.openOrderForEditing(orderNumber, targetOrderNumber);
  }

  @step('业务步骤：从 Recall 第一张可见订单卡片进入编辑点单页')
  async editFirstVisibleOrder(recallPage: RecallPage): Promise<OrderDishesPage> {
    await recallPage.expectLoaded();
    return await recallPage.openFirstVisibleOrderForEditing();
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickSendInOrderDetails();
    return recallPage;
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
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.openPayment();
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickPrintInOrderDetails();
    return recallPage;
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
    options?: Parameters<RecallPage['openSplitInOrderDetails']>[0],
  ): Promise<SplitOrderPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.openSplitInOrderDetails(options);
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickDiscountInOrderDetails();
    return recallPage;
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickOrderDetailsMoreButton();
    return recallPage;
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickChargeInMoreMenu();
    return recallPage;
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickMoveItemInMoreMenu();
    return recallPage;
  }

  @step((_: RecallPage, sourceOrderNumber: string, targetOrderNumber: string) =>
    `业务步骤：将订单 ${sourceOrderNumber} 的第一个菜品移动到已有订单 ${targetOrderNumber}`,
  )
  async moveFirstDishToExistingOrder(
    recallPage: RecallPage,
    sourceOrderNumber: string,
    targetOrderNumber: string,
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(sourceOrderNumber);
    await recallPage.expandOrderDetailsPriceSummary();
    await recallPage.selectFirstOrderDishItem();
    await recallPage.clickMoveItemInMoreMenu();
    await recallPage.expectMoveDishesOutReady();
    await recallPage.clickMoveDishesToExistingOrder();
    await recallPage.expectMoveDishesTargetSelectionReady();
    await recallPage.clickMoveDishesTargetOrder(targetOrderNumber);
    await recallPage.expectMovedOrderDetailsReady(targetOrderNumber);
    return recallPage;
  }

  @step((_: RecallPage, sourceOrderNumber: string) =>
    `业务步骤：将订单 ${sourceOrderNumber} 的第一个菜品移动到新订单`,
  )
  async moveFirstDishToNewOrder(
    recallPage: RecallPage,
    sourceOrderNumber: string,
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(sourceOrderNumber);
    await recallPage.selectFirstOrderDishItem();
    await recallPage.clickMoveItemInMoreMenu();
    await recallPage.expectMoveDishesToNewOrderReady();
    await recallPage.clickMoveDishesToNewOrder();
    await recallPage.expectMovedToNewOrderDetailsReady(sourceOrderNumber);
    return recallPage;
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickCombineInMoreMenu();
    return recallPage;
  }

  @step((_: RecallPage, sourceOrderNumber: string, targetOrderNumber: string) =>
    `业务步骤：从 Recall 将订单 ${sourceOrderNumber} 合并到订单 ${targetOrderNumber}`,
  )
  async combineOrders(
    recallPage: RecallPage,
    sourceOrderNumber: string,
    targetOrderNumber: string,
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(sourceOrderNumber);
    await recallPage.clickCombineInMoreMenu();
    await recallPage.expectCombineTargetSelectionReady();
    await recallPage.clickCombineTargetOrder(targetOrderNumber);
    await recallPage.confirmCombineChargeWarningIfNeeded();
    await recallPage.expectCombinedOrderDetailsReady(targetOrderNumber);
    return recallPage;
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickTipsInMoreMenu();
    return recallPage;
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
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    const message = await recallPage.addOrderDetailsTip(amountInCents);
    await recallPage.closeOrderDetailsDialog();
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickPagingInMoreMenu();
    return recallPage;
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickCallOffInMoreMenu();
    return recallPage;
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickCopyInMoreMenu();
    return recallPage;
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
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickVoidInMoreMenu();
    return recallPage;
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
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.attemptVoidCurrentOrder(options);
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
      await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
      await recallPage.voidCurrentOrder(options);
    }
  }

  @step((_: RecallPage, orderNumber: string) => `业务步骤：从 Recall 作废未分单母单 ${orderNumber}`)
  private async voidUnsplitOrder(
    recallPage: RecallPage,
    orderNumber: string,
    options: RecallVoidOptions = {},
  ): Promise<void> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber);
    await recallPage.voidCurrentOrder(options);
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
      ? await this.enterRecallFromSplitReturnPage(cleanupReturnPage, homePage)
      : await this.enterRecallFromSplitReturnPage(recallPage, homePage);
    await cleanupRecallPage.expectLoaded();
    await cleanupRecallPage.openOrderDetails(orderNumber);
    const targetOrderNumbers = options.requireSplitChildren
      ? await waitUntil(
          async () => await cleanupRecallPage.readTargetOrderNumbers(),
          (orderNumbers) => orderNumbers.length >= 2,
          {
            timeout: 10_000,
            interval: 100,
            message: `Recall 订单 ${orderNumber} 未展示至少两个持久化子单。`,
          },
        )
      : await cleanupRecallPage.readTargetOrderNumbers();

    if (targetOrderNumbers.length > 0) {
      await cleanupRecallPage.openOrderDetails(orderNumber, targetOrderNumbers[0]);
    }

    await cleanupRecallPage.clickClearTableInMoreMenu();

    if (targetOrderNumbers.length > 0) {
      await this.voidSplitChildren(cleanupRecallPage, orderNumber, targetOrderNumbers, options);
      return;
    }

    await this.voidUnsplitOrder(cleanupRecallPage, orderNumber, options);
  }

  @step('业务步骤：从分单提交返回页进入 Recall')
  private async enterRecallFromSplitReturnPage(
    returnedPage: SplitOrderReturnPage,
    homePage: HomePage,
  ): Promise<RecallPage> {
    try {
      if (returnedPage instanceof RecallPage) {
        await returnedPage.expectLoaded();
        return returnedPage;
      }

      if (returnedPage instanceof OrderDishesPage) {
        return await returnedPage.clickRecall();
      }

      return await returnedPage.enterRecall();
    } catch {
      await homePage.expectPrimaryFunctionCardsVisible();
      return await homePage.enterRecall();
    }
  }

  @step('业务步骤：对当前 Recall 订单详情中的所有正向支付流水发起退款')
  async refundAllPaymentRecords(recallPage: RecallPage): Promise<void> {
    await recallPage.expectLoaded();
    const paymentAmounts = (await recallPage.readOrderPaymentAmounts()).filter((amount) => amount > 0);

    for (let index = 0; index < paymentAmounts.length; index += 1) {
      const refundedCountBefore = (await recallPage.readOrderPaymentAmounts()).filter((amount) => amount < 0).length;

      await recallPage.refundPaymentRecord(index);
      await waitUntil(
        async () => {
          const amounts = await recallPage.readOrderPaymentAmounts();
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

  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：从 Recall 打开订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击 More 中的 Sort`
      : `业务步骤：从 Recall 打开订单 ${orderNumber} 并点击 More 中的 Sort`,
  )
  async openSortFromMore(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<RecallPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    await recallPage.clickSortInMoreMenu();
    return recallPage;
  }
}

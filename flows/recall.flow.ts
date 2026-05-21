import {
  RecallPage,
  type RecallOrderDetails,
} from '../pages/recall.page';
import { HomePage } from '../pages/home.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
import { PaymentPage } from '../pages/payment.page';
import { SplitOrderPage } from '../pages/split-order.page';
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
  ): Promise<SplitOrderPage> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.openSplitInOrderDetails();
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

export async function searchRecallOrders(
  recallPage: RecallPage,
  params: RecallSearchParams,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.searchOrders(recallPage, params);
}

export async function clearRecallSearchConditions(recallPage: RecallPage): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.clearSearchConditions(recallPage);
}

export async function readLatestVisibleRecallOrderNumber(
  recallPage: RecallPage,
): Promise<string> {
  const recallFlow = new RecallFlow();
  return await recallFlow.readLatestVisibleOrderNumber(recallPage);
}

export async function openRecallFromHome(
  homePage: HomePage,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openRecallFromHome(homePage);
}

export async function viewRecallOrderDetails(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallOrderDetails> {
  const recallFlow = new RecallFlow();
  return await recallFlow.viewOrderDetails(recallPage, orderNumber, targetOrderNumber);
}

export async function viewFirstVisibleRecallOrderDetails(
  recallPage: RecallPage,
): Promise<RecallOrderDetails> {
  const recallFlow = new RecallFlow();
  return await recallFlow.viewFirstVisibleOrderDetails(recallPage);
}

export async function editRecallOrder(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<OrderDishesPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.editOrder(recallPage, orderNumber, targetOrderNumber);
}

export async function editFirstVisibleRecallOrder(
  recallPage: RecallPage,
): Promise<OrderDishesPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.editFirstVisibleOrder(recallPage);
}

export async function sendRecallOrderToKitchen(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.sendOrderToKitchen(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderPayment(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<PaymentPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openPayment(recallPage, orderNumber, targetOrderNumber);
}

export async function printRecallOrder(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.printOrder(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderSplitPanel(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<SplitOrderPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openSplitOrder(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderDiscount(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openDiscount(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderMoreActions(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openMoreActions(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderChargeFromMore(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openChargeFromMore(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderMoveItemFromMore(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openMoveItemFromMore(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderCombineFromMore(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openCombineFromMore(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderTipsFromMore(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openTipsFromMore(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderPagingFromMore(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openPagingFromMore(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderCallOffFromMore(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openCallOffFromMore(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderCopyFromMore(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openCopyFromMore(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderVoidFromMore(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openVoidFromMore(recallPage, orderNumber, targetOrderNumber);
}

export async function openRecallOrderSortFromMore(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  return await recallFlow.openSortFromMore(recallPage, orderNumber, targetOrderNumber);
}

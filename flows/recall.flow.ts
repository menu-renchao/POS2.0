import {
  RecallPage,
  type RecallOrderDetails,
} from '../pages/recall.page';
import { HomePage } from '../pages/home.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
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
    const recallPage = await homePage.clickRecall();
    await recallPage.expectLoaded();

    return recallPage;
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

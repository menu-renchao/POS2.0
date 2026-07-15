import { HomePage } from '../pages/home.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
import { RecallPage } from '../pages/recall.page';
import {
  type SplitOrderReturnPage,
  type SplitOrderSnapshot,
  type SplitOrderSuborderSnapshot,
  SplitOrderPage,
} from '../pages/split-order.page';
import { step } from '../utils/step';
import { PaymentFlow } from './payment.flow';

export const SPLIT_ORDER_SUBORDER_INDICES = ['1', '2', '3'] as const;

export type SplitOrderSuborderIndex = (typeof SPLIT_ORDER_SUBORDER_INDICES)[number];

export type EvenSplitDishOnSuborderParams = {
  dishName: string;
  splitCount: number;
  suborderIndex: SplitOrderSuborderIndex;
};

export type PartialSplitPaymentOptions = {
  paidSuborderIndex: number;
  printReceipt: boolean;
  splitCount: number;
};

export type PartialSplitPaymentResult = {
  afterPayment: SplitOrderSnapshot;
  paidSuborder: SplitOrderSuborderSnapshot;
  parentOrderNumber: string;
  returnPage: SplitOrderReturnPage;
  unpaidSuborders: SplitOrderSuborderSnapshot[];
};

function assertSplitOrderSuborderIndex(
  suborderIndex: string,
): asserts suborderIndex is SplitOrderSuborderIndex {
  if (!SPLIT_ORDER_SUBORDER_INDICES.includes(suborderIndex as SplitOrderSuborderIndex)) {
    throw new Error(
      `子单序号仅支持 ${SPLIT_ORDER_SUBORDER_INDICES.join('、')}，收到：${suborderIndex}`,
    );
  }
}

export class SplitOrderFlow {
  @step((_splitOrderPage: SplitOrderPage, count: number) => `业务步骤：将当前订单平分为 ${count} 份`)
  async splitOrderEvenly(splitOrderPage: SplitOrderPage, count: number): Promise<void> {
    await splitOrderPage.clickEvenOrder();
    await splitOrderPage.fillSplitCount(count);
    await splitOrderPage.confirmSplitInput();
  }

  @step(
    (_splitOrderPage: SplitOrderPage, options: PartialSplitPaymentOptions) =>
      `业务步骤：将订单平分为 ${options.splitCount} 份，现金支付第 ${options.paidSuborderIndex} 个子单并提交`,
  )
  async splitEvenlyPaySuborderByCashAndSubmit(
    splitOrderPage: SplitOrderPage,
    options: PartialSplitPaymentOptions,
  ): Promise<PartialSplitPaymentResult> {
    if (!Number.isInteger(options.splitCount) || options.splitCount < 1) {
      throw new Error(`平分份数必须是正整数，收到：${options.splitCount}`);
    }
    if (
      !Number.isInteger(options.paidSuborderIndex) ||
      options.paidSuborderIndex < 1 ||
      options.paidSuborderIndex > options.splitCount
    ) {
      throw new Error(
        `支付子单序号必须是 1 到 ${options.splitCount} 的整数，收到：${options.paidSuborderIndex}`,
      );
    }

    await this.splitOrderEvenly(splitOrderPage, options.splitCount);
    const beforePayment = await splitOrderPage.readSnapshot();
    const paidSuborder = beforePayment.suborders[options.paidSuborderIndex - 1];

    if (!paidSuborder) {
      throw new Error(
        `分单后不存在第 ${options.paidSuborderIndex} 个子单；实际子单数：${beforePayment.suborders.length}`,
      );
    }

    const paymentPage = await splitOrderPage.openSuborderPayment(options.paidSuborderIndex);
    await new PaymentFlow().payByCash(paymentPage, {
      printReceipt: options.printReceipt,
    });

    const afterPayment = await splitOrderPage.readSnapshot();
    const settledPaidSuborder = afterPayment.suborders.find(
      (suborder) => suborder.orderNumber === paidSuborder.orderNumber,
    );

    if (!settledPaidSuborder) {
      throw new Error(`支付后未找到子单 ${paidSuborder.orderNumber}。`);
    }

    const parentOrderNumber = settledPaidSuborder.orderNumber.split('-')[0];
    if (!parentOrderNumber) {
      throw new Error(`无法从子单号 ${settledPaidSuborder.orderNumber} 解析母单号。`);
    }

    const unpaidSuborders = afterPayment.suborders.filter(
      (suborder) => suborder.orderNumber !== settledPaidSuborder.orderNumber,
    );
    await splitOrderPage.submitAndWaitForSuccess();
    await splitOrderPage.clickBlankOutsideSubmittedSplitModal();
    const returnPage = await splitOrderPage.dismissOrderSummaryIfNeededAndReturnHome();

    return {
      afterPayment,
      paidSuborder: settledPaidSuborder,
      parentOrderNumber,
      returnPage,
      unpaidSuborders,
    };
  }

  @step((_splitOrderPage: SplitOrderPage, amounts: number[]) => `业务步骤：按金额分单，金额序列为 ${amounts.join('、')}`)
  async splitOrderByAmounts(splitOrderPage: SplitOrderPage, amounts: number[]): Promise<void> {
    if (amounts.length === 0) {
      return;
    }

    await splitOrderPage.clickByAmount();
    await splitOrderPage.fillSplitAmount(amounts[0]);
    await splitOrderPage.confirmSplitInput();

    for (let index = 1; index < amounts.length; index += 1) {
      await splitOrderPage.clickAddAmountSuborder();
      await splitOrderPage.fillSplitAmount(amounts[index]);
      await splitOrderPage.confirmSplitInput();
    }
  }

  @step('业务步骤：按座位分单')
  async splitOrderBySeats(splitOrderPage: SplitOrderPage): Promise<void> {
    await splitOrderPage.clickBySeats();
  }

  @step((_splitOrderPage: SplitOrderPage, count: number) => `业务步骤：将可平分菜品按 ${count} 份进行分单`)
  async splitOrderByItems(splitOrderPage: SplitOrderPage, count: number = 2): Promise<void> {
    const snapshot = await splitOrderPage.readSnapshot();

    for (const suborder of snapshot.suborders) {
      if (suborder.paidStatus) {
        continue;
      }

      for (const dish of suborder.dishes) {
        if (dish.proportion && /^1\/\d+$/.test(dish.proportion)) {
          continue;
        }

        await splitOrderPage.toggleDishSelection(suborder.orderNumber, dish.name);
      }
    }

    await splitOrderPage.clickEvenItems();
    await splitOrderPage.fillSplitCount(count);
    await splitOrderPage.confirmSplitInput();
  }

  @step(
    (_splitOrderPage: SplitOrderPage, params: EvenSplitDishOnSuborderParams) =>
      `业务步骤：在子单 ${params.suborderIndex} 对菜品 ${params.dishName} 执行按菜品平分为 ${params.splitCount} 份`,
  )
  async evenSplitDishOnSuborder(
    splitOrderPage: SplitOrderPage,
    params: EvenSplitDishOnSuborderParams,
  ): Promise<void> {
    assertSplitOrderSuborderIndex(params.suborderIndex);

    const orderNumber = await this.resolveSuborderIndex(splitOrderPage, params.suborderIndex);
    const eligible = await splitOrderPage.isDishEligibleForEvenSplit(orderNumber, params.dishName);

    if (!eligible) {
      throw new Error(
        `子单 ${params.suborderIndex} 的菜品 ${params.dishName} 当前不可按菜品平分，可能已存在比例或子单已支付。`,
      );
    }

    await splitOrderPage.toggleDishSelection(orderNumber, params.dishName);
    await splitOrderPage.clickEvenItems();
    await splitOrderPage.fillSplitCount(params.splitCount);
    await splitOrderPage.confirmSplitInput();
  }

  @step(
    (_splitOrderPage: SplitOrderPage, sourceOrderNumber: string, dishNames: string[], targetOrderNumber: string) =>
      `业务步骤：将子单 ${sourceOrderNumber} 的菜品 ${dishNames.join('、')} 移动到子单 ${targetOrderNumber}`,
  )
  async moveDishes(
    splitOrderPage: SplitOrderPage,
    sourceOrderNumber: string,
    dishNames: string[],
    targetOrderNumber: string,
  ): Promise<void> {
    if (dishNames.length === 0) {
      return;
    }

    const normalizedTargetOrderNumber = targetOrderNumber.replace(/^#/, '');

    for (const dishName of dishNames) {
      await splitOrderPage.clickDish(sourceOrderNumber, dishName);
      await splitOrderPage.receiveDishOnSuborder(normalizedTargetOrderNumber);
    }
  }

  @step(
    (
      _splitOrderPage: SplitOrderPage,
      sourceSuborderIndex: SplitOrderSuborderIndex,
      dishNames: string[],
      targetSuborderIndex: SplitOrderSuborderIndex,
    ) =>
      `业务步骤：将子单 ${sourceSuborderIndex} 的菜品 ${dishNames.join('、')} 移动到子单 ${targetSuborderIndex}`,
  )
  async moveDishesBySuborderIndex(
    splitOrderPage: SplitOrderPage,
    sourceSuborderIndex: SplitOrderSuborderIndex,
    dishNames: string[],
    targetSuborderIndex: SplitOrderSuborderIndex,
  ): Promise<void> {
    assertSplitOrderSuborderIndex(sourceSuborderIndex);
    assertSplitOrderSuborderIndex(targetSuborderIndex);

    const sourceOrderNumber = await this.resolveSuborderIndex(splitOrderPage, sourceSuborderIndex);
    const targetOrderNumber = await this.resolveSuborderIndex(splitOrderPage, targetSuborderIndex);

    await this.moveDishes(splitOrderPage, sourceOrderNumber, dishNames, targetOrderNumber);
  }

  @step((_: SplitOrderPage, dishName: string) => `业务步骤：将菜品 ${dishName} 移入新建子单`)
  async moveDishToNewSuborder(
    splitOrderPage: SplitOrderPage,
    dishName: string,
  ): Promise<void> {
    const snapshot = await splitOrderPage.readSnapshot();
    const sourceOrder = snapshot.suborders.find((suborder) =>
      suborder.dishes.some((dish) => dish.name === dishName),
    );

    if (!sourceOrder) {
      throw new Error(`分单面板中未找到包含菜品 ${dishName} 的源子单。`);
    }

    await splitOrderPage.clickDish(sourceOrder.orderNumber, dishName);
    await splitOrderPage.clickAddSuborder();
    await splitOrderPage.expectSuborderIndexVisible(2);
  }

  @step((_splitOrderPage: SplitOrderPage, orderNumbers?: string[]) => `业务步骤：合并分单${orderNumbers?.length ? `，目标子单为 ${orderNumbers.join('、')}` : ''}`)
  async combineSuborders(
    splitOrderPage: SplitOrderPage,
    orderNumbers?: string[],
  ): Promise<void> {
    const snapshot = await splitOrderPage.readSnapshot();
    const targetOrders =
      orderNumbers && orderNumbers.length > 0
        ? orderNumbers
        : snapshot.suborders.filter((suborder) => !suborder.paidStatus).map((suborder) => suborder.orderNumber);

    if (targetOrders.length < 2) {
      return;
    }

    await splitOrderPage.clickCombine();

    for (const orderNumber of targetOrders) {
      await splitOrderPage.toggleCombineOrder(orderNumber);
    }

    await splitOrderPage.confirmCombine();
  }

  @step('业务步骤：撤销当前分单')
  async cancelSplit(splitOrderPage: SplitOrderPage): Promise<void> {
    await splitOrderPage.clickCancelSplit();
  }

  @step('业务步骤：读取分单操作阻断提示')
  async readBlockingMessage(splitOrderPage: SplitOrderPage): Promise<string> {
    return await splitOrderPage.readBlockingMessage();
  }

  @step('业务步骤：提交分单并根据当前地址返回对应页面对象')
  async submitAndReturnPage(
    splitOrderPage: SplitOrderPage,
  ): Promise<HomePage | OrderDishesPage | RecallPage> {
    const page = await splitOrderPage.submitAndReturnPage();
    return this.assertReturnPage(page);
  }

  @step(
    (_splitOrderPage: SplitOrderPage, suborderIndex: SplitOrderSuborderIndex) =>
      `业务步骤：解析子单序号 ${suborderIndex} 对应的子单单号`,
  )
  async resolveSuborderIndex(
    splitOrderPage: SplitOrderPage,
    suborderIndex: SplitOrderSuborderIndex,
  ): Promise<string> {
    assertSplitOrderSuborderIndex(suborderIndex);

    const orderNumber = await splitOrderPage.readSuborderOrderNumberByIndex(suborderIndex);

    if (!orderNumber) {
      throw new Error(`未找到子单序号 ${suborderIndex} 对应的分单子单。`);
    }

    return orderNumber;
  }

  private assertReturnPage(page: SplitOrderReturnPage): HomePage | OrderDishesPage | RecallPage {
    if (page instanceof RecallPage) {
      return page;
    }

    if (page instanceof OrderDishesPage) {
      return page;
    }

    return page;
  }
}

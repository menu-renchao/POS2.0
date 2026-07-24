import { expect } from '@playwright/test';
import type { SystemConfigurationInputValue } from '../api/setup/system-configuration.setup';
import type { EmployeeLoginPage } from '../pages/employee-login.page';
import type { HomePage } from '../pages/home.page';
import type { OrderDishesPage } from '../pages/order-dishes.page';
import type { RecallPage } from '../pages/recall.page';
import {
  orderServiceDishes,
  orderServiceSplitOperationCase,
} from '../test-data/order-service';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import type { EmployeeLoginFlow } from './employee-login.flow';
import type { OrderDishesFlow } from './order-dishes.flow';
import type { OrderRegressionFlow } from './order-regression.flow';
import type { PaymentFlow } from './payment.flow';
import type { RecallFlow } from './recall.flow';
import type { SelectTableFlow } from './select-table.flow';
import type { SplitOrderTargets } from './split-order.types';
import type { SplitOrderFlow } from './split-order.flow';
import type { TakeoutFlow } from './takeout.flow';

export type SplitRecallContext = {
  recallPage: RecallPage;
  targets: SplitOrderTargets;
};

export type ConfigurationResourceRegistrar = {
  updateByName(
    name: string,
    value: SystemConfigurationInputValue,
    options?: { userId?: number; verify?: boolean },
  ): Promise<void>;
};

export class SplitOrderOperationFlow {
  constructor(
    private readonly employeeLoginFlow: EmployeeLoginFlow,
    private readonly orderDishesFlow: OrderDishesFlow,
    private readonly orderRegressionFlow: OrderRegressionFlow,
    private readonly paymentFlow: PaymentFlow,
    private readonly recallFlow: RecallFlow,
    private readonly selectTableFlow: SelectTableFlow,
    private readonly splitOrderFlow: SplitOrderFlow,
    private readonly takeoutFlow: TakeoutFlow,
    private readonly configurationResources: ConfigurationResourceRegistrar,
  ) {}

  @step('业务流程：启用座位显示并刷新首页配置')
  async enableSeatDisplayOnHome(homePage: HomePage): Promise<void> {
    await this.configurationResources.updateByName(
      'IS_SHOW_SEATS',
      '0',
      { verify: true },
    );
    await homePage.clickRefresh();
  }

  @step('业务流程：向订单加入两份常规菜品')
  async addTwoRegularDishes(orderDishesPage: OrderDishesPage): Promise<void> {
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.test.name,
      orderServiceDishes.test.menu,
    );
  }

  @step('业务流程：创建按座位分单并进入 Recall')
  async createSeatSplitRecallOrder(
    readyHomePage: HomePage,
    options: {
      addTip?: boolean;
      tipAmountInCents?: number;
    },
  ): Promise<SplitRecallContext> {
    const selectTablePage = await readyHomePage.enterDineIn();
    const { orderDishesPage } =
      await this.selectTableFlow.selectAnyAvailableTableAndEnterOrderDishes(
        selectTablePage,
        2,
      );
    await this.addSharedAndSeatDishes(orderDishesPage);

    if (options.addTip || options.tipAmountInCents !== undefined) {
      await orderDishesPage.tips.addTip(
        options.tipAmountInCents ??
          orderServiceSplitOperationCase.tipAmountInCents,
      );
    }

    const splitOrderPage = await orderDishesPage.navigation.openSplitOrder();
    await this.splitOrderFlow.splitOrderBySeats(splitOrderPage);
    const returnedPage =
      await this.splitOrderFlow.submitAndReturnPage(splitOrderPage);
    const recallPage =
      await this.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
    const targets = await this.openLatestSplitOrderTargets(recallPage);
    return { recallPage, targets };
  }

  @step('业务流程：创建按金额分单并进入 Recall')
  async createAmountSplitRecallOrder(
    readyHomePage: HomePage,
  ): Promise<SplitRecallContext> {
    const orderDishesPage = await this.enterDineInNoTableOrder(readyHomePage);
    await this.addTwoRegularDishes(orderDishesPage);
    await orderDishesPage.tips.addTip(
      orderServiceSplitOperationCase.tipAmountInCents,
    );

    const splitOrderPage = await orderDishesPage.navigation.openSplitOrder();
    const beforeSplitSnapshot = await splitOrderPage.readSnapshot();
    const totalBeforeSplit = Number(beforeSplitSnapshot.total);
    expect(
      totalBeforeSplit,
      '按金额分单前应能读取订单总额。',
    ).toBeGreaterThan(0);

    const firstAmount =
      orderServiceSplitOperationCase.amountSplitFirstAmount;
    const secondAmount = Number((totalBeforeSplit - firstAmount).toFixed(2));
    await this.splitOrderFlow.splitOrderByAmounts(splitOrderPage, [
      firstAmount,
      secondAmount,
    ]);
    const returnedPage =
      await this.splitOrderFlow.submitAndReturnPage(splitOrderPage);
    const recallPage =
      await this.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
    const targets = await this.openLatestSplitOrderTargets(recallPage);
    return { recallPage, targets };
  }

  @step('业务流程：创建平均分单并进入 Recall')
  async createEvenSplitRecallOrder(
    readyHomePage: HomePage,
  ): Promise<SplitRecallContext> {
    const orderDishesPage = await this.enterDineInNoTableOrder(readyHomePage);
    await this.addTwoRegularDishes(orderDishesPage);
    await orderDishesPage.tips.addTip(
      orderServiceSplitOperationCase.tipAmountInCents,
    );

    const splitOrderPage = await orderDishesPage.navigation.openSplitOrder();
    await this.splitOrderFlow.splitOrderEvenly(splitOrderPage, 2);
    const returnedPage =
      await this.splitOrderFlow.submitAndReturnPage(splitOrderPage);
    const recallPage =
      await this.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
    const targets = await this.openLatestSplitOrderTargets(recallPage);
    return { recallPage, targets };
  }

  @step('业务流程：创建外带平均分单并进入 Recall')
  async createToGoEvenSplitRecallOrder(
    readyHomePage: HomePage,
  ): Promise<SplitRecallContext> {
    const orderDishesPage = await this.takeoutFlow.startToGoOrder(readyHomePage);
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );

    const splitOrderPage = await orderDishesPage.navigation.openSplitOrder();
    await this.splitOrderFlow.splitOrderEvenly(splitOrderPage, 2);
    const returnedPage =
      await this.splitOrderFlow.submitAndReturnPage(splitOrderPage);
    const recallPage =
      await this.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
    const targets = await this.openLatestSplitOrderTargets(recallPage);
    return { recallPage, targets };
  }

  @step('业务流程：读取指定分单子单总额')
  async readTargetTotal(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber: string,
  ): Promise<number> {
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    const priceSummary = await recallPage.orderDetails.readDisplayedOrderPriceSummary();
    return priceSummary.Total ?? priceSummary['Total(Cash)'] ?? 0;
  }

  @step('业务流程：创建多金额分单并进入 Recall')
  async createMultiAmountSplitRecallOrder(
    readyHomePage: HomePage,
  ): Promise<SplitRecallContext & { beforeTotal: number }> {
    const orderDishesPage = await this.enterDineInNoTableOrder(readyHomePage);
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );
    await orderDishesPage.menu.changeOrderedDishPrice(
      orderServiceDishes.regular.name,
      orderServiceSplitOperationCase.multiAmountSplitChangedDishPrice,
    );
    await this.orderDishesFlow.clearAllCharges(orderDishesPage, {
      scope: 'whole',
    });
    const beforeSummary = await orderDishesPage.reads.readPriceSummary();
    const beforeTotal = beforeSummary['Total(Cash)'];
    expect(beforeTotal).toBeCloseTo(
      orderServiceSplitOperationCase.multiAmountExpectedTotal,
      2,
    );

    const splitOrderPage = await orderDishesPage.navigation.openSplitOrder();
    await this.splitOrderFlow.splitOrderByAmounts(splitOrderPage, [
      orderServiceSplitOperationCase.multiAmountFirstSplitAmount,
      orderServiceSplitOperationCase.multiAmountSecondSplitAmount,
    ]);
    const returnedPage =
      await this.splitOrderFlow.submitAndReturnPage(splitOrderPage);
    const recallPage =
      await this.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
    const targets = await this.openLatestSplitOrderTargets(recallPage);

    return { beforeTotal, recallPage, targets };
  }

  @step('业务流程：读取报表首页未支付金额')
  async readReportHomeUnpaidAmount(homePage: HomePage): Promise<number> {
    const reportPage = await homePage.enterReport();
    await reportPage.enterWithPasscode('11');
    return await reportPage.readOverviewAmount('Unpaid');
  }

  @step('业务流程：读取报表首页费用金额')
  async readReportFeeAmount(homePage: HomePage): Promise<number> {
    const reportPage = await homePage.enterReport();
    await reportPage.enterWithPasscode('11');
    return await reportPage.readOverviewAmount('Fee');
  }

  @step('业务流程：转移订单服务员并读取详情快照')
  async transferOrderServerAndReadSnapshot(
    recallPage: RecallPage,
    serverName: string,
  ): Promise<{
    serverName: string | null;
    status: string | null;
    total: number | null;
  }> {
    await recallPage.orderDetails.changeOrderServer(serverName);
    const details = await recallPage.orderDetails.readOrderDetailsSnapshot();
    return {
      serverName: details.orderContext.serverName,
      status: details.paymentStatus,
      total:
        details.priceSummary.Total ??
        details.priceSummary['Total(Cash)'] ??
        null,
    };
  }

  @step('业务流程：使用现金支付指定分单子单')
  async payTargetOrderByCash(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber: string,
  ): Promise<void> {
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    const paymentPage = await recallPage.orderDetails.openPayment();
    await this.paymentFlow.payByCash(paymentPage, { printReceipt: false });
    await recallPage.orderDetails.closeOrderDetailsDialog();
  }

  @step('业务流程：使用现金部分支付指定分单子单')
  async payTargetOrderByPartialCash(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber: string,
  ): Promise<void> {
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    const paymentPage = await recallPage.orderDetails.openPayment();
    await this.paymentFlow.payPartialByCash(paymentPage, {
      amountInCents:
        orderServiceSplitOperationCase.partialPaymentAmountInCents,
      printReceipt: false,
    });
    await recallPage.orderDetails.closeOrderDetailsDialog();
  }

  @step('业务流程：创建含两笔现金支付记录的 Recall 订单')
  async createMultiPaymentRecallOrder(
    readyHomePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
  ): Promise<{
    orderNumber: string;
    paidAmounts: number[];
    recallPage: RecallPage;
  }> {
    const orderDishesPage = await this.enterDineInNoTableOrder(readyHomePage);
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );
    await orderDishesPage.menu.changeOrderedDishPrice(
      orderServiceDishes.regular.name,
      orderServiceSplitOperationCase.multiPaymentChangedDishPrice,
    );
    await orderDishesPage.menu.setOrderedDishTaxExempt(
      orderServiceDishes.regular.name,
      true,
    );
    await this.orderDishesFlow.clearAllCharges(orderDishesPage, {
      scope: 'whole',
    });
    const priceSummary = await orderDishesPage.reads.readPriceSummary();
    expect(priceSummary.Tax).toBe(0);
    expect(priceSummary['Total(Cash)']).toBe(
      orderServiceSplitOperationCase.multiPaymentChangedDishPrice,
    );

    const savedHomePage = await orderDishesPage.navigation.saveOrder();
    const employeeHomePage =
      await this.employeeLoginFlow.enterEmployeeContext(
        savedHomePage,
        employeeLoginPage,
      );
    const recallPage =
      await this.recallFlow.openRecallFromHome(employeeHomePage);
    const orderNumber =
      await this.recallFlow.readLatestVisibleOrderNumber(recallPage);
    const paymentPage =
      await this.recallFlow.openPayment(recallPage, orderNumber);
    await this.paymentFlow.payPartialByCash(paymentPage, {
      amountInCents:
        orderServiceSplitOperationCase.multiPaymentAmountInCents,
      printReceipt: false,
    });
    await recallPage.orderDetails.closeOrderDetailsDialog();
    const remainingPaymentPage =
      await this.recallFlow.openPayment(recallPage, orderNumber);
    await this.paymentFlow.payByCash(remainingPaymentPage, {
      printReceipt: false,
    });
    await recallPage.orderDetails.closeOrderDetailsDialog();

    await this.recallFlow.clearSearchConditions(recallPage);
    await recallPage.orderDetails.openOrderDetails(orderNumber);
    const paidAmounts = (await recallPage.orderDetails.readOrderPaymentAmounts()).filter(
      (amount) => amount > 0,
    );
    await recallPage.orderDetails.closeOrderDetailsDialog();

    expect(paidAmounts).toHaveLength(2);
    return { orderNumber, paidAmounts, recallPage };
  }

  @step('业务流程：向共享座位和指定座位分别加入菜品')
  private async addSharedAndSeatDishes(
    orderDishesPage: OrderDishesPage,
  ): Promise<void> {
    await orderDishesPage.menu.selectSharedSeat();
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );
    await orderDishesPage.menu.selectSeat(1);
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.test.name,
      orderServiceDishes.test.menu,
    );
  }

  @step('业务流程：进入堂食无桌点单页')
  private async enterDineInNoTableOrder(
    homePage: HomePage,
  ): Promise<OrderDishesPage> {
    const orderDishesPage =
      await this.selectTableFlow.enterDineInNoTableOrder(homePage);
    await orderDishesPage.expectLoaded();
    return orderDishesPage;
  }

  @step('业务流程：打开最新分单订单并读取子单目标')
  private async openLatestSplitOrderTargets(
    recallPage: RecallPage,
  ): Promise<SplitOrderTargets> {
    const latestVisibleOrderNumber =
      await this.recallFlow.readLatestVisibleOrderNumber(recallPage);
    const orderNumber = latestVisibleOrderNumber.replace(/-\d+$/, '');
    await recallPage.orderDetails.openOrderDetails(orderNumber);
    const targetOrderNumbers = await waitUntil(
      async () => await recallPage.orderDetails.readTargetOrderNumbers(),
      (orderNumbers) => orderNumbers.length >= 2,
      {
        timeout: 10_000,
        interval: 250,
        message: `Recall 母单 ${orderNumber} 未稳定展示至少两个分单子单。`,
      },
    );

    expect(
      targetOrderNumbers.length,
      'Recall 详情应至少展示两个分单子单。',
    ).toBeGreaterThanOrEqual(2);
    const [firstTargetOrderNumber, secondTargetOrderNumber] =
      targetOrderNumbers;
    expect(firstTargetOrderNumber, '第一个子单号应存在。').toBeTruthy();
    expect(secondTargetOrderNumber, '第二个子单号应存在。').toBeTruthy();

    return {
      firstTargetOrderNumber,
      orderNumber,
      secondTargetOrderNumber,
    };
  }
}

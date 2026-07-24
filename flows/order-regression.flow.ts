import type { EmployeeLoginPage } from '../pages/employee-login.page';
import type { HomePage } from '../pages/home.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
import { RecallPage } from '../pages/recall.page';
import type { RecallFlow } from './recall.flow';
import type { EmployeeLoginFlow } from './employee-login.flow';
import type { HomeFlow } from './home.flow';
import { step } from '../utils/step';

export class OrderRegressionFlow {
  constructor(
    private readonly homeFlow: HomeFlow,
    private readonly employeeLoginFlow: EmployeeLoginFlow,
    private readonly recallFlow: RecallFlow,
  ) {}

  @step('业务流程：进入 POS 主页并建立员工上下文')
  async enterReadyHome(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
  ): Promise<HomePage> {
    const readyHomePage = await this.homeFlow.openHomeWithEmployeeContext(
      homePage,
      employeeLoginPage,
    );
    await readyHomePage.expectPrimaryFunctionCardsVisible();
    return readyHomePage;
  }

  @step('业务流程：保存订单并读取对应 Recall 详情')
  async saveAndReadRecallDetails(
    orderDishesPage: OrderDishesPage,
    employeeLoginPage: EmployeeLoginPage,
  ) {
    const { homePage, orderNumber } =
      await orderDishesPage.navigation.saveOrderWithReference();
    const readyHomePage = await this.employeeLoginFlow.enterEmployeeContext(
      homePage,
      employeeLoginPage,
    );
    const recallPage = await this.recallFlow.openRecallFromHome(readyHomePage);
    await recallPage.orderDetails.openOrderDetails(orderNumber);
    return {
      details: await recallPage.orderDetails.readOrderDetailsSnapshot(),
      orderNumber,
      recallPage,
    };
  }

  @step('业务流程：保存订单并从 Recall 打开分单页')
  async saveAndOpenSplit(
    orderPage: OrderDishesPage,
    employeeLoginPage: EmployeeLoginPage,
    options?: Parameters<RecallFlow['openSplitOrder']>[3],
  ) {
    const { homePage, orderNumber } =
      await orderPage.navigation.saveOrderWithReference();
    const readyHomePage = await this.employeeLoginFlow.enterEmployeeContext(
      homePage,
      employeeLoginPage,
    );
    const recallPage = await this.recallFlow.openRecallFromHome(readyHomePage);
    const splitOrderPage = await this.recallFlow.openSplitOrder(
      recallPage,
      orderNumber,
      undefined,
      options,
    );
    return { orderNumber, recallPage, splitOrderPage };
  }

  @step('业务流程：从返回页面进入 Recall')
  async enterRecallFromReturnedPage(
    returnedPage: HomePage | OrderDishesPage | RecallPage,
  ): Promise<RecallPage> {
    if (returnedPage instanceof RecallPage) {
      return returnedPage;
    }

    return returnedPage instanceof OrderDishesPage
      ? await returnedPage.navigation.clickRecall()
      : await returnedPage.clickRecall();
  }

  @step('业务流程：保存订单并打开 Recall 首条可见订单详情')
  async saveOrderAndOpenLatestRecallDetails(orderDishesPage: OrderDishesPage) {
    const savedHomePage = await orderDishesPage.navigation.saveOrder();
    await savedHomePage.expectPrimaryFunctionCardsVisible();
    const recallPage = await this.recallFlow.openRecallFromHome(savedHomePage);
    return await this.recallFlow.viewFirstVisibleOrderDetails(recallPage);
  }

  @step('业务流程：保存订单并打开 Recall 页面')
  async saveOrderAndOpenRecallPage(
    orderDishesPage: OrderDishesPage,
  ): Promise<RecallPage> {
    const savedHomePage = await orderDishesPage.navigation.saveOrder();
    await savedHomePage.expectPrimaryFunctionCardsVisible();
    return await this.recallFlow.openRecallFromHome(savedHomePage);
  }

  @step('业务流程：读取目标分单的小费金额')
  async readTargetTips(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber: string,
  ): Promise<number> {
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    const priceSummary = await recallPage.orderDetails.readDisplayedOrderPriceSummary();
    return priceSummary.Tips ?? 0;
  }
}

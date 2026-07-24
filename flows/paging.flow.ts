import type { HomePage } from '../pages/home.page';
import type { PagingPage } from '../pages/paging.page';
import { orderServiceDishes } from '../test-data/order-service';
import { step } from '../utils/step';
import { OrderDishesFlow } from './order-dishes.flow';
import { RecallFlow } from './recall.flow';
import { SelectTableFlow } from './select-table.flow';

export type PagingOrderReference = {
  homePage: HomePage;
  orderNumber: string;
};

export class PagingFlow {
  constructor(
    private readonly selectTableFlow: SelectTableFlow,
    private readonly orderDishesFlow: OrderDishesFlow,
    private readonly recallFlow: RecallFlow,
  ) {}

  @step('业务步骤：创建无桌位堂食订单、添加普通菜并整单送厨')
  async createSentDineInOrder(homePage: HomePage): Promise<PagingOrderReference> {
    const orderDishesPage = await this.selectTableFlow.enterDineInNoTableOrder(homePage);
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );
    const sentOrder = await orderDishesPage.navigation.sendOrderWithReference();
    return {
      homePage: sentOrder.homePage,
      orderNumber: sentOrder.orderNumber,
    };
  }

  @step((_homePage: HomePage, orderNumber: string) => `业务步骤：从 Recall 进入 Paging 并定位订单 ${orderNumber}`)
  async openPagingForOrder(homePage: HomePage, orderNumber: string): Promise<PagingPage> {
    const recallPage = await this.recallFlow.openRecallFromHome(homePage);
    const pagingPage = await recallPage.enterPaging();
    await pagingPage.waitForOrderVisible(orderNumber);
    return pagingPage;
  }

  @step((_pagingPage: PagingPage, orderNumber: string) => `业务步骤：组合筛选并搜索 Paging 订单 ${orderNumber}`)
  async searchDineInOrder(pagingPage: PagingPage, orderNumber: string): Promise<void> {
    await pagingPage.selectOrderType('Dine In');
    await pagingPage.fillOrderSearch(orderNumber);
    await pagingPage.waitForOrderVisible(orderNumber);
  }

  @step((_pagingPage: PagingPage, orderNumber: string) => `业务步骤：将 Paging 订单 ${orderNumber} 叫号后销号`)
  async readyAndCallOffOrder(pagingPage: PagingPage, orderNumber: string): Promise<void> {
    await pagingPage.selectStatus('preparing');
    await pagingPage.waitForOrderVisible(orderNumber);
    await pagingPage.markOrderReady(orderNumber);
    await pagingPage.selectStatus('ready');
    await pagingPage.waitForOrderVisible(orderNumber);
    await pagingPage.callOffOrder(orderNumber);
    await pagingPage.selectStatus('completed');
    await pagingPage.waitForOrderVisible(orderNumber);
  }

  @step((_pagingPage: PagingPage, orderNumber: string) => `业务步骤：叫号订单 ${orderNumber} 后完成全部待取餐订单`)
  async readyAndCompleteAllOrders(pagingPage: PagingPage, orderNumber: string): Promise<void> {
    await pagingPage.selectStatus('preparing');
    await pagingPage.waitForOrderVisible(orderNumber);
    await pagingPage.markOrderReady(orderNumber);
    await pagingPage.selectStatus('ready');
    await pagingPage.waitForOrderVisible(orderNumber);
    await pagingPage.completeAllReadyOrders();
    await pagingPage.selectStatus('completed');
    await pagingPage.waitForOrderVisible(orderNumber);
  }

  @step('业务步骤：从 Paging 返回 POS 首页')
  async returnHome(pagingPage: PagingPage, homePage: HomePage): Promise<void> {
    await pagingPage.clickBackHome();
    await homePage.expectEmployeeReady();
  }
}

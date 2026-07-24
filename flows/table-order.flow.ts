import type { HomePage } from '../pages/home.page';
import type { RecallOrderDetails } from '../pages/recall.page';
import type {
  SelectedTableRecord,
  SelectTablePage,
} from '../pages/select-table.page';
import {
  buildOrderServiceDineInCustomer,
  orderServiceDishes,
} from '../test-data/order-service';
import { step } from '../utils/step';
import type { OrderCustomerFlow } from './order-customer.flow';
import type { OrderDishesFlow } from './order-dishes.flow';
import type { RecallFlow } from './recall.flow';
import type { SelectTableFlow } from './select-table.flow';

export type CreatedTableOrder = {
  homePage: HomePage;
  orderNumber: string;
  selectedTable: SelectedTableRecord;
};

export type CreateTableOrderOptions = {
  customer?: ReturnType<typeof buildOrderServiceDineInCustomer>;
  guestCount?: number;
  switchArea?: boolean;
};

export type TableOrderResourceRegistrar = {
  registerTableOrder(orderNumber: string): Promise<number>;
};

export class TableOrderFlow {
  constructor(
    private readonly orderCustomerFlow: OrderCustomerFlow,
    private readonly orderDishesFlow: OrderDishesFlow,
    private readonly recallFlow: RecallFlow,
    private readonly selectTableFlow: SelectTableFlow,
    private readonly uiResources: TableOrderResourceRegistrar,
  ) {}

  @step('业务步骤：在可用桌台创建并登记堂食订单')
  async createTableOrder(
    homePage: HomePage,
    options: CreateTableOrderOptions = {},
  ): Promise<CreatedTableOrder> {
    const guestCount = options.guestCount ?? 2;
    const selectTablePage = await homePage.enterDineIn();
    const { selectedTable } = options.switchArea
      ? await this.selectTableFlow.selectAvailableTableInAnotherArea(
          selectTablePage,
        )
      : await this.selectTableFlow.selectAnyAvailableTable(selectTablePage);
    const orderDishesPage =
      await selectTablePage.enterOrderDishesAfterSelectingTable(guestCount);
    await orderDishesPage.expectLoaded();

    if (options.customer) {
      await this.orderCustomerFlow.addCustomerInformationToOrder(
        orderDishesPage,
        options.customer,
      );
    }

    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );
    const savedOrder = await orderDishesPage.navigation.saveOrderWithReference();
    await this.uiResources.registerTableOrder(savedOrder.orderNumber);

    return {
      homePage: savedOrder.homePage,
      orderNumber: savedOrder.orderNumber,
      selectedTable,
    };
  }

  @step('业务步骤：在同一桌台创建并登记第二笔堂食订单')
  async createSecondOrderOnSameTable(
    firstOrder: CreatedTableOrder,
  ): Promise<CreatedTableOrder> {
    const orderDishesPage =
      await this.selectTableFlow.enterAdditionalOrderForTable(
        firstOrder.homePage,
        firstOrder.selectedTable,
        2,
      );
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.test.name,
      orderServiceDishes.test.menu,
    );
    const savedOrder = await orderDishesPage.navigation.saveOrderWithReference();
    await this.uiResources.registerTableOrder(savedOrder.orderNumber);

    return {
      homePage: savedOrder.homePage,
      orderNumber: savedOrder.orderNumber,
      selectedTable: firstOrder.selectedTable,
    };
  }

  @step('业务步骤：从首页重新打开已保存桌台所在区域')
  async openSavedTable(
    createdOrder: CreatedTableOrder,
  ): Promise<SelectTablePage> {
    const selectTablePage = await createdOrder.homePage.enterDineIn();
    await selectTablePage.selectArea(createdOrder.selectedTable.areaName);
    return selectTablePage;
  }

  @step('业务步骤：读取桌台订单 Recall 详情并返回首页')
  async readRecallDetailsAndReturnHome(
    createdOrder: CreatedTableOrder,
  ): Promise<RecallOrderDetails> {
    const recallPage = await this.recallFlow.openRecallFromHome(
      createdOrder.homePage,
    );
    await this.recallFlow.clearSearchConditions(recallPage);
    await recallPage.orderDetails.openOrderDetails(createdOrder.orderNumber);
    const details = await recallPage.orderDetails.readOrderDetailsSnapshot();
    await recallPage.orderDetails.closeOrderDetailsDialog();
    await recallPage.exitRecall();
    await createdOrder.homePage.expectPrimaryFunctionCardsVisible();
    return details;
  }
}

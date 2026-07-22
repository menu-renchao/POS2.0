import { expect } from '@playwright/test';
import { HomeFlow } from '../../flows/home.flow';
import { OrderCustomerFlow } from '../../flows/order-customer.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { RecallDatabaseFlow } from '../../flows/recall-database.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import type { HomePage } from '../../pages/home.page';
import type { OrderDishesPage } from '../../pages/order-dishes.page';
import type { RecallOrderDetails } from '../../pages/recall.page';
import type { SelectedTableRecord, SelectTablePage } from '../../pages/select-table.page';
import {
  buildOrderServiceDineInCustomer,
  orderServiceDishes,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

type CreatedTableOrder = {
  homePage: HomePage;
  orderNumber: string;
  selectedTable: SelectedTableRecord;
};

const createdTableIds = new Set<string>();
let tableEnvironmentPrepared = false;

async function enterReadyHome(
  homePage: Parameters<HomeFlow['openHomeWithEmployeeContext']>[0],
  employeeLoginPage: Parameters<HomeFlow['openHomeWithEmployeeContext']>[1],
): Promise<HomePage> {
  return await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
}

function requireTableId(selectedTable: SelectedTableRecord): string {
  if (!selectedTable.tableId) {
    throw new Error(`桌台 ${selectedTable.tableNumber} 缺少 data-table-id。`);
  }

  return selectedTable.tableId;
}

async function addRecordedRegularDish(orderDishesPage: OrderDishesPage): Promise<void> {
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
}

async function createTableOrder(
  homePage: HomePage,
  options: {
    customer?: ReturnType<typeof buildOrderServiceDineInCustomer>;
    guestCount?: number;
    switchArea?: boolean;
  } = {},
): Promise<CreatedTableOrder> {
  const guestCount = options.guestCount ?? 2;
  const selectTablePage = await homePage.enterDineIn();
  const selectTableFlow = new SelectTableFlow();
  const { selectedTable } = options.switchArea
    ? await selectTableFlow.selectAvailableTableInAnotherArea(selectTablePage)
    : await selectTableFlow.selectAnyAvailableTable(selectTablePage);
  const orderDishesPage = await selectTablePage.enterOrderDishesAfterSelectingTable(guestCount);
  await orderDishesPage.expectLoaded();
  createdTableIds.add(requireTableId(selectedTable));

  if (options.customer) {
    await new OrderCustomerFlow().addCustomerInformationToOrder(
      orderDishesPage,
      options.customer,
    );
  }

  await addRecordedRegularDish(orderDishesPage);
  const savedOrder = await orderDishesPage.saveOrderWithReference();

  return {
    homePage: savedOrder.homePage,
    orderNumber: savedOrder.orderNumber,
    selectedTable,
  };
}

async function openSavedTable(
  createdOrder: CreatedTableOrder,
): Promise<SelectTablePage> {
  const selectTablePage = await createdOrder.homePage.enterDineIn();
  await selectTablePage.selectArea(createdOrder.selectedTable.areaName);
  return selectTablePage;
}

async function readRecallDetailsAndReturnHome(
  createdOrder: CreatedTableOrder,
): Promise<RecallOrderDetails> {
  const recallFlow = new RecallFlow();
  const recallPage = await recallFlow.openRecallFromHome(createdOrder.homePage);
  await recallFlow.clearSearchConditions(recallPage);
  await recallPage.openOrderDetails(createdOrder.orderNumber);
  const details = await recallPage.readOrderDetailsSnapshot();
  await recallPage.closeOrderDetailsDialog();
  await recallPage.exitRecall();
  await createdOrder.homePage.expectPrimaryFunctionCardsVisible();
  return details;
}

async function createSecondOrderOnSameTable(
  firstOrder: CreatedTableOrder,
): Promise<CreatedTableOrder> {
  const orderDishesPage = await new SelectTableFlow().enterAdditionalOrderForTable(
    firstOrder.homePage,
    firstOrder.selectedTable,
    2,
  );
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.test.name,
    orderServiceDishes.test.menu,
  );
  const savedOrder = await orderDishesPage.saveOrderWithReference();

  return {
    homePage: savedOrder.homePage,
    orderNumber: savedOrder.orderNumber,
    selectedTable: firstOrder.selectedTable,
  };
}

function readRecallOrderTime(cardText: string): string {
  const dateTime = cardText.match(/\b\d{4}-\d{2}-\d{2}\s+(\d{2}:\d{2}):\d{2}\b/)?.[1];

  if (!dateTime) {
    throw new Error(`Recall 订单卡未显示可解析的创建时间：${cardText}`);
  }

  return dateTime;
}

test.describe('桌台点单已录制回归', { tag: ['@桌台', '@点单'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test.beforeEach(async ({ apiConfig, employeeLoginPage, homePage, orderApi }) => {
    if (tableEnvironmentPrepared) {
      return;
    }

    const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
    const selectTablePage = await readyHomePage.enterDineIn();
    const hasAvailableTable = await new SelectTableFlow().hasAnyAvailableTable(selectTablePage);

    if (!hasAvailableTable) {
      const occupiedTableId = await new RecallDatabaseFlow(
        apiConfig.baseURL,
      ).readLeastOccupiedTableId();
      const response = await orderApi.clearTable({ tableId: occupiedTableId });
      const body = (await response.json()) as { code?: number };

      if (!response.ok() || body.code !== 0) {
        throw new Error(`无法为桌台回归释放空桌：HTTP ${response.status()}，code=${body.code}`);
      }
    }

    tableEnvironmentPrepared = true;
  });

  test.afterEach(async ({ orderApi }) => {
    for (const tableId of createdTableIds) {
      const response = await orderApi.clearTable({ tableId });

      if (!response.ok()) {
        throw new Error(`清理桌台 ${tableId} 失败：HTTP ${response.status()}`);
      }
    }

    createdTableIds.clear();
  });

  test(
    '应能从空桌创建堂食订单并在 Recall 回查桌号',
    { annotation: [jiraIssueAnnotation('POS-15531')] },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await createTableOrder(readyHomePage);
      const details = await readRecallDetailsAndReturnHome(createdOrder);

      expect(details.orderNumber).toContain(createdOrder.orderNumber);
      expect(details.orderContext.tableName).toContain(createdOrder.selectedTable.tableNumber);
    },
  );

  test(
    '应能在同一桌台创建第二笔订单并显示两笔订单',
    { annotation: [jiraIssueAnnotation('POS-15532')] },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const firstOrder = await createTableOrder(readyHomePage);
      const secondOrder = await createSecondOrderOnSameTable(firstOrder);
      const tablePage = await new SelectTableFlow().openOrdersForTable(
        secondOrder.homePage,
        secondOrder.selectedTable,
      );
      const orderNumbers = await tablePage.cards.readOpenOrderNumbers();

      expect(orderNumbers).toEqual(
        expect.arrayContaining([firstOrder.orderNumber, secondOrder.orderNumber]),
      );
      expect(orderNumbers).toHaveLength(2);
    },
  );

  test(
    '应能切换区域选择空桌并在 Recall 回查桌号',
    { annotation: [jiraIssueAnnotation('POS-15534')] },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await createTableOrder(readyHomePage, { switchArea: true });
      const details = await readRecallDetailsAndReturnHome(createdOrder);

      expect(details.orderContext.tableName).toContain(createdOrder.selectedTable.tableNumber);
    },
  );

  test(
    '应能在桌台卡片显示与数据库一致的订单号',
    { annotation: [jiraIssueAnnotation('POS-15558')] },
    async ({ apiConfig, employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await createTableOrder(readyHomePage);
      const tableId = requireTableId(createdOrder.selectedTable);
      const databaseOrderNumber = await new RecallDatabaseFlow(
        apiConfig.baseURL,
      ).readLatestOrderNumberForTable(tableId);
      const tablePage = await openSavedTable(createdOrder);
      await tablePage.cards.selectDisplayField('orderId');

      expect(
        await tablePage.cards.readDisplayedOrderNumber(createdOrder.selectedTable.tableNumber),
      ).toBe(databaseOrderNumber);
      expect(databaseOrderNumber).toBe(createdOrder.orderNumber);
    },
  );

  test(
    '应能在桌台卡片显示与 Recall 一致的下单时间',
    { annotation: [jiraIssueAnnotation('POS-15559')] },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await createTableOrder(readyHomePage);
      const recallFlow = new RecallFlow();
      const recallPage = await recallFlow.openRecallFromHome(createdOrder.homePage);
      await recallFlow.clearSearchConditions(recallPage);
      const recallOrderTime = readRecallOrderTime(
        await recallPage.readOrderCardText(createdOrder.orderNumber),
      );
      await recallPage.exitRecall();
      await createdOrder.homePage.expectPrimaryFunctionCardsVisible();
      const tablePage = await openSavedTable(createdOrder);
      await tablePage.cards.selectDisplayField('orderTime');

      expect(
        await tablePage.cards.readDisplayedOrderTime(createdOrder.selectedTable.tableNumber),
      ).toBe(recallOrderTime);
    },
  );

  test(
    '应能在桌台卡片显示与 Recall 一致的客人数',
    { annotation: [jiraIssueAnnotation('POS-15560')] },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await createTableOrder(readyHomePage, { guestCount: 2 });
      const details = await readRecallDetailsAndReturnHome(createdOrder);
      const tablePage = await openSavedTable(createdOrder);
      await tablePage.cards.selectDisplayField('partySize');

      expect(details.orderContext.guestCount).toBe('2');
      expect(
        await tablePage.cards.readDisplayedPartySize(createdOrder.selectedTable.tableNumber),
      ).toBe(2);
    },
  );

  test(
    '应能在桌台卡片显示与 Recall 一致的企台',
    { annotation: [jiraIssueAnnotation('POS-15561')] },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await createTableOrder(readyHomePage);
      const details = await readRecallDetailsAndReturnHome(createdOrder);
      const tablePage = await openSavedTable(createdOrder);
      await tablePage.cards.selectDisplayField('server');

      expect(
        await tablePage.cards.readDisplayedServer(createdOrder.selectedTable.tableNumber),
      ).toBe(details.orderContext.serverName);
    },
  );

  test(
    '应能在桌台卡片显示与 Recall 一致的订单价格',
    { annotation: [jiraIssueAnnotation('POS-15563')] },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await createTableOrder(readyHomePage);
      const details = await readRecallDetailsAndReturnHome(createdOrder);
      const tablePage = await openSavedTable(createdOrder);
      await tablePage.cards.selectDisplayField('price');

      expect(
        await tablePage.cards.readDisplayedPrice(createdOrder.selectedTable.tableNumber),
      ).toBeCloseTo(
        details.priceSummary.Total,
        2,
      );
    },
  );

  test(
    '应能在桌台卡片显示下单时填写的客人姓名',
    { annotation: [jiraIssueAnnotation('POS-15564')] },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const customer = buildOrderServiceDineInCustomer();
      const createdOrder = await createTableOrder(readyHomePage, { customer });
      const tablePage = await openSavedTable(createdOrder);
      await tablePage.cards.selectDisplayField('partyName');

      expect(
        await tablePage.cards.readDisplayedPartyName(createdOrder.selectedTable.tableNumber),
      ).toBe(customer.customerName);
    },
  );

  test(
    '应能修改已保存 Pick Up 订单的客人数',
    {
      tag: ['@PickUp'],
      annotation: [jiraIssueAnnotation('POS-15554')],
    },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new TakeoutFlow().startPickUpOrder(readyHomePage);
      await addRecordedRegularDish(orderDishesPage);
      const savedOrder = await orderDishesPage.saveOrderWithReference();
      const recallPage = await new RecallFlow().openRecallFromHome(savedOrder.homePage);
      const editingPage = await new RecallFlow().editOrder(recallPage, savedOrder.orderNumber);
      await editingPage.changeGuestCount(5);
      const editedOrder = await editingPage.saveOrderWithReference();
      const finalRecallPage = await new RecallFlow().openRecallFromHome(editedOrder.homePage);
      await finalRecallPage.openOrderDetails(savedOrder.orderNumber);

      expect((await finalRecallPage.readOrderContext()).guestCount).toBe('5');
    },
  );

  test(
    '应能从桌台多订单弹窗打印订单并保持订单详情不变',
    {
      tag: ['@多单', '@打印'],
      annotation: [jiraIssueAnnotation('POS-36301')],
    },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const firstOrder = await createTableOrder(readyHomePage);
      const secondOrder = await createSecondOrderOnSameTable(firstOrder);
      const tablePage = await new SelectTableFlow().openOrdersForTable(
        secondOrder.homePage,
        secondOrder.selectedTable,
      );
      await tablePage.cards.openOrderDetails(secondOrder.orderNumber);
      const beforePrint = await tablePage.cards.orderDetails.readOrderDetailsSnapshot();
      const printStatus =
        await tablePage.cards.orderDetails.clickPrintInOrderDetailsAndReadReceiptStatus();
      const afterPrint = await tablePage.cards.orderDetails.readOrderDetailsSnapshot();

      expect(printStatus).toBeGreaterThanOrEqual(200);
      expect(printStatus).toBeLessThan(300);
      expect(afterPrint.orderNumber).toBe(beforePrint.orderNumber);
      expect(afterPrint.priceSummary).toEqual(beforePrint.priceSummary);
    },
  );
});

import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import type { SelectedTableRecord } from '../../pages/select-table.page';
import {
  buildOrderServiceDineInCustomer,
  orderServiceDishes,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';
import { waitUntil } from '../../utils/wait';

function requireTableId(selectedTable: SelectedTableRecord): string {
  if (!selectedTable.tableId) {
    throw new Error(`桌台 ${selectedTable.tableNumber} 缺少 data-table-id。`);
  }

  return selectedTable.tableId;
}

function readRecallOrderTime(cardText: string): string {
  const dateTime = cardText.match(
    /\b(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})\s+(\d{2}:\d{2}):\d{2}\b/,
  )?.[1];

  if (!dateTime) {
    throw new Error(`Recall 订单卡未显示可解析的创建时间：${cardText}`);
  }

  return dateTime;
}

test.describe('桌台点单已录制回归', { tag: ['@桌台', '@点单'] }, () => {
  test.setTimeout(120_000);

  test(
    '应能从空桌创建堂食订单并在 Recall 回查桌号',
    { annotation: [jiraIssueAnnotation('POS-15531')] },
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage);
      const details = await flows.tableOrderFlow.readRecallDetailsAndReturnHome(createdOrder);

      expect(details.orderNumber).toContain(createdOrder.orderNumber);
      expect(details.orderContext.tableName).toContain(createdOrder.selectedTable.tableNumber);
    },
  );

  test(
    '应能在同一桌台创建第二笔订单并显示两笔订单',
    { annotation: [jiraIssueAnnotation('POS-15532')] },
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const firstOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage);
      const secondOrder = await flows.tableOrderFlow.createSecondOrderOnSameTable(firstOrder);
      const tablePage = await flows.selectTableFlow.openOrdersForTable(
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
    {
      annotation: [jiraIssueAnnotation('POS-15534')],
    },
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage, { switchArea: true });
      const details = await flows.tableOrderFlow.readRecallDetailsAndReturnHome(createdOrder);

      expect(details.orderContext.tableName).toContain(createdOrder.selectedTable.tableNumber);
    },
  );

  test(
    '应能在桌台卡片显示订单时长达到一分钟',
    {
      annotation: [jiraIssueAnnotation('POS-15557')],
      tag: ['@slow'],
    },
    async ({ employeeLoginPage, flows, homePage }) => {
      test.setTimeout(180_000);
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage);
      const tablePage = await flows.tableOrderFlow.openSavedTable(createdOrder);

      await test.step('等待桌台卡片显示订单时长达到一分钟', async () => {
        await waitUntil(
          async () =>
            await tablePage.cards.readDisplayedDuration(
              createdOrder.selectedTable.tableNumber,
            ),
          (duration) => duration !== '0:00',
          {
            timeout: 110_000,
            interval: 1_000,
            message: `桌台 ${createdOrder.selectedTable.tableNumber} 的订单时长未达到一分钟。`,
          },
        );
      });

      expect(
        await tablePage.cards.readDisplayedDuration(
          createdOrder.selectedTable.tableNumber,
        ),
      ).toBe('0:01');
    },
  );

  test(
    '应能在桌台卡片显示与数据库一致的订单号',
    { annotation: [jiraIssueAnnotation('POS-15558')] },
    async ({ employeeLoginPage, flows, homePage, recallDatabaseFlow }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage);
      const tableId = requireTableId(createdOrder.selectedTable);
      const databaseOrderNumber =
        await recallDatabaseFlow.readLatestOrderNumberForTable(tableId);
      const tablePage = await flows.tableOrderFlow.openSavedTable(createdOrder);
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
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage);
      const recallPage = await flows.recallFlow.openRecallFromHome(createdOrder.homePage);
      await flows.recallFlow.clearSearchConditions(recallPage);
      const recallOrderTime = readRecallOrderTime(
        await recallPage.filterBar.readOrderCardText(createdOrder.orderNumber),
      );
      await recallPage.exitRecall();
      await createdOrder.homePage.expectPrimaryFunctionCardsVisible();
      const tablePage = await flows.tableOrderFlow.openSavedTable(createdOrder);
      await tablePage.cards.selectDisplayField('orderTime');

      expect(
        await tablePage.cards.readDisplayedOrderTime(createdOrder.selectedTable.tableNumber),
      ).toBe(recallOrderTime);
    },
  );

  test(
    '应能在桌台卡片显示与 Recall 一致的客人数',
    { annotation: [jiraIssueAnnotation('POS-15560')] },
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage, { guestCount: 2 });
      const details = await flows.tableOrderFlow.readRecallDetailsAndReturnHome(createdOrder);
      const tablePage = await flows.tableOrderFlow.openSavedTable(createdOrder);
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
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage);
      const details = await flows.tableOrderFlow.readRecallDetailsAndReturnHome(createdOrder);
      const tablePage = await flows.tableOrderFlow.openSavedTable(createdOrder);
      await tablePage.cards.selectDisplayField('server');

      expect(
        await tablePage.cards.readDisplayedServer(createdOrder.selectedTable.tableNumber),
      ).toBe(details.orderContext.serverName);
    },
  );

  test(
    '应能在桌台卡片显示与 Recall 一致的订单价格',
    { annotation: [jiraIssueAnnotation('POS-15563')] },
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const createdOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage);
      const details = await flows.tableOrderFlow.readRecallDetailsAndReturnHome(createdOrder);
      const tablePage = await flows.tableOrderFlow.openSavedTable(createdOrder);
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
    {
      annotation: [
        jiraIssueAnnotation('POS-15564'),
        {
          type: 'known-issue',
          description:
            '堂食订单已填写动态客户姓名，但桌台卡片 Party Name 字段仍显示“-”。',
        },
      ],
    },
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const customer = buildOrderServiceDineInCustomer();
      const createdOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage, { customer });
      const tablePage = await flows.selectTableFlow.enterDineInWithEmployeeContext(
        createdOrder.homePage,
        employeeLoginPage,
      );
      await tablePage.selectArea(createdOrder.selectedTable.areaName);
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
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await flows.takeoutFlow.startPickUpOrder(readyHomePage);
      await flows.orderDishesFlow.addRegularDish(
        orderDishesPage,
        orderServiceDishes.regular.name,
        orderServiceDishes.regular.menu,
      );
      const savedOrder = await orderDishesPage.navigation.saveOrderWithReference();
      const recallPage = await flows.recallFlow.openRecallFromHome(savedOrder.homePage);
      const editingPage = await flows.recallFlow.editOrder(recallPage, savedOrder.orderNumber);
      await editingPage.menu.changeGuestCount(5);
      const editedOrder = await editingPage.navigation.saveOrderWithReference();
      const finalRecallPage = await flows.recallFlow.openRecallFromHome(editedOrder.homePage);
      const finalEditingPage = await flows.recallFlow.editOrder(
        finalRecallPage,
        savedOrder.orderNumber,
      );
      await finalEditingPage.menu.expectGuestCount(5);
    },
  );

  test(
    '应能从桌台多订单弹窗打印订单并保持订单详情不变',
    {
      tag: ['@多单', '@打印'],
      annotation: [jiraIssueAnnotation('POS-36301')],
    },
    async ({ employeeLoginPage, flows, homePage }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const firstOrder = await flows.tableOrderFlow.createTableOrder(readyHomePage);
      const secondOrder = await flows.tableOrderFlow.createSecondOrderOnSameTable(firstOrder);
      const tablePage = await flows.selectTableFlow.openOrdersForTable(
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

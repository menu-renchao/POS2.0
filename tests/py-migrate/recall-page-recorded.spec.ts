import { expect } from '@playwright/test';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { OrderPermissionFlow } from '../../flows/order-permission.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallDatabaseFlow } from '../../flows/recall-database.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import type { HomePage } from '../../pages/home.page';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import type { RecallPage } from '../../pages/recall.page';
import {
  buildExpectedRecallPresetRange,
  recallDeliveryDriverCase,
  RecallDatePresets,
  RecallSortableColumns,
  type RecallSortDirection,
  type RecallSortableColumn,
} from '../../test-data/recall-list';
import {
  orderServiceDishes,
  orderServiceKitchenVoidPermissionCase,
  orderServiceSameDishStatusCombineCase,
} from '../../test-data/order-service';
import { orderSettleConfiguration } from '../../test-data/order-settle';
import {
  RecallManualSearchTags,
  RecallOrderStatuses,
} from '../../test-data/recall-search-options';
import { jiraIssueAnnotation } from '../../utils/jira';
import { waitUntil } from '../../utils/wait';

const datePresetCases = [
  { name: '今天', preset: RecallDatePresets.today },
  { name: '昨天', preset: RecallDatePresets.yesterday },
  { name: '本周', preset: RecallDatePresets.thisWeek },
  { name: '上周', preset: RecallDatePresets.lastWeek },
  { name: '本月', preset: RecallDatePresets.thisMonth },
  { name: '上月', preset: RecallDatePresets.lastMonth },
] as const;

const datePresetDatabaseCases = datePresetCases.filter(
  (dateCase) => dateCase.preset !== RecallDatePresets.thisWeek,
);

const sortCases = [
  { issue: 'POS-16432', name: '时间', column: RecallSortableColumns.time },
  { issue: 'POS-16433', name: '价格', column: RecallSortableColumns.total },
  { issue: 'POS-16436', name: '类型', column: RecallSortableColumns.type },
  { issue: 'POS-16437', name: '订单号', column: RecallSortableColumns.orderNumber },
] as const;

const recallPickUpCardCase = {
  customerName: 'Recall Pickup Customer',
  expectedFormattedPhone: '(934)221-9952',
  phoneNumber: '9342219952',
} as const;

async function enterReadyHome(
  homePage: Parameters<HomeFlow['openHomeWithEmployeeContext']>[0],
  employeeLoginPage: Parameters<HomeFlow['openHomeWithEmployeeContext']>[1],
): Promise<HomePage> {
  return await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
}

async function openCleanRecall(homePage: HomePage): Promise<RecallPage> {
  const recallFlow = new RecallFlow();
  const recallPage = await recallFlow.openRecallFromHome(homePage);
  return await recallFlow.clearSearchConditions(recallPage);
}

function parseSortValue(column: RecallSortableColumn, value: string): number | string {
  if (column === RecallSortableColumns.orderNumber) {
    return Number(value.replace(/\D/g, ''));
  }

  if (column === RecallSortableColumns.total) {
    return Number(value.replace(/[$,]/g, ''));
  }

  if (column === RecallSortableColumns.time) {
    const [hours = '0', minutes = '0', seconds = '0'] = value.split(':');
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }

  return value.toLocaleLowerCase('en-US');
}

function compareValues(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), 'en-US');
}

function isSortedInDirection(
  column: RecallSortableColumn,
  values: string[],
  direction: RecallSortDirection,
): boolean {
  const parsedValues = values.map((value) => parseSortValue(column, value));
  const comparisons = parsedValues.slice(1).map((value, index) =>
    compareValues(parsedValues[index], value),
  );
  return direction === 'ascending'
    ? comparisons.every((comparison) => comparison <= 0)
    : comparisons.every((comparison) => comparison >= 0);
}

test.describe('Recall 已录制回归', { tag: ['@订单查询'] }, () => {
  for (const dateCase of datePresetDatabaseCases) {
    test(
      `应能按${dateCase.name}筛选并使订单数量与数据库一致`,
      { tag: ['@时间筛选'] },
      async ({ apiConfig, employeeLoginPage, homePage }) => {
        const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
        const recallPage = await openCleanRecall(readyHomePage);
        const selectedRange = await new RecallFlow().applyDatePreset(
          recallPage,
          dateCase.preset,
        );
        const databaseOrderCount = await new RecallDatabaseFlow(
          apiConfig.baseURL,
        ).countParentOrdersInDateRange(selectedRange);
        const pageOrderCount = await waitUntil(
          async () => await recallPage.readOrderCount(),
          (count) => count === databaseOrderCount,
          {
            timeout: 15_000,
            message: `${dateCase.name}订单数量未刷新为数据库数量 ${databaseOrderCount}。`,
          },
        );

        expect(
          pageOrderCount,
          `${dateCase.name}订单数量不一致：页面 ${pageOrderCount}，数据库 ${databaseOrderCount}`,
        ).toBe(databaseOrderCount);
      },
    );
  }

  test(
    '[POS-16387] 应能按本周和已删除状态筛选并与数据库一致',
    {
      annotation: [jiraIssueAnnotation('POS-16387')],
      tag: ['@时间筛选', '@状态筛选'],
    },
    async ({ apiConfig, employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
      await orderDishesPage.clickDish(orderServiceDishes.regular.name);
      const savedOrder = await orderDishesPage.saveOrderWithReference();
      const recallFlow = new RecallFlow();
      const recallPage = await recallFlow.openRecallFromHome(savedOrder.homePage);

      await recallFlow.searchOrders(recallPage, {
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: savedOrder.orderNumber,
        },
      });
      await recallPage.openOrderDetails(savedOrder.orderNumber);
      await recallPage.voidCurrentOrder({ reason: 'POS-16387' });
      await recallFlow.clearSearchConditions(recallPage);

      const selectedRange = await recallFlow.applyDatePreset(
        recallPage,
        RecallDatePresets.thisWeek,
      );
      await recallPage.selectOrderStatus(RecallOrderStatuses.voided);
      const pageOrderCount = await waitUntil(
        async () => await recallPage.readOrderCount(),
        (count) => count > 0,
        {
          timeout: 15_000,
          message: 'Recall 页面未加载出本周已删除订单数量。',
        },
      );
      const databaseOrderCount = await new RecallDatabaseFlow(
        apiConfig.baseURL,
      ).countParentOrdersByStatusesInDateRange(selectedRange, [-1, -2]);

      expect(pageOrderCount).toBe(databaseOrderCount);
      expect(await recallPage.readVisibleOrderNumbers()).toContain(`#${savedOrder.orderNumber}`);
    },
  );

  test(
    '[POS-31674] 应能通过带字母的子单号搜索到对应母单',
    {
      annotation: [jiraIssueAnnotation('POS-31674')],
      tag: ['@点单', '@分单'],
    },
    async ({ apiConfig, employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(
        readyHomePage,
      );
      const orderDishesFlow = new OrderDishesFlow();
      await orderDishesFlow.addRegularDish(
        orderDishesPage,
        orderServiceDishes.regular.name,
        orderServiceDishes.regular.menu,
      );
      await orderDishesFlow.addRegularDish(
        orderDishesPage,
        orderServiceDishes.test.name,
        orderServiceDishes.test.menu,
      );

      const splitOrderPage = await orderDishesPage.openSplitOrder();
      const splitOrderFlow = new SplitOrderFlow();
      await splitOrderFlow.moveDishToNewSuborder(
        splitOrderPage,
        orderServiceDishes.test.name,
      );
      const splitSnapshot = await splitOrderPage.readSnapshot();
      const childOrderNumber = splitSnapshot.suborders.find((suborder) =>
        suborder.dishes.some((dish) => dish.name === orderServiceDishes.test.name),
      )?.orderNumber;

      expect(childOrderNumber, '按菜分单后应读取到子单号').toBeTruthy();

      const returnedPage = await splitOrderFlow.submitAndReturnPage(splitOrderPage);
      const alphabeticChild = await new RecallDatabaseFlow(
        apiConfig.baseURL,
      ).replaceLatestSplitChildOrderNumberWithAlphabetic(childOrderNumber!);

      try {
        const recallFlow = new RecallFlow();
        const recallPage = await recallFlow.openRecallFromSplitReturnPage(
          returnedPage,
          readyHomePage,
        );
        const parentOrderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
        await recallFlow.clearSearchConditions(recallPage);
        await recallFlow.searchOrders(recallPage, {
          manualSearch: {
            tag: RecallManualSearchTags.orderNumber,
            keyword: alphabeticChild.orderNumber,
          },
        });

        expect(await recallPage.readVisibleOrderNumbers()).toContain(parentOrderNumber);
      } finally {
        await alphabeticChild.restore();
      }
    },
  );

  test(
    '[POS-32935] 已支付订单作废后价格排序仍应保持正确',
    {
      annotation: [jiraIssueAnnotation('POS-32935')],
      tag: ['@点单', '@现金支付'],
    },
    async ({ employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(
        readyHomePage,
      );
      await new OrderDishesFlow().addRegularDish(
        orderDishesPage,
        orderServiceDishes.regular.name,
        orderServiceDishes.regular.menu,
      );
      const savedOrder = await orderDishesPage.saveOrderWithReference();
      const recallFlow = new RecallFlow();
      const recallPage = await recallFlow.openRecallFromHome(savedOrder.homePage);
      await recallFlow.clearSearchConditions(recallPage);
      await recallPage.openOrderDetails(savedOrder.orderNumber);
      const paymentPage = await recallPage.openPayment();
      await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
      await recallPage.closeOrderDetailsDialog();

      await recallPage.switchToListView();
      const firstSort = await recallPage.clickListSort(RecallSortableColumns.total);
      await recallFlow.searchOrders(recallPage, {
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: savedOrder.orderNumber,
        },
      });
      await recallPage.switchToCardView();
      await recallPage.openOrderDetails(savedOrder.orderNumber);
      await recallPage.voidPaymentRecord(0);
      await recallPage.closeOrderDetailsDialog();
      await recallFlow.clearSearchConditions(recallPage);
      await recallPage.switchToListView();
      const pricesAfterVoid = await recallPage.readVisibleListColumnValues(
        RecallSortableColumns.total,
      );

      expect(
        isSortedInDirection(RecallSortableColumns.total, pricesAfterVoid, firstSort),
        `作废已支付订单后价格列表未保持${firstSort === 'ascending' ? '升序' : '降序'}`,
      ).toBe(true);
    },
  );

  test(
    '[POS-34463] 关闭结账后自动送厨时订单打单后应变为Printed',
    {
      annotation: [jiraIssueAnnotation('POS-34463')],
      tag: ['@点单'],
    },
    async ({ apiSetup, employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        'AUTO_SEND_TO_KITCHEN_AFTER_PRINTED',
        false,
        { verify: true },
      );

      try {
        const readyHomePage = await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
        await orderDishesPage.clickDish(orderServiceDishes.regular.name);
        const savedOrder = await orderDishesPage.saveOrderWithReference();
        const recallPage = await new RecallFlow().openRecallFromHome(savedOrder.homePage);
        await recallPage.openOrderDetails(savedOrder.orderNumber);
        expect(await recallPage.clickPrintInOrderDetailsAndReadReceiptStatus()).toBe(200);
        await recallPage.closeOrderDetailsDialog();
        const recallFlow = new RecallFlow();
        await recallFlow.clearSearchConditions(recallPage);
        await recallFlow.searchOrders(recallPage, {
          orderStatus: RecallOrderStatuses.printed,
          manualSearch: {
            tag: RecallManualSearchTags.orderNumber,
            keyword: savedOrder.orderNumber,
          },
        });

        expect(await recallPage.readVisibleOrderNumbers()).toContain(`#${savedOrder.orderNumber}`);
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-34442] 开启相同菜合并后编辑订单应能删除并重新添加同一道菜',
    {
      annotation: [jiraIssueAnnotation('POS-34442')],
      tag: ['@点单'],
    },
    async ({ apiSetup, employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        orderServiceSameDishStatusCombineCase.configuration,
        { verify: true },
      );

      try {
        const readyHomePage = await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
        await orderDishesPage.clickDish(orderServiceDishes.regular.name);
        const savedOrder = await orderDishesPage.saveOrderWithReference();
        const recallPage = await new RecallFlow().openRecallFromHome(savedOrder.homePage);
        const editingPage = await new RecallFlow().editOrder(
          recallPage,
          savedOrder.orderNumber,
        );

        await editingPage.reduceOrderedDishQuantity(orderServiceDishes.regular.name, 1);
        await editingPage.expectOrderedDishAbsent(orderServiceDishes.regular.name);
        await editingPage.clickDish(orderServiceDishes.test.name);
        await editingPage.clickDish(orderServiceDishes.regular.name);
        const editedItems = await editingPage.readOrderedItems();

        expect(editedItems.filter((item) => item.name === orderServiceDishes.regular.name)).toHaveLength(1);
        expect(editedItems.map((item) => item.name)).toContain(orderServiceDishes.test.name);
        await editingPage.saveOrder();
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-34673] Pick Up订单卡片应显示服务员和完整格式化手机号',
    {
      annotation: [jiraIssueAnnotation('POS-34673')],
      tag: ['@点单'],
    },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new TakeoutFlow().startPickUpOrder(
        readyHomePage,
        recallPickUpCardCase,
      );
      await orderDishesPage.clickDish(orderServiceDishes.regular.name);
      const savedOrder = await orderDishesPage.saveOrderWithReference();
      const recallFlow = new RecallFlow();
      const recallPage = await recallFlow.openRecallFromHome(savedOrder.homePage);
      await recallFlow.searchOrders(recallPage, {
        orderType: 'Pickup',
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: savedOrder.orderNumber,
        },
      });
      const cardText = await recallPage.readOrderCardText(savedOrder.orderNumber);

      await recallPage.openOrderDetails(savedOrder.orderNumber);
      const context = await recallPage.readOrderContext();
      expect(cardText).toContain(recallPickUpCardCase.expectedFormattedPhone);
      expect(context.serverName).toBeTruthy();
      expect(cardText).toContain(context.serverName!);
    },
  );

  test(
    '[POS-30058] 订单保存后切换为No Rounding仍应保留原舍入明细和总额',
    {
      annotation: [jiraIssueAnnotation('POS-30058')],
      tag: ['@点单'],
    },
    async ({ apiSetup, employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);
      const restoreOriginalConfiguration = await apiSetup.systemConfiguration.updateByName(
        orderSettleConfiguration.roundingName,
        orderSettleConfiguration.nearestFiveCents,
        { verify: true },
      );
      let restoreRoundedConfiguration: (() => Promise<void>) | undefined;

      try {
        const readyHomePage = await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(
          readyHomePage,
        );
        await orderDishesPage.clickDish(orderServiceDishes.regular.name);
        await orderDishesPage.changeOrderedDishPrice(orderServiceDishes.regular.name, 10.01);
        await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
        const summaryBeforeSave = await orderDishesPage.readPriceSummary();
        const savedOrder = await orderDishesPage.saveOrderWithReference();

        restoreRoundedConfiguration = await apiSetup.systemConfiguration.updateByName(
          orderSettleConfiguration.roundingName,
          orderSettleConfiguration.noRounding,
          { verify: true },
        );
        const refreshedHomePage = await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
          savedOrder.homePage,
          employeeLoginPage,
        );
        const recallPage = await new RecallFlow().openRecallFromHome(refreshedHomePage);
        await recallPage.openOrderDetails(savedOrder.orderNumber);
        const details = await recallPage.readOrderDetailsSnapshot();
        const expectedTotal = summaryBeforeSave['Total(Cash)'];
        const actualTotal = details.priceSummary.Total ?? details.priceSummary['Total(Cash)'];
        const expectedRounding =
          actualTotal -
          (details.priceSummary.Subtotal +
            details.priceSummary.Tax +
            (details.priceSummary.Charge ?? 0) +
            (details.priceSummary.Tips ?? 0));

        expect(actualTotal).toBeCloseTo(expectedTotal, 2);
        expect(details.priceSummary.Rounding).toBeCloseTo(expectedRounding, 2);
      } finally {
        await restoreRoundedConfiguration?.();
        await restoreOriginalConfiguration();
      }
    },
  );

  test(
    '[POS-34021] To Go合入四人堂食订单后应保留人数且不新增自动加收',
    {
      annotation: [jiraIssueAnnotation('POS-34021')],
      tag: ['@点单', '@加收'],
    },
    async ({ apiSetup, employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const toGoPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
      await toGoPage.clickDish(orderServiceDishes.regular.name);
      const toGoOrder = await toGoPage.saveOrderWithReference();

      const dineInPage = await new SelectTableFlow().enterDineInNoTableOrder(toGoOrder.homePage);
      await dineInPage.changeGuestCount(4);
      await dineInPage.clickDish(orderServiceDishes.test.name);
      const dineInOrder = await dineInPage.saveOrderWithReference();

      const chargeResource = await apiSetup.charge.create({
        name: 'POS34021_GUEST4',
        minGuest: 4,
        orderType: 'dine in',
        rate: 10,
        rateType: 2,
        triggerMode: 1,
        type: 'SERVICE',
      });
      const restoreRecalculation = await apiSetup.systemConfiguration.updateByName(
        'RECALCULATE_CHARGE_WHEN_COMBINE_ORDERS',
        false,
        { verify: true },
      );

      try {
        const refreshedHomePage =
          await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
            dineInOrder.homePage,
            employeeLoginPage,
          );
        const recallPage = await new RecallFlow().openRecallFromHome(refreshedHomePage);
        await new RecallFlow().combineOrders(
          recallPage,
          toGoOrder.orderNumber,
          dineInOrder.orderNumber,
        );
        const details = await recallPage.readOrderDetailsSnapshot();
        const detailsText = await recallPage.readOrderDetailsText();

        expect(details.orderContext.orderType).toMatch(/Dine\s*In/i);
        expect(details.orderContext.guestCount).toContain('4');
        expect(detailsText).not.toContain(chargeResource.name);
      } finally {
        await restoreRecalculation();
      }
    },
  );

  test(
    '[POS-34787] Printed订单换桌保存后应保持Printed状态',
    {
      annotation: [jiraIssueAnnotation('POS-34787')],
      tag: ['@点单'],
    },
    async ({ apiConfig, employeeLoginPage, homePage, orderApi }) => {
      test.setTimeout(120_000);
      const databaseFlow = new RecallDatabaseFlow(apiConfig.baseURL);
      const occupiedTableId = await databaseFlow.readLeastOccupiedTableId();
      const clearTableResponse = await orderApi.clearTable({ tableId: occupiedTableId });
      expect(clearTableResponse.ok()).toBe(true);
      const clearTableBody = (await clearTableResponse.json()) as { code?: number };
      expect(clearTableBody.code).toBe(0);

      const recallFlow = new RecallFlow();
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
        const selectTablePage = await readyHomePage.enterDineIn();
        const initialEntry = await new SelectTableFlow().selectAnyAvailableTableAndEnterOrderDishes(
          selectTablePage,
          1,
        );
        await initialEntry.orderDishesPage.clickDish(orderServiceDishes.regular.name);
        const sentOrder = await initialEntry.orderDishesPage.sendOrderWithReference();
        const recallPage = await recallFlow.openRecallFromHome(sentOrder.homePage);
        await recallFlow.clearSearchConditions(recallPage);
        const printStatus = await recallFlow.printReceiptAndReadStatus(
          recallPage,
          sentOrder.orderNumber,
        );
        expect(printStatus).toBe(200);
        const printedDatabaseStatus = await databaseFlow.readLatestOrderStatus(sentOrder.orderNumber);
        const receiptPrintCount = await databaseFlow.readLatestReceiptPrintCount(
          sentOrder.orderNumber,
        );
        expect(receiptPrintCount).toBeGreaterThan(0);
        await recallPage.closeOrderDetailsDialog();
        await recallFlow.clearSearchConditions(recallPage);
        await recallFlow.searchOrders(recallPage, {
          manualSearch: {
            tag: RecallManualSearchTags.orderNumber,
            keyword: sentOrder.orderNumber,
          },
        });
        const editingPage = await recallFlow.editOrder(recallPage, sentOrder.orderNumber);
        const changedEntry = await new SelectTableFlow().changeToAnyAvailableTable(
          editingPage,
          initialEntry.selectedTable.tableNumber,
          1,
        );
        expect(changedEntry.selectedTable.tableNumber).not.toBe(
          initialEntry.selectedTable.tableNumber,
        );
        const savedHomePage = await changedEntry.orderDishesPage.saveOrder();

        expect(await databaseFlow.readLatestOrderStatus(sentOrder.orderNumber)).toBe(
          printedDatabaseStatus,
        );
        expect(await databaseFlow.readLatestReceiptPrintCount(sentOrder.orderNumber)).toBe(
          receiptPrintCount,
        );

        const cleanupRecallPage = await recallFlow.openRecallFromHome(savedHomePage);
        await recallFlow.clearSearchConditions(cleanupRecallPage);
        await recallFlow.searchOrders(cleanupRecallPage, {
          manualSearch: {
            tag: RecallManualSearchTags.orderNumber,
            keyword: sentOrder.orderNumber,
          },
        });
        await cleanupRecallPage.openOrderDetails(sentOrder.orderNumber);
        await cleanupRecallPage.clickClearTableInMoreMenu();
    },
  );

  test(
    '[POS-34800] Printed订单编辑新增菜品保存后应变为Semi-Sent',
    {
      annotation: [jiraIssueAnnotation('POS-34800')],
      tag: ['@点单'],
    },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
      await orderDishesPage.clickDish(orderServiceDishes.regular.name);
      const sentOrder = await orderDishesPage.sendOrderWithReference();
      const recallFlow = new RecallFlow();
      const recallPage = await recallFlow.openRecallFromHome(sentOrder.homePage);
      await recallFlow.clearSearchConditions(recallPage);
      const printStatus = await recallFlow.printReceiptAndReadStatus(
        recallPage,
        sentOrder.orderNumber,
      );
      expect(printStatus).toBe(200);
      await recallPage.closeOrderDetailsDialog();
      await recallFlow.clearSearchConditions(recallPage);
      await recallFlow.searchOrders(recallPage, {
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: sentOrder.orderNumber,
        },
      });
      const editingPage = await recallFlow.editOrder(recallPage, sentOrder.orderNumber);
      await editingPage.clickDish(orderServiceDishes.test.name);
      const savedHomePage = await editingPage.saveOrder();
      const updatedRecallPage = await recallFlow.openRecallFromHome(savedHomePage);
      await recallFlow.clearSearchConditions(updatedRecallPage);
      await recallFlow.searchOrders(updatedRecallPage, {
        orderStatus: RecallOrderStatuses.semiSent,
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: sentOrder.orderNumber,
        },
      });
      expect(await updatedRecallPage.readVisibleOrderNumbers()).toContain(`#${sentOrder.orderNumber}`);
    },
  );

  test(
    '[POS-34827] Printed订单免税后恢复税并保存应保持原状态',
    {
      annotation: [jiraIssueAnnotation('POS-34827')],
      tag: ['@点单'],
    },
    async ({ apiConfig, employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
      await orderDishesPage.clickDish(orderServiceDishes.regular.name);
      const sentOrder = await orderDishesPage.sendOrderWithReference();
      const databaseFlow = new RecallDatabaseFlow(apiConfig.baseURL);
      const recallFlow = new RecallFlow();
      const recallPage = await recallFlow.openRecallFromHome(sentOrder.homePage);
      await recallFlow.clearSearchConditions(recallPage);
      const printStatus = await recallFlow.printReceiptAndReadStatus(
        recallPage,
        sentOrder.orderNumber,
      );
      expect(printStatus).toBe(200);
      const printedDatabaseStatus = await databaseFlow.readLatestOrderStatus(sentOrder.orderNumber);
      const receiptPrintCount = await databaseFlow.readLatestReceiptPrintCount(
        sentOrder.orderNumber,
      );
      expect(receiptPrintCount).toBeGreaterThan(0);
      await recallPage.closeOrderDetailsDialog();
      await recallFlow.clearSearchConditions(recallPage);
      await recallFlow.searchOrders(recallPage, {
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: sentOrder.orderNumber,
        },
      });
      const editingPage = await recallFlow.editOrder(recallPage, sentOrder.orderNumber);
      await editingPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
      await editingPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, false);
      await editingPage.saveOrder();

      expect(await databaseFlow.readLatestOrderStatus(sentOrder.orderNumber)).toBe(
        printedDatabaseStatus,
      );
      expect(await databaseFlow.readLatestReceiptPrintCount(sentOrder.orderNumber)).toBe(
        receiptPrintCount,
      );
    },
  );

  test(
    '[POS-34829] In Kitchen订单应能从Recall进入Charge并添加加收',
    {
      annotation: [jiraIssueAnnotation('POS-34829')],
      tag: ['@点单', '@加收'],
    },
    async ({ apiSetup, employeeLoginPage, homePage, page }) => {
      test.setTimeout(120_000);
      const chargeResource = await apiSetup.charge.create({
        name: 'POS34829_CHARGE',
        rate: 5,
        rateType: 1,
        triggerMode: 2,
        type: 'DEFAULT',
      });
      const readyHomePage =
        await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
      await orderDishesPage.clickDish(orderServiceDishes.regular.name);
      const sentOrder = await orderDishesPage.sendOrderWithReference();

      const recallPage = await new RecallFlow().openRecallFromHome(sentOrder.homePage);
      await new RecallFlow().openChargeFromMore(recallPage, sentOrder.orderNumber);
      const editingPage = new OrderDishesPage(page);
      await editingPage.expectChargeDialogVisible();
      await editingPage.toggleChargeOption(chargeResource.name);
      const chargeSnapshot = await editingPage.readChargeSnapshot();
      expect(chargeSnapshot.wholeOrderCharges.map((charge) => charge.name)).toContain(
        chargeResource.name,
      );
      await editingPage.confirmChargeDialog();
    },
  );

  test(
    '[POS-36180] 删除部分已送厨菜品后应能按Partially Void筛选到订单',
    {
      annotation: [jiraIssueAnnotation('POS-36180')],
      tag: ['@点单'],
    },
    async ({ apiSetup, employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);
      const restrictedEmployee = await apiSetup.staff.createWithoutKitchenVoidPermission();
      const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
        restrictedEmployee.passcode,
      );
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
      await orderDishesPage.clickDish(orderServiceDishes.regular.name);
      await orderDishesPage.clickDish(orderServiceDishes.test.name);
      const sentOrder = await orderDishesPage.sendOrderWithReference();
      const recallFlow = new RecallFlow();
      const recallPage = await recallFlow.openRecallFromHome(sentOrder.homePage);
      const editingPage = await recallFlow.editOrder(recallPage, sentOrder.orderNumber);
      await new OrderPermissionFlow().removeSentDishWithAuthorization(
        editingPage,
        orderServiceDishes.regular.name,
        orderServiceKitchenVoidPermissionCase.authorizationPasscode,
      );
      const savedHomePage = await editingPage.saveOrder();
      const resultPage = await recallFlow.openRecallFromHome(savedHomePage);
      await recallFlow.clearSearchConditions(resultPage);
      await recallFlow.searchOrders(resultPage, {
        orderStatus: RecallOrderStatuses.partiallyVoided,
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: sentOrder.orderNumber,
        },
      });

      expect(await resultPage.readVisibleOrderNumbers()).toContain(`#${sentOrder.orderNumber}`);
    },
  );

  test(
    '[POS-39760] 现金支付后小费留空确认应保持无小费和已付款总额',
    {
      annotation: [jiraIssueAnnotation('POS-39760')],
      tag: ['@点单', '@现金支付', '@小费'],
    },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
      await orderDishesPage.clickDish(orderServiceDishes.regular.name);
      const expectedTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
      const savedOrder = await orderDishesPage.saveOrderWithReference();
      const recallPage = await new RecallFlow().openRecallFromHome(savedOrder.homePage);
      await recallPage.openOrderDetails(savedOrder.orderNumber);
      const paymentPage = await recallPage.openPayment();
      await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
      await recallPage.confirmEmptyPaymentCardTip('Cash');
      const details = await recallPage.readOrderDetailsSnapshot();
      const actualTotal = details.priceSummary.Total ?? details.priceSummary['Total(Cash)'];

      expect(details.paymentStatus).toBe('Success');
      expect(details.priceSummary.Tips ?? 0).toBe(0);
      expect(actualTotal).toBeCloseTo(expectedTotal, 2);
    },
  );

  test(
    '[POS-16377] 应能应用日期预设并使本周订单数量与数据库一致',
    {
      annotation: [jiraIssueAnnotation('POS-16377')],
      tag: ['@时间筛选'],
    },
    async ({ apiConfig, employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const recallPage = await openCleanRecall(readyHomePage);
      const recallFlow = new RecallFlow();

      for (const dateCase of datePresetCases) {
        await test.step(`选择${dateCase.name}并校验日期范围`, async () => {
          const expectedRange = buildExpectedRecallPresetRange(dateCase.preset);
          const actualRange = await recallFlow.applyDatePreset(recallPage, dateCase.preset);
          expect(actualRange).toEqual(expectedRange);
        });
      }

      await test.step('对账本周页面订单数量和数据库有效订单数量', async () => {
        const thisWeekRange = await recallFlow.applyDatePreset(
          recallPage,
          RecallDatePresets.thisWeek,
        );
        const databaseOrderCount = await new RecallDatabaseFlow(
          apiConfig.baseURL,
        ).countParentOrdersInDateRange(thisWeekRange);
        const pageOrderCount = await waitUntil(
          async () => await recallPage.readOrderCount(),
          (orderCount) => orderCount > 0,
          {
            timeout: 15_000,
            message: 'Recall 页面未加载出本周订单总数。',
          },
        );

        expect(databaseOrderCount).toBeGreaterThan(0);
        expect(
          pageOrderCount,
          `POS-16377 本周订单数量不一致：页面 ${pageOrderCount}，数据库 ${databaseOrderCount}`,
        ).toBe(databaseOrderCount);
      });
    },
  );

  for (const sortCase of sortCases) {
    test(
      `[${sortCase.issue}] 应能按照${sortCase.name}在升序和降序间切换`,
      {
        annotation: [jiraIssueAnnotation(sortCase.issue)],
        tag: ['@排序'],
      },
      async ({ employeeLoginPage, homePage }) => {
        const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
        const recallPage = await openCleanRecall(readyHomePage);
        const sortedValues = await new RecallFlow().readBothSortDirections(
          recallPage,
          sortCase.column,
        );

        expect(sortedValues.first.direction).toBe('ascending');
        expect(
          isSortedInDirection(
            sortCase.column,
            sortedValues.first.values,
            sortedValues.first.direction,
          ),
          `第一次点击${sortCase.name}排序后的可见值不符合升序：${JSON.stringify(sortedValues.first.values)}`,
        ).toBe(true);
        expect(sortedValues.second.direction).toBe('descending');
        expect(
          isSortedInDirection(
            sortCase.column,
            sortedValues.second.values,
            sortedValues.second.direction,
          ),
          `第二次点击${sortCase.name}排序后的可见值不符合降序：${JSON.stringify(sortedValues.second.values)}`,
        ).toBe(true);
      },
    );
  }

  test(
    '应能按菜品名称关键字搜索到包含该菜品的订单',
    { tag: ['@点单'] },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
      await orderDishesPage.clickDish(orderServiceDishes.regular.name);
      const savedOrder = await orderDishesPage.saveOrderWithReference();

      const recallFlow = new RecallFlow();
      const recallPage = await recallFlow.openRecallFromHome(savedOrder.homePage);
      await recallFlow.searchOrders(recallPage, {
        manualSearch: {
          tag: RecallManualSearchTags.itemName,
          keyword: '普通',
        },
      });

      const expectedOrderNumber = `#${savedOrder.orderNumber}`;
      const visibleOrderNumbers = await waitUntil(
        async () => await recallPage.readVisibleOrderNumbers(),
        (orderNumbers) => orderNumbers.includes(expectedOrderNumber),
        {
          timeout: 10_000,
          message: `按菜品名称搜索后未找到订单 ${expectedOrderNumber}。`,
        },
      );
      expect(visibleOrderNumbers).toContain(expectedOrderNumber);
    },
  );

  test(
    '[POS-32940][POS-33781] Delivery 订单应格式化手机号并持久化司机切换',
    {
      annotation: [
        jiraIssueAnnotation('POS-32940'),
        jiraIssueAnnotation('POS-33781'),
      ],
      tag: ['@点单'],
    },
    async ({ employeeLoginPage, homePage }) => {
      const readyHomePage = await enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await new TakeoutFlow().startDeliveryOrder(
        readyHomePage,
        recallDeliveryDriverCase.customer,
      );
      await orderDishesPage.clickDish(orderServiceDishes.regular.name);
      await orderDishesPage.selectDriver(recallDeliveryDriverCase.initialDriver);
      const savedOrder = await orderDishesPage.saveOrderWithReference();

      const recallFlow = new RecallFlow();
      const recallPage = await recallFlow.openRecallFromHome(savedOrder.homePage);
      await recallFlow.searchOrders(recallPage, {
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: savedOrder.orderNumber,
        },
      });

      await test.step('校验 Recall 订单卡片展示格式化后的完整手机号', async () => {
        const orderCardText = await recallPage.readOrderCardText(savedOrder.orderNumber);
        expect(orderCardText).toContain(recallDeliveryDriverCase.expectedFormattedPhone);
      });

      await recallPage.openOrderDetails(savedOrder.orderNumber);
      expect(await recallPage.readOrderDriverName()).toContain(
        recallDeliveryDriverCase.initialDriver,
      );
      expect((await recallPage.readOrderCustomerInfo())?.phone).toContain(
        recallDeliveryDriverCase.expectedFormattedPhone,
      );

      await recallPage.changeOrderDriver(recallDeliveryDriverCase.targetDriver);
      await recallPage.closeOrderDetailsDialog();
      await recallPage.openOrderDetails(savedOrder.orderNumber);

      expect(await recallPage.readOrderDriverName()).toContain(
        recallDeliveryDriverCase.targetDriver,
      );
      expect((await recallPage.readOrderCustomerInfo())?.phone).toContain(
        recallDeliveryDriverCase.expectedFormattedPhone,
      );
    },
  );
});

import { expect } from '@playwright/test';
import { HomeFlow } from '../../flows/home.flow';
import { RecallDatabaseFlow } from '../../flows/recall-database.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import type { HomePage } from '../../pages/home.page';
import type { RecallPage } from '../../pages/recall.page';
import {
  buildExpectedRecallPresetRange,
  recallDeliveryDriverCase,
  RecallDatePresets,
  RecallSortableColumns,
  type RecallSortDirection,
  type RecallSortableColumn,
} from '../../test-data/recall-list';
import { orderServiceDishes } from '../../test-data/order-service';
import { RecallManualSearchTags } from '../../test-data/recall-search-options';
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

const sortCases = [
  { issue: 'POS-16432', name: '时间', column: RecallSortableColumns.time },
  { issue: 'POS-16433', name: '价格', column: RecallSortableColumns.total },
  { issue: 'POS-16436', name: '类型', column: RecallSortableColumns.type },
  { issue: 'POS-16437', name: '订单号', column: RecallSortableColumns.orderNumber },
] as const;

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

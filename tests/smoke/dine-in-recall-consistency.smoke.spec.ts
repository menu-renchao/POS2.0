import { expect } from '@playwright/test';
import { enterEmployeeContext, enterWithEmployeePassword } from '../../flows/employee-login.flow';
import { openHome } from '../../flows/home.flow';
import { addRegularDish, addWeightedDish } from '../../flows/order-dishes.flow';
import {
  readLatestVisibleRecallOrderNumber,
  openRecallFromHome,
  searchRecallOrders,
  viewRecallOrderDetails,
} from '../../flows/recall.flow';
import { enterWithAvailableLicense } from '../../flows/license-selection.flow';
import { selectAnyAvailableTableAndEnterOrderDishes } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { test } from '../../fixtures/test.fixture';
import { EmployeeLoginPage } from '../../pages/employee-login.page';
import { HomePage } from '../../pages/home.page';
import { OrderDishesPage, type OrderPriceSummary } from '../../pages/order-dishes.page';
import { RecallPage, type RecallOrderDetails, type RecallOrderItem } from '../../pages/recall.page';
import { type SplitOrderSuborderSnapshot } from '../../pages/split-order.page';
import {
  RecallPaymentStatuses,
} from '../../test-data/recall-search-options';
import { waitUntil } from '../../utils/wait';

type ComparableDishItem = {
  quantity: string;
  name: string;
};

function countSplitDishRows(
  snapshot: {
    suborders: Array<{
      dishes: Array<{ name: string }>;
      orderNumber: string;
    }>;
  },
  orderNumber: string,
  dishName: string,
): number {
  return (
    snapshot.suborders
      .find((suborder) => suborder.orderNumber === orderNumber)
      ?.dishes.filter((dish) => dish.name === dishName).length ?? 0
  );
}

function parseCurrencyValue(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value.replace(/[$,]/g, ''));
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

const expectedGuestCount = 3;
const automationMenu = {
  category: '全类型类',
  group: '自动化菜单组',
};
const comparablePriceSummaryKeys = ['Count', 'Subtotal', 'Tax', 'Total Before Tips'] as const;
const expectedDishItems: ComparableDishItem[] = [
  { quantity: '2', name: 'test' },
  { quantity: '1', name: '称重菜' },
];

function normalizeDishItems(items: RecallOrderItem[]): ComparableDishItem[] {
  return [...items]
    .map((item) => ({
      quantity: item.quantity ?? '',
      name: item.name,
    }))
    .sort((leftItem, rightItem) => leftItem.name.localeCompare(rightItem.name, 'zh-CN'));
}

function normalizeExpectedDishItems(items: ComparableDishItem[]): ComparableDishItem[] {
  return [...items].sort((leftItem, rightItem) =>
    leftItem.name.localeCompare(rightItem.name, 'zh-CN'),
  );
}

function pickComparablePriceSummary(summary: Record<string, number>): Record<string, number> {
  return comparablePriceSummaryKeys.reduce<Record<string, number>>((pickedSummary, key) => {
    if (summary[key] !== undefined) {
      pickedSummary[key] = summary[key];
    }

    return pickedSummary;
  }, {});
}

async function assertRecallMatchesOrderSnapshot(
  recallDetails: RecallOrderDetails,
  orderPriceSummary: OrderPriceSummary,
  expectedTableNumber: string,
  expectedComparableDishItems: ComparableDishItem[] = expectedDishItems,
): Promise<void> {
  await test.step('校验 Recall 菜品明细与点单页一致', async () => {
    expect(
      normalizeDishItems(recallDetails.items),
      'Recall 菜品明细应与点单页菜品明细一致',
    ).toEqual(normalizeExpectedDishItems(expectedComparableDishItems));
  });

  await test.step('校验 Recall 价格信息与点单页一致', async () => {
    expect(
      pickComparablePriceSummary(recallDetails.priceSummary),
      'Recall 价格汇总应与点单页价格汇总一致',
    ).toEqual(pickComparablePriceSummary(orderPriceSummary));
  });

  await test.step('校验 Recall 桌台信息与下单桌台一致', async () => {
    expect(
      recallDetails.orderContext.tableName,
      'Recall 桌台号应与下单时选中的桌台一致',
    ).toBe(expectedTableNumber);
  });

  await test.step('校验 Recall 桌台人数为 3 人', async () => {
    expect(
      recallDetails.orderContext.guestCount,
      'Recall 人数应与下单时选择的 3 人一致',
    ).toBe(String(expectedGuestCount));
  });

  await test.step('校验 Recall 支付状态为未支付', async () => {
    expect(
      recallDetails.paymentStatus,
      'Recall 支付状态应保持未支付',
    ).toBe(RecallPaymentStatuses.unpaid);
  });
}

async function assertRecallMatchesSplitSuborder(
  recallDetails: RecallOrderDetails,
  expectedSuborder: SplitOrderSuborderSnapshot,
  expectedTableNumber: string,
): Promise<void> {
  await test.step('校验 Recall 菜品明细包含目标子单的关键菜品', async () => {
    const recallDishNames = [...new Set(recallDetails.items.map((item) => item.name))].sort((leftItem, rightItem) =>
      leftItem.localeCompare(rightItem),
    );
    const expectedDishNames = [...new Set(expectedSuborder.dishes.map((dish) => dish.name))].sort((leftItem, rightItem) =>
      leftItem.localeCompare(rightItem),
    );

    expect(recallDishNames, 'Recall 菜品名称集合应与目标子单一致').toEqual(expectedDishNames);
    expect(
      recallDetails.items.filter((item) => item.name === 'test').length,
      'Recall 中的 x-3 子单至少应包含 2 行 test，表示移动结果已保留',
    ).toBeGreaterThanOrEqual(2);
  });

  await test.step('校验 Recall 订单上下文与目标子单一致', async () => {
    expect(recallDetails.orderContext.orderType ?? '').toMatch(/dine[\s-]*in/i);
    expect(recallDetails.orderContext.tableName).toBe(expectedTableNumber);

    if (expectedSuborder.seats.length > 0) {
      expect(recallDetails.orderContext.guestCount).toBe(String(expectedSuborder.seats.length));
    }
  });

  await test.step('校验 Recall 价格摘要与目标子单一致', async () => {
    const expectedTotalBeforeTips = parseCurrencyValue(expectedSuborder.total);
    if (expectedTotalBeforeTips !== null) {
      expect(recallDetails.priceSummary['Total Before Tips']).toBe(expectedTotalBeforeTips);
    }
  });
}

async function enterRecallAfterSplitSave(
  pageAfterSplitSave: HomePage | OrderDishesPage | RecallPage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<RecallPage> {
  if (pageAfterSplitSave instanceof RecallPage) {
    return pageAfterSplitSave;
  }

  const recallReadyHomePage =
    pageAfterSplitSave instanceof OrderDishesPage
      ? await pageAfterSplitSave.saveOrder()
      : pageAfterSplitSave;

  const requiresEmployeeRelogin = await waitUntil(
    async () => await employeeLoginPage.isVisible(),
    (isVisible) => isVisible,
    {
      timeout: 3_000,
      message: 'Employee passcode dialog did not appear after split save in time.',
    },
  ).catch(() => false);

  const loggedInHomePage = requiresEmployeeRelogin
    ? await enterEmployeeContext(recallReadyHomePage, employeeLoginPage)
    : recallReadyHomePage;

  const recallPage = await loggedInHomePage.clickRecall();
  const recallLoaded = await recallPage.expectLoaded().then(() => true).catch(() => false);

  if (recallLoaded) {
    return recallPage;
  }

  if (await employeeLoginPage.isVisible().catch(() => false)) {
    const reloggedInHomePage = await enterEmployeeContext(loggedInHomePage, employeeLoginPage);
    const retriedRecallPage = await reloggedInHomePage.clickRecall();
    await retriedRecallPage.expectLoaded();
    return retriedRecallPage;
  }

  throw new Error('Unable to enter Recall after split save.');
}

test.describe('堂食点单后 Recall 校验', () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '应能在任意空桌以 3 人堂食点单保存后通过 Recall 校验订单信息一致',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/12345',
        },
      ],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await test.step('从首页进入系统并完成堂食点单前置操作', async () => {
        await openHome(homePage);

        if (await licenseSelectionPage.isVisible(30_000)) {
          await enterWithAvailableLicense(licenseSelectionPage, homePage);
        }
      });

      const dineInOrderContext = await test.step('使用员工口令进入系统并选择任意空桌的 3 人堂食点单页', async () => {
        const readyHomePage = await enterEmployeeContext(homePage, employeeLoginPage);

        await readyHomePage.expectPrimaryFunctionCardsVisible();
        const selectTablePage = await readyHomePage.clickDineIn();
        const { orderDishesPage, selectedTable } = await selectAnyAvailableTableAndEnterOrderDishes(
          selectTablePage,
          expectedGuestCount,
        );

        await orderDishesPage.expectTableNumber(selectedTable.tableNumber);
        await orderDishesPage.expectGuestCount(expectedGuestCount);

        return {
          orderDishesPage,
          selectedTable,
        };
      });

      const orderSnapshot = await test.step('执行堂食点单并保存订单', async () => {
        await addWeightedDish(dineInOrderContext.orderDishesPage, '称重菜', automationMenu, 14);
        await addRegularDish(dineInOrderContext.orderDishesPage, 'test', automationMenu, 2);

        const currentOrderPriceSummary = await dineInOrderContext.orderDishesPage.readPriceSummary();

        const savedHomePage = await dineInOrderContext.orderDishesPage.saveOrder();
        await savedHomePage.expectPrimaryFunctionCardsVisible();

        return {
          currentOrderPriceSummary,
          savedHomePage,
        };
      });

      const recallDetails = await test.step('进入 Recall 查询包含目标菜品的最新未支付堂食订单', async () => {
        const recallReadyHomePage = await employeeLoginPage.isVisible()
          ? await enterEmployeeContext(orderSnapshot.savedHomePage, employeeLoginPage)
          : orderSnapshot.savedHomePage;
        const recallPage = await openRecallFromHome(recallReadyHomePage);

        await searchRecallOrders(recallPage, {
          paymentStatus: RecallPaymentStatuses.unpaid,
        });

        const latestOrderNumber = await readLatestVisibleRecallOrderNumber(recallPage);
        return await viewRecallOrderDetails(recallPage, latestOrderNumber);
      });

      await test.step('逐项校验 Recall 订单信息', async () => {
        await assertRecallMatchesOrderSnapshot(
          recallDetails,
          orderSnapshot.currentOrderPriceSummary,
          dineInOrderContext.selectedTable.tableNumber,
        );
      });
    },
  );

  test(
    '应能在堂食点单后将订单平分三份并移动 x-1 的 test 到 x-3 后保存分单并在 Recall 查看订单',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/12345',
        },
      ],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      const splitOrderFlow = new SplitOrderFlow();

      await test.step('从首页进入系统并完成堂食点单前置操作', async () => {
        await openHome(homePage);

        if (await licenseSelectionPage.isVisible(30_000)) {
          await enterWithAvailableLicense(licenseSelectionPage, homePage);
        }
      });

      const dineInOrderContext = await test.step('使用员工口令进入系统并选择任意空桌的 3 人堂食点单页', async () => {
        const readyHomePage = await enterEmployeeContext(homePage, employeeLoginPage);

        await readyHomePage.expectPrimaryFunctionCardsVisible();
        const selectTablePage = await readyHomePage.clickDineIn();
        const { orderDishesPage, selectedTable } = await selectAnyAvailableTableAndEnterOrderDishes(
          selectTablePage,
          expectedGuestCount,
        );

        await orderDishesPage.expectTableNumber(selectedTable.tableNumber);
        await orderDishesPage.expectGuestCount(expectedGuestCount);

        return {
          orderDishesPage,
          selectedTable,
        };
      });

      await test.step('完成点单', async () => {
        await addRegularDish(dineInOrderContext.orderDishesPage, 'test', automationMenu, 2);
        await addRegularDish(dineInOrderContext.orderDishesPage, 'common item2', automationMenu, 1);
      });

      const splitResult = await test.step('将当前订单平分三份并把 x-1 的 test 移动到 x-3', async () => {
        const splitOrderPage = await dineInOrderContext.orderDishesPage.openSplitOrder();

        await splitOrderFlow.splitOrderEvenly(splitOrderPage, 3);

        const evenlySplitSnapshot = await splitOrderPage.readSnapshot();
        expect(evenlySplitSnapshot.suborders).toHaveLength(3);

        const sourceOrderNumber = evenlySplitSnapshot.suborders[0]?.orderNumber;
        const targetOrderNumber = evenlySplitSnapshot.suborders[2]?.orderNumber;

        expect(sourceOrderNumber, '平分三份后应存在 x-1 子单').toBeTruthy();
        expect(targetOrderNumber, '平分三份后应存在 x-3 子单').toBeTruthy();

        const sourceTestCountBeforeMove = countSplitDishRows(
          evenlySplitSnapshot,
          sourceOrderNumber as string,
          'test',
        );
        const targetTestCountBeforeMove = countSplitDishRows(
          evenlySplitSnapshot,
          targetOrderNumber as string,
          'test',
        );

        await splitOrderFlow.moveDishes(
          splitOrderPage,
          sourceOrderNumber as string,
          ['test'],
          targetOrderNumber as string,
        );

        const movedSnapshot = await splitOrderPage.readSnapshot();
        const targetSuborderSnapshot = movedSnapshot.suborders.find(
          (suborder) => suborder.orderNumber === targetOrderNumber,
        );
        expect(
          countSplitDishRows(movedSnapshot, sourceOrderNumber as string, 'test'),
          '移动后 x-1 子单中的 test 数量应减少 1',
        ).toBe(sourceTestCountBeforeMove - 1);
        expect(
          countSplitDishRows(movedSnapshot, targetOrderNumber as string, 'test'),
          '移动后 x-3 子单中的 test 数量应增加 1',
        ).toBe(targetTestCountBeforeMove + 1);
        expect(targetSuborderSnapshot, '移动后应仍能读取 x-3 子单快照').toBeTruthy();

        return {
          pageAfterSplitSave: await splitOrderFlow.submitAndReturnPage(splitOrderPage),
          recallOrderNumber: String(sourceOrderNumber).replace(/-\d+$/, ''),
          targetOrderNumber: targetOrderNumber as string,
          targetSuborderSnapshot: targetSuborderSnapshot as SplitOrderSuborderSnapshot,
        };
      });

      const recallDetails = await test.step('按订单号进入 Recall 查看刚保存的分单订单', async () => {
        const recallPage = await enterRecallAfterSplitSave(
          splitResult.pageAfterSplitSave,
          employeeLoginPage,
        );

        await searchRecallOrders(recallPage, {
          paymentStatus: RecallPaymentStatuses.unpaid,
        });

        return await viewRecallOrderDetails(
          recallPage,
          splitResult.recallOrderNumber,
          splitResult.targetOrderNumber,
        );
      });

      await test.step('校验分单保存后 Recall 仍可读取 x-3 子单详情', async () => {
        expect(recallDetails.orderNumber).toBe(`#${splitResult.targetOrderNumber}`);
        await assertRecallMatchesSplitSuborder(
          recallDetails,
          splitResult.targetSuborderSnapshot,
          dineInOrderContext.selectedTable.tableNumber,
        );
      });
    },
  );
});

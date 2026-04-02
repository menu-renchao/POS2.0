import { expect } from '@playwright/test';
import { enterWithEmployeePassword } from '../../flows/employee-login.flow';
import { openHome } from '../../flows/home.flow';
import { addRegularDish, addWeightedDish } from '../../flows/order-dishes.flow';
import {
  readLatestVisibleRecallOrderNumber,
  searchRecallOrders,
  viewRecallOrderDetails,
} from '../../flows/recall.flow';
import { enterWithAvailableLicense } from '../../flows/license-selection.flow';
import { selectAnyAvailableTableAndEnterOrderDishes } from '../../flows/select-table.flow';
import { test } from '../../fixtures/test.fixture';
import { type OrderPriceSummary } from '../../pages/order-dishes.page';
import { type RecallOrderDetails, type RecallOrderItem } from '../../pages/recall.page';
import {
  RecallManualSearchTags,
  RecallPaymentStatuses,
} from '../../test-data/recall-search-options';

type ComparableDishItem = {
  quantity: string;
  name: string;
};

const expectedGuestCount = 3;
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

function pickComparablePriceSummary(summary: Record<string, string>): Record<string, string> {
  return comparablePriceSummaryKeys.reduce<Record<string, string>>((pickedSummary, key) => {
    if (summary[key]) {
      pickedSummary[key] = summary[key];
    }

    return pickedSummary;
  }, {});
}

async function assertRecallMatchesOrderSnapshot(
  recallDetails: RecallOrderDetails,
  orderPriceSummary: OrderPriceSummary,
  expectedTableNumber: string,
): Promise<void> {
  await test.step('校验 Recall 菜品明细与点单页一致', async () => {
    expect(
      normalizeDishItems(recallDetails.items),
      'Recall 菜品明细应与点单页菜品明细一致',
    ).toEqual(normalizeExpectedDishItems(expectedDishItems));
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

test.describe('堂食点单后 Recall 校验', () => {
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

        if (await licenseSelectionPage.isVisible(10_000)) {
          await enterWithAvailableLicense(licenseSelectionPage, homePage);
        }
      });

      const dineInOrderContext = await test.step('使用员工口令进入系统并选择任意空桌的 3 人堂食点单页', async () => {
        const readyHomePage = await enterWithEmployeePassword(
          employeeLoginPage,
          homePage,
          '11',
        );

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
        await addWeightedDish(dineInOrderContext.orderDishesPage, '称重菜', 14);
        await addRegularDish(dineInOrderContext.orderDishesPage, 'test', 2);

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
          ? await enterWithEmployeePassword(
              employeeLoginPage,
              orderSnapshot.savedHomePage,
              '11',
            )
          : orderSnapshot.savedHomePage;
        const recallPage = await recallReadyHomePage.clickRecall();

        await searchRecallOrders(recallPage, {
          paymentStatus: RecallPaymentStatuses.unpaid,
          manualSearch: {
            tag: RecallManualSearchTags.itemName,
            keyword: 'test',
          },
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
});

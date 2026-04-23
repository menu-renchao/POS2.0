import { expect } from '@playwright/test';
import { enterEmployeeContext } from '../../flows/employee-login.flow';
import { openHome } from '../../flows/home.flow';
import { enterWithAvailableLicense } from '../../flows/license-selection.flow';
import {
  addRegularDish,
  increaseOrderedDishQuantityByOne,
  sendOrderToKitchen,
} from '../../flows/order-dishes.flow';
import {
  editFirstVisibleRecallOrder,
  openRecallFromHome,
  viewFirstVisibleRecallOrderDetails
} from '../../flows/recall.flow';
import { skipTableSelectionAndEnterOrderDishes } from '../../flows/select-table.flow';
import { test } from '../../fixtures/test.fixture';
import { RecallPage } from '../../pages/recall.page';
const firstDishName = '普通菜1';
const secondDishName = 'test';

function readCurrencyAmount(value: string | undefined): number {
  if (!value) {
    throw new Error('Expected a currency value, but received empty content.');
  }

  const parsed = Number(value.replace(/[$,]/g, ''));

  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to parse currency value: ${value}`);
  }

  return parsed;
}

function readSubtotal(priceSummary: Record<string, string>): string {
  const subtotal = priceSummary.Subtotal;

  if (!subtotal) {
    throw new Error('Recall price summary did not include a Subtotal field.');
  }

  return subtotal;
}

test.describe('堂食点单后 Recall 编辑税额校验', () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '应能堂食送厨后在 Recall 编辑菜品数量并校验税额实时更新',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-30543',
        },
      ],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await test.step('从首页进入系统并完成授权前置条件', async () => {
        await openHome(homePage);

        if (await licenseSelectionPage.isVisible(30_000)) {
          await enterWithAvailableLicense(licenseSelectionPage, homePage);
        }
      });

      const sentOrderContext = await test.step('使用员工口令进入系统并通过 New Order 不选桌完成堂食点单送厨', async () => {
        const readyHomePage = await enterEmployeeContext(homePage, employeeLoginPage);
        await readyHomePage.expectPrimaryFunctionCardsVisible();
        const selectTablePage = await readyHomePage.clickDineIn();
        const orderDishesPage = await skipTableSelectionAndEnterOrderDishes(
          selectTablePage,
        );

        await addRegularDish(orderDishesPage, firstDishName, 1);
        await addRegularDish(orderDishesPage, secondDishName, 1);

        await sendOrderToKitchen(orderDishesPage);
        const savedHomePage = await orderDishesPage.saveOrder();
        await savedHomePage.expectPrimaryFunctionCardsVisible();

        return {
          savedHomePage,
        };
      });

      const recallBeforeEdit = await test.step('进入 Recall 读取最新订单并记录编辑前税额', async () => {
        const recallPage = await openRecallFromHome(sentOrderContext.savedHomePage);
        const orderDetails = await viewFirstVisibleRecallOrderDetails(recallPage);
        const subtotalBeforeEdit = orderDetails.priceSummary.Subtotal;
        const taxBeforeEdit = orderDetails.priceSummary.Tax;
        const testItem = orderDetails.items.find((item) => item.name === secondDishName);

        expect(orderDetails.items.map((item) => item.name), 'Recall 应包含送厨菜品').toEqual(
          expect.arrayContaining([firstDishName, secondDishName]),
        );
        expect(subtotalBeforeEdit, '编辑前 Recall 应能读取 Subtotal').toBeTruthy();
        expect(taxBeforeEdit, '编辑前 Recall 应能读取税额').toBeTruthy();
        expect(testItem?.price, 'Recall 中 test 菜品应有单价').toBeTruthy();

        return {
          recallPage,
          subtotalBeforeEdit,
          taxBeforeEdit,
          testItemPrice: testItem?.price ?? '',
        };
      });

      const editResult = await test.step('从 Recall 编辑订单并将 test 加 1 后保存', async () => {
        const recallPage: RecallPage = recallBeforeEdit.recallPage;
        const editingOrderDishesPage = await editFirstVisibleRecallOrder(recallPage);

        await increaseOrderedDishQuantityByOne(editingOrderDishesPage, secondDishName);
        const priceSummaryAfterQuantityChange = await editingOrderDishesPage.readPriceSummary();
        const subtotalAfterQuantityChange = priceSummaryAfterQuantityChange.Subtotal;
        const subtotalDelta = subtotalAfterQuantityChange - recallBeforeEdit.subtotalBeforeEdit;
        const testItemPrice = readCurrencyAmount(recallBeforeEdit.testItemPrice);

        expect(subtotalDelta, '点单页加 1 后 Subtotal 应增加 test 单价').toBeCloseTo(testItemPrice, 2);

        const savedHomePage = await editingOrderDishesPage.saveOrder();
        await savedHomePage.expectPrimaryFunctionCardsVisible();

        return {
          savedHomePage,
          subtotalAfterQuantityChange,
        };
      });

      await test.step('再次进入 Recall 校验保存后的税额已更新', async () => {
        const readyHomePage = await enterEmployeeContext(
          editResult.savedHomePage,
          employeeLoginPage,
        );
        const recallPage = await openRecallFromHome(readyHomePage);

        const orderDetailsAfterEdit = await viewFirstVisibleRecallOrderDetails(recallPage);
        const subtotalAfterEdit = orderDetailsAfterEdit.priceSummary.Subtotal;
        const taxAfterEdit = orderDetailsAfterEdit.priceSummary.Tax;
        const afterTaxRate = taxAfterEdit / subtotalAfterEdit;
        const beforeTaxRate = recallBeforeEdit.taxBeforeEdit / recallBeforeEdit.subtotalBeforeEdit;

        expect(orderDetailsAfterEdit.items.find((item) => item.name === secondDishName)?.quantity).toBe('2');
        expect(subtotalAfterEdit, 'Recall 保存后应保留更新后的 Subtotal').toBeTruthy();
        expect(taxAfterEdit, 'Recall 保存后应保留更新后的税额').toBeTruthy();
        expect(afterTaxRate, 'Recall 保存后的 tax/subtotal 比例应与修改前近似一致').toBeCloseTo(
          beforeTaxRate,
          2,
        );
        expect(subtotalAfterEdit, 'Recall 保存后 Subtotal 应与点单页实时值一致').toBe(
          editResult.subtotalAfterQuantityChange,
        );
      });
    },
  );
});

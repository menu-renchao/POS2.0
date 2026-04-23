import { enterWithEmployeePassword } from '../../flows/employee-login.flow';
import { openHome } from '../../flows/home.flow';
import { addComboDish, addRegularDish } from '../../flows/order-dishes.flow';
import { enterWithAvailableLicense } from '../../flows/license-selection.flow';
import { selectAnyAvailableTableAndEnterOrderDishes } from '../../flows/select-table.flow';
import { test } from '../../fixtures/test.fixture';

test.describe('点餐冒烟测试', () => {
  test.setTimeout(60_000);

  test(
    '应能进入点餐页面并添加普通菜与带数量的套餐子菜到购物车',
    {
      tag: ['@smoke'],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await openHome(homePage);

      if (await licenseSelectionPage.isVisible(30_000)) {
        await enterWithAvailableLicense(licenseSelectionPage, homePage);
      }

      const loggedInHomePage = await enterWithEmployeePassword(
        employeeLoginPage,
        homePage,
        '11',
      );

      await loggedInHomePage.expectPrimaryFunctionCardsVisible();
      const selectTablePage = await loggedInHomePage.clickDineIn();
      await selectTablePage.expectLoaded();

      const { orderDishesPage, selectedTable } = await selectAnyAvailableTableAndEnterOrderDishes(
        selectTablePage,
        1,
      );

      await orderDishesPage.expectTableNumber(selectedTable.tableNumber);
      await orderDishesPage.expectGuestCount(1);

      await addRegularDish(orderDishesPage, 'test', 3);
      await addComboDish(
        orderDishesPage,
        '普通套餐',
        {
          common: {
            普通菜1: 1,
            普通菜2: 2,
          },
          SelectionYprbJ: {
            'Spi Thai Gn Curry Chk': 1,
            'Spi Kung Pao Chicken': 1,
          },
          SelectiondDbta: {
            'Crabmeat Salad': 1,
            'House Salad': 1,
          },
        },
        3,
      );
      await orderDishesPage.saveOrder();
    },
  );
});

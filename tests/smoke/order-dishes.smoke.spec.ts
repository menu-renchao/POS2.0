import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { LicenseSelectionFlow } from '../../flows/license-selection.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { test } from '../../fixtures/test.fixture';

const automationMenu = {
  category: '全类型类',
  group: '自动化菜单组',
};

test.describe('点餐冒烟测试', () => {
  test.setTimeout(60_000);

  test(
    '应能进入点餐页面并添加普通菜与带数量的套餐子菜到购物车',
    {
      tag: ['@smoke'],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await new HomeFlow().openHome(homePage);

      if (await licenseSelectionPage.isVisible(30_000)) {
        await new LicenseSelectionFlow().enterWithAvailableLicense(licenseSelectionPage, homePage);
      }

      const loggedInHomePage = await new EmployeeLoginFlow().enterWithEmployeePassword(
        employeeLoginPage,
        homePage,
        '11',
      );

      await loggedInHomePage.expectPrimaryFunctionCardsVisible();
      const selectTablePage = await loggedInHomePage.clickDineIn();
      await selectTablePage.expectLoaded();

      const { orderDishesPage, selectedTable } = await new SelectTableFlow().selectAnyAvailableTableAndEnterOrderDishes(
        selectTablePage,
        1,
      );

      await orderDishesPage.expectTableNumber(selectedTable.tableNumber);
      await orderDishesPage.expectGuestCount(1);

      await new OrderDishesFlow().addRegularDish(orderDishesPage, 'test', automationMenu, 3);
      await new OrderDishesFlow().addComboDish(
        orderDishesPage,
        '普通套餐',
        automationMenu,
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

import { enterWithEmployeePassword } from '../../flows/employee-login.flow';
import { openHome } from '../../flows/home.flow';
import { enterWithAvailableLicense } from '../../flows/license-selection.flow';
import { skipTableSelectionAndEnterOrderDishes } from '../../flows/select-table.flow';
import { test } from '../../fixtures/test.fixture';

test.describe('堂食点餐冒烟', () => {
  test(
    '应能通过 New order 跳过选桌直接进入点餐页面',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-46667',
        },
      ],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await openHome(homePage);

      if (await licenseSelectionPage.isVisible(10_000)) {
        await enterWithAvailableLicense(licenseSelectionPage, homePage);
      }

      const loggedInHomePage = await enterWithEmployeePassword(
        employeeLoginPage,
        homePage,
        '11',
      );

      await loggedInHomePage.expectPrimaryFunctionCardsVisible();
      const selectTablePage = await loggedInHomePage.clickDineIn();
      const orderDishesPage = await skipTableSelectionAndEnterOrderDishes(selectTablePage);

      await orderDishesPage.expectLoaded();
    },
  );
});

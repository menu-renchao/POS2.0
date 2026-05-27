import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { LicenseSelectionFlow } from '../../flows/license-selection.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
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
      await new HomeFlow().openHome(homePage);

      if (await licenseSelectionPage.isVisible(10_000)) {
        await new LicenseSelectionFlow().enterWithAvailableLicense(licenseSelectionPage, homePage);
      }

      const loggedInHomePage = await new EmployeeLoginFlow().enterWithEmployeePassword(
        employeeLoginPage,
        homePage,
        '11',
      );

      await loggedInHomePage.expectPrimaryFunctionCardsVisible();
      const selectTablePage = await loggedInHomePage.clickDineIn();
      const orderDishesPage = await new SelectTableFlow().skipTableSelectionAndEnterOrderDishes(selectTablePage);

      await orderDishesPage.expectLoaded();
    },
  );
});

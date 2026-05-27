import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { LicenseSelectionFlow } from '../../flows/license-selection.flow';
import { test } from '../../fixtures/test.fixture';

test.describe('Dine In 入口冒烟', () => {
  test(
    '应能从主页点击 Dine In 入口进入选桌流程',
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
      await loggedInHomePage.clickDineIn();
    },
  );
});

import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { LicenseSelectionFlow } from '../../flows/license-selection.flow';
import { test } from '../../fixtures/test.fixture';

test.describe('授权选择与员工登录冒烟', () => {
  test(
    '应能通过 License 选择和员工口令登录进入 POS 主页',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-46667',
        },
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-46668',
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

      await loggedInHomePage.expectEmployeeReady();
    },
  );
});

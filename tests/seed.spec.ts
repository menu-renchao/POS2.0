import { EmployeeLoginFlow } from '../flows/employee-login.flow';
import { HomeFlow } from '../flows/home.flow';
import { LicenseSelectionFlow } from '../flows/license-selection.flow';
import { test } from '../fixtures/test.fixture';

test.describe('Playwright Test Agents 种子入口', () => {
  test(
    '应能进入 POS 首页并建立员工上下文',
    {
      tag: ['@seed'],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await new HomeFlow().openHome(homePage);

      if (await licenseSelectionPage.isVisible(10_000)) {
        await new LicenseSelectionFlow().enterWithAvailableLicense(licenseSelectionPage, homePage);
      }
      const readyHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
        homePage,
        employeeLoginPage,
        '11',
      );

      await readyHomePage.expectEmployeeReady();
    },
  );
});

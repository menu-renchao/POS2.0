import { enterEmployeeContext } from '../flows/employee-login.flow';
import { openHome } from '../flows/home.flow';
import { enterWithAvailableLicense } from '../flows/license-selection.flow';
import { test } from '../fixtures/test.fixture';

test.describe('Playwright Test Agents 种子入口', () => {
  test(
    '应能进入 POS 首页并建立员工上下文',
    {
      tag: ['@seed'],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await openHome(homePage);

      if (await licenseSelectionPage.isVisible(10_000)) {
        await enterWithAvailableLicense(licenseSelectionPage, homePage);
      }

      const readyHomePage = await enterEmployeeContext(
        homePage,
        employeeLoginPage,
        '11',
      );

      await readyHomePage.expectEmployeeReady();
    },
  );
});

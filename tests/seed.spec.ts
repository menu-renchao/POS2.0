import { HomeFlow } from '../flows/home.flow';
import { test } from '../fixtures/test.fixture';

test.describe('Playwright Test Agents 种子入口', () => {
  test(
    '应能进入 POS 首页并建立员工上下文',
    {
      tag: ['@seed'],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);

      await readyHomePage.expectEmployeeReady();
    },
  );
});

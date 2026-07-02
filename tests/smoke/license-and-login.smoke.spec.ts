import { HomeFlow } from '../../flows/home.flow';
import { test } from '../../fixtures/test.fixture';

test.describe('员工上下文入口冒烟', () => {
  test(
    '应能通过员工口令登录进入 POS 主页',
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
    async ({ homePage, employeeLoginPage }) => {
      const loggedInHomePage = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);

      await loggedInHomePage.expectEmployeeReady();
    },
  );
});

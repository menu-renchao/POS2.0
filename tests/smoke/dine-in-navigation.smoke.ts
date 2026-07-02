import { HomeFlow } from '../../flows/home.flow';
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
    async ({ homePage, employeeLoginPage }) => {
      const loggedInHomePage = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);

      await loggedInHomePage.expectPrimaryFunctionCardsVisible();
      await loggedInHomePage.clickDineIn();
    },
  );
});

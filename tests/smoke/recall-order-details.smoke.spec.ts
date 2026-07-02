import { expect } from '@playwright/test';
import { HomeFlow } from '../../flows/home.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { test } from '../../fixtures/test.fixture';

test.describe('Recall 订单详情冒烟', () => {
  test(
    '应能读取 #1 订单详情并在完成后恢复 Recall 页面状态',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-46667',
        },
      ],
    },
    async ({ page, homePage, employeeLoginPage }) => {
      const loggedInHomePage = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
      const recallPage = await new RecallFlow().openRecallFromHome(loggedInHomePage);

      const details = await new RecallFlow().viewOrderDetails(recallPage, '1');
      console.log(JSON.stringify(details, null, 2));
      expect(details.orderNumber).toBe('#1');
      expect(details.paymentStatus).toBeTruthy();
      expect(details.items.length).toBeGreaterThan(0);
      expect(Object.keys(details.priceSummary).length).toBeGreaterThan(0);
      expect(details.orderContext.tableName).toBe('3');
      expect(details.orderContext.guestCount).toBe('1');

      await expect(page.locator('[role="dialog"][data-testid="pos-ui-modal"]')).toBeHidden();
      await recallPage.expectLoaded();
    },
  );
});

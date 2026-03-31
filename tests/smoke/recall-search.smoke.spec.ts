import { expect } from '@playwright/test';
import {
  clearRecallSearchConditions,
  searchRecallOrders,
} from '../../flows/recall.flow';
import { enterWithEmployeePassword } from '../../flows/employee-login.flow';
import { openHome } from '../../flows/home.flow';
import { enterWithAvailableLicense } from '../../flows/license-selection.flow';
import { test } from '../../fixtures/test.fixture';
import { RecallManualSearchTags } from '../../test-data/recall-search-options';

test.describe('Recall 搜索冒烟', () => {
  test(
    '应能按订单号搜索 Recall 订单并清空当前搜索条件',
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
      const recallPage = await loggedInHomePage.clickRecall();

      await recallPage.expectLoaded();

      const visibleOrderNumbers = await recallPage.readVisibleOrderNumbers();
      const targetOrderNumber = visibleOrderNumbers[0];

      expect(targetOrderNumber).toBeTruthy();

      await searchRecallOrders(recallPage, {
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: targetOrderNumber.replace(/^#/, ''),
        },
      });

      await expect
        .poll(async () => {
          const orderNumbers = await recallPage.readVisibleOrderNumbers();
          return orderNumbers.length > 0 && orderNumbers.every((orderNumber) => orderNumber === targetOrderNumber);
        })
        .toBe(true);

      await clearRecallSearchConditions(recallPage);

      await expect.poll(async () => await recallPage.readManualSearchKeyword()).toBe('');
      await expect.poll(async () => await recallPage.readActiveFilterTexts()).toEqual([]);
      await expect
        .poll(async () => (await recallPage.readVisibleOrderNumbers()).length)
        .toBeGreaterThan(0);
    },
  );
});

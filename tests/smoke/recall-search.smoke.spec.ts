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
import { waitUntil } from '../../utils/wait';

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

      const visibleOrderNumbers = await waitUntil(
        async () => await recallPage.readVisibleOrderNumbers(),
        (orderNumbers) => orderNumbers.length > 0,
        {
          timeout: 10_000,
          message: 'Recall order list did not load any order numbers in time.',
        },
      );
      const targetOrderNumber = visibleOrderNumbers[0];

      expect(targetOrderNumber).toBeTruthy();

      await searchRecallOrders(recallPage, {
        manualSearch: {
          tag: RecallManualSearchTags.orderNumber,
          keyword: targetOrderNumber.replace(/^#/, ''),
        },
      });

      const filteredOrderNumbers = await waitUntil(
        async () => await recallPage.readVisibleOrderNumbers(),
        (orderNumbers) =>
          orderNumbers.length > 0 &&
          orderNumbers.every((orderNumber) => orderNumber === targetOrderNumber),
        {
          timeout: 10_000,
          message: `Recall order list did not narrow down to ${targetOrderNumber}.`,
        },
      );

      expect(filteredOrderNumbers.length).toBeGreaterThan(0);
      expect(filteredOrderNumbers.every((orderNumber) => orderNumber === targetOrderNumber)).toBe(true);

      await clearRecallSearchConditions(recallPage);

      const clearedKeyword = await waitUntil(
        async () => await recallPage.readManualSearchKeyword(),
        (keyword) => keyword === '',
        {
          timeout: 10_000,
          message: 'Recall manual search keyword was not cleared in time.',
        },
      );
      expect(clearedKeyword).toBe('');

      const activeFilterTexts = await waitUntil(
        async () => await recallPage.readActiveFilterTexts(),
        (filters) => filters.length === 0,
        {
          timeout: 10_000,
          message: 'Recall active filters were not cleared in time.',
        },
      );
      expect(activeFilterTexts).toEqual([]);

      const visibleOrderNumbersAfterClear = await waitUntil(
        async () => await recallPage.readVisibleOrderNumbers(),
        (orderNumbers) => orderNumbers.length > 0,
        {
          timeout: 10_000,
          message: 'Recall order list did not recover after clearing filters.',
        },
      );
      expect(visibleOrderNumbersAfterClear.length).toBeGreaterThan(0);
    },
  );
});

import { expect, test } from '@playwright/test';
import { RecallPage } from '../../pages/recall.page';

const recallRecentOrderFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="recall2-header-new-order">New Order</button>
    <button type="button" data-testid="recall2-header-paging">Paging</button>
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-active-filter-bar"></div>
    <div data-testid="recall2-order-list-container">
      <button type="button" data-testid="shared-order-card-open-1001">#1001</button>
      <button type="button" data-testid="shared-order-card-open-1005">#1005</button>
    </div>

    <div role="dialog" aria-modal="true" data-testid="pos-ui-modal" hidden>
      <span data-testid="order-details-number"></span>
      <button type="button" data-testid="shared-order-detail-side-action-editod">Edit</button>
    </div>

    <script>
      (() => {
        const state = {
          clickedOrderNumber: null,
        };

        window.__recallRecentOrderState = state;

        const dialog = document.querySelector('[data-testid="pos-ui-modal"]');
        const orderNumberLabel = document.querySelector('[data-testid="order-details-number"]');

        for (const orderButton of document.querySelectorAll('[data-testid^="shared-order-card-open-"]')) {
          orderButton.addEventListener('click', () => {
            state.clickedOrderNumber = orderButton.textContent.trim();
            orderNumberLabel.textContent = state.clickedOrderNumber;
            dialog.hidden = false;
          });
        }
      })();
    </script>
  </body>
</html>
`;

test.describe('Recall 最近订单契约', () => {
  test(
    '应按最新订单号而不是第一张卡片打开最近一笔订单详情',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备第一张卡片不是最新订单的 Recall 页面骨架', async () => {
        await page.setContent(recallRecentOrderFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = 'recall';
        });
      });

      await test.step('打开 Recall 最近一笔订单详情', async () => {
        await recallPage.openRecentOrderDetails();
      });

      await test.step('确认最近一笔订单详情命中了更大的订单号', async () => {
        expect(
          await page.evaluate(
            () =>
              (
                window as typeof window & {
                  __recallRecentOrderState: { clickedOrderNumber: string | null };
                }
              ).__recallRecentOrderState.clickedOrderNumber,
          ),
        ).toBe('#1005');
        await expect(page.getByTestId('order-details-number')).toHaveText('#1005');
      });
    },
  );
});

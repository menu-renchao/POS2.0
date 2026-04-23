import { expect, test } from '@playwright/test';
import { RecallPage } from '../../pages/recall.page';

const recallEditFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="recall2-header-new-order">New Order</button>
    <button type="button" data-testid="recall2-header-paging">Paging</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderStatus">Order Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderType">Order Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentType">Payment Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-productLine">Product Line</button>
    <button type="button" data-testid="recall2-search-trigger">Search</button>
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-order-list-container">
      <button type="button" data-testid="recall2-order-card-1001">#1001</button>
    </div>

    <div role="dialog" aria-modal="true" data-testid="pos-ui-modal" hidden>
      <span class="_number_abc">#1001</span>
      <span class="_statusTag_abc">Unpaid</span>
      <button type="button" data-test-id="shared-order-detail-side-action-editod">Edit</button>
    </div>

    <iframe data-wujie-id="orderDishes" hidden></iframe>

    <script>
      (() => {
        const orderCard = document.querySelector('[data-testid="recall2-order-card-1001"]');
        const dialog = document.querySelector('[data-testid="pos-ui-modal"]');
        const editButton = document.querySelector('[data-test-id="shared-order-detail-side-action-editod"]');
        const orderDishesFrame = document.querySelector('iframe[data-wujie-id="orderDishes"]');

        orderDishesFrame.srcdoc = [
          '<!DOCTYPE html>',
          '<html><body>',
          '<button type="button">Back</button>',
          '<button type="button">Send</button>',
          '<button type="button">Pay</button>',
          '</body></html>',
        ].join('');

        orderCard.addEventListener('click', () => {
          dialog.hidden = false;
        });

        editButton.addEventListener('click', () => {
          dialog.hidden = true;
          orderDishesFrame.hidden = false;
          window.location.hash = 'orderDishes';
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('Recall 订单编辑契约', () => {
  test(
    '应能从 Recall 订单详情点击编辑并进入点单页',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备包含编辑入口的 Recall 订单详情页面', async () => {
        await page.setContent(recallEditFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = 'recall';
        });
      });

      const orderDishesPage = await recallPage.openOrderForEditing('1001');

      await test.step('确认编辑入口已进入点单页', async () => {
        await orderDishesPage.expectLoaded();
        await expect(page).toHaveURL(/#orderDishes/);
      });
    },
  );
});

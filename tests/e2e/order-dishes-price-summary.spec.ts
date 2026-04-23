import { expect, test } from '@playwright/test';
import { OrderDishesPage } from '../../pages/order-dishes.page';

const orderDishesFrameHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>

    <div
      role="button"
      tabindex="0"
      aria-expanded="false"
      data-test-id="shared-order-price-summary-toggle"
    >
      <div role="separator" aria-orientation="horizontal" data-testid="pos-ui-separator"></div>
      <span>Toggle price summary</span>
      <div role="separator" aria-orientation="horizontal" data-testid="pos-ui-separator"></div>
    </div>

    <div data-testid="price-summary-details" hidden>
      <div class="row"><span>Count</span><span>3</span></div>
      <div class="row"><span>Subtotal</span><span>$41.78</span></div>
      <div class="row"><span>Tax</span><span>$1.25</span></div>
      <div class="row"><span>Total Before Tips</span><span>$43.03</span></div>
    </div>

    <div class="row">
      <span>Total(Cash)</span>
      <span>Save$1.73</span>
      <span>$43.03</span>
      <span>Total(Card)</span>
      <span>$44.76</span>
    </div>

    <script>
      (() => {
        const toggle = document.querySelector('[data-test-id="shared-order-price-summary-toggle"]');
        const details = document.querySelector('[data-testid="price-summary-details"]');

        toggle.addEventListener('click', () => {
          toggle.setAttribute('aria-expanded', 'true');
          details.hidden = false;
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('点单页价格汇总契约', () => {
  test(
    '应在读取点单页价格汇总前自动展开折叠态汇总',
    {},
    async ({ page }) => {
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备折叠态点单页价格汇总骨架', async () => {
        await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
        await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, orderDishesFrameHtml);
        await page.evaluate(() => {
          window.location.hash = 'orderDishes';
        });
      });

      const priceSummary = await test.step('读取点单页左侧价格汇总', async () => {
        return await orderDishesPage.readPriceSummary();
      });

      await test.step('验证读取结果包含完整汇总字段', async () => {
        expect(priceSummary).toMatchObject({
          Count: 3,
          Subtotal: 41.78,
          Tax: 1.25,
          'Total Before Tips': 43.03,
          'Total(Cash)': 43.03,
          'Total(Card)': 44.76,
        });

        const toggleExpanded = await page
          .frameLocator('iframe[data-wujie-id="orderDishes"]')
          .locator('[data-test-id="shared-order-price-summary-toggle"]')
          .getAttribute('aria-expanded');

        expect(toggleExpanded).toBe('true');
      });
    },
  );
});

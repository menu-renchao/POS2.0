import { expect, test } from '@playwright/test';
import { OrderDishesPage } from '../../pages/order-dishes.page';

const weightDialogLoadingFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>

    <div role="dialog" aria-modal="true">
      <button type="button">Cancel</button>
      <div>Weight</div>
      <button type="button" disabled>Confirm</button>
      <div>Loading</div>
    </div>
  </body>
</html>
`;

test.describe('称重菜异常', () => {
  test(
    '当称重弹窗持续处于 Loading 时应抛出磅秤模式异常',
    {},
    async ({ page }) => {
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备仅包含称重弹窗 Loading 状态的点单页骨架', async () => {
        await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
        await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, weightDialogLoadingFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = 'orderDishes';
        });
      });

      await test.step('验证输入重量时抛出磅秤模式异常', async () => {
        await expect(orderDishesPage.enterWeight(14)).rejects.toThrow(
          '当前license为磅秤模式，无法输入重量',
        );
      });
    },
  );
});

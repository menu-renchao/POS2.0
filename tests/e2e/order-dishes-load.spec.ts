import { test } from '@playwright/test';
import { OrderDishesPage } from '../../pages/order-dishes.page';

const orderDishesFrameHtml = `
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="icon-button-Back">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>
  </body>
</html>
`.replace(/"/g, '&quot;');

test.describe('点餐页加载契约', () => {
  test('应能通过 Back 的 data-testid 识别点餐页已加载', async ({ page }) => {
    const orderDishesPage = new OrderDishesPage(page);

    await test.step('准备暴露 icon-button-Back 的点餐页骨架', async () => {
      await page.setContent(
        `<iframe data-wujie-id="orderDishes" srcdoc="${orderDishesFrameHtml}"></iframe>`,
      );
      await page.evaluate(() => {
        window.location.hash = '#orderDishes';
      });
    });

    await test.step('页面对象应仍能判断点餐页加载完成', async () => {
      await orderDishesPage.expectLoaded();
    });
  });
});

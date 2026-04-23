import { expect, test } from '@playwright/test';
import { OrderDishesPage } from '../../pages/order-dishes.page';

const orderDishesEditFrameHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>

    <section>
      <button type="button" data-testid="ordered-dish-test">Sent in 2026-04-22 15:01:15 1 test $5.89 Waiting</button>
    </section>

    <aside>
      <button type="button" data-testid="action-rail-button-add1">Add</button>
    </aside>

    <script>
      (() => {
        const state = {
          addClicks: 0,
          selectedDishName: '',
          testQuantity: 1,
        };

        window.__orderDishesState = state;

        const testDish = document.querySelector('[data-testid="ordered-dish-test"]');
        const addButton = document.querySelector('[data-testid="action-rail-button-add1"]');

        const renderTestDish = () => {
          testDish.textContent =
            'Sent in 2026-04-22 15:01:15 ' + state.testQuantity + ' test $' + (state.testQuantity * 5.89).toFixed(2) + ' Waiting';
        };

        testDish.addEventListener('click', () => {
          state.selectedDishName = 'test';
        });

        addButton.addEventListener('click', () => {
          if (state.selectedDishName !== 'test') {
            return;
          }

          state.addClicks += 1;
          state.testQuantity += 1;
          renderTestDish();
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('点单编辑数量契约', () => {
  test(
    '应能选中已下单菜品并点击加 1',
    {},
    async ({ page }) => {
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备包含已下单菜品和加 1 操作的点单页', async () => {
        await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
        await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, orderDishesEditFrameHtml);
        await page.evaluate(() => {
          window.location.hash = 'orderDishes';
        });
      });

      await orderDishesPage.increaseOrderedDishQuantityByOne('test');

      await test.step('验证已通过加 1 操作更新目标菜品数量', async () => {
        const state = await page.frameLocator('iframe[data-wujie-id="orderDishes"]').locator('body').evaluate(() => {
          return (window as typeof window & {
            __orderDishesState: {
              addClicks: number;
              selectedDishName: string;
              testQuantity: number;
            };
          }).__orderDishesState;
        });

        expect(state).toEqual({
          addClicks: 1,
          selectedDishName: 'test',
          testQuantity: 2,
        });
      });
    },
  );
});

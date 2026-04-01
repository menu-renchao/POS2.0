import { expect, test } from '@playwright/test';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { OrderDishesPage } from '../../pages/order-dishes.page';

const orderDishesFrameHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>
    <button type="button">Count</button>
    <button type="button">Fried Rice</button>

    <div role="dialog" data-testid="dish-count-modal" hidden>
      <label>
        Count
        <input type="text" value="1" />
      </label>
      <button type="button">Confirm</button>
    </div>

    <script>
      (() => {
        const state = {
          countClicks: 0,
          selectedQuantity: 1,
          currentDishIndex: -1,
          dishClicks: [],
        };

        window.__orderDishesState = state;

        const countButton = document.querySelector('button:nth-of-type(4)');
        const dishButton = document.querySelector('button:nth-of-type(5)');
        const countDialog = document.querySelector('[data-testid="dish-count-modal"]');
        const countInput = countDialog.querySelector('input');
        const confirmButton = countDialog.querySelector('button');

        countButton.addEventListener('click', () => {
          state.countClicks += 1;
          countDialog.hidden = false;
        });

        confirmButton.addEventListener('click', () => {
          state.selectedQuantity = Number(countInput.value);

          if (state.currentDishIndex >= 0) {
            state.dishClicks[state.currentDishIndex].quantity = state.selectedQuantity;
          }

          countDialog.hidden = true;
        });

        dishButton.addEventListener('click', () => {
          state.dishClicks.push({
            dishName: 'Fried Rice',
            quantity: 1,
          });
          state.currentDishIndex = state.dishClicks.length - 1;
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('点餐数量契约', () => {
  test(
    '当 quantity 不等于 1 时应先点菜再通过 Count 修改已点菜数量',
    {},
    async ({ page }) => {
      const flow = new OrderDishesFlow();
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备点餐页面契约骨架', async () => {
        await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
        await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, orderDishesFrameHtml);
        await page.evaluate(() => {
          window.location.hash = 'orderDishes';
        });
      });

      await test.step('使用 flow 以数量 3 添加普通菜品', async () => {
        await flow.addRegularDish(orderDishesPage, 'Fried Rice', 3);
      });

      await test.step('验证先点菜再修改当前菜品数量', async () => {
        const frame = page.frameLocator('iframe[data-wujie-id="orderDishes"]');
        const state = await frame.locator('body').evaluate(() => {
          return (window as typeof window & {
            __orderDishesState: {
              countClicks: number;
              selectedQuantity: number;
              currentDishIndex: number;
              dishClicks: Array<{ dishName: string; quantity: number }>;
            };
          }).__orderDishesState;
        });

        expect(state.countClicks).toBe(1);
        expect(state.selectedQuantity).toBe(3);
        expect(state.currentDishIndex).toBe(0);
        expect(state.dishClicks).toEqual([{ dishName: 'Fried Rice', quantity: 3 }]);
      });
    },
  );
});

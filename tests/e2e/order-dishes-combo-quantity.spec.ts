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
    <button type="button">普通套餐</button>

    <aside class="_panel_1hxxi_20" hidden>
      <div class="_header_1hxxi_41">
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </div>
      <div class="_content_1hxxi_72">
        <section class="_sectionCard_1hxxi_84">
          <div class="_sectionTop_1hxxi_99">
            <div class="_sectionHeading_1hxxi_106">
              <div class="_sectionName_1hxxi_95">common</div>
            </div>
          </div>
          <div class="_itemGrid_1hxxi_171">
            <div class="_cardShell_vnilk_1" data-dish-name="普通菜1"></div>
            <div class="_cardShell_vnilk_1" data-dish-name="普通菜2"></div>
          </div>
        </section>
      </div>
    </aside>

    <script>
      (() => {
        const state = {
          confirmClicks: 0,
          comboSelections: {
            common: {},
          },
        };

        window.__orderDishesState = state;

        const comboDishButton = document.querySelector('button:nth-of-type(4)');
        const comboDialog = document.querySelector('aside');
        const confirmButton = comboDialog.querySelector('button:nth-of-type(2)');
        const shells = Array.from(comboDialog.querySelectorAll('div[data-dish-name]'));

        const renderCard = (shell) => {
          const dishName = shell.dataset.dishName;
          const quantity = state.comboSelections.common[dishName] || 0;

          if (quantity === 0) {
            shell.innerHTML = [
              '<button type="button" class="_card_vnilk_1 _item_vnilk_36">',
              '  <div class="_itemLayout_vnilk_58">',
              '    <span class="_itemTitle_vnilk_36">' + dishName + '</span>',
              '  </div>',
              '</button>',
            ].join('');

            shell.querySelector('button').addEventListener('click', () => {
              state.comboSelections.common[dishName] = 1;
              renderCard(shell);
            });
            return;
          }

          shell.innerHTML = [
            '<div class="_card_vnilk_1 _item_vnilk_36 _selected_vnilk_142">',
            '  <div class="_itemLayout_vnilk_58">',
            '    <span class="_itemTitle_vnilk_36">' + dishName + '</span>',
            '  </div>',
            '  <div class="_counter_vnilk_163">',
            '    <button type="button" class="_counterBtn_vnilk_194 _counterBtnMinus_vnilk_205">-</button>',
            '    <span class="_counterBadge_vnilk_163">' + quantity + '</span>',
            '    <button type="button" class="_counterBtn_vnilk_194 _counterBtnPlus_vnilk_205">+</button>',
            '  </div>',
            '</div>',
          ].join('');

          shell.querySelector('button[class*="_counterBtnPlus_"]').addEventListener('click', () => {
            state.comboSelections.common[dishName] += 1;
            renderCard(shell);
          });
        };

        shells.forEach(renderCard);

        comboDishButton.addEventListener('click', () => {
          comboDialog.hidden = false;
        });

        confirmButton.addEventListener('click', () => {
          state.confirmClicks += 1;
          comboDialog.hidden = true;
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('点餐套餐数量契约', () => {
  test(
    '应能在同一套餐分组下按数量重复选择子菜',
    {},
    async ({ page }) => {
      const flow = new OrderDishesFlow();
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备套餐选择契约页面', async () => {
        await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
        await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, orderDishesFrameHtml);
        await page.evaluate(() => {
          window.location.hash = 'orderDishes';
        });
      });

      await test.step('通过 flow 选择带数量的套餐子菜', async () => {
        await flow.addComboDish(
          orderDishesPage,
          '普通套餐',
          {
            common: {
              普通菜1: 1,
              普通菜2: 2,
            },
          } as any,
        );
      });

      await test.step('验证第二次同菜点击走的是加号路径', async () => {
        const frame = page.frameLocator('iframe[data-wujie-id="orderDishes"]');
        const state = await frame.locator('body').evaluate(() => {
          return (window as typeof window & {
            __orderDishesState: {
              confirmClicks: number;
              comboSelections: {
                common: Record<string, number>;
              };
            };
          }).__orderDishesState;
        });

        expect(state.confirmClicks).toBe(1);
        expect(state.comboSelections).toEqual({
          common: {
            普通菜1: 1,
            普通菜2: 2,
          },
        });
      });
    },
  );
});

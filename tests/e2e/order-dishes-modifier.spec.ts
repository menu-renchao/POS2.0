import { expect, test } from '@playwright/test';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { OrderDishesPage } from '../../pages/order-dishes.page';

const modifierFrameHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>

    <main>
      <button type="button" data-testid="ordered-dish-fried-rice">1 Fried Rice $5.89</button>
    </main>

    <aside role="complementary">
      <button type="button" data-testid="action-rail-button-modify" hidden>Modify</button>
    </aside>

    <div class="_panel_xhb0m_3" hidden>
      <div class="_header_xhb0m_24">
        <svg aria-label="onLeftIcon" role="img"></svg>
        <span class="_headerTitle_xhb0m_32">Modify</span>
      </div>
      <div class="_body_xhb0m_5">
        <div class="_bodyFixed_xhb0m_57">
          <div class="_bodyFirstRow_xhb0m_101">
            <div>
              <input placeholder="Enter custom modifier" data-testid="pos-ui-input" type="text" value="">
            </div>
            <div>
              <input placeholder="0.00" data-testid="pos-ui-input" inputmode="numeric" type="text" value="0.00">
            </div>
            <button type="button">Add</button>
          </div>
          <div class="_section_xhb0m_219">
            <div class="_sectionTitle_xhb0m_225">Actions</div>
            <div class="_actionsGrid_xhb0m_249">
              <button type="button">Add</button>
              <button type="button">Less</button>
            </div>
          </div>
          <div class="_section_xhb0m_219">
            <div class="_sectionTitle_xhb0m_225">Category</div>
            <div class="_categoryGrid_xhb0m_256">
              <button type="button">Sauce</button>
              <button type="button">global</button>
            </div>
          </div>
        </div>
        <div class="_optionsSection_xhb0m_71">
          <div class="_sectionTitle_xhb0m_225">Option</div>
          <div class="_optionsGrid_xhb0m_81">
            <button type="button" class="_optionCard_xhb0m_377"><span>Spicy Sauce</span></button>
            <button type="button" class="_optionCard_xhb0m_377"><span>Pork Sauce</span></button>
            <button type="button" class="_optionCard_xhb0m_377"><span>Pork Soy Sauce</span><span>$1.00</span></button>
          </div>
        </div>
        <div class="_section_xhb0m_219 _priceSection_xhb0m_65">
          <div class="_sectionTitle_xhb0m_225">Price</div>
          <div class="_priceGrid_xhb0m_264">
            <button type="button">Free</button>
            <button type="button">$1.00</button>
            <button type="button">$2.00</button>
            <button type="button">Custom</button>
            <input data-testid="modifier-custom-price-input" inputmode="numeric" type="text" hidden>
          </div>
        </div>
      </div>
    </div>

    <script>
      (() => {
        const state = {
          closeClicks: 0,
          customModifiers: [],
          draft: {},
          modifyOpens: 0,
          presetModifiers: [],
          selectedDishName: null,
        };

        window.__orderDishesState = state;

        const orderedDishButton = document.querySelector('[data-testid="ordered-dish-fried-rice"]');
        const modifyButton = document.querySelector('[data-testid="action-rail-button-modify"]');
        const panel = document.querySelector('._panel_xhb0m_3');
        const closeIcon = panel.querySelector('[aria-label="onLeftIcon"]');
        const customNameInput = panel.querySelector('input[placeholder="Enter custom modifier"]');
        const customPriceInput = panel.querySelector('input[placeholder="0.00"]');
        const customAddButton = panel.querySelector('._bodyFirstRow_xhb0m_101 button');
        const customSystemPriceInput = panel.querySelector('[data-testid="modifier-custom-price-input"]');

        const resetDraft = () => {
          state.draft = {};
        };

        const commitPresetModifier = () => {
          if (!state.draft.action || !state.draft.category || !state.draft.option || !state.draft.price) {
            return;
          }

          state.presetModifiers.push({
            dishName: state.selectedDishName,
            action: state.draft.action,
            category: state.draft.category,
            option: state.draft.option,
            price: state.draft.price,
          });
          resetDraft();
        };

        orderedDishButton.addEventListener('click', () => {
          state.selectedDishName = 'Fried Rice';
          modifyButton.hidden = false;
        });

        modifyButton.addEventListener('click', () => {
          if (!state.selectedDishName) {
            return;
          }

          state.modifyOpens += 1;
          panel.hidden = false;
        });

        closeIcon.addEventListener('click', () => {
          state.closeClicks += 1;
          panel.hidden = true;
        });

        customAddButton.addEventListener('click', () => {
          state.customModifiers.push({
            dishName: state.selectedDishName,
            name: customNameInput.value,
            price: customPriceInput.value,
          });
          customNameInput.value = '';
          customPriceInput.value = '0.00';
        });

        panel.querySelectorAll('._actionsGrid_xhb0m_249 button').forEach((button) => {
          button.addEventListener('click', () => {
            state.draft.action = button.textContent.trim();
          });
        });

        panel.querySelectorAll('._categoryGrid_xhb0m_256 button').forEach((button) => {
          button.addEventListener('click', () => {
            state.draft.category = button.textContent.trim();
          });
        });

        panel.querySelectorAll('._optionCard_xhb0m_377').forEach((button) => {
          button.addEventListener('click', () => {
            const rawText = button.textContent.trim();
            state.draft.option = rawText.replace(/\$\d+\.\d+$/, '').trim();
          });
        });

        panel.querySelectorAll('._priceGrid_xhb0m_264 button').forEach((button) => {
          button.addEventListener('click', () => {
            const value = button.textContent.trim();

            if (value === 'Custom') {
              customSystemPriceInput.hidden = false;
              customSystemPriceInput.focus();
              return;
            }

            state.draft.price = value;
            commitPresetModifier();
          });
        });

        customSystemPriceInput.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') {
            return;
          }

          state.draft.price = '$' + Number(customSystemPriceInput.value).toFixed(2);
          customSystemPriceInput.value = '';
          customSystemPriceInput.hidden = true;
          commitPresetModifier();
        });
      })();
    </script>
  </body>
</html>
`;

async function prepareOrderDishesFrame(page: import('@playwright/test').Page): Promise<void> {
  await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
  await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
    iframe.setAttribute('srcdoc', content as string);
  }, modifierFrameHtml);
  await page.evaluate(() => {
    window.location.hash = 'orderDishes';
  });
}

async function readModifierState(page: import('@playwright/test').Page) {
  const frame = page.frameLocator('iframe[data-wujie-id="orderDishes"]');
  return await frame.locator('body').evaluate(() => {
    return (window as typeof window & {
      __orderDishesState: {
        closeClicks: number;
        customModifiers: Array<{
          dishName: string;
          name: string;
          price: string;
        }>;
        modifyOpens: number;
        presetModifiers: Array<{
          action: string;
          category: string;
          dishName: string;
          option: string;
          price: string;
        }>;
        selectedDishName: string | null;
      };
    }).__orderDishesState;
  });
}

test.describe('已点菜品调味契约', () => {
  test(
    '应能先聚焦已点菜品再打开 Modify 并连续选择多条系统预置调味',
    {},
    async ({ page }) => {
      const flow = new OrderDishesFlow();
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备仅选中已点菜品后才显示 Modify 的点单页', async () => {
        await prepareOrderDishesFrame(page);
      });

      await test.step('通过 flow 在同一个 Modify 面板连续选择三条预置调味并返回关闭', async () => {
        await flow.selectPresetModifierOptions(orderDishesPage, {
          dishName: 'Fried Rice',
          options: [
            {
              action: 'Add',
              category: 'Sauce',
              option: 'Spicy Sauce',
              price: { kind: 'preset', value: '$1.00' },
            },
            {
              action: 'Less',
              category: 'global',
              option: 'Pork Sauce',
              price: { kind: 'preset', value: '$2.00' },
            },
            {
              action: 'Add',
              category: 'Sauce',
              option: 'Pork Soy Sauce',
              price: { kind: 'custom', value: 1.5 },
            },
          ],
        });
      });

      await test.step('验证已先选中菜品并累计三条调味记录', async () => {
        const state = await readModifierState(page);
        const panelHidden = await page
          .frameLocator('iframe[data-wujie-id="orderDishes"]')
          .locator('._panel_xhb0m_3')
          .evaluate((panel) => (panel as HTMLElement).hidden);

        expect(state.selectedDishName).toBe('Fried Rice');
        expect(state.modifyOpens).toBe(1);
        expect(state.closeClicks).toBe(1);
        expect(panelHidden).toBe(true);
        expect(state.presetModifiers).toEqual([
          {
            dishName: 'Fried Rice',
            action: 'Add',
            category: 'Sauce',
            option: 'Spicy Sauce',
            price: '$1.00',
          },
          {
            dishName: 'Fried Rice',
            action: 'Less',
            category: 'global',
            option: 'Pork Sauce',
            price: '$2.00',
          },
          {
            dishName: 'Fried Rice',
            action: 'Add',
            category: 'Sauce',
            option: 'Pork Soy Sauce',
            price: '$1.50',
          },
        ]);
      });
    },
  );

  test(
    '应能通过顶部独立输入区添加自定义调味并返回关闭',
    {},
    async ({ page }) => {
      const flow = new OrderDishesFlow();
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备 Modify 自定义调味输入区', async () => {
        await prepareOrderDishesFrame(page);
      });

      await test.step('通过 flow 添加自定义调味', async () => {
        await flow.addCustomModifier(orderDishesPage, {
          dishName: 'Fried Rice',
          name: 'No Onion',
          price: 0.5,
        });
      });

      await test.step('验证自定义调味走顶部输入区且返回关闭面板', async () => {
        const state = await readModifierState(page);
        const panelHidden = await page
          .frameLocator('iframe[data-wujie-id="orderDishes"]')
          .locator('._panel_xhb0m_3')
          .evaluate((panel) => (panel as HTMLElement).hidden);

        expect(state.selectedDishName).toBe('Fried Rice');
        expect(state.modifyOpens).toBe(1);
        expect(state.closeClicks).toBe(1);
        expect(panelHidden).toBe(true);
        expect(state.customModifiers).toEqual([
          {
            dishName: 'Fried Rice',
            name: 'No Onion',
            price: '0.50',
          },
        ]);
      });
    },
  );
});

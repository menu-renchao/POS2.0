import { expect, test } from '@playwright/test';
import { OrderDishesPage } from '../../pages/order-dishes.page';

const orderDishesFrameHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>

    <section aria-label="Order cart">
      <div role="button" tabindex="0">
        <div>
          <div>1</div>
          <div>test</div>
        </div>
        <div>$5.89</div>
      </div>
    </section>
  </body>
</html>
`;

const orderDishesWithOptionsFrameHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>

    <section aria-label="Order cart">
      <div class="_dishItem_yksc5_196 _selected_yksc5_217" data-testid="pos-ui-dish-item" role="button" tabindex="0">
        <div class="_dishMainRow_yksc5_239">
          <div class="_dishInfo_yksc5_203">
            <section class="_prefix_yksc5_280">
              <span class="_quantity_yksc5_234">1</span>
            </section>
            <div class="_dishTitleBlock_yksc5_339">
              <span class="_dishName_yksc5_331">test</span>
            </div>
          </div>
          <span class="_dishPrice_yksc5_355">$8.89</span>
        </div>
        <div class="_comboExtras_yksc5_205">
          <div class="_optionsContainer_yksc5_376">
            <div class="_optionItemContainer_yksc5_383" data-testid="dish-item-subitem-option-undefined">
              <div class="_optionItem_yksc5_383">
                <div class="_optionNameContainer_yksc5_541">
                  <span class="_optionName_yksc5_422">Spicy Sauce</span>
                </div>
              </div>
            </div>
            <div class="_optionItemContainer_yksc5_383" data-testid="dish-item-subitem-option-undefined">
              <div class="_optionItem_yksc5_383">
                <div class="_optionNameContainer_yksc5_541">
                  <span class="_optionName_yksc5_422"> Garlic Sauce</span>
                </div>
                <span class="_optionPrice_yksc5_423">$3.00</span>
              </div>
            </div>
            <div class="_optionItemContainer_yksc5_383" data-testid="dish-item-subitem-option-undefined">
              <div class="_optionItem_yksc5_383">
                <div class="_optionNameContainer_yksc5_541">
                  <span class="_optionName_yksc5_422">Less  Garlic Sauce</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`;

const orderDishesWithNestedOptionsFrameHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>

    <section aria-label="Order cart">
      <div class="_dishItem_yksc5_196 _selected_yksc5_217" data-testid="pos-ui-dish-item" role="button" tabindex="0">
        <div class="_dishMainRow_yksc5_239">
          <div class="_dishInfo_yksc5_203">
            <section class="_prefix_yksc5_280">
              <span class="_quantity_yksc5_234">1</span>
            </section>
            <div class="_dishTitleBlock_yksc5_339">
              <span class="_dishName_yksc5_331">test</span>
            </div>
          </div>
          <span class="_dishPrice_yksc5_355">$8.89</span>
        </div>
        <div class="_comboExtras_yksc5_205">
          <div class="_optionsContainer_yksc5_376">
            <div class="_optionItemContainer_yksc5_383" data-testid="dish-item-subitem-option-undefined">
              <div class="_optionItem_yksc5_383">
                <div class="_optionNameContainer_yksc5_541">
                  <span class="_optionName_yksc5_422">Pork Sauce</span>
                </div>
                <div class="_subItemRow_yksc5_383">
                  <div class="_optionItemContainer_yksc5_383" data-testid="dish-item-subitem-option-undefined">
                    <div class="_optionItem_yksc5_383">
                      <div class="_optionNameContainer_yksc5_541">
                        <span class="_optionName_yksc5_422">free suboption</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="_optionItemContainer_yksc5_383" data-testid="dish-item-subitem-option-undefined">
              <div class="_optionItem_yksc5_383">
                <div class="_optionNameContainer_yksc5_541">
                  <span class="_optionName_yksc5_422"> Garlic Sauce</span>
                </div>
                <span class="_optionPrice_yksc5_423">$3.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`;

async function prepareOrderDishesFrame(page: import('@playwright/test').Page, html: string): Promise<void> {
  await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
  await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
    iframe.setAttribute('srcdoc', content as string);
  }, html);
  await page.evaluate(() => {
    window.location.hash = 'orderDishes';
  });
}

test.describe('点单页已点菜品读取契约', () => {
  test('应能读取多节点渲染且不含调味的购物车菜品行', async ({ page }) => {
    const orderDishesPage = new OrderDishesPage(page);

    await test.step('准备购物车菜品由多个子节点组成的点单页骨架', async () => {
      await prepareOrderDishesFrame(page, orderDishesFrameHtml);
    });

    await test.step('读取已点菜品明细', async () => {
      await expect(orderDishesPage.readOrderedItems()).resolves.toEqual([
        {
          additions: [],
          name: 'test',
          price: '$5.89',
          quantity: '1',
        },
      ]);
    });
  });

  test('应能读取已点菜品下的调味名称和价格并兼容 Less 前缀', async ({ page }) => {
    const orderDishesPage = new OrderDishesPage(page);

    await test.step('准备带多条调味的已点菜品骨架', async () => {
      await prepareOrderDishesFrame(page, orderDishesWithOptionsFrameHtml);
    });

    await test.step('读取已点菜品明细时包含调味子项', async () => {
      await expect(orderDishesPage.readOrderedItems()).resolves.toEqual([
        {
          additions: [
            { name: 'Spicy Sauce' },
            { name: 'Garlic Sauce', price: '$3.00' },
            { name: 'Less Garlic Sauce' },
          ],
          name: 'test',
          price: '$8.89',
          quantity: '1',
        },
      ]);
    });
  });

  test('应能读取已点菜品下的二级调味名称', async ({ page }) => {
    const orderDishesPage = new OrderDishesPage(page);

    await test.step('准备带二级调味的已点菜品骨架', async () => {
      await prepareOrderDishesFrame(page, orderDishesWithNestedOptionsFrameHtml);
    });

    await test.step('读取已点菜品明细时保留调味层级', async () => {
      await expect(orderDishesPage.readOrderedItems()).resolves.toEqual([
        {
          additions: [
            {
              name: 'Pork Sauce',
              subAdditions: [{ name: 'free suboption' }],
            },
            { name: 'Garlic Sauce', price: '$3.00' },
          ],
          name: 'test',
          price: '$8.89',
          quantity: '1',
        },
      ]);
    });
  });
});

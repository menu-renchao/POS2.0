import { expect, test } from '@playwright/test';
import { InventoryPage } from '../../pages/inventory.page';
import { InventoryStockSettingPage } from '../../pages/inventory-stock-setting.page';

const inventoryStockSettingFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <div id="inventory-dialog">
      <button type="button">In Stock (Unlimited)</button>
      <button type="button">Out of Stock</button>
      <button type="button">Limited Stock</button>
      <input id="gqipt" />
      <button type="button" id="inventory-submit">Confirm</button>
    </div>
    <div id="inventory-root" hidden>
      <div>Inventory Management</div>
      <div id="root"><span>Limited Stock</span></div>
    </div>

    <script>
      (() => {
        const state = {
          committedQuantity: '',
          pendingQuantity: '',
          submittedQuantity: '',
        };

        window.__inventoryStockSettingState = state;

        const input = document.querySelector('#gqipt');
        const submitButton = document.querySelector('#inventory-submit');
        const dialog = document.querySelector('#inventory-dialog');
        const inventoryRoot = document.querySelector('#inventory-root');
        let commitTimer = null;

        input.addEventListener('input', () => {
          state.pendingQuantity = input.value;

          if (commitTimer) {
            window.clearTimeout(commitTimer);
          }

          commitTimer = window.setTimeout(() => {
            state.committedQuantity = state.pendingQuantity;
          }, 200);
        });

        submitButton.addEventListener('click', () => {
          state.submittedQuantity = state.committedQuantity;
          dialog.hidden = true;
          inventoryRoot.hidden = false;
          window.location.hash = 'inventory';
        });
      })();
    </script>
  </body>
</html>
`;

const inventoryVisibleItemFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <div>Inventory Management</div>
    <div id="root"><span>Limited Stock</span></div>
    <div style="display:none">superman item4</div>
    <button type="button" id="visible-item">superman item4</button>

    <div id="inventory-dialog" hidden>
      <button type="button">In Stock (Unlimited)</button>
      <button type="button">Out of Stock</button>
      <button type="button">Limited Stock</button>
      <input id="gqipt" />
      <button type="button" id="inventory-submit">Confirm</button>
    </div>

    <script>
      (() => {
        const visibleItem = document.querySelector('#visible-item');
        const dialog = document.querySelector('#inventory-dialog');

        visibleItem?.addEventListener('click', () => {
          dialog.hidden = false;
        });
      })();
    </script>
  </body>
</html>
`;

const inventoryCategoryTextOnlyFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <div>Inventory Management</div>
    <div id="root"><span>Limited Stock</span></div>
    <button type="button" id="category-trigger">Auto Category 001</button>
    <button type="button" id="visible-item" hidden>superman item4</button>

    <script>
      (() => {
        const categoryTrigger = document.querySelector('#category-trigger');
        const visibleItem = document.querySelector('#visible-item');

        categoryTrigger?.addEventListener('click', () => {
          visibleItem.hidden = false;
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('库存设置输入稳定契约', () => {
  test(
    '库存页定位商品时不应依赖 inventoryCategoryPanelId 这类写死 id',
    {},
    async ({ page }) => {
      const inventoryPage = new InventoryPage(page);

      await test.step('准备仅通过分类文案暴露库存分类入口的库存页骨架', async () => {
        await page.setContent(inventoryCategoryTextOnlyFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = 'inventory';
        });
      });

      await test.step('按分类文案定位商品时仍应找到目标商品', async () => {
        await inventoryPage.focusItem({
          itemName: 'superman item4',
          menu: { category: 'Auto Category 001' },
        });
      });
    },
  );

  test(
    '同名商品存在隐藏副本时仍应定位并打开可见商品的库存设置',
    {},
    async ({ page }) => {
      const inventoryPage = new InventoryPage(page);

      await test.step('准备同时存在隐藏同名节点与可见商品行的库存页骨架', async () => {
        await page.setContent(inventoryVisibleItemFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = 'inventory';
        });
      });

      await test.step('定位商品并打开库存设置弹窗时应命中可见商品行', async () => {
        await inventoryPage.focusItem({ itemName: 'superman item4' });
        const stockSettingPage = await inventoryPage.openStockSetting('superman item4');
        await stockSettingPage.expectVisible();
      });
    },
  );

  test(
    '设置有限库存后提交前应等待输入稳定 200ms',
    {},
    async ({ page }) => {
      const stockSettingPage = new InventoryStockSettingPage(page, 'superman item4');

      await test.step('准备输入值需等待 200ms 才会提交稳定值的库存设置骨架', async () => {
        await page.setContent(inventoryStockSettingFixtureHtml);
      });

      await test.step('输入有限库存并立即走页面对象提交流程', async () => {
        await stockSettingPage.setLimitedStockQuantity(20);
        await stockSettingPage.saveInventoryConfig();
      });

      await test.step('确认提交读到的是稳定后的库存值', async () => {
        expect(
          await page.evaluate(
            () =>
              (
                window as typeof window & {
                  __inventoryStockSettingState: { submittedQuantity: string };
                }
              ).__inventoryStockSettingState.submittedQuantity,
          ),
        ).toBe('20');
      });
    },
  );
});

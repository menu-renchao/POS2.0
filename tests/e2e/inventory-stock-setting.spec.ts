import { expect, test } from '@playwright/test';
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

test.describe('库存设置输入稳定契约', () => {
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

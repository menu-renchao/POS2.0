import { expect, test } from '@playwright/test';
import { RecallPage } from '../../pages/recall.page';

const recallVoidFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="recall2-header-new-order">New Order</button>
    <button type="button" data-testid="recall2-header-paging">Paging</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderStatus">Order Status</button>
    <button type="button" data-testid="recall2-filter-dropdown-orderType">Order Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-paymentType">Payment Type</button>
    <button type="button" data-testid="recall2-filter-dropdown-productLine">Product Line</button>
    <button type="button" data-testid="icon-button-More Filters">More Filters</button>
    <button type="button" data-testid="recall2-search-trigger">Search</button>
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-order-list-container">
      <button type="button" data-testid="shared-order-card-open-1001">#1001</button>
    </div>

    <div role="dialog" aria-modal="true" data-testid="pos-ui-modal" hidden>
      <span>#1001</span>
      <div class="price-summary">
        <span>Total</span>
        <span>$0.00</span>
      </div>
    </div>

    <button type="button" id="odsmymoreicon" hidden>MoreIcon More</button>
    <button type="button" id="pvoidod" hidden>Void All</button>
    <label hidden id="void-checkbox-wrapper">
      <input type="checkbox" class="void-checkbox" checked />
      Restore inventory
    </label>
    <input id="void-note-input" hidden />
    <button type="button" data-testid="pos-keyboard-button-{close}" hidden>Close</button>
    <button type="button" id="void-submit" hidden>Submit</button>

    <div role="dialog" aria-modal="true" data-testid="void-dialog" hidden>
      <button type="button">Cancel</button>
      <div>Void</div>
      <button type="button" data-testid="visible-void-confirm">Void</button>
      <div>Void Reason</div>
      <div>Note</div>
      <textarea aria-label="Note"></textarea>
      <label>
        <input type="checkbox" aria-label="Restore inventory" checked />
        Restore inventory for items sent to kitchen.
      </label>
    </div>

    <script>
      (() => {
        const state = {
          moreOpened: false,
          voidEntry: '',
          restoreInventory: true,
          reason: '',
          submitted: false,
          awaitingOutsideDismiss: false,
        };

        window.__recallVoidState = state;

        const orderCard = document.querySelector('[data-testid="shared-order-card-open-1001"]');
        const dialog = document.querySelector('[data-testid="pos-ui-modal"]');
        const moreButton = document.querySelector('#odsmymoreicon');
        const voidAllButton = document.querySelector('#pvoidod');
        const restoreInventoryCheckbox = document.querySelector('.void-checkbox');
        const restoreInventoryWrapper = document.querySelector('#void-checkbox-wrapper');
        const voidNoteInput = document.querySelector('#void-note-input');
        const keyboardCloseButton = document.querySelector('[data-testid="pos-keyboard-button-{close}"]');
        const voidSubmitButton = document.querySelector('#void-submit');
        const voidDialog = document.querySelector('[data-testid="void-dialog"]');
        const visibleVoidNoteInput = voidDialog.querySelector('textarea[aria-label="Note"]');
        const visibleRestoreInventoryCheckbox = voidDialog.querySelector('input[aria-label="Restore inventory"]');
        const visibleVoidSubmitButton = voidDialog.querySelector('[data-testid="visible-void-confirm"]');

        orderCard.addEventListener('click', () => {
          dialog.hidden = false;
          moreButton.hidden = false;
        });

        moreButton.addEventListener('click', () => {
          state.moreOpened = true;
          window.setTimeout(() => {
            voidAllButton.hidden = false;
          }, 150);
        });

        voidAllButton.addEventListener('click', () => {
          state.voidEntry = 'Void All';
          restoreInventoryWrapper.hidden = true;
          voidNoteInput.hidden = true;
          keyboardCloseButton.hidden = true;
          voidSubmitButton.hidden = true;
          window.setTimeout(() => {
            voidDialog.hidden = false;
          }, 150);
        });

        visibleVoidSubmitButton.addEventListener('click', () => {
          state.restoreInventory = visibleRestoreInventoryCheckbox.checked;
          state.reason = visibleVoidNoteInput.value;
          state.submitted = true;
          state.awaitingOutsideDismiss = true;
          voidDialog.hidden = true;
          voidAllButton.hidden = true;
          restoreInventoryWrapper.hidden = true;
          voidNoteInput.hidden = true;
          keyboardCloseButton.hidden = true;
          voidSubmitButton.hidden = true;
        });

        document.body.addEventListener('click', (event) => {
          if (
            state.awaitingOutsideDismiss &&
            voidDialog.hidden &&
            !dialog.hidden &&
            event.target instanceof Node &&
            !dialog.contains(event.target)
          ) {
            dialog.hidden = true;
            moreButton.hidden = true;
            state.awaitingOutsideDismiss = false;
          }
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('Recall Void 契约', () => {
  test(
    '应能从订单详情页的 More 进入 Void All 并完成作废',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备 More 按钮位于详情弹窗外层的 Recall Void 页面骨架', async () => {
        await page.setContent(recallVoidFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = 'recall';
        });
      });

      await test.step('从最近一笔可见订单进入 Void All 并提交作废', async () => {
        await recallPage.voidRecentVisibleOrder({
          restoreInventory: false,
          reason: '库存回退校验',
        });
      });

      await test.step('确认 Recall Void 入口走的是 More -> Void All', async () => {
        expect(
          await page.evaluate(
            () => (window as typeof window & { __recallVoidState: unknown }).__recallVoidState,
          ),
        ).toMatchObject({
          moreOpened: true,
          voidEntry: 'Void All',
          restoreInventory: false,
          reason: '库存回退校验',
          submitted: true,
        });

        await expect(page.getByTestId('pos-ui-modal')).toBeHidden();
      });
    },
  );

  test(
    '应能识别带图标文本名称的 More 按钮并进入 Void All',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备仅暴露 MoreIcon More 文本名称的 Recall Void 页面骨架', async () => {
        await page.setContent(
          recallVoidFixtureHtml
            .replaceAll('id="odsmymoreicon"', 'data-testid="more-without-id"')
            .replaceAll("'#odsmymoreicon'", "'[data-testid=\"more-without-id\"]'"),
        );
        await page.evaluate(() => {
          window.location.hash = 'recall';
        });
      });

      await test.step('从最近一笔可见订单进入 Void All 并提交作废', async () => {
        await recallPage.voidRecentVisibleOrder({
          restoreInventory: true,
          reason: '图标名称按钮校验',
        });
      });

      await test.step('确认图标文本名称按钮被识别为订单详情 More，而不是 More Filters', async () => {
        expect(
          await page.evaluate(
            () => (window as typeof window & { __recallVoidState: unknown }).__recallVoidState,
          ),
        ).toMatchObject({
          moreOpened: true,
          voidEntry: 'Void All',
          restoreInventory: true,
          reason: '图标名称按钮校验',
          submitted: true,
        });

        await expect(page.getByTestId('pos-ui-modal')).toBeHidden();
      });
    },
  );

  test(
    '应能在恢复库存默认未勾选时主动勾选后再提交 Void',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备恢复库存默认未勾选的 Recall Void 页面骨架', async () => {
        await page.setContent(
          recallVoidFixtureHtml.replaceAll(
            'input type="checkbox" aria-label="Restore inventory" checked',
            'input type="checkbox" aria-label="Restore inventory"',
          ),
        );
        await page.evaluate(() => {
          window.location.hash = 'recall';
        });
      });

      await test.step('提交要求恢复库存的 Void 操作', async () => {
        await recallPage.voidRecentVisibleOrder({
          restoreInventory: true,
          reason: '默认未勾选恢复库存',
        });
      });

      await test.step('确认恢复库存复选框被主动切换到勾选状态', async () => {
        expect(
          await page.evaluate(
            () => (window as typeof window & { __recallVoidState: unknown }).__recallVoidState,
          ),
        ).toMatchObject({
          restoreInventory: true,
          submitted: true,
          reason: '默认未勾选恢复库存',
        });
      });
    },
  );

  test(
    '应能在退出 Recall 后等待页面真正离开 Recall',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备带延迟退出效果的 Recall 页面骨架', async () => {
        await page.setContent(`
          <!DOCTYPE html>
          <html lang="en">
            <body>
              <button type="button" data-testid="recall2-header-new-order">New Order</button>
              <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
              <button type="button" class="rcreturnbx_bth_exit">Exit Recall</button>
              <script>
                document.querySelector('.rcreturnbx_bth_exit').addEventListener('click', () => {
                  window.setTimeout(() => {
                    window.location.hash = 'home';
                    document.querySelector('[data-testid="recall2-header-new-order"]').remove();
                    document.querySelector('[data-testid="recall2-filter-dropdown-paymentStatus"]').remove();
                  }, 200);
                });
              </script>
            </body>
          </html>
        `);
        await page.evaluate(() => {
          window.location.hash = 'recall';
        });
      });

      await test.step('调用 exitRecall 后应已离开 Recall 页面', async () => {
        await recallPage.exitRecall();
        expect(page.url()).not.toMatch(/#recall/);
      });
    },
  );

  test(
    '应能通过左上角 Back 按钮退出 Recall',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备仅暴露 Back 退出按钮的 Recall 页面骨架', async () => {
        await page.setContent(`
          <!DOCTYPE html>
          <html lang="en">
            <body>
              <button type="button" data-testid="recall2-header-new-order">New Order</button>
              <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
              <button type="button">Back</button>
              <script>
                document.querySelector('button:last-of-type').addEventListener('click', () => {
                  window.setTimeout(() => {
                    window.location.hash = 'home';
                    document.querySelector('[data-testid="recall2-header-new-order"]').remove();
                    document.querySelector('[data-testid="recall2-filter-dropdown-paymentStatus"]').remove();
                  }, 200);
                });
              </script>
            </body>
          </html>
        `);
        await page.evaluate(() => {
          window.location.hash = 'recall';
        });
      });

      await test.step('调用 exitRecall 后应通过 Back 按钮离开 Recall 页面', async () => {
        await recallPage.exitRecall();
        expect(page.url()).not.toMatch(/#recall/);
      });
    },
  );

  test(
    '应能在订单详情仍遮挡退出按钮时先关闭详情再退出 Recall',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备全屏详情弹窗会遮挡退出按钮的 Recall 页面骨架', async () => {
        await page.setContent(`
          <!DOCTYPE html>
          <html lang="en">
            <body style="margin: 0">
              <button type="button" data-testid="recall2-header-new-order">New Order</button>
              <button type="button" data-testid="recall2-filter-dropdown-paymentStatus">Payment Status</button>
              <button type="button" class="rcreturnbx_bth_exit" hidden>Exit Recall</button>
              <div
                role="dialog"
                aria-modal="true"
                data-testid="pos-ui-modal"
                style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.35)"
              >
                <div
                  id="order-details-panel"
                  style="width: 900px; height: 620px; background: white"
                >
                  <span>#1001</span>
                </div>
              </div>
              <script>
                const dialog = document.querySelector('[data-testid="pos-ui-modal"]');
                const exitButton = document.querySelector('.rcreturnbx_bth_exit');

                dialog.addEventListener('click', (event) => {
                  if (event.target !== dialog) {
                    return;
                  }

                  dialog.style.display = 'none';
                  exitButton.hidden = false;
                });

                exitButton.addEventListener('click', () => {
                  window.setTimeout(() => {
                    window.location.hash = 'home';
                    document.querySelector('[data-testid="recall2-header-new-order"]').remove();
                    document.querySelector('[data-testid="recall2-filter-dropdown-paymentStatus"]').remove();
                  }, 200);
                });
              </script>
            </body>
          </html>
        `);
        await page.evaluate(() => {
          window.location.hash = 'recall';
        });
      });

      await test.step('调用 exitRecall 后应先收起详情弹窗并真正离开 Recall 页面', async () => {
        await recallPage.exitRecall();
        await expect(page.getByTestId('pos-ui-modal')).toBeHidden();
        expect(page.url()).not.toMatch(/#recall/);
      });
    },
  );
});

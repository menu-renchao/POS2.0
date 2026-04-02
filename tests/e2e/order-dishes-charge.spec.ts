import { expect, test } from '@playwright/test';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { OrderDishesPage } from '../../pages/order-dishes.page';

const orderDishesChargeFrameHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>
    <button type="button">Charge</button>

    <div data-testid="order-cart">
      <div>1 Fried Rice $12.00</div>
      <div>1 Noodles $10.00</div>
    </div>

    <div
      role="dialog"
      aria-label="Charge"
      class="_modal_gtxfg_1"
      data-testid="charge-dialog"
      hidden
    >
      <div class="_modalHeader_gtxfg_7">
        <button type="button" data-mode="whole" aria-pressed="true">Whole Order Charge</button>
        <button type="button" data-mode="item" aria-pressed="false">Item Charge</button>
      </div>
      <div class="_modalContent_gtxfg_19">
        <section class="_leftPanel_gtxfg_53">
          <div class="_wholeOrderSummary_gtxfg_66" data-section="whole-summary">
            <div class="_wholeOrderHeaderRow_gtxfg_69">
              <span class="_wholeOrderNumber_gtxfg_73">Order #1001</span>
              <button type="button" data-action="clear-selected">Clear Selected</button>
            </div>
            <div class="_wholeOrderSubtotalRow_gtxfg_70">
              <span class="_wholeOrderSubtotalLabel_gtxfg_79">Subtotal</span>
              <span class="_wholeOrderSubtotalValue_gtxfg_80">$22.00</span>
            </div>
            <div data-testid="whole-order-charge-list"></div>
          </div>

          <div class="_filters_gtxfg_62" data-section="item-filters" hidden>
            <button type="button" data-action="clear-selected">Clear Selected</button>
          </div>
          <div class="_dishList_gtxfg_106" data-section="dish-list" hidden>
            <button type="button" data-dish-name="Fried Rice" aria-pressed="false">Fried Rice</button>
            <button type="button" data-dish-name="Noodles" aria-pressed="false">Noodles</button>
          </div>
          <div class="_orderDiscountCard_gtxfg_151" data-section="item-summary" hidden>
            <span class="_orderDiscountName_gtxfg_156">Order Charge</span>
            <span class="_orderDiscountAmount_gtxfg_157">--</span>
          </div>
        </section>

        <section class="_rightPanel_gtxfg_167">
          <div class="_optionGrid_gtxfg_185">
            <button type="button" data-option-name="Service Charge" aria-pressed="false">
              Service Charge
            </button>
            <button type="button" data-option-name="Packaging Charge" aria-pressed="false">
              Packaging Charge
            </button>
          </div>
          <div class="_customOptionRow_gtxfg_212">
            <button type="button" data-action="custom-charge" aria-pressed="false">Custom Charge</button>
          </div>
        </section>
      </div>
      <div class="_footerBar_gtxfg_23">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" data-action="clear-all">Clear All</button>
        <button type="button" data-action="confirm">Confirm</button>
      </div>
    </div>

    <div
      role="dialog"
      aria-label="Custom Charge"
      data-testid="custom-charge-dialog"
      hidden
    >
      <button type="button" data-custom-kind="percentage" aria-pressed="true">Percentage</button>
      <button type="button" data-custom-kind="fixed" aria-pressed="false">Fixed Amount</button>
      <label>
        Value
        <input type="text" value="" />
      </label>
      <label>
        Taxed
        <input type="checkbox" data-action="taxed" />
      </label>
      <button type="button" data-action="custom-cancel">Cancel</button>
      <button type="button" data-action="custom-confirm">Confirm</button>
    </div>

    <script>
      (() => {
        const state = {
          persisted: {
            scope: 'whole',
            wholeOrderCharges: [],
            itemCharges: {},
          },
          draft: null,
          customDraft: {
            kind: 'percentage',
            value: '',
            taxed: false,
          },
        };

        window.__chargeState = state;

        const chargeButton = document.querySelector('button:nth-of-type(4)');
        const chargeDialog = document.querySelector('[data-testid="charge-dialog"]');
        const customDialog = document.querySelector('[data-testid="custom-charge-dialog"]');
        const wholeModeButton = chargeDialog.querySelector('[data-mode="whole"]');
        const itemModeButton = chargeDialog.querySelector('[data-mode="item"]');
        const dishButtons = Array.from(chargeDialog.querySelectorAll('[data-dish-name]'));
        const optionButtons = Array.from(chargeDialog.querySelectorAll('[data-option-name]'));
        const customChargeButton = chargeDialog.querySelector('[data-action="custom-charge"]');
        const clearSelectedButtons = Array.from(chargeDialog.querySelectorAll('[data-action="clear-selected"]'));
        const clearAllButton = chargeDialog.querySelector('[data-action="clear-all"]');
        const cancelButton = chargeDialog.querySelector('[data-action="cancel"]');
        const confirmButton = chargeDialog.querySelector('[data-action="confirm"]');
        const customPercentageButton = customDialog.querySelector('[data-custom-kind="percentage"]');
        const customFixedButton = customDialog.querySelector('[data-custom-kind="fixed"]');
        const customValueInput = customDialog.querySelector('input[type="text"]');
        const customTaxedInput = customDialog.querySelector('[data-action="taxed"]');
        const customCancelButton = customDialog.querySelector('[data-action="custom-cancel"]');
        const customConfirmButton = customDialog.querySelector('[data-action="custom-confirm"]');
        const wholeSummary = chargeDialog.querySelector('[data-section="whole-summary"]');
        const itemFilters = chargeDialog.querySelector('[data-section="item-filters"]');
        const dishList = chargeDialog.querySelector('[data-section="dish-list"]');
        const itemSummary = chargeDialog.querySelector('[data-section="item-summary"]');
        const wholeChargeList = chargeDialog.querySelector('[data-testid="whole-order-charge-list"]');
        const itemSummaryAmount = itemSummary.querySelector('span:last-child');

        const clone = (value) => JSON.parse(JSON.stringify(value));

        const openDraft = () => {
          state.draft = clone(state.persisted);
          if (!state.draft.selectedDishNames) {
            state.draft.selectedDishNames = [];
          }
        };

        const formatAmount = (option) => {
          if (option.kind === 'percentage') {
            return option.name.includes('%') ? option.name : option.name + ' %';
          }

          return '$' + Number(option.value).toFixed(2);
        };

        const renderWholeOrderCharges = () => {
          wholeChargeList.innerHTML = '';

          for (const option of state.draft.wholeOrderCharges) {
            const row = document.createElement('div');
            row.className = '_wholeOrderDiscountRow_gtxfg_91';
            row.innerHTML = [
              '<span class="_wholeOrderDiscountName_gtxfg_94">' + option.name + '</span>',
              '<span class="_wholeOrderDiscountAmount_gtxfg_100">' + formatAmount(option) + '</span>',
            ].join('');
            wholeChargeList.appendChild(row);
          }
        };

        const renderItemSummary = () => {
          const itemCharges = Object.values(state.draft.itemCharges);
          itemSummaryAmount.textContent = itemCharges[0] ? itemCharges[0].name : '--';
        };

        const renderScope = () => {
          const isWhole = state.draft.scope === 'whole';
          wholeModeButton.setAttribute('aria-pressed', String(isWhole));
          itemModeButton.setAttribute('aria-pressed', String(!isWhole));
          wholeSummary.hidden = !isWhole;
          itemFilters.hidden = isWhole;
          dishList.hidden = isWhole;
          itemSummary.hidden = isWhole;
        };

        const renderDishSelections = () => {
          for (const button of dishButtons) {
            button.setAttribute(
              'aria-pressed',
              String(state.draft.selectedDishNames.includes(button.dataset.dishName)),
            );
          }
        };

        const renderOptions = () => {
          for (const button of optionButtons) {
            const optionName = button.dataset.optionName;
            const selected =
              state.draft.scope === 'whole'
                ? state.draft.wholeOrderCharges.some((option) => option.name === optionName)
                : Object.values(state.draft.itemCharges).every((option) => option.name === optionName)
                  && Object.keys(state.draft.itemCharges).length > 0;

            button.setAttribute('aria-pressed', String(selected));
          }
        };

        const render = () => {
          renderScope();
          renderDishSelections();
          renderOptions();
          renderWholeOrderCharges();
          renderItemSummary();
        };

        const ensureDraft = () => {
          if (!state.draft) {
            openDraft();
          }
        };

        const applyOptionToDraft = (option) => {
          ensureDraft();

          if (state.draft.scope === 'whole') {
            const exists = state.draft.wholeOrderCharges.some((current) => current.name === option.name);
            state.draft.wholeOrderCharges = exists
              ? state.draft.wholeOrderCharges.filter((current) => current.name !== option.name)
              : state.draft.wholeOrderCharges.concat(option);
            return;
          }

          for (const dishName of state.draft.selectedDishNames) {
            state.draft.itemCharges[dishName] = option;
          }
          state.draft.selectedDishNames = [];
        };

        chargeButton.addEventListener('click', () => {
          openDraft();
          chargeDialog.hidden = false;
          render();
        });

        wholeModeButton.addEventListener('click', () => {
          ensureDraft();
          state.draft.scope = 'whole';
          state.draft.selectedDishNames = [];
          render();
        });

        itemModeButton.addEventListener('click', () => {
          ensureDraft();
          state.draft.scope = 'item';
          state.draft.selectedDishNames = [];
          render();
        });

        for (const button of dishButtons) {
          button.addEventListener('click', () => {
            ensureDraft();
            const dishName = button.dataset.dishName;
            const selected = state.draft.selectedDishNames.includes(dishName);

            state.draft.selectedDishNames = selected
              ? state.draft.selectedDishNames.filter((current) => current !== dishName)
              : state.draft.selectedDishNames.concat(dishName);

            render();
          });
        }

        for (const button of optionButtons) {
          button.addEventListener('click', () => {
            applyOptionToDraft({
              name: button.dataset.optionName,
              kind: 'fixed',
              value: button.dataset.optionName === 'Service Charge' ? 2 : 1.5,
              taxed: false,
            });
            render();
          });
        }

        customChargeButton.addEventListener('click', () => {
          customDialog.hidden = false;
        });

        customPercentageButton.addEventListener('click', () => {
          state.customDraft.kind = 'percentage';
          customPercentageButton.setAttribute('aria-pressed', 'true');
          customFixedButton.setAttribute('aria-pressed', 'false');
        });

        customFixedButton.addEventListener('click', () => {
          state.customDraft.kind = 'fixed';
          customPercentageButton.setAttribute('aria-pressed', 'false');
          customFixedButton.setAttribute('aria-pressed', 'true');
        });

        customTaxedInput.addEventListener('change', () => {
          state.customDraft.taxed = customTaxedInput.checked;
        });

        customCancelButton.addEventListener('click', () => {
          customDialog.hidden = true;
          customValueInput.value = '';
          customTaxedInput.checked = false;
          state.customDraft = { kind: 'percentage', value: '', taxed: false };
        });

        customConfirmButton.addEventListener('click', () => {
          const numericValue = Number(customValueInput.value);
          const option = {
            name: state.customDraft.kind === 'percentage' ? 'Add ' + numericValue + '%' : 'Add $' + numericValue.toFixed(2),
            kind: state.customDraft.kind,
            value: numericValue,
            taxed: state.customDraft.taxed,
          };

          applyOptionToDraft(option);
          customDialog.hidden = true;
          customValueInput.value = '';
          customTaxedInput.checked = false;
          state.customDraft = { kind: 'percentage', value: '', taxed: false };
          render();
        });

        for (const button of clearSelectedButtons) {
          button.addEventListener('click', () => {
            ensureDraft();

            if (state.draft.scope === 'whole') {
              state.draft.wholeOrderCharges = [];
            } else {
              for (const dishName of state.draft.selectedDishNames) {
                delete state.draft.itemCharges[dishName];
              }
              state.draft.selectedDishNames = [];
            }

            render();
          });
        }

        clearAllButton.addEventListener('click', () => {
          ensureDraft();
          state.draft.wholeOrderCharges = [];
          state.draft.itemCharges = {};
          state.draft.selectedDishNames = [];
          render();
        });

        cancelButton.addEventListener('click', () => {
          state.draft = null;
          chargeDialog.hidden = true;
        });

        confirmButton.addEventListener('click', () => {
          state.persisted = clone(state.draft);
          state.persisted.selectedDishNames = [];
          state.draft = null;
          chargeDialog.hidden = true;
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('点单加收契约', () => {
  test(
    '应能快捷执行整单预置加收并在重新打开后读取结果',
    {},
    async ({ page }) => {
      const flow = new OrderDishesFlow();
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备带有加收弹窗的点单页契约骨架', async () => {
        await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
        await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, orderDishesChargeFrameHtml);
        await page.evaluate(() => {
          window.location.hash = 'orderDishes';
        });
      });

      await test.step('快捷执行整单预置加收', async () => {
        await flow.quickChargeByName(orderDishesPage, 'Service Charge');
      });

      await test.step('重新打开弹窗并读取整单加收结果', async () => {
        await orderDishesPage.clickCharge();
        const snapshot = await orderDishesPage.readChargeSnapshot();

        expect(snapshot.scope).toBe('whole');
        expect(snapshot.wholeOrderCharges).toEqual([
          { amountText: '$2.00', name: 'Service Charge' },
        ]);

        await orderDishesPage.closeChargeDialog();
      });
    },
  );

  test(
    '应能按菜品多选执行百分比自定义加收并返回详细菜品',
    {},
    async ({ page }) => {
      const flow = new OrderDishesFlow();
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备带有加收弹窗的点单页契约骨架', async () => {
        await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
        await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, orderDishesChargeFrameHtml);
        await page.evaluate(() => {
          window.location.hash = 'orderDishes';
        });
      });

      await test.step('对多道菜执行百分比自定义加收', async () => {
        await flow.applyCustomCharge(orderDishesPage, {
          dishNames: ['Fried Rice', 'Noodles'],
          scope: 'item',
          type: 'percentage',
          value: 10,
        });
      });

      await test.step('重新打开弹窗并读取菜品加收详情', async () => {
        await orderDishesPage.clickCharge();
        const snapshot = await orderDishesPage.readChargeSnapshot();

        expect(snapshot.scope).toBe('item');
        expect(snapshot.itemCharges).toEqual([
          { dishName: 'Fried Rice', optionName: 'Add 10%' },
          { dishName: 'Noodles', optionName: 'Add 10%' },
        ]);

        await orderDishesPage.closeChargeDialog();
      });
    },
  );

  test(
    '应能清除已选加收和全部加收',
    {},
    async ({ page }) => {
      const flow = new OrderDishesFlow();
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备带有加收弹窗的点单页契约骨架', async () => {
        await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
        await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, orderDishesChargeFrameHtml);
        await page.evaluate(() => {
          window.location.hash = 'orderDishes';
        });
      });

      await test.step('先写入整单和菜品两类加收数据', async () => {
        await flow.quickChargeByName(orderDishesPage, 'Service Charge');
        await flow.applyChargeByScope(orderDishesPage, {
          dishNames: ['Fried Rice', 'Noodles'],
          optionName: 'Packaging Charge',
          scope: 'item',
        });
      });

      await test.step('清除当前已选菜品的加收', async () => {
        await orderDishesPage.clickCharge();
        await orderDishesPage.switchChargeScope('item');
        await orderDishesPage.toggleChargeDish('Fried Rice');
        await orderDishesPage.toggleChargeDish('Noodles');
        await orderDishesPage.clearSelectedChargeEntries();
        await orderDishesPage.confirmChargeDialog();
      });

      await test.step('清空全部加收并验证结果', async () => {
        await orderDishesPage.clickCharge();
        await orderDishesPage.clearAllCharges();
        await orderDishesPage.confirmChargeDialog();

        await orderDishesPage.clickCharge();
        const snapshot = await orderDishesPage.readChargeSnapshot();

        expect(snapshot.wholeOrderCharges).toEqual([]);
        expect(snapshot.itemCharges).toEqual([]);

        await orderDishesPage.closeChargeDialog();
      });
    },
  );
});

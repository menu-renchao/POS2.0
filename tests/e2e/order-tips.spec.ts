import { expect, test } from '@playwright/test';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import { RecallPage } from '../../pages/recall.page';

const orderDishesTipsFrameHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="icon-button-Back">Back</button>
    <button type="button">Send</button>
    <button type="button">Pay</button>
    <button type="button">More</button>
    <div role="menu" data-testid="order-dishes-more-menu" hidden>
      <button type="button" data-testid="dropdown-item-tips">Tips</button>
    </div>

    <div role="button" aria-expanded="true" data-test-id="shared-order-price-summary-toggle">
      <span>Toggle price summary</span>
    </div>

    <div data-testid="price-summary-details">
      <div class="row"><span>Count</span><span>1</span></div>
      <div class="row"><span>Subtotal</span><span>$20.00</span></div>
      <div class="row"><span>Tax</span><span>$0.00</span></div>
      <div class="row"><span>Total Before Tips</span><span>$20.00</span></div>
      <div class="row"><span>Tips</span><span>$0.00</span></div>
    </div>

    <div class="row" data-testid="price-summary-total-row">
      <span>Total(Cash)</span>
      <span>$20.00</span>
      <span>Total(Card)</span>
      <span>$20.00</span>
    </div>

    <div role="dialog" aria-label="Tips" data-testid="tip-input-dialog" hidden>
      <input type="text" data-testid="tip-input-value" value="" />
      <button type="button">1</button>
      <button type="button">2</button>
      <button type="button">3</button>
      <button type="button">4</button>
      <button type="button">5</button>
      <button type="button">0</button>
      <button type="button">C</button>
      <button type="button">Confirm</button>
    </div>

    <div role="dialog" aria-label="Big tip warning" data-testid="big-tip-confirm-dialog" hidden>
      <p>The tip is more than 50% of the meal. Confirm to add?</p>
      <button type="button">Re-input</button>
      <button type="button">Yes</button>
    </div>

    <script>
      (() => {
        const state = {
          draftTip: 0,
          tip: 0,
          totalBeforeTips: 20,
        };
        window.__orderTipsState = state;

        const moreButton = document.querySelector('body > button:nth-of-type(4)');
        const moreMenu = document.querySelector('[data-testid="order-dishes-more-menu"]');
        const tipsMenuItem = document.querySelector('[data-testid="dropdown-item-tips"]');
        const tipDialog = document.querySelector('[data-testid="tip-input-dialog"]');
        const tipInput = document.querySelector('[data-testid="tip-input-value"]');
        const tipValue = document.querySelector('[data-testid="price-summary-details"] .row:last-child span:last-child');
        const totalCashValue = document.querySelector('[data-testid="price-summary-total-row"] span:nth-child(2)');
        const totalCardValue = document.querySelector('[data-testid="price-summary-total-row"] span:nth-child(4)');
        const bigTipDialog = document.querySelector('[data-testid="big-tip-confirm-dialog"]');

        const render = () => {
          tipValue.textContent = '$' + state.tip.toFixed(2);
          totalCashValue.textContent = '$' + (state.totalBeforeTips + state.tip).toFixed(2);
          totalCardValue.textContent = '$' + (state.totalBeforeTips + state.tip).toFixed(2);
        };

        moreButton.addEventListener('click', () => {
          moreMenu.hidden = false;
        });

        tipsMenuItem.addEventListener('click', () => {
          moreMenu.hidden = true;
          tipInput.value = '';
          tipDialog.hidden = false;
        });

        tipDialog.querySelector('button:last-child').addEventListener('click', () => {
          state.draftTip = Number(tipInput.value || '0') / 100;
          tipDialog.hidden = true;

          if (state.draftTip > state.totalBeforeTips / 2) {
            bigTipDialog.hidden = false;
            return;
          }

          state.tip = state.draftTip;
          render();
        });

        bigTipDialog.querySelector('button:first-of-type').addEventListener('click', () => {
          bigTipDialog.hidden = true;
          tipDialog.hidden = false;
        });

        bigTipDialog.querySelector('button:last-of-type').addEventListener('click', () => {
          state.tip = state.draftTip;
          bigTipDialog.hidden = true;
          render();
        });

        render();
      })();
    </script>
  </body>
</html>
`;

const recallTipsFixtureHtml = String.raw`
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
    <button type="button" data-testid="recall2-search-trigger">Search</button>
    <button type="button" data-testid="icon-button-More Filters">More Filters</button>
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-order-list-container">
      <button type="button" data-testid="recall2-order-card-8">#8</button>
    </div>

    <div role="dialog" aria-modal="true" data-testid="pos-ui-modal" hidden>
      <div class="_header_1ej2d_479">
        <div class="_orderNumber_1bmdj_459"><span class="_number_1bmdj_480">#8</span></div>
        <button type="button" id="odsmymoreicon">MoreIcon More</button>
      </div>

      <div role="menu" data-testid="recall-more-menu" hidden>
        <button type="button" data-testid="recall2-order-detail-tips">Tips</button>
      </div>

      <div class="_section_201h3_462">
        <div class="_header_blu61_457"><h3>PAYMENT</h3></div>
        <div class="_content_blu61_472">
          <div class="_card_7kgct_437" data-payment-method="Visa">
            <div class="_paymentInfo_7kgct_458">
              <div class="_paymentType_7kgct_465">
                <span class="_methodLabel_7kgct_492">Visa</span>
                <span class="_amount_7kgct_501">$20.00</span>
              </div>
              <div class="_content_7kgct_509">
                <div class="_contentItem_7kgct_517">
                  <span class="_detailLabel_7kgct_523">Tips:</span>
                  <span class="_detailAmount_7kgct_524">$0.00</span>
                  <button type="button" data-testid="payment-card-tips-button">Tips</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="_section_cmkd9_444">
        <div class="_dishList_cmkd9_516">
          <div class="_dishItem_99zrf_198" data-testid="pos-ui-dish-item">
            <div class="_dishMainRow_99zrf_241">
              <div class="_dishInfo_99zrf_205">
                <section class="_prefix_99zrf_282"><span class="_quantity_99zrf_236">1</span></section>
                <span class="_dishName_99zrf_333">Tip Test Dish</span>
              </div>
              <span class="_dishPrice_99zrf_342">$20.00</span>
            </div>
          </div>
        </div>
      </div>

      <div class="_container_1jzox_437">
        <div class="_row_1jzox_446">
          <span class="_label_1jzox_483">Subtotal</span>
          <span class="_value_1jzox_484">$20.00</span>
        </div>
        <div class="_row_1jzox_446">
          <span class="_label_1jzox_483">Tax</span>
          <span class="_value_1jzox_484">$0.00</span>
        </div>
        <div class="_row_1jzox_446">
          <span class="_label_1jzox_483">Total Before Tips</span>
          <span class="_value_1jzox_484">$20.00</span>
        </div>
        <div class="_row_1jzox_446">
          <span class="_label_1jzox_483">Tips</span>
          <span class="_value_1jzox_484">$0.00</span>
        </div>
        <div class="_row_1jzox_446 _totalRow_1jzox_556">
          <span class="_totalLabel_1jzox_565">Total</span>
          <span class="_totalValue_1jzox_566">$20.00</span>
        </div>
      </div>
    </div>

    <div role="dialog" aria-label="Tips" data-testid="tip-input-dialog" hidden>
      <input type="text" data-testid="tip-input-value" value="" />
      <button type="button">Confirm</button>
    </div>

    <div role="dialog" aria-label="Payment Tips" data-testid="payment-tip-dialog" hidden>
      <input type="text" data-testid="payment-tip-input-value" value="" />
      <button type="button">Confirm</button>
    </div>

    <div role="dialog" aria-label="Big tip warning" data-testid="big-tip-confirm-dialog" hidden>
      <p>The tip is more than 50% of the meal. Confirm to add?</p>
      <button type="button">Re-input</button>
      <button type="button">Yes</button>
    </div>

    <script>
      (() => {
        const state = {
          draftMode: 'order',
          draftTip: 0,
          paymentTip: 0,
          tip: 0,
          totalBeforeTips: 20,
        };
        window.__recallTipsState = state;

        const orderCard = document.querySelector('[data-testid="recall2-order-card-8"]');
        const orderDialog = document.querySelector('[data-testid="pos-ui-modal"]');
        const moreButton = document.querySelector('#odsmymoreicon');
        const moreMenu = document.querySelector('[data-testid="recall-more-menu"]');
        const orderTipsButton = document.querySelector('[data-testid="recall2-order-detail-tips"]');
        const paymentTipsButton = document.querySelector('[data-testid="payment-card-tips-button"]');
        const orderTipDialog = document.querySelector('[data-testid="tip-input-dialog"]');
        const orderTipInput = document.querySelector('[data-testid="tip-input-value"]');
        const paymentTipDialog = document.querySelector('[data-testid="payment-tip-dialog"]');
        const paymentTipInput = document.querySelector('[data-testid="payment-tip-input-value"]');
        const bigTipDialog = document.querySelector('[data-testid="big-tip-confirm-dialog"]');
        const summaryTipValue = document.querySelector('._container_1jzox_437 ._row_1jzox_446:nth-child(4) ._value_1jzox_484');
        const totalValue = document.querySelector('._totalValue_1jzox_566');
        const paymentTipValue = document.querySelector('._detailAmount_7kgct_524');

        const render = () => {
          summaryTipValue.textContent = '$' + state.tip.toFixed(2);
          totalValue.textContent = '$' + (state.totalBeforeTips + state.tip).toFixed(2);
          paymentTipValue.textContent = '$' + state.paymentTip.toFixed(2);
        };

        const confirmDraft = () => {
          if (state.draftMode === 'payment') {
            state.paymentTip = state.draftTip;
          } else {
            state.tip = state.draftTip;
          }
          render();
        };

        orderCard.addEventListener('click', () => {
          orderDialog.hidden = false;
        });

        moreButton.addEventListener('click', () => {
          moreMenu.hidden = false;
        });

        orderTipsButton.addEventListener('click', () => {
          state.draftMode = 'order';
          moreMenu.hidden = true;
          orderTipInput.value = '';
          orderTipDialog.hidden = false;
        });

        paymentTipsButton.addEventListener('click', () => {
          state.draftMode = 'payment';
          paymentTipInput.value = '';
          paymentTipDialog.hidden = false;
        });

        orderTipDialog.querySelector('button').addEventListener('click', () => {
          state.draftTip = Number(orderTipInput.value || '0') / 100;
          orderTipDialog.hidden = true;

          if (state.draftTip > state.totalBeforeTips / 2) {
            bigTipDialog.hidden = false;
            return;
          }

          confirmDraft();
        });

        paymentTipDialog.querySelector('button').addEventListener('click', () => {
          state.draftTip = Number(paymentTipInput.value || '0') / 100;
          paymentTipDialog.hidden = true;

          if (state.draftTip > state.totalBeforeTips / 2) {
            bigTipDialog.hidden = false;
            return;
          }

          confirmDraft();
        });

        bigTipDialog.querySelector('button:first-of-type').addEventListener('click', () => {
          bigTipDialog.hidden = true;

          if (state.draftMode === 'payment') {
            paymentTipDialog.hidden = false;
            return;
          }

          orderTipDialog.hidden = false;
        });

        bigTipDialog.querySelector('button:last-of-type').addEventListener('click', () => {
          bigTipDialog.hidden = true;
          confirmDraft();
        });

        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            orderDialog.hidden = true;
          }
        });

        render();
      })();
    </script>
  </body>
</html>
`;

test.describe('Tips 页面契约', () => {
  test(
    '应能在点单页通过 More 打开 Tips 并在大额小费确认后更新价格汇总',
    {},
    async ({ page }) => {
      const orderDishesPage = new OrderDishesPage(page);

      await test.step('准备点单页 Tips 页面骨架', async () => {
        await page.setContent('<iframe data-wujie-id="orderDishes"></iframe>');
        await page.locator('iframe[data-wujie-id="orderDishes"]').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, orderDishesTipsFrameHtml);
        await page.evaluate(() => {
          window.location.hash = 'orderDishes';
        });
      });

      await test.step('添加超过 50% 的 Tips 并确认', async () => {
        await orderDishesPage.addTip(1100);
      });

      await test.step('校验点单页价格汇总中的 Tips 已更新', async () => {
        const priceSummary = await orderDishesPage.readPriceSummary();
        expect(priceSummary.Tips).toBe(11);
        expect(priceSummary['Total(Cash)']).toBe(31);
        expect(priceSummary['Total(Card)']).toBe(31);
      });
    },
  );

  test(
    '应能在 Recall 订单详情和 PAYMENT 卡片分别添加 Tips',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);

      await test.step('准备 Recall Tips 页面骨架', async () => {
        await page.setContent(recallTipsFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = '#recall';
        });
      });

      await test.step('从订单详情 More 添加 Tips', async () => {
        await recallPage.openOrderDetails('#8');
        await recallPage.addOrderDetailsTip(600);
      });

      await test.step('校验订单详情价格汇总中的 Tips 已更新', async () => {
        const orderDetails = await recallPage.readOrderDetailsSnapshot();
        expect(orderDetails.priceSummary.Tips).toBe(6);
      });

      await test.step('从 PAYMENT 卡片添加大额 Tips 并确认', async () => {
        await recallPage.addPaymentCardTip(1100, 'Visa');
      });

      await test.step('校验 PAYMENT 卡片中的 Tips 已更新', async () => {
        const orderDetails = await recallPage.readOrderDetailsSnapshot();
        expect(orderDetails.payments).toEqual([
          {
            method: 'Visa',
            amount: '$20.00',
            details: {
              Tips: '$11.00',
            },
          },
        ]);
      });
    },
  );
});

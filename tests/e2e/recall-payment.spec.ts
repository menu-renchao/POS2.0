import { expect, test } from '@playwright/test';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallPage } from '../../pages/recall.page';

const recallPaymentFixtureHtml = String.raw`
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
    <input data-testid="recall2-search-input" value="" />

    <div data-testid="recall2-order-list-container">
      <button type="button" data-testid="shared-order-card-open-1001">#1001</button>
    </div>

    <div role="dialog" aria-modal="true" data-testid="pos-ui-modal" hidden>
      <span>#1001</span>
      <button type="button" data-test-id="shared-order-detail-side-action-pay">Pay</button>
    </div>

    <div data-testid="payment-page" hidden>
      <div id="_summaryContent">
        <div class="summary-row">
          <span class="label">Subtotal</span>
          <span class="value">$12.00</span>
        </div>
        <div class="summary-row">
          <span class="label">Tax</span>
          <span class="value">$1.20</span>
        </div>
        <div class="summary-row">
          <span class="label">Total</span>
          <span class="value">$13.20</span>
        </div>
      </div>

      <section aria-label="Balance due">
        <button type="button" data-testid="balance-due-cash">Cash</button>
        <button type="button" data-testid="balance-due-cards">Cards</button>
      </section>

      <section aria-label="Payment type">
        <button type="button" data-testid="payment-type-cash">Cash</button>
        <button type="button" data-testid="payment-type-credit-card">Credit Card</button>
      </section>
    </div>

    <div id="print-customer-dialog" hidden>
      <div id="print-customer-title">Print receipt?</div>
      <button type="button" id="print-customer-cancel">Cancel</button>
      <button type="button" id="print-customer-submit">Confirm</button>
    </div>

    <script>
      (() => {
        const state = {
          openedFromRecall: false,
          paymentType: '',
          printed: null,
        };

        window.__recallPaymentState = state;

        const orderCard = document.querySelector('[data-testid="shared-order-card-open-1001"]');
        const dialog = document.querySelector('[data-testid="pos-ui-modal"]');
        const payButton = document.querySelector('[data-test-id="shared-order-detail-side-action-pay"]');
        const paymentPage = document.querySelector('[data-testid="payment-page"]');
        const paymentCashButton = document.querySelector('[data-testid="payment-type-cash"]');
        const printDialog = document.querySelector('#print-customer-dialog');
        const cancelPrintButton = document.querySelector('#print-customer-cancel');
        const confirmPrintButton = document.querySelector('#print-customer-submit');

        orderCard.addEventListener('click', () => {
          dialog.hidden = false;
        });

        payButton.addEventListener('click', () => {
          state.openedFromRecall = true;
          dialog.hidden = true;
          paymentPage.hidden = false;
        });

        paymentCashButton.addEventListener('click', () => {
          state.paymentType = 'Cash';
          printDialog.hidden = false;
        });

        cancelPrintButton.addEventListener('click', () => {
          state.printed = false;
          printDialog.hidden = true;
          paymentPage.hidden = true;
        });

        confirmPrintButton.addEventListener('click', () => {
          state.printed = true;
          printDialog.hidden = true;
          paymentPage.hidden = true;
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('Recall 支付入口契约', () => {
  test(
    '应能从 Recall 订单详情点击 Pay 后进入支付页面并完成现金支付',
    {},
    async ({ page }) => {
      const recallPage = new RecallPage(page);
      const paymentFlow = new PaymentFlow();

      await test.step('准备包含 Recall 支付入口的页面骨架', async () => {
        await page.setContent(recallPaymentFixtureHtml);
        await page.evaluate(() => {
          window.location.hash = 'recall';
        });
      });

      await test.step('先打开 Recall 首个订单详情弹窗', async () => {
        await recallPage.openFirstVisibleOrderDetails();
      });

      const paymentPage = await recallPage.openPayment();
      const summary = await test.step('进入支付页面后先读取左侧支付详情', async () => {
        return await paymentPage.readSummaryContent();
      });

      await test.step('从 Recall 入口进入支付页面后执行现金支付', async () => {
        await paymentFlow.payByCash(paymentPage, { printReceipt: false });
      });

      await test.step('确认 Recall 支付入口与支付页面已正确接线', async () => {
        expect(summary.rows).toEqual([
          { label: 'Subtotal', value: '$12.00' },
          { label: 'Tax', value: '$1.20' },
          { label: 'Total', value: '$13.20' },
        ]);

        expect(
          await page.evaluate(
            () =>
              (window as typeof window & { __recallPaymentState: unknown }).__recallPaymentState,
          ),
        ).toMatchObject({
          openedFromRecall: true,
          paymentType: 'Cash',
          printed: false,
        });
      });
    },
  );
});

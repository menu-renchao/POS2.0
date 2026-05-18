import { expect, test } from '@playwright/test';
import { PaymentFlow } from '../../flows/payment.flow';
import { PaymentPage } from '../../pages/payment.page';

const paymentFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <div data-testid="payment-page">
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

      <form data-testid="credit-card-form" hidden>
        <input id="cardNof" value="" />
        <input id="carddate" value="" />
        <input id="carddateY" value="" />
        <input id="cardfHolderName" value="" />
      </form>

      <button type="button" data-testid="payment-submit">Pay</button>
    </div>

    <div id="print-customer-dialog" hidden>
      <div id="print-customer-title">Print receipt?</div>
      <button type="button" id="print-customer-cancel">Cancel</button>
      <button type="button" id="print-customer-submit">Confirm</button>
    </div>

    <script>
      (() => {
        const state = {
          balanceDue: '',
          paymentType: '',
          printed: null,
          submitted: false,
        };

        window.__paymentContractState = state;

        const cashButton = document.querySelector('[data-testid="balance-due-cash"]');
        const cardsButton = document.querySelector('[data-testid="balance-due-cards"]');
        const paymentCashButton = document.querySelector('[data-testid="payment-type-cash"]');
        const paymentCreditCardButton = document.querySelector('[data-testid="payment-type-credit-card"]');
        const submitButton = document.querySelector('[data-testid="payment-submit"]');
        const printDialog = document.querySelector('#print-customer-dialog');
        const cancelPrintButton = document.querySelector('#print-customer-cancel');
        const confirmPrintButton = document.querySelector('#print-customer-submit');
        const creditCardForm = document.querySelector('[data-testid="credit-card-form"]');

        cashButton.addEventListener('click', () => {
          state.balanceDue = 'Cash';
        });

        cardsButton.addEventListener('click', () => {
          state.balanceDue = 'Cards';
        });

        paymentCashButton.addEventListener('click', () => {
          state.paymentType = 'Cash';
          state.submitted = true;
          creditCardForm.hidden = true;
          printDialog.hidden = false;
        });

        paymentCreditCardButton.addEventListener('click', () => {
          state.paymentType = 'Credit Card';
          creditCardForm.hidden = false;
        });

        submitButton.addEventListener('click', () => {
          state.submitted = true;
          printDialog.hidden = false;
        });

        cancelPrintButton.addEventListener('click', () => {
          state.printed = false;
          printDialog.hidden = true;
        });

        confirmPrintButton.addEventListener('click', () => {
          state.printed = true;
          printDialog.hidden = true;
        });
      })();
    </script>
  </body>
</html>
`;

const paymentFixtureKeepDialogVisibleHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <div data-testid="payment-page">
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
      </section>

      <section aria-label="Payment type">
        <button type="button" data-testid="payment-type-cash">Cash</button>
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
          paymentPanelClosed: false,
          printed: null,
        };

        window.__paymentContractState = state;

        const paymentPage = document.querySelector('[data-testid="payment-page"]');
        const paymentCashButton = document.querySelector('[data-testid="payment-type-cash"]');
        const printDialog = document.querySelector('#print-customer-dialog');
        const cancelPrintButton = document.querySelector('#print-customer-cancel');

        paymentCashButton.addEventListener('click', () => {
          printDialog.hidden = false;
        });

        cancelPrintButton.addEventListener('click', () => {
          state.printed = false;
          state.paymentPanelClosed = true;
          paymentPage.hidden = true;
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('支付页面契约', () => {
  test(
    '应能完成现金支付并读取左侧支付详情',
    {},
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      const paymentFlow = new PaymentFlow();

      await test.step('准备支付页面契约骨架', async () => {
        await page.setContent(paymentFixtureHtml);
      });

      await test.step('执行现金支付并选择不打印小票', async () => {
        await paymentFlow.payByCash(paymentPage, { printReceipt: false });
      });

      await test.step('读取左侧支付详情并校验支付结果', async () => {
        const summary = await paymentPage.readSummaryContent();

        expect(summary.rows).toEqual([
          { label: 'Subtotal', value: '$12.00' },
          { label: 'Tax', value: '$1.20' },
          { label: 'Total', value: '$13.20' },
        ]);

        expect(
          await page.evaluate(
            () =>
              (window as typeof window & { __paymentContractState: unknown }).__paymentContractState,
          ),
        ).toMatchObject({
          balanceDue: 'Cash',
          paymentType: 'Cash',
          printed: false,
          submitted: true,
        });
      });
    },
  );

  test(
    '应能完成信用卡支付并自动填写测试卡',
    {},
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      const paymentFlow = new PaymentFlow();

      await test.step('准备支付页面契约骨架', async () => {
        await page.setContent(paymentFixtureHtml);
      });

      await test.step('执行信用卡支付并选择打印小票', async () => {
        await paymentFlow.payByCreditCard(paymentPage, { printReceipt: true });
      });

      await test.step('校验测试卡信息与打印结果', async () => {
        await expect(page.locator('#cardNof')).toHaveValue('4000000000000002');
        await expect(page.locator('#carddate')).toHaveValue('12');
        await expect(page.locator('#carddateY')).toHaveValue('55');
        await expect(page.locator('#cardfHolderName')).toHaveValue('Tester');

        expect(
          await page.evaluate(
            () =>
              (window as typeof window & { __paymentContractState: unknown }).__paymentContractState,
          ),
        ).toMatchObject({
          balanceDue: 'Cards',
          paymentType: 'Credit Card',
          printed: true,
          submitted: true,
        });
      });
    },
  );
  test(
    '应能在支付面板关闭后结束打印小票分支而不强等弹窗隐藏',
    {},
    async ({ page }) => {
      const paymentPage = new PaymentPage(page);
      const paymentFlow = new PaymentFlow();

      await test.step('准备点击取消后仅关闭支付面板的支付页骨架', async () => {
        await page.setContent(paymentFixtureKeepDialogVisibleHtml);
      });

      await test.step('执行现金支付并选择不打印小票', async () => {
        await paymentFlow.payByCash(paymentPage, { printReceipt: false });
      });

      await test.step('校验支付面板已关闭且不因为弹窗仍在 DOM 中而卡住', async () => {
        await expect(page.getByTestId('payment-page')).toBeHidden();
        expect(
          await page.evaluate(
            () =>
              (window as typeof window & { __paymentContractState: unknown }).__paymentContractState,
          ),
        ).toMatchObject({
          paymentPanelClosed: true,
          printed: false,
        });
      });
    },
  );
});

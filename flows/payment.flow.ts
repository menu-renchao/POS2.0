import { PaymentPage } from '../pages/payment.page';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

export type PaymentCompletionOptions = {
  printReceipt: boolean;
};

export type PartialCashPaymentOptions = PaymentCompletionOptions & {
  amountInCents: number;
};

const testCreditCard = {
  cardNumber: '4000000000000002',
  cvv: '999',
  expMonth: '12',
  expYear: '55',
  holderName: 'Tester',
} as const;

export class PaymentFlow {
  @step('业务步骤：完成现金支付并处理打印小票选择')
  async payByCash(
    paymentPage: PaymentPage,
    options: PaymentCompletionOptions,
  ): Promise<void> {
    await paymentPage.expectLoaded();

    try {
      await paymentPage.clickBalanceDueCash();
      await paymentPage.clickPaymentTypeCash();
      await this.finishPrintReceiptStep(paymentPage, options);
    } catch (error) {
      await paymentPage.dismissPrintReceiptDialogIfVisible();
      throw error;
    }
  }

  @step('业务步骤：完成指定金额现金支付并处理打印小票选择')
  async payPartialByCash(
    paymentPage: PaymentPage,
    options: PartialCashPaymentOptions,
  ): Promise<void> {
    await paymentPage.expectLoaded();

    try {
      await paymentPage.fillAmountTendered(options.amountInCents);
      await paymentPage.clickPaymentTypeCash();
      await this.finishPrintReceiptStep(paymentPage, options);
      await paymentPage.closePaymentPanel();
    } catch (error) {
      await paymentPage.dismissPrintReceiptDialogIfVisible();
      throw error;
    }
  }

  @step('业务步骤：完成指定金额现金支付并停留在支付页')
  async payPartialByCashKeepingPaymentOpen(
    paymentPage: PaymentPage,
    options: PartialCashPaymentOptions,
  ): Promise<void> {
    await paymentPage.expectLoaded();

    try {
      await paymentPage.fillAmountTendered(options.amountInCents);
      await paymentPage.clickPaymentTypeCash();
      await this.finishPrintReceiptStep(paymentPage, options);
      await paymentPage.expectLoaded();
    } catch (error) {
      await paymentPage.dismissPrintReceiptDialogIfVisible();
      throw error;
    }
  }

  @step('业务步骤：完成信用卡支付并处理打印小票选择')
  async payByCreditCard(
    paymentPage: PaymentPage,
    options: PaymentCompletionOptions,
  ): Promise<void> {
    await paymentPage.expectLoaded();

    try {
      await paymentPage.clickBalanceDueCards();
      await paymentPage.clickPaymentTypeCreditCard();
      await paymentPage.fillCreditCardForm(testCreditCard);
      await paymentPage.clickPay();
      await this.finishPrintReceiptStep(paymentPage, options);
    } catch (error) {
      await paymentPage.dismissPrintReceiptDialogIfVisible();
      throw error;
    }
  }

  @step('业务步骤：根据支付完成后的页面状态处理打印小票分支')
  private async finishPrintReceiptStep(
    paymentPage: PaymentPage,
    options: PaymentCompletionOptions,
  ): Promise<void> {
    const completionState = await waitUntil(
      async () => ({
        paymentPanelVisible: await paymentPage.isPaymentPanelVisible(),
        printReceiptVisible: await paymentPage.isPrintReceiptDialogVisible(),
        successConfirmVisible: await paymentPage.isPaymentSuccessConfirmVisible(),
      }),
      (state) => state.printReceiptVisible || state.successConfirmVisible || !state.paymentPanelVisible,
      {
        timeout: 20_000,
        message: 'Payment did not reach a settled completion state in time.',
      },
    );

    if (!completionState.paymentPanelVisible) {
      return;
    }

    if (completionState.successConfirmVisible) {
      await paymentPage.confirmPaymentSuccessIfVisible();
      return;
    }

    await paymentPage.handlePrintReceiptChoice(options.printReceipt);
  }
}

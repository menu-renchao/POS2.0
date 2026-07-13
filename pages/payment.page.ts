import { expect, type Locator, type Page } from '@playwright/test';
import { waitForInputSettled } from '../utils/input-stability';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

export type PaymentCardForm = {
  cardNumber: string;
  cvv: string;
  expMonth: string;
  expYear: string;
  holderName: string;
};

export type PaymentSummaryRow = {
  label: string;
  value: string | null;
};

export type PaymentSummarySnapshot = {
  rows: PaymentSummaryRow[];
  text: string;
};

export class PaymentPage {
  private readonly contractRoot: Locator;
  private readonly paymentPanelFrame: Locator;
  private readonly paymentFrame: ReturnType<Page['frameLocator']>;
  private readonly printReceiptDialog: Locator;
  private readonly printReceiptCancelButton: Locator;
  private readonly printReceiptConfirmButton: Locator;
  private readonly paymentSuccessConfirmButton: Locator;
  private readonly paymentFlow: Locator;
  private readonly tipsButton: Locator;
  private readonly tipsConfirmButton: Locator;

  constructor(private readonly page: Page) {
    this.contractRoot = this.page.getByTestId('payment-page');
    this.paymentPanelFrame = this.page.locator('#paymentPanelContainer iframe');
    this.paymentFrame = this.page.frameLocator('#paymentPanelContainer iframe');
    this.printReceiptDialog = this.page.locator('#print-customer-dialog');
    this.printReceiptCancelButton = this.printReceiptDialog.locator('#print-customer-cancel');
    this.printReceiptConfirmButton = this.printReceiptDialog.locator('#print-customer-submit');
    this.paymentSuccessConfirmButton = this.paymentFrame.getByTestId('pay-success-status-button-1');
    this.paymentFlow = this.paymentFrame.getByTestId('payment-panel-payment-flow');
    this.tipsButton = this.paymentFrame.getByTestId('payment-panel-action-tips');
    this.tipsConfirmButton = this.paymentFrame.getByTestId(
      'preset-numeric-input-modal-confirm-button',
    );
  }

  @step('页面操作：确认支付页面已经加载完成')
  async expectLoaded(): Promise<void> {
    const paymentSurface = await this.resolvePaymentSurface();
    const balanceDueControl = await this.resolveBalanceDueControl();
    const paymentTypeControl = await this.resolvePaymentTypeControl();

    await expect(paymentSurface).toBeVisible({ timeout: 15_000 });
    await expect(balanceDueControl).toBeVisible({ timeout: 15_000 });
    await expect(paymentTypeControl).toBeVisible({ timeout: 15_000 });
  }

  @step('页面操作：在 Balance due 区域点击 Cash')
  async clickBalanceDueCash(): Promise<void> {
    await (await this.resolveBalanceDueCashButton()).click();
  }

  @step('页面操作：在 Balance due 区域点击 Cards')
  async clickBalanceDueCards(): Promise<void> {
    await (await this.resolveBalanceDueCardsButton()).click();
  }

  @step('页面操作：在 Payment type 区域点击 Cash')
  async clickPaymentTypeCash(): Promise<void> {
    await (await this.resolvePaymentTypeCashButton()).click();
  }

  @step((amountInCents: number) => `页面操作：输入本次现金支付金额 ${amountInCents} 分`)
  async fillAmountTendered(amountInCents: number): Promise<void> {
    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      throw new Error(`Invalid payment amount in cents: ${amountInCents}`);
    }

    const amountDisplay = await this.resolveAmountTenderedInput();
    await amountDisplay.click();

    const currentValue = await amountDisplay.inputValue().catch(() => '');
    for (let index = 0; index < currentValue.replace(/\D/g, '').length + 4; index += 1) {
      await this.resolveKeypadButton('backspace').click();
    }

    const amountDigits = String(amountInCents);
    const wholeDigits = amountDigits.endsWith('00') ? amountDigits.slice(0, -2) : amountDigits;
    for (const digit of wholeDigits) {
      await this.resolveKeypadButton(digit).click();
    }

    if (amountDigits.endsWith('00')) {
      await this.resolveKeypadButton('00').click();
    }

    await waitForInputSettled(amountDisplay);
  }

  @step((amountInCents: number) => `页面操作：在 Payment 页添加小费 ${amountInCents} 分`)
  async addTip(amountInCents: number): Promise<void> {
    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      throw new Error(`Invalid tip amount in cents: ${amountInCents}`);
    }

    await this.tipsButton.click();
    const amountDigits = String(amountInCents);
    const wholeDigits = amountDigits.endsWith('00') ? amountDigits.slice(0, -2) : amountDigits;

    for (const digit of wholeDigits) {
      await this.paymentFrame
        .getByTestId(`preset-currency-keypad-input-number-${digit}`)
        .click();
    }

    if (amountDigits.endsWith('00')) {
      await this.paymentFrame
        .getByTestId('preset-currency-keypad-input-double-zero')
        .click();
    }

    await waitForInputSettled(undefined, 250);
    await this.tipsConfirmButton.click();
  }

  @step((text: string) => `页面断言：Payment 支付流程展示 ${text}`)
  async expectPaymentFlowText(text: string): Promise<void> {
    await expect(this.paymentFlow).toContainText(text);
  }

  @step('页面操作：在 Payment type 区域点击 Credit Card')
  async clickPaymentTypeCreditCard(): Promise<void> {
    await this.waitForPaymentOverlayToClear();
    const creditCardButton = await this.resolvePaymentTypeCreditCardButton();
    await expect(creditCardButton).toBeVisible({ timeout: 5_000 });
    await creditCardButton.dispatchEvent('click');
  }

  @step('页面操作：填写信用卡表单')
  async fillCreditCardForm(card: PaymentCardForm): Promise<void> {
    await (await this.resolveCardNumberInput()).fill(card.cardNumber);
    await (await this.resolveCardMonthInput()).fill(card.expMonth);
    await (await this.resolveCardYearInput()).fill(card.expYear);
    await (await this.resolveCardHolderInput()).fill(card.holderName);
    await (await this.resolveCardCvvInput()).fill(card.cvv);
  }

  @step('页面操作：点击支付确认按钮')
  async clickPay(): Promise<void> {
    await waitForInputSettled();
    await (await this.resolvePayButton()).click();
  }

  @step('页面操作：按参数处理是否打印小票弹窗')
  async handlePrintReceiptChoice(printReceipt: boolean): Promise<void> {
    const targetButton = printReceipt ? this.printReceiptConfirmButton : this.printReceiptCancelButton;

    await expect(await this.resolvePrintReceiptDialog()).toBeVisible({ timeout: 15_000 });
    await expect(targetButton).toBeVisible({ timeout: 15_000 });

    if (printReceipt) {
      await this.printReceiptConfirmButton.click();
    } else {
      await this.printReceiptCancelButton.click();
    }

    await waitUntil(
      async () => ({
        paymentPanelVisible: await this.isPaymentPanelVisible(),
        printReceiptVisible: await this.isPrintReceiptDialogVisible(),
      }),
      (state) => !state.paymentPanelVisible || !state.printReceiptVisible,
      {
        timeout: 15_000,
        message: 'Print receipt flow did not settle after choosing whether to print.',
      },
    );
  }

  @step('页面操作：如有打印小票弹窗则关闭，避免污染后续状态')
  async dismissPrintReceiptDialogIfVisible(): Promise<void> {
    if (!(await this.isPrintReceiptDialogVisible())) {
      return;
    }

    if (await this.printReceiptCancelButton.isVisible().catch(() => false)) {
      await this.printReceiptCancelButton.click();
      await expect(this.printReceiptDialog).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
      return;
    }

    await this.page.keyboard.press('Escape').catch(() => undefined);
  }

  @step('页面操作：如支付成功页仍显示，则确认并关闭')
  async confirmPaymentSuccessIfVisible(): Promise<void> {
    if (!(await this.isPaymentSuccessConfirmVisible())) {
      return;
    }

    await this.paymentSuccessConfirmButton.click();
    await waitUntil(
      async () => await this.isPaymentPanelVisible(),
      (paymentPanelVisible) => !paymentPanelVisible,
      {
        timeout: 10_000,
        message: 'Payment success panel did not close after confirmation.',
      },
    ).catch(() => undefined);
  }

  @step('页面操作：关闭支付面板并返回订单详情')
  async closePaymentPanel(): Promise<void> {
    if (!(await this.isPaymentPanelVisible())) {
      return;
    }

    await (await this.resolvePaymentPanelBackButton()).click();
    await this.confirmPartialPaidLeaveIfVisible();
    await waitUntil(
      async () => await this.isPaymentPanelVisible(),
      (paymentPanelVisible) => !paymentPanelVisible,
      {
        timeout: 10_000,
        message: 'Payment panel did not close after clicking Back.',
      },
    );
  }

  private async confirmPartialPaidLeaveIfVisible(): Promise<void> {
    const confirmButton = await waitUntil(
      async () => {
        const candidates = [
          this.paymentFrame.getByRole('button', { name: /^Yes$/i }).first(),
          this.contractRoot.getByRole('button', { name: /^Yes$/i }).first(),
          this.page.getByRole('button', { name: /^Yes$/i }).first(),
        ];

        for (const candidate of candidates) {
          if (await candidate.isVisible().catch(() => false)) {
            return candidate;
          }
        }

        return null;
      },
      (button): button is Locator => button !== null,
      {
        timeout: 2_000,
        message: 'Partial paid leave confirmation did not appear.',
      },
    ).catch(() => null);

    if (!confirmButton) {
      return;
    }

    await confirmButton.click();
  }

  @step('页面读取：读取左侧支付详情_summaryContent')
  async readSummaryContent(): Promise<PaymentSummarySnapshot> {
    const summaryContent = await this.resolveSummaryContent();

    return await summaryContent.evaluate((summaryElement) => {
      const cleanText = (value: string | null | undefined): string =>
        value?.replace(/\s+/g, ' ').trim() ?? '';
      const normalizeOptionalText = (value: string | null | undefined): string | null => {
        const normalized = cleanText(value);
        return normalized.length > 0 ? normalized : null;
      };

      const rows = Array.from(summaryElement.querySelectorAll(':scope > *, :scope > * > *'))
        .map((rowElement) => {
          const label =
            normalizeOptionalText(
              rowElement.querySelector('.label, [class*="label"]')?.textContent,
            ) ??
            normalizeOptionalText(rowElement.querySelector('span:first-child')?.textContent) ??
            normalizeOptionalText(rowElement.children[0]?.textContent);
          const value =
            normalizeOptionalText(
              rowElement.querySelector('.value, [class*="value"]')?.textContent,
            ) ??
            normalizeOptionalText(rowElement.querySelector('span:last-child')?.textContent) ??
            (rowElement.children.length > 1
              ? normalizeOptionalText(rowElement.children[rowElement.children.length - 1]?.textContent)
              : null);

          if (!label) {
            return null;
          }

          return {
            label,
            value: value && value !== label ? value : null,
          };
        })
        .filter((row): row is PaymentSummaryRow => row !== null);

      if (rows.length > 0) {
        return {
          rows,
          text: cleanText(summaryElement.textContent),
        };
      }

      const fallbackText = cleanText(summaryElement.textContent);
      const fallbackRows = Array.from(
        fallbackText.matchAll(
          /\b(Subtotal|Tax|Charge|Tips|Total(?:\s*\([^)]*\))?)\b\s*([$]?[0-9,.-]+)/gi,
        ),
      ).map((matchedRow) => ({
        label: matchedRow[1],
        value: matchedRow[2] ?? null,
      }));

      return {
        rows: fallbackRows,
        text: fallbackText,
      };
    });
  }

  @step('页面读取：确认当前是否显示打印小票弹窗')
  async isPrintReceiptDialogVisible(): Promise<boolean> {
    return await this.printReceiptDialog.isVisible().catch(() => false);
  }

  @step('页面读取：确认支付面板当前是否仍然可见')
  async isPaymentPanelVisible(): Promise<boolean> {
    if (await this.contractRoot.isVisible().catch(() => false)) {
      return true;
    }

    if (await this.paymentPanelFrame.isVisible().catch(() => false)) {
      return true;
    }

    return await this.paymentFrame.locator('body').isVisible().catch(() => false);
  }

  @step('页面读取：确认支付成功确认按钮当前是否可见')
  async isPaymentSuccessConfirmVisible(): Promise<boolean> {
    return await this.paymentSuccessConfirmButton.isVisible().catch(() => false);
  }

  private async resolvePaymentSurface(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [this.contractRoot, this.paymentPanelFrame, this.paymentFrame.locator('body')],
      'Unable to find payment panel surface.',
      15_000,
    );
  }

  private async resolveBalanceDueControl(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.contractRoot.getByText(/^Balance due$/),
        this.contractRoot.getByTestId('balance-due-cash'),
        this.contractRoot.getByTestId('balance-due-cards'),
        this.paymentFrame.getByRole('radiogroup', { name: /Balance due/i }),
        this.paymentFrame.getByText(/^Balance due$/),
        this.paymentFrame.getByTestId('balance-due-cash'),
        this.paymentFrame.getByTestId('balance-due-cards'),
      ],
      'Unable to find Balance due controls.',
      15_000,
    );
  }

  private async resolvePaymentPanelBackButton(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.contractRoot.getByTestId('payment-panel-header-back'),
        this.paymentFrame.getByTestId('payment-panel-header-back'),
      ],
      'Unable to find payment panel Back button.',
    );
  }

  private async resolvePaymentTypeControl(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.contractRoot.getByText(/^Payment type$/),
        this.contractRoot.getByTestId('payment-type-cash'),
        this.contractRoot.getByTestId('payment-type-credit-card'),
        this.paymentFrame.getByText(/^Payment type$/),
        this.paymentFrame.getByTestId('payment-type-cash'),
        this.paymentFrame.getByTestId('payment-type-credit-card'),
        this.paymentFrame.getByRole('button', { name: /Credit Card/i }),
      ],
      'Unable to find Payment type controls.',
      15_000,
    );
  }

  private async resolveSummaryContent(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.contractRoot.locator('#_summaryContent').first(),
        this.contractRoot.locator('[class*="_summaryContent"]').first(),
        this.contractRoot.locator('[class*="summaryContent"]').first(),
        this.paymentFrame.locator('#_summaryContent').first(),
        this.paymentFrame.locator('[class*="_summaryContent"]').first(),
        this.paymentFrame.locator('[class*="summaryContent"]').first(),
        this.paymentFrame
          .locator('section, aside, div')
          .filter({ hasText: /Subtotal/i })
          .filter({ hasText: /Tax/i })
          .filter({ hasText: /Total/i })
          .first(),
      ],
      'Unable to find payment summary content.',
      15_000,
    );
  }

  private async resolveBalanceDueCashButton(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.contractRoot.getByTestId('balance-due-cash'),
        this.contractRoot.getByRole('button', { name: /Cash/i }),
        this.contractRoot.getByRole('radio', { name: /Cash/i }),
        this.paymentFrame.getByTestId('balance-due-cash'),
        this.paymentFrame.getByRole('radio', { name: /Cash/i }).first(),
        this.paymentFrame.getByRole('button', { name: /Cash/i }).first(),
      ],
      'Unable to find Balance due Cash button.',
    );
  }

  private async resolveBalanceDueCardsButton(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.contractRoot.getByTestId('balance-due-cards'),
        this.contractRoot.getByRole('button', { name: /Cards?/i }),
        this.contractRoot.getByRole('radio', { name: /Cards?/i }),
        this.paymentFrame.getByTestId('balance-due-cards'),
        this.paymentFrame.getByRole('radio', { name: /Cards?/i }).first(),
        this.paymentFrame.getByRole('button', { name: /Cards?/i }).first(),
      ],
      'Unable to find Balance due Cards button.',
    );
  }

  private async resolvePaymentTypeCashButton(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.contractRoot.getByTestId('payment-panel-btn-cash'),
        this.contractRoot.getByTestId('payment-type-cash'),
        this.contractRoot.getByRole('button', { name: /Cash/i }),
        this.paymentFrame.getByTestId('payment-panel-btn-cash'),
        this.paymentFrame.getByTestId('payment-type-cash'),
        this.paymentFrame.getByRole('button', { name: /Cash/i }).first(),
      ],
      'Unable to find Payment type Cash button.',
    );
  }

  private async resolvePaymentTypeCreditCardButton(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.contractRoot.getByTestId('payment-type-credit-card'),
        this.contractRoot.getByRole('button', { name: /Credit Card/i }),
        this.paymentFrame.getByTestId('payment-type-credit-card'),
        this.paymentFrame.getByRole('button', { name: /Credit Card/i }).first(),
      ],
      'Unable to find Payment type Credit Card button.',
    );
  }

  private async resolveAmountTenderedInput(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.contractRoot.getByTestId('payment-panel-amount-display'),
        this.paymentFrame.getByTestId('payment-panel-amount-display'),
      ],
      'Unable to find payment amount tendered input.',
    );
  }

  private resolveKeypadButton(digit: string): Locator {
    const testId =
      digit === 'backspace'
        ? 'payment-panel-keypad-backspace'
        : `payment-panel-keypad-digit-${digit}`;

    return this.paymentFrame.getByTestId(testId).or(this.contractRoot.getByTestId(testId)).first();
  }

  private async resolveCardNumberInput(): Promise<Locator> {
    const creditCardDialogCandidates = this.resolveTopLevelCreditCardDialogCandidates();

    return await this.resolveVisibleLocator(
      [
        this.contractRoot.locator('#cardNof'),
        this.paymentFrame.locator('#cardNof'),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.getByRole('textbox', { name: /____-____-____-____/ }).first(),
        ),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.locator('input, textarea').nth(0),
        ),
      ],
      'Unable to find credit-card number input.',
    );
  }

  private async resolveCardMonthInput(): Promise<Locator> {
    const creditCardDialogCandidates = this.resolveTopLevelCreditCardDialogCandidates();

    return await this.resolveVisibleLocator(
      [
        this.contractRoot.locator('#carddate'),
        this.paymentFrame.locator('#carddate'),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.locator('input, textarea').nth(2),
        ),
      ],
      'Unable to find credit-card month input.',
    );
  }

  private async resolveCardYearInput(): Promise<Locator> {
    const creditCardDialogCandidates = this.resolveTopLevelCreditCardDialogCandidates();

    return await this.resolveVisibleLocator(
      [
        this.contractRoot.locator('#carddateY'),
        this.paymentFrame.locator('#carddateY'),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.locator('input, textarea').nth(3),
        ),
      ],
      'Unable to find credit-card year input.',
    );
  }

  private async resolveCardCvvInput(): Promise<Locator> {
    const creditCardDialogCandidates = this.resolveTopLevelCreditCardDialogCandidates();

    return await this.resolveVisibleLocator(
      [
        this.contractRoot.locator('#cvv2'),
        this.paymentFrame.locator('#cvv2'),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.getByText(/^CVV2$/).locator('xpath=preceding-sibling::input[1]').first(),
        ),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.getByText(/^CVV2$/).locator('xpath=../input[1]').first(),
        ),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.locator('input, textarea').nth(4),
        ),
      ],
      'Unable to find credit-card CVV input.',
    );
  }

  private async resolveCardHolderInput(): Promise<Locator> {
    const creditCardDialogCandidates = this.resolveTopLevelCreditCardDialogCandidates();

    return await this.resolveVisibleLocator(
      [
        this.contractRoot.locator('#cardfHolderName'),
        this.paymentFrame.locator('#cardfHolderName'),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.locator('input, textarea').nth(1),
        ),
      ],
      'Unable to find card-holder input.',
    );
  }

  private async resolvePayButton(): Promise<Locator> {
    const creditCardDialogCandidates = this.resolveTopLevelCreditCardDialogCandidates();

    return await this.resolveVisibleLocator(
      [
        this.contractRoot.getByTestId('payment-submit'),
        this.contractRoot.getByRole('button', { name: /Pay/i }),
        this.paymentFrame.getByTestId('payment-submit'),
        this.paymentFrame.getByRole('button', { name: /Pay/i }).first(),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.getByRole('button', { name: /Pay/i }).first(),
        ),
        ...creditCardDialogCandidates.map((creditCardDialog) =>
          creditCardDialog.getByText(/^Pay$/).first(),
        ),
      ],
      'Unable to find payment submit button.',
      15_000,
    );
  }

  private async resolvePrintReceiptDialog(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [this.printReceiptDialog],
      'Unable to find print receipt dialog.',
      15_000,
    );
  }

  private resolveTopLevelCreditCardDialogCandidates(): Locator[] {
    return [
      this.page
        .locator('body > div:visible')
        .filter({ has: this.page.getByText(/Card Holder/i) })
        .filter({ has: this.page.getByText(/Exp\. Date/i) })
        .first(),
      this.page
        .locator('body > div:visible')
        .filter({ has: this.page.getByRole('textbox', { name: /____-____-____-____/ }) })
        .first(),
    ];
  }

  private async resolveVisibleLocator(
    candidates: Locator[],
    message: string,
    timeout = 5_000,
  ): Promise<Locator> {
    const resolvedLocator = await waitUntil(
      async () => {
        for (const candidate of candidates) {
          if (await candidate.isVisible().catch(() => false)) {
            return candidate;
          }
        }

        return null;
      },
      (locator): locator is Locator => locator !== null,
      {
        timeout,
        message,
      },
    );

    if (!resolvedLocator) {
      throw new Error(message);
    }

    return resolvedLocator;
  }

  private async waitForPaymentOverlayToClear(): Promise<void> {
    const overlay = this.paymentFrame.locator('.mycover, [id^="floatcover"]').first();

    await waitUntil(
      async () => await overlay.isVisible().catch(() => false),
      (visible) => !visible,
      {
        timeout: 5_000,
        message: 'Payment overlay did not disappear in time.',
      },
    ).catch(() => undefined);
  }
}

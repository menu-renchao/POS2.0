import { expect, type Locator, type Page } from '@playwright/test';
import { parseCurrencyAmount } from '../../utils/currency';
import { step } from '../../utils/step';
import { escapeRegExp } from '../../utils/text';
import { waitUntil } from '../../utils/wait';
import type { OrderDetailsContext } from '../shared/order-details/order-details-context';
import type { OrderDetailsPaymentSection } from '../shared/order-details/order-details-payment.section';
import { TipInputDialog } from '../shared/tip-input.dialog';
import type { RecallOrderActionsSection } from './recall-order-actions.section';

export class RecallTipsSection {
  private readonly globalLoadingOverlay: Locator;
  private readonly paymentTipButtons: Locator;
  private readonly paymentRecordTipInput: TipInputDialog;
  private readonly standardTipInput: TipInputDialog;

  constructor(
    private readonly page: Page,
    private readonly context: OrderDetailsContext,
    private readonly actions: RecallOrderActionsSection,
    private readonly payment: OrderDetailsPaymentSection,
  ) {
    this.globalLoadingOverlay = page.locator('#floatmsgbx');
    this.paymentTipButtons = context.paymentSection
      .locator('button:not([aria-expanded])')
      .filter({ hasText: /^Tips$/ });
    this.standardTipInput = new TipInputDialog(page, 'standard');
    this.paymentRecordTipInput = new TipInputDialog(page, 'payment-record');
  }

  @step((amountInCents: number) =>
    `页面操作：在 Recall 订单详情中添加 Tips ${amountInCents} 分`,
  )
  async addOrderTip(amountInCents: number): Promise<string | null> {
    await this.actions.clickMore('tips');
    await this.standardTipInput.fillAmount(amountInCents);
    await this.standardTipInput.confirm();
    const message = await this.confirmBigTipIfNeeded(this.standardTipInput);
    await this.waitForMutationSettled();
    return message;
  }

  @step((amountInCents: number, paymentMethod?: string) =>
    paymentMethod
      ? `页面操作：在 Recall PAYMENT 卡片 ${paymentMethod} 中添加 Tips ${amountInCents} 分`
      : `页面操作：在 Recall PAYMENT 卡片中添加 Tips ${amountInCents} 分`,
  )
  async addPaymentCardTip(
    amountInCents: number,
    paymentMethod?: string,
  ): Promise<string | null> {
    await this.clickPaymentCardTipsButton(paymentMethod);
    await this.paymentRecordTipInput.fillAmount(amountInCents);
    await this.paymentRecordTipInput.confirm();
    const message = await this.confirmBigTipIfNeeded(this.paymentRecordTipInput);
    await this.waitForMutationSettled();
    return message;
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面操作：在 Recall PAYMENT 卡片 ${paymentMethod} 的 Tips 弹窗中直接确认空值`
      : '页面操作：在 Recall PAYMENT 卡片的 Tips 弹窗中直接确认空值',
  )
  async confirmEmptyPaymentCardTip(paymentMethod?: string): Promise<void> {
    await this.clickPaymentCardTipsButton(paymentMethod);
    await this.paymentRecordTipInput.confirm();
    await this.waitForMutationSettled();
  }

  @step((paymentIndex: number, amountInCents: number) =>
    `页面操作：在 Recall 第 ${paymentIndex + 1} 笔 PAYMENT 流水中添加 Tips ${amountInCents} 分`,
  )
  async addPaymentRecordTip(
    paymentIndex: number,
    amountInCents: number,
  ): Promise<string | null> {
    await this.clickPaymentRecordTipsButton(paymentIndex);
    await this.paymentRecordTipInput.fillAmount(amountInCents);
    await this.paymentRecordTipInput.confirm();
    const message = await this.confirmBigTipIfNeeded(this.paymentRecordTipInput);
    await this.waitForMutationSettled();
    return message;
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面读取：读取 Recall 订单详情 PAYMENT 卡片 ${paymentMethod} 中的 Tips`
      : '页面读取：读取 Recall 订单详情 PAYMENT 卡片中的 Tips',
  )
  async readPaymentCardTip(paymentMethod?: string): Promise<string | null> {
    const payments = await this.payment.readPayments();
    const paymentIndex = this.resolvePaymentIndex(payments, paymentMethod);
    return paymentIndex === null
      ? null
      : payments[paymentIndex]?.details.Tips ?? null;
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面读取：读取 Recall 订单详情 PAYMENT 卡片 ${paymentMethod} 中的 Tips 金额`
      : '页面读取：读取 Recall 订单详情 PAYMENT 卡片中的 Tips 金额',
  )
  async readPaymentCardTipAmount(paymentMethod?: string): Promise<number | null> {
    const tipText = await this.readPaymentCardTip(paymentMethod);
    return tipText === null ? null : parseCurrencyAmount(tipText);
  }

  @step((paymentIndex: number) =>
    `页面读取：读取 Recall 订单详情第 ${paymentIndex + 1} 笔 PAYMENT 流水的 Tips 金额`,
  )
  async readPaymentRecordTipAmount(paymentIndex: number): Promise<number | null> {
    const paymentRecord = (await this.payment.readPayments())[paymentIndex];
    if (!paymentRecord) {
      throw new Error(`Recall 订单详情不存在第 ${paymentIndex + 1} 笔支付流水。`);
    }

    const tipText = paymentRecord.details.Tips;
    return tipText === undefined ? null : parseCurrencyAmount(tipText);
  }

  @step((paymentIndex: number) =>
    `页面操作：点击 Recall 订单详情第 ${paymentIndex + 1} 笔支付流水的 Tips 按钮`,
  )
  private async clickPaymentRecordTipsButton(paymentIndex: number): Promise<void> {
    const tipsButton = this.paymentTipButtons.nth(paymentIndex);
    await expect(tipsButton).toBeVisible({ timeout: 10_000 });
    await tipsButton.scrollIntoViewIfNeeded();
    await tipsButton.click();
    await this.paymentRecordTipInput.expectVisible();
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面操作：点击 Recall PAYMENT 卡片 ${paymentMethod} 的 Tips 按钮`
      : '页面操作：点击 Recall PAYMENT 卡片的 Tips 按钮',
  )
  private async clickPaymentCardTipsButton(paymentMethod?: string): Promise<void> {
    await this.context.paymentSection.scrollIntoViewIfNeeded();
    await this.waitForLoadingHidden();

    const payments = await this.payment.readPayments();
    const paymentIndex = this.resolvePaymentIndex(payments, paymentMethod);
    if (paymentIndex === null) {
      throw new Error(
        paymentMethod
          ? `Recall PAYMENT 中未找到支付方式 ${paymentMethod}。`
          : 'Recall PAYMENT 中没有可添加小费的支付流水。',
      );
    }
    const tipsButton = this.paymentTipButtons.nth(paymentIndex);

    await expect(tipsButton).toBeVisible({ timeout: 15_000 });
    await expect(tipsButton).toBeEnabled({ timeout: 5_000 });
    await tipsButton.click({ timeout: 5_000 });
    await this.paymentRecordTipInput.expectVisible();
  }

  private resolvePaymentIndex(
    payments: Awaited<ReturnType<OrderDetailsPaymentSection['readPayments']>>,
    paymentMethod?: string,
  ): number | null {
    if (payments.length === 0) {
      return null;
    }

    if (!paymentMethod) {
      return payments.length - 1;
    }

    const paymentMethodPattern = buildPaymentMethodPattern(paymentMethod);
    const paymentIndex = payments.findIndex((paymentRecord) =>
      paymentMethodPattern.test(paymentRecord.method),
    );
    return paymentIndex >= 0 ? paymentIndex : null;
  }

  @step('页面操作：存在大额小费提示时确认继续')
  private async confirmBigTipIfNeeded(
    tipInput: TipInputDialog,
  ): Promise<string | null> {
    if (!(await tipInput.isBigTipConfirmationVisible())) {
      return null;
    }
    return await tipInput.confirmBigTip();
  }

  @step('页面操作：等待 Recall 小费变更完成')
  private async waitForMutationSettled(): Promise<void> {
    await waitUntil(
      async () => await this.globalLoadingOverlay.isVisible().catch(() => false),
      (isVisible) => isVisible,
      {
        timeout: 3_000,
        interval: 50,
        message: 'Recall 加小费后未出现全局 Loading 遮罩。',
      },
    ).catch(() => undefined);

    await this.waitForLoadingHidden();
  }

  @step('页面操作：等待 Recall 全局 Loading 遮罩消失')
  private async waitForLoadingHidden(): Promise<void> {
    if (!(await this.globalLoadingOverlay.isVisible().catch(() => false))) {
      return;
    }

    await waitUntil(
      async () => !(await this.globalLoadingOverlay.isVisible().catch(() => false)),
      (hidden) => hidden,
      {
        timeout: 15_000,
        message: 'Recall 全局 Loading 遮罩未在预期时间内消失。',
      },
    );
  }
}

function buildPaymentMethodPattern(paymentMethod: string): RegExp {
  const tokens = paymentMethod
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((token) => escapeRegExp(token));

  if (tokens.length === 0) {
    return /.^/;
  }

  return new RegExp(tokens.map((token) => `(?=.*${token})`).join(''), 'i');
}

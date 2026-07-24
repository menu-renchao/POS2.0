import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import type { RecallOrderActionsSection } from './recall-order-actions.section';
import type { RecallDiscountWholeOrderSummary } from './recall.types';

export class RecallDiscountSection {
  private readonly dialog: Locator;
  private readonly wholeOrderNumber: Locator;
  private readonly wholeOrderScope: Locator;
  private readonly wholeOrderSubtotalValue: Locator;
  private readonly wholeOrderSummary: Locator;

  constructor(
    page: Page,
    private readonly actions: RecallOrderActionsSection,
  ) {
    this.dialog = page
      .getByRole('dialog')
      .filter({
        has: page.getByRole('heading', { name: 'Discount', exact: true }),
      })
      .last();
    this.wholeOrderScope = this.dialog.getByTestId(
      'pos-ui-segmented-option-whole',
    );
    this.wholeOrderSummary = this.dialog
      .locator('[class*="_wholeOrderSummary_"]')
      .first();
    this.wholeOrderNumber = this.wholeOrderSummary
      .locator('[class*="_wholeOrderNumber_"]')
      .first();
    this.wholeOrderSubtotalValue = this.wholeOrderSummary
      .locator('[class*="_wholeOrderSubtotalValue_"]')
      .first();
  }

  @step('页面操作：从 Recall 订单详情打开 Discount 弹窗')
  async open(): Promise<void> {
    await this.actions.click('discount');
    await expect(this.dialog).toBeVisible({ timeout: 10_000 });
    await expect(this.wholeOrderScope).toHaveAttribute('aria-checked', 'true');
  }

  @step('页面读取：读取 Recall Discount 整单范围摘要')
  async readWholeOrderSummary(): Promise<RecallDiscountWholeOrderSummary> {
    await expect(this.dialog).toBeVisible({ timeout: 10_000 });
    await expect(this.wholeOrderSummary).toBeVisible();

    const orderNumber = (await this.wholeOrderNumber.innerText()).trim();
    const subtotalText = (await this.wholeOrderSubtotalValue.innerText()).trim();
    const subtotal = Number(subtotalText.replace(/[$,]/g, ''));

    if (!Number.isFinite(subtotal)) {
      throw new Error(`Recall Discount 整单金额无法解析：${subtotalText}`);
    }

    return { orderNumber, subtotal };
  }
}

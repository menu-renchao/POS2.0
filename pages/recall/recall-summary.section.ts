import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';

export class RecallSummarySection {
  private readonly orderCountValue: Locator;

  constructor(page: Page) {
    this.orderCountValue = page.getByTestId('recall2-order-summary-count-value');
  }

  @step('页面读取：读取 Recall 查询结果的订单总数')
  async readOrderCount(): Promise<number> {
    await expect(this.orderCountValue).toBeVisible();
    const count = Number((await this.orderCountValue.innerText()).trim());

    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Recall 页面展示了无效的订单总数：${String(count)}`);
    }

    return count;
  }
}

import { step } from '../../utils/step';
import type { SplitOrderContext } from './split-order-context';

export class SplitSummarySection {
  constructor(private readonly ctx: SplitOrderContext) {}

  @step('页面读取：读取分单总金额')
  async readTotal(): Promise<number> {
    return parseAmount(
      await this.ctx.modal.locator('[class*="_value_"]').first().innerText(),
      '总金额',
    );
  }

  @step('页面读取：读取分单剩余金额')
  async readRemain(): Promise<number | null> {
    const remain = this.ctx.modal.locator('[class*="_remainValue_"]').first();
    if (!(await remain.isVisible().catch(() => false))) {
      return null;
    }
    return parseAmount(await remain.innerText(), '剩余金额');
  }
}

function parseAmount(text: string, label: string): number {
  const amount = Number(text.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(amount)) {
    throw new Error(`无法解析分单${label}：${text}`);
  }
  return amount;
}

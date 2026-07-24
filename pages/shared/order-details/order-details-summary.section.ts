import { expect } from '@playwright/test';
import { step } from '../../../utils/step';
import type { OrderDetailsContext } from './order-details-context';

export class OrderDetailsSummarySection {
  constructor(private readonly ctx: OrderDetailsContext) {}

  @step('页面读取：读取订单详情中的价格汇总')
  async read(): Promise<Record<string, number>> {
    await this.ensureExpanded();
    return parseSummaryText(await this.ctx.priceSummaryToggle.innerText());
  }

  @step('页面读取：读取订单详情价格汇总区域当前展示的完整文本')
  async readText(): Promise<string> {
    await this.ensureExpanded();
    return (await this.ctx.priceSummaryToggle.innerText()).replace(/\s+/g, ' ').trim();
  }

  @step('页面操作：展开订单详情价格汇总')
  private async ensureExpanded(): Promise<void> {
    await expect(this.ctx.priceSummaryToggle).toBeVisible({ timeout: 5_000 });
    if ((await this.ctx.priceSummaryToggle.getAttribute('aria-expanded')) !== 'true') {
      await this.ctx.priceSummaryToggle.click();
    }
    await expect(this.ctx.priceSummaryToggle).toHaveAttribute('aria-expanded', 'true');
  }
}

function parseSummaryText(value: string): Record<string, number> {
  const summary: Record<string, number> = {};
  const normalized = value.replace(/\s+/g, ' ').trim();
  const rowPattern =
    /\b(Count|Subtotal|Tax|Total Before Tips|Tips|Rounding|Total(?:\s*\(\s*(?:Cash|Card)\s*\))?)\s+\$?(-?[\d,.]+)/gi;

  for (const match of normalized.matchAll(rowPattern)) {
    const label = normalizeLabel(match[1]);
    const amount = Number(match[2].replace(/,/g, ''));
    if (label && Number.isFinite(amount)) {
      summary[label] = amount;
    }
  }
  return summary;
}

function normalizeLabel(value: string): string | null {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (/^(Count|Subtotal|Tax|Total Before Tips|Tips|Rounding)$/i.test(normalized)) {
    return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  const total = normalized.match(/^Total\s*(?:\(\s*(Cash|Card)\s*\))?$/i);
  return total ? (total[1] ? `Total(${total[1]})` : 'Total') : null;
}

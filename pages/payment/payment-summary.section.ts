import { step } from '../../utils/step';
import type {
  PaymentSummaryRow,
  PaymentSummarySnapshot,
} from '../payment.page';
import type { PaymentPageContext } from './payment-page-context';

export class PaymentSummarySection {
  constructor(private readonly ctx: PaymentPageContext) {}

  @step('页面读取：读取左侧支付详情_summaryContent')
  async read(): Promise<PaymentSummarySnapshot> {
    const summaryContent = this.ctx.frame.locator('#_summaryContent');

    return await summaryContent.evaluate((summaryElement) => {
      const cleanText = (value: string | null | undefined): string =>
        value?.replace(/\s+/g, ' ').trim() ?? '';
      const normalizeOptionalText = (
        value: string | null | undefined,
      ): string | null => {
        const normalized = cleanText(value);
        return normalized.length > 0 ? normalized : null;
      };

      const rows = Array.from(summaryElement.children)
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
              ? normalizeOptionalText(
                  rowElement.children[rowElement.children.length - 1]?.textContent,
                )
              : null);

          return label
            ? { label, value: value && value !== label ? value : null }
            : null;
        })
        .filter((row): row is PaymentSummaryRow => row !== null);

      const text = cleanText(summaryElement.textContent);
      if (rows.length > 0) {
        return { rows, text };
      }

      return {
        rows: Array.from(
          text.matchAll(
            /\b(Subtotal|Tax|Charge|Tips|Total(?:\s*\([^)]*\))?)\b\s*([$]?[0-9,.-]+)/gi,
          ),
        ).map((matchedRow) => ({
          label: matchedRow[1],
          value: matchedRow[2] ?? null,
        })),
        text,
      };
    });
  }
}

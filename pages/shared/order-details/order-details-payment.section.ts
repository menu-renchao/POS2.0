import { step } from '../../../utils/step';
import type { RecallOrderPaymentRecord } from '../../recall/recall.types';
import type { OrderDetailsContext } from './order-details-context';

export class OrderDetailsPaymentSection {
  constructor(private readonly ctx: OrderDetailsContext) {}

  @step('页面读取：读取订单详情中的支付记录')
  async readPayments(): Promise<RecallOrderPaymentRecord[]> {
    if (!(await this.ctx.paymentSection.isVisible().catch(() => false))) {
      return [];
    }

    return parseOrderPaymentText(await this.ctx.paymentSection.innerText());
  }
}

export function parseOrderPaymentText(
  paymentSectionText: string,
): RecallOrderPaymentRecord[] {
    const lines = paymentSectionText
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const records: RecallOrderPaymentRecord[] = [];

    for (let index = 0; index <= lines.length - 2; index += 1) {
      const method = lines[index];
      const amount = lines[index + 1];
      const tipLabel = lines[index + 2];
      const tipAmount = lines[index + 3];

      if (method && isNegativeCurrencyAmount(amount)) {
        const details: Record<string, string> = {};
        const extraLabel = lines[index + 2];
        const extraAmount = lines[index + 3];
        if (extraLabel && isCurrencyAmount(extraAmount)) {
          details[extraLabel.replace(/:\s*$/, '')] = extraAmount;
        }

        records.push({
          method,
          amount,
          details,
        });
        continue;
      }

      if (
        !method ||
        !isCurrencyAmount(amount) ||
        tipLabel !== 'Tips' ||
        !isCurrencyAmount(tipAmount)
      ) {
        continue;
      }

      const details: Record<string, string> = {
        Tips: tipAmount,
      };
      const extraLabel = lines[index + 4];
      const extraAmount = lines[index + 5];
      if (extraLabel && isCurrencyAmount(extraAmount)) {
        details[extraLabel.replace(/:\s*$/, '')] = extraAmount;
      }

      records.push({
        method,
        amount,
        details,
      });
    }

    return records;
}

function isCurrencyAmount(value: string | undefined): value is string {
  return value !== undefined && /^(?:-\$|\$-?)[\d,.]+$/.test(value);
}

function isNegativeCurrencyAmount(value: string | undefined): value is string {
  return value !== undefined && /^(?:-\$|\$-)[\d,.]+$/.test(value);
}

import { step } from '../../../utils/step';
import type {
  RecallCustomerInfo,
  RecallMemberInfo,
  RecallOrderContext,
} from '../../recall/recall.types';
import type { OrderDetailsContext } from './order-details-context';

export class OrderDetailsHeaderSection {
  constructor(private readonly ctx: OrderDetailsContext) {}

  @step('页面读取：读取订单详情中的客户信息')
  async readCustomerInfo(): Promise<RecallCustomerInfo | null> {
    const section = this.ctx.section('CUSTOMER INFO');
    if (!(await section.isVisible().catch(() => false))) {
      return null;
    }

    const primaryTexts = (await section
      .locator('[class*="_customerPrimaryText_"]')
      .allInnerTexts())
      .map(normalizeText)
      .filter(Boolean);
    const address = await readOptionalText(
      section.locator('[class*="_customerAddressText_"]'),
    );
    const note = await readOptionalText(
      section.locator('[class*="_customerNoteText_"]'),
    );
    if (primaryTexts.length === 0 && !address && !note) {
      return null;
    }

    return {
      name: primaryTexts[0] ?? '',
      phone: primaryTexts[1] ?? '',
      address,
      note,
    };
  }

  @step('页面读取：读取订单详情中的会员信息')
  async readMemberInfo(): Promise<RecallMemberInfo | null> {
    const section = this.ctx.section('MEMBER INFO');
    if (!(await section.isVisible().catch(() => false))) {
      return null;
    }
    const entries = (await section
      .locator('[class*="_memberInfoText_"]')
      .allInnerTexts())
      .map(normalizeText)
      .filter(Boolean);
    return entries.length > 0 ? { entries } : null;
  }

  @step('页面读取：读取订单详情中的支付状态')
  async readPaymentStatus(): Promise<string | null> {
    return await readOptionalText(this.ctx.dialog.locator('[class*="_statusTag_"]'));
  }

  @step('页面读取：读取订单详情中的订单类型、桌号、人数与服务员信息')
  async readOrderContext(): Promise<RecallOrderContext> {
    const chipTexts = (await this.ctx.dialog
      .locator('[class*="_header_1ej2d_"] button, [class*="_actionButtons_"] button')
      .allInnerTexts())
      .map(normalizeText)
      .filter(Boolean);
    let orderType: string | null = null;
    let tableName: string | null = null;
    let guestCount: string | null = null;
    let serverName: string | null = null;

    for (const chipText of chipTexts) {
      const tableWithGuests = chipText.match(/^(.+?)\s*\((\d+)\)$/);
      if (tableWithGuests) {
        tableName ??= tableWithGuests[1].trim();
        guestCount ??= tableWithGuests[2];
      } else if (
        !orderType &&
        /^(dine in|delivery|pick up|pickup|take out|to go|togo|bar|drive thru|drive-thru|online delivery|online pickup)$/i.test(
          chipText,
        )
      ) {
        orderType = chipText;
      } else if (!guestCount && /^\d+(?:\(\d+\))?$/.test(chipText)) {
        guestCount = chipText;
      } else if (!tableName && /\b(table|tbl|tab|booth|room|patio|bar seat)\b/i.test(chipText)) {
        tableName = chipText;
      } else if (!serverName) {
        serverName = chipText;
      }
    }

    return { orderType, tableName, guestCount, serverName };
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

async function readOptionalText(locator: import('@playwright/test').Locator): Promise<string | null> {
  if (!(await locator.isVisible().catch(() => false))) {
    return null;
  }
  const value = normalizeText(await locator.innerText());
  return value && value !== '-' ? value : null;
}

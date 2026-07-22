import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import { RecallFilterBarSection } from '../recall/recall-filter-bar.section';
import { RecallOrderDetailsDialog } from '../recall/recall-order-details.dialog';

export type TableCardDisplayField =
  | 'orderTime'
  | 'orderId'
  | 'partySize'
  | 'server'
  | 'price'
  | 'partyName';

const displayFieldAccessibleNames = {
  orderTime: 'TimeoutIcon Order Time',
  orderId: 'Order Id',
  partySize: 'Seat3Icon Party Size',
  server: 'RoleIcon Server',
  price: 'PriceIcon Price',
  partyName: 'MemberIcon Party Name',
} as const satisfies Record<TableCardDisplayField, string>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export class SelectTableCardsSection {
  public readonly orderDetails: RecallOrderDetailsDialog;
  private readonly tableAreaRoot: Locator;
  private readonly tableNodeById: (tableId: string) => Locator;
  private readonly occupiedTableButtonByNumber: (tableNumber: string) => Locator;
  private readonly multiOrderDialog: Locator;

  constructor(private readonly page: Page) {
    this.tableAreaRoot = this.page.locator('#myAreaRoot');
    this.tableNodeById = (tableId: string) =>
      this.tableAreaRoot.locator(`[data-table-id="${tableId}"]`);
    this.occupiedTableButtonByNumber = (tableNumber: string) =>
      this.page.getByRole('button', {
        name: new RegExp(
          `^(?:Reopen1Icon\\s+${escapeRegExp(tableNumber)}|Order1Icon\\s+\\d+\\s+${escapeRegExp(tableNumber)})\\b`,
        ),
      }).first();
    this.multiOrderDialog = this.page.getByTestId('pos-ui-modal').last();
    this.orderDetails = new RecallOrderDetailsDialog(
      page,
      new RecallFilterBarSection(page),
    );
  }

  @step((field: TableCardDisplayField) => `页面操作：将桌台卡片显示字段切换为 ${field}`)
  async selectDisplayField(field: TableCardDisplayField): Promise<void> {
    const tab = this.page.getByRole('tab', {
      name: displayFieldAccessibleNames[field],
      exact: true,
    });

    await expect(tab).toBeVisible();
    await tab.click();
  }

  @step((tableNumber: string) => `页面读取：读取桌号为 ${tableNumber} 的已占用桌台卡片文本`)
  async readTableCardText(tableNumber: string): Promise<string> {
    const tableButton = this.occupiedTableButtonByNumber(tableNumber);
    await expect(tableButton).toBeVisible();
    return normalizeText(await tableButton.innerText());
  }

  @step((tableNumber: string) => `页面读取：读取桌台 ${tableNumber} 显示的订单号`)
  async readDisplayedOrderNumber(tableNumber: string): Promise<string> {
    const tableText = await this.readTableCardText(tableNumber);
    const orderNumber = tableText.match(/#(\d+)/)?.[1];

    if (!orderNumber) {
      throw new Error(`无法从桌台卡片读取订单号：${tableText}`);
    }

    return orderNumber;
  }

  @step((tableNumber: string) => `页面读取：读取桌台 ${tableNumber} 显示的下单时间`)
  async readDisplayedOrderTime(tableNumber: string): Promise<string> {
    const tableText = await this.readTableCardText(tableNumber);
    const orderTime = tableText.match(/\b(\d{1,2}:\d{2})\b/)?.[1];

    if (!orderTime) {
      throw new Error(`无法从桌台卡片读取下单时间：${tableText}`);
    }

    return orderTime.padStart(5, '0');
  }

  @step((tableNumber: string) => `页面读取：读取桌台 ${tableNumber} 显示的客人数`)
  async readDisplayedPartySize(tableNumber: string): Promise<number> {
    const valueText = await this.readDisplayValueText(tableNumber);
    const partySize = Number(valueText.match(/\d+/)?.[0]);

    if (!Number.isInteger(partySize) || partySize < 0) {
      throw new Error(`无法从桌台卡片读取客人数：${valueText}`);
    }

    return partySize;
  }

  @step((tableNumber: string) => `页面读取：读取桌台 ${tableNumber} 显示的企台`)
  async readDisplayedServer(tableNumber: string): Promise<string> {
    const serverName = await this.readDisplayValueText(tableNumber);

    if (!serverName) {
      throw new Error(`桌台 ${tableNumber} 未显示企台。`);
    }

    return serverName;
  }

  @step((tableNumber: string) => `页面读取：读取桌台 ${tableNumber} 显示的订单金额`)
  async readDisplayedPrice(tableNumber: string): Promise<number> {
    const tableText = await this.readTableCardText(tableNumber);
    const amount = Number(tableText.match(/\$([\d,]+(?:\.\d{1,2})?)/)?.[1]?.replace(/,/g, ''));

    if (Number.isNaN(amount)) {
      throw new Error(`无法从桌台卡片读取订单金额：${tableText}`);
    }

    return amount;
  }

  @step((tableNumber: string) => `页面读取：读取桌台 ${tableNumber} 显示的客人姓名`)
  async readDisplayedPartyName(tableNumber: string): Promise<string> {
    return await this.readDisplayValueText(tableNumber);
  }

  @step((tableId: string) => `页面操作：在桌台 ${tableId} 上追加一笔订单`)
  async clickAddOrder(tableId: string): Promise<void> {
    const addOrderBadge = this.tableNodeById(tableId).locator('div.table-node-blue-badge');
    await expect(addOrderBadge).toBeVisible();
    await addOrderBadge.click();
  }

  @step((tableNumber: string) => `页面操作：打开桌台 ${tableNumber} 的所有订单`)
  async openTableOrders(tableNumber: string): Promise<void> {
    const tableOrderButton = this.occupiedTableButtonByNumber(tableNumber);
    await expect(tableOrderButton).toBeVisible();
    await tableOrderButton.click();
    await expect(this.multiOrderDialog).toBeVisible();
  }

  @step('页面读取：读取桌台多订单弹窗中的订单号')
  async readOpenOrderNumbers(): Promise<string[]> {
    await expect(this.multiOrderDialog).toBeVisible();
    const buttonTexts = await this.multiOrderDialog.getByRole('button').allTextContents();

    return buttonTexts
      .map((buttonText) => normalizeText(buttonText).match(/^#(\d+)/)?.[1] ?? null)
      .filter((orderNumber): orderNumber is string => orderNumber !== null);
  }

  @step((orderNumber: string) => `页面操作：从桌台多订单弹窗打开订单 ${orderNumber}`)
  async openOrderDetails(orderNumber: string): Promise<void> {
    const orderButton = this.multiOrderDialog.getByRole('button', {
      name: new RegExp(`^#${escapeRegExp(orderNumber)}\\b`),
    });

    await expect(orderButton).toBeVisible();
    await orderButton.click();
    await this.orderDetails.readOrderDetailsSnapshot();
  }

  private async readDisplayValueText(tableNumber: string): Promise<string> {
    const tableText = await this.readTableCardText(tableNumber);
    const leadingTableNumber = new RegExp(`^\\W*${escapeRegExp(tableNumber)}\\W*`);
    return tableText.replace(leadingTableNumber, '').trim();
  }
}

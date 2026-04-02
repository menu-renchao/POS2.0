import { expect, type Locator, type Page } from '@playwright/test';
import { OrderDishesPage } from './order-dishes.page';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

export type SelectedTableRecord = {
  areaName: string;
  tableNumber: string;
};

type TableEntryState = 'guestCountDialog' | 'orderDishes';

export class SelectTablePage {
  private readonly backButton: Locator;
  private readonly newOrderButton: Locator;
  private readonly areaButtons: Locator;
  private readonly tableButtons: Locator;
  private readonly availableTableButtons: Locator;
  private readonly guestCountDialog: Locator;
  private readonly orderDishesFrame: Locator;
  private readonly loadingTablesStatus: Locator;

  constructor(private readonly page: Page) {
    this.backButton = this.page.getByRole('button', { name: 'Back' });
    this.newOrderButton = this.page.getByRole('button', { name: /New order/i });
    this.areaButtons = this.page.locator('button[aria-pressed]');
    this.tableButtons = this.page.getByRole('button', {
      name: /(Seat2Icon|Reopen1Icon)/,
    });
    this.availableTableButtons = this.page.getByRole('button', {
      name: /Seat2Icon/,
    }).filter({
      hasNotText: 'Boss',
    });
    this.guestCountDialog = this.page.getByRole('dialog').filter({
      hasText: 'Please choose the guest number of this order.',
    }).first();
    this.orderDishesFrame = this.page.locator('iframe[data-wujie-id="orderDishes"]');
    this.loadingTablesStatus = this.page.getByRole('status').filter({
      hasText: 'Loading tables...',
    });
  }

  @step('页面操作：确认选桌页面已经加载完成')
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/#tableV2/);
    await expect(this.backButton).toBeVisible();
    await expect(this.newOrderButton).toBeVisible();
  }

  @step('页面读取：读取当前区域下所有空桌')
  async getAvailableTables(): Promise<Locator[]> {
    await this.expectLoaded();
    await this.waitUntilTableDataLoaded();

    const availableTableCount = await this.availableTableButtons.count();
    const availableTables: Locator[] = [];

    for (let index = 0; index < availableTableCount; index += 1) {
      const tableButton = this.availableTableButtons.nth(index);

      if (await tableButton.isVisible().catch(() => false)) {
        availableTables.push(tableButton);
      }
    }

    return availableTables;
  }

  @step((areaName: string) => `页面操作：切换到区域 ${areaName}`)
  async selectArea(areaName: string): Promise<void> {
    const areaButton = this.resolveAreaLocator(areaName);

    await expect(areaButton).toBeVisible();

    const isChecked =
      (await areaButton.getAttribute('aria-checked')) === 'true' ||
      (await areaButton.getAttribute('aria-pressed')) === 'true';

    if (!isChecked) {
      await areaButton.click();
      await this.waitUntilTableDataLoaded();
    }
  }

  @step('页面读取：读取当前选中的区域名称')
  async getCurrentAreaName(): Promise<string> {
    const selectedArea = this.page.locator('button[aria-pressed="true"]').first();

    await expect(selectedArea).toBeVisible();

    const areaName = (await selectedArea.textContent())?.trim();

    if (!areaName) {
      throw new Error('Unable to determine the current selected area on the select-table page.');
    }

    return areaName;
  }

  @step('页面读取：读取选桌页全部区域名称')
  async readAreaNames(): Promise<string[]> {
    const areaNames = await this.areaButtons.allTextContents();

    return areaNames.map((areaName) => areaName.trim()).filter(Boolean);
  }

  @step((tableNumber: string) => `页面操作：在当前区域中查找桌号为 ${tableNumber} 的桌台`)
  async findTableByNumber(tableNumber: string): Promise<Locator> {
    await this.waitUntilTableDataLoaded();

    const escapedTableNumber = tableNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const table = this.tableButtons.filter({
      hasText: new RegExp(`(^|\\s)${escapedTableNumber}(\\s|$)`),
    });

    await expect(table.first()).toBeVisible();

    return table.first();
  }

  @step('页面操作：等待选桌页面桌台数据加载完成')
  async waitUntilTableDataLoaded(): Promise<void> {
    await waitUntil(
      async () => await this.loadingTablesStatus.isVisible().catch(() => false),
      (isLoading) => isLoading === false,
      {
        timeout: 15_000,
        message: 'Select-table page did not finish loading table data in time.',
      },
    );
  }

  @step('页面操作：点击指定桌台卡片')
  async clickTable(table: Locator): Promise<void> {
    await expect(table).toBeVisible();
    await table.scrollIntoViewIfNeeded();
    await table.click();
  }

  @step('页面操作：确认人数选择弹窗已经显示')
  async expectGuestCountDialogVisible(): Promise<void> {
    await expect(this.guestCountDialog).toBeVisible();
    await expect(
      this.guestCountDialog.getByText('Please choose the guest number of this order.'),
    ).toBeVisible();
  }

  @step((guestCount: number) => `页面操作：在人数弹窗中选择 ${guestCount} 位客人并进入点单页`)
  async selectGuestCount(guestCount: number): Promise<OrderDishesPage> {
    await this.expectGuestCountDialogVisible();
    await this.guestCountDialog
      .getByRole('button', { name: String(guestCount), exact: true })
      .click();
    return new OrderDishesPage(this.page);
  }

  @step('页面读取：等待桌台点击后的页面分支稳定')
  async waitForTableEntryState(): Promise<TableEntryState> {
    let entryState: TableEntryState | null = null;

    await waitUntil(
      async () => {
        if (await this.guestCountDialog.isVisible().catch(() => false)) {
          entryState = 'guestCountDialog';
          return entryState;
        }

        if (
          this.page.url().includes('#orderDishes') ||
          (await this.orderDishesFrame.first().isVisible().catch(() => false))
        ) {
          entryState = 'orderDishes';
          return entryState;
        }

        return null;
      },
      (state) => state !== null,
      {
        timeout: 5_000,
        message: 'Selecting a table did not open guest-count dialog or order-dishes page in time.',
      },
    );

    if (!entryState) {
      throw new Error('Unable to determine the entry state after selecting a table.');
    }

    return entryState;
  }

  @step((guestCount: number) => `页面操作：完成桌台进入流程，并以 ${guestCount} 位客人进入点单页`)
  async enterOrderDishesAfterSelectingTable(guestCount: number): Promise<OrderDishesPage> {
    const entryState = await this.waitForTableEntryState();

    if (entryState === 'orderDishes') {
      return new OrderDishesPage(this.page);
    }

    return await this.selectGuestCount(guestCount);
  }

  @step('页面操作：点击 New order 直接进入点单页')
  async clickNewOrder(): Promise<OrderDishesPage> {
    await this.expectLoaded();
    await this.newOrderButton.click();
    return new OrderDishesPage(this.page);
  }

  @step('页面读取：读取桌台卡片中的桌号')
  async readTableNumber(table: Locator): Promise<string> {
    const tableText = await table
      .evaluate((tableElement) => (tableElement as HTMLElement).innerText)
      .catch(async () => (await table.textContent()) ?? '');
    const normalizedTableText = tableText.replace(/\s+/g, ' ').trim();

    if (!normalizedTableText) {
      throw new Error('Unable to read the table number from the table card.');
    }

    const matchedTableNumber = normalizedTableText.match(/^(\S+)/);

    if (!matchedTableNumber?.[1]) {
      throw new Error(
        `Unable to parse the table number from table card text: ${normalizedTableText}`,
      );
    }

    return matchedTableNumber[1];
  }

  private resolveAreaLocator(areaName: string): Locator {
    return this.page
      .getByRole('radio', {
        name: areaName,
        exact: true,
      })
      .or(
        this.page.getByRole('button', {
          name: areaName,
          exact: true,
        }),
      )
      .first();
  }
}

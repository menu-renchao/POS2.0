import { expect, type Locator, type Page } from '@playwright/test';
import { InventoryStockSettingPage } from './inventory-stock-setting.page';
import { OrderDishesPage } from './order-dishes.page';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

export type InventoryMenuNavigation = {
  category: string;
  inventoryCategoryPanelId?: string;
};

export type InventoryItemFocusParams = {
  itemName: string;
  menu?: InventoryMenuNavigation;
  limitedStockFilter?: boolean;
};

export class InventoryPage {
  private readonly pageTitle: Locator;
  private readonly itemNameInput: Locator;
  private readonly searchButton: Locator;
  private readonly limitedStockFilter: Locator;
  private readonly backButton: Locator;
  private readonly globalLoadingOverlay: Locator;

  constructor(private readonly page: Page) {
    this.pageTitle = this.page.getByText('Inventory Management', { exact: true });
    this.itemNameInput = this.page.getByRole('textbox', { name: 'Item Name' });
    this.searchButton = this.page.getByText('Search', { exact: true });
    this.limitedStockFilter = this.page.locator('#root').getByText('Limited Stock', { exact: true });
    this.backButton = this.page.locator('.header_back__XNwEZ').first();
    this.globalLoadingOverlay = this.page.locator('#floatmsgbx');
  }

  @step('页面操作：确认库存管理页已经加载完成')
  async expectLoaded(): Promise<void> {
    await waitUntil(
      async () => {
        if (/#inventory/.test(this.page.url())) {
          return true;
        }

        if (await this.pageTitle.isVisible().catch(() => false)) {
          return true;
        }

        if (await this.limitedStockFilter.isVisible().catch(() => false)) {
          return true;
        }

        return await this.page.locator('[id^="cty_"]').first().isVisible().catch(() => false);
      },
      (loaded) => loaded,
      {
        timeout: 15_000,
        message: 'Inventory page did not finish loading.',
      },
    );

    if (await this.globalLoadingOverlay.isVisible().catch(() => false)) {
      await expect(this.globalLoadingOverlay).toBeHidden({ timeout: 30_000 });
    }
  }

  @step((params: InventoryItemFocusParams) => `页面操作：在库存页定位商品 ${params.itemName}`)
  async focusItem(params: InventoryItemFocusParams): Promise<void> {
    await this.expectLoaded();

    if (params.menu?.inventoryCategoryPanelId) {
      await this.page
        .locator(`#${params.menu.inventoryCategoryPanelId}`)
        .getByText(params.menu.category, { exact: true })
        .click();
    }

    if (params.limitedStockFilter) {
      await this.limitedStockFilter.click();
    }

    await expect(this.itemNameLocator(params.itemName)).toBeVisible({ timeout: 15_000 });
  }

  @step((params: InventoryItemFocusParams) => `页面操作：搜索库存商品 ${params.itemName}`)
  async searchInventory(params: InventoryItemFocusParams): Promise<void> {
    if (await this.itemNameInput.isVisible().catch(() => false)) {
      await this.itemNameInput.fill('');
      await this.itemNameInput.fill(params.itemName);
      await this.searchButton.click();
      await expect(this.itemNameLocator(params.itemName)).toBeVisible({ timeout: 15_000 });
      return;
    }

    await this.focusItem(params);
  }

  @step((itemName: string) => `页面操作：打开商品 ${itemName} 的库存设置弹窗`)
  async openStockSetting(itemName: string): Promise<InventoryStockSettingPage> {
    await this.itemNameLocator(itemName).click();

    const stockSettingPage = new InventoryStockSettingPage(this.page, itemName);
    await stockSettingPage.expectVisible();

    return stockSettingPage;
  }

  @step((itemName: string) => `页面读取：读取商品 ${itemName} 的库存状态文案`)
  async readItemStockState(itemName: string): Promise<string> {
    const stockStateLocator = this.itemStockStateLocator(itemName);
    await expect(stockStateLocator).toBeVisible({ timeout: 10_000 });
    const stockText = (await stockStateLocator.innerText()).trim();
    const matchedStock = stockText.match(/Stock:\s*\d+/);

    if (!matchedStock) {
      throw new Error(`Unable to read stock label for ${itemName}. Received "${stockText}".`);
    }

    return matchedStock[0];
  }

  @step('页面操作：从库存管理页返回点单页')
  async backToOrderPage(): Promise<OrderDishesPage> {
    if (await this.backButton.isVisible().catch(() => false)) {
      await this.backButton.click();
    } else {
      await this.page.goBack();
    }

    const orderDishesPage = new OrderDishesPage(this.page);
    await waitUntil(
      async () => {
        await orderDishesPage.expectLoaded().catch(() => undefined);
        return await this.page.url();
      },
      (url) => /#orderDishes/.test(url),
      {
        timeout: 15_000,
        message: 'Inventory page did not navigate back to order dishes.',
      },
    );

    await expect(this.page.locator('#inventory-dialog')).toBeHidden({ timeout: 5_000 }).catch(() => undefined);

    return orderDishesPage;
  }

  private itemNameLocator(itemName: string): Locator {
    return this.page.getByText(itemName, { exact: true }).first();
  }

  private itemStockStateLocator(itemName: string): Locator {
    const combinedRow = this.page
      .locator('motion.div, div')
      .filter({ hasText: new RegExp(`^${escapeRegExp(itemName)}\\s*Stock:\\s*\\d+$`) })
      .first();

    return this.itemNameLocator(itemName)
      .locator('xpath=ancestor::*[.//*[contains(normalize-space(.),"Stock:")]][1]')
      .getByText(/Stock:\s*\d+/)
      .or(combinedRow.getByText(/Stock:\s*\d+/))
      .first();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

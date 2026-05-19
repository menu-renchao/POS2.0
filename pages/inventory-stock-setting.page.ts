import { expect, type Locator, type Page } from '@playwright/test';
import { InventoryPage } from './inventory.page';
import { step } from '../utils/step';
import { waitForInputSettled } from '../utils/input-stability';

export type InventoryStockStatus = 'In Stock (Unlimited)' | 'Out of Stock' | 'Limited Stock';

export class InventoryStockSettingPage {
  private readonly inventoryDialog: Locator;
  private readonly limitedStockInput: Locator;
  private readonly confirmButton: Locator;
  private readonly keyboardHideButton: Locator;

  constructor(
    private readonly page: Page,
    private readonly itemName: string,
  ) {
    this.inventoryDialog = this.page.locator('#inventory-dialog');
    this.limitedStockInput = this.page.locator('#gqipt');
    this.confirmButton = this.inventoryDialog
      .getByRole('button', { name: /^Confirm$/ })
      .or(this.page.locator('#inventory-submit'));
    this.keyboardHideButton = this.page.locator('#kbrhide');
  }

  @step((itemName: string) => `页面操作：确认商品 ${itemName} 的库存设置弹窗可见`)
  async expectVisible(): Promise<void> {
    await expect(this.inventoryDialog).toBeVisible({ timeout: 10_000 });
    await expect(this.limitedStockInput).toBeVisible({ timeout: 10_000 });
    await expect(this.confirmButton).toBeVisible({ timeout: 10_000 });
  }

  @step((status: string) => `页面操作：设置库存状态为 ${status}`)
  async setStockStatus(status: InventoryStockStatus): Promise<this> {
    const statusOption = this.inventoryDialog.getByText(status, { exact: true });

    if (await statusOption.isVisible().catch(() => false)) {
      await statusOption.click();
      return this;
    }

    await this.page.getByRole('radio', { name: status, exact: true }).click();
    return this;
  }

  @step((quantity: number) => `页面操作：设置有限库存数量为 ${quantity}`)
  async setLimitedStockQuantity(quantity: number): Promise<this> {
    await this.setStockStatus('Limited Stock');
    await this.limitedStockInput.click();
    await this.limitedStockInput.fill(String(quantity));
    return this;
  }

  @step('页面操作：保存库存配置')
  async saveInventoryConfig(): Promise<InventoryPage> {
    if (await this.keyboardHideButton.isVisible().catch(() => false)) {
      await this.keyboardHideButton.click();
    }

    await waitForInputSettled();
    await this.confirmButton.click({ force: true });

    await expect(this.inventoryDialog).toBeHidden({ timeout: 15_000 });

    const inventoryPage = new InventoryPage(this.page);
    await inventoryPage.expectLoaded();
    return inventoryPage;
  }
}

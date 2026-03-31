import { expect, type Page } from '@playwright/test';
import { step } from '../utils/step';

export class OrderDishesPage {
  private readonly appFrame: ReturnType<Page['frameLocator']>;

  constructor(private readonly page: Page) {
    this.appFrame = this.page.frameLocator('iframe[data-wujie-id="orderDishes"]');
  }

  @step('页面操作：确认点餐页面已经加载完成')
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/#orderDishes/);
    await expect(this.appFrame.getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(this.appFrame.getByRole('button', { name: 'Send' })).toBeVisible();
    await expect(this.appFrame.getByRole('button', { name: 'Pay' })).toBeVisible();
  }

  @step((tableNumber: string) => `页面操作：确认点餐页面顶部桌号为 ${tableNumber}`)
  async expectTableNumber(tableNumber: string): Promise<void> {
    await expect(
      this.appFrame.getByRole('button', {
        name: new RegExp(`TableIcon\\s*${tableNumber}`),
      }),
    ).toBeVisible();
  }

  @step((guestCount: number) => `页面操作：确认点餐页面顶部人数为 ${guestCount}`)
  async expectGuestCount(guestCount: number): Promise<void> {
    await expect(
      this.appFrame.getByRole('button', {
        name: new RegExp(`SeatIcon\\s*${guestCount}`),
      }),
    ).toBeVisible();
  }
}

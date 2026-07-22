import { expect, type Locator } from '@playwright/test';
import { step } from '../../utils/step';
import type { OrderDishesPageContext } from './order-dishes-page-context';

export class OrderDishesDriverSection {
  private readonly driverButton: Locator;
  private readonly driverOptions: Locator;

  constructor(private readonly ctx: OrderDishesPageContext) {
    this.driverButton = this.ctx.page.getByTestId('driverName-button');
    this.driverOptions = this.ctx.page.locator('[data-testid^="dropdown-item-"]');
  }

  @step((driverName: string) => `页面操作：为当前 Delivery 订单选择司机 ${driverName}`)
  async selectDriver(driverName: string): Promise<void> {
    await expect(this.driverButton).toBeVisible();
    await this.driverButton.click();

    const driverOption = this.driverOptions.filter({ hasText: driverName });
    await expect(driverOption).toHaveCount(1);
    await driverOption.click();
    await expect(this.driverButton).toContainText(driverName);
  }
}

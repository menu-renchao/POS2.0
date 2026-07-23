import type { KitchenSetupService } from '../api/setup/kitchen.setup';
import type { SentOrderItemReference } from '../pages/order-dishes/order-dishes.types';
import { step } from '../utils/step';

export class OrderKitchenFlow {
  @step((_: KitchenSetupService, __: readonly SentOrderItemReference[], dishName: string) =>
    `业务步骤：将已送厨菜品 ${dishName} 设置为 Delay`)
  async delaySentDish(
    kitchenSetup: KitchenSetupService,
    orderItems: readonly SentOrderItemReference[],
    dishName: string,
    delayInMillis: number,
  ): Promise<void> {
    const targetItem = this.requireOrderItem(orderItems, dishName);
    await kitchenSetup.delayOrderItem(targetItem.id, delayInMillis);
  }

  @step((_: KitchenSetupService, __: readonly SentOrderItemReference[], dishName: string) =>
    `业务步骤：将已送厨菜品 ${dishName} 设置为 Hold`)
  async holdSentDish(
    kitchenSetup: KitchenSetupService,
    orderItems: readonly SentOrderItemReference[],
    dishName: string,
  ): Promise<void> {
    const targetItem = this.requireOrderItem(orderItems, dishName);
    await kitchenSetup.holdOrderItem(targetItem.id);
  }

  private requireOrderItem(
    orderItems: readonly SentOrderItemReference[],
    dishName: string,
  ): SentOrderItemReference {
    const normalizedDishName = dishName.trim();
    const targetItem = orderItems.find((item) => item.displayName.trim() === normalizedDishName);
    if (!targetItem) {
      const availableNames = orderItems.map((item) => item.displayName).join(', ');
      throw new Error(
        `送厨响应中没有找到目标菜品 ${dishName}。可用菜品：${availableNames || '无'}`,
      );
    }

    return targetItem;
  }
}

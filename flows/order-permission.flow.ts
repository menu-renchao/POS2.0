import type { OrderDishesPage } from '../pages/order-dishes.page';
import { step } from '../utils/step';

export class OrderPermissionFlow {
  @step(
    (_: OrderDishesPage, comboName: string, saleItemId: number, __: string, note: string) =>
      `业务步骤：为套餐 ${comboName} 的子菜 ${saleItemId} 授权后添加 Note：${note}`,
  )
  async addNoteToComboSubItemWithAuthorization(
    orderDishesPage: OrderDishesPage,
    comboName: string,
    saleItemId: number,
    authorizationPasscode: string,
    note: string,
  ): Promise<void> {
    await orderDishesPage.selectComboSubItem(comboName, saleItemId);
    await orderDishesPage.requestSelectedItemNoteAndExpectAuthorization();
    await orderDishesPage.authorizeSelectedItemNote(authorizationPasscode);
    await orderDishesPage.fillSelectedItemNote(note);
  }

  @step('业务步骤：通过 Count=0 校验延迟送厨菜品被权限拦截并使用主管口令授权')
  async removeDelayedDishByCountWithAuthorization(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    authorizationPasscode: string,
  ): Promise<void> {
    await orderDishesPage.changeOrderedDishQuantity(dishName, 0);
    await orderDishesPage.expectPendingDishRemovalAuthorization();
    await orderDishesPage.authorizePendingDishRemoval(authorizationPasscode);
  }

  @step('业务步骤：校验受限员工删菜被拦截并通过主管口令完成授权')
  async removeSentDishWithAuthorization(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    authorizationPasscode: string,
  ): Promise<void> {
    await orderDishesPage.requestSentDishRemovalAndExpectAuthorization(dishName);
    await orderDishesPage.authorizePendingDishRemoval(authorizationPasscode);
  }
}

import type { OrderDishesPage } from '../pages/order-dishes.page';
import { step } from '../utils/step';

export class OrderPermissionFlow {
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

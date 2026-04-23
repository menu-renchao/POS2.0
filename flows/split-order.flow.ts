import { HomePage } from '../pages/home.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
import { RecallPage } from '../pages/recall.page';
import { type SplitOrderReturnPage, SplitOrderPage } from '../pages/split-order.page';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

const SPLIT_ORDER_SUBMIT_STABILIZATION_MS = 1500;

export class SplitOrderFlow {
  @step((_splitOrderPage: SplitOrderPage, count: number) => `业务步骤：将当前订单平分为 ${count} 份`)
  async splitOrderEvenly(splitOrderPage: SplitOrderPage, count: number): Promise<void> {
    await splitOrderPage.clickEvenOrder();
    await splitOrderPage.fillSplitCount(count);
    await splitOrderPage.confirmSplitInput();
  }

  @step((_splitOrderPage: SplitOrderPage, amounts: number[]) => `业务步骤：按金额分单，金额序列为 ${amounts.join('、')}`)
  async splitOrderByAmounts(splitOrderPage: SplitOrderPage, amounts: number[]): Promise<void> {
    if (amounts.length === 0) {
      return;
    }

    await splitOrderPage.clickByAmount();
    await splitOrderPage.fillSplitAmount(amounts[0]);
    await splitOrderPage.confirmSplitInput();

    for (let index = 1; index < amounts.length; index += 1) {
      await splitOrderPage.clickAddAmountSuborder();
      await splitOrderPage.fillSplitAmount(amounts[index]);
      await splitOrderPage.confirmSplitInput();
    }
  }

  @step('业务步骤：按座位分单')
  async splitOrderBySeats(splitOrderPage: SplitOrderPage): Promise<void> {
    await splitOrderPage.clickBySeats();
  }

  @step((_splitOrderPage: SplitOrderPage, count: number) => `业务步骤：将可平分菜品按 ${count} 份进行分单`)
  async splitOrderByItems(splitOrderPage: SplitOrderPage, count: number = 2): Promise<void> {
    const snapshot = await splitOrderPage.readSnapshot();

    for (const suborder of snapshot.suborders) {
      if (suborder.paidStatus) {
        continue;
      }

      for (const dish of suborder.dishes) {
        if (dish.proportion && /^1\/\d+$/.test(dish.proportion)) {
          continue;
        }

        await splitOrderPage.toggleDishSelection(suborder.orderNumber, dish.name);
      }
    }

    await splitOrderPage.clickEvenItems();
    await splitOrderPage.fillSplitCount(count);
    await splitOrderPage.confirmSplitInput();
  }

  @step(
    (_splitOrderPage: SplitOrderPage, sourceOrderNumber: string, dishNames: string[], targetOrderNumber: string) =>
      `业务步骤：将子单 ${sourceOrderNumber} 的菜品 ${dishNames.join('、')} 移动到子单 ${targetOrderNumber}`,
  )
  async moveDishes(
    splitOrderPage: SplitOrderPage,
    sourceOrderNumber: string,
    dishNames: string[],
    targetOrderNumber: string,
  ): Promise<void> {
    for (const dishName of dishNames) {
      await splitOrderPage.clickDish(sourceOrderNumber, dishName);
      await splitOrderPage.clickSuborder(targetOrderNumber);
    }
  }

  @step((_splitOrderPage: SplitOrderPage, orderNumbers?: string[]) => `业务步骤：合并分单${orderNumbers?.length ? `，目标子单为 ${orderNumbers.join('、')}` : ''}`)
  async combineSuborders(
    splitOrderPage: SplitOrderPage,
    orderNumbers?: string[],
  ): Promise<void> {
    const snapshot = await splitOrderPage.readSnapshot();
    const targetOrders =
      orderNumbers && orderNumbers.length > 0
        ? orderNumbers
        : snapshot.suborders.filter((suborder) => !suborder.paidStatus).map((suborder) => suborder.orderNumber);

    if (targetOrders.length < 2) {
      return;
    }

    await splitOrderPage.clickCombine();

    for (const orderNumber of targetOrders) {
      await splitOrderPage.toggleCombineOrder(orderNumber);
    }

    await splitOrderPage.confirmCombine();
  }

  @step('业务步骤：提交分单并根据当前地址返回对应页面对象')
  async submitAndReturnPage(
    splitOrderPage: SplitOrderPage,
  ): Promise<HomePage | OrderDishesPage | RecallPage> {
    const page = await splitOrderPage.submitAndReturnPage();
    return this.assertReturnPage(page);
  }

  private assertReturnPage(page: SplitOrderReturnPage): HomePage | OrderDishesPage | RecallPage {
    if (page instanceof RecallPage) {
      return page;
    }

    if (page instanceof OrderDishesPage) {
      return page;
    }

    return page;
  }
}

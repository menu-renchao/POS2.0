import { expect } from '@playwright/test';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { test } from '../../fixtures/test.fixture';
import { HomePage } from '../../pages/home.page';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import { RecallPage } from '../../pages/recall.page';
import {
  orderServiceDishes,
  orderServiceSplitTipsCase,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

async function enterRecallFromReturnedPage(
  returnedPage: HomePage | OrderDishesPage | RecallPage,
): Promise<RecallPage> {
  if (returnedPage instanceof RecallPage) {
    return returnedPage;
  }

  if (returnedPage instanceof OrderDishesPage) {
    return await returnedPage.clickRecall();
  }

  return await returnedPage.enterRecall();
}

async function readTargetTips(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<number> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();

  return priceSummary.Tips ?? 0;
}

test.describe('堂食分单 Tips 保留', () => {
  test.describe.configure({ timeout: 240_000 });

  test(
    '应能在支付一个子单并删除另一个子单后保持已支付子单 tips 不变',
    {
      tag: ['@e2e'],
      annotation: [jiraIssueAnnotation('POS-19362')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const orderDishesFlow = new OrderDishesFlow();
      const splitOrderFlow = new SplitOrderFlow();
      const recallFlow = new RecallFlow();
      const paymentFlow = new PaymentFlow();

      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        const loadedHomePage = await new HomeFlow().openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        await loadedHomePage.expectPrimaryFunctionCardsVisible();
        return loadedHomePage;
      });

      const orderDishesPage = await test.step('从堂食 New Order 进入点餐页', async () => {
        const selectTablePage = await readyHomePage.enterDineIn();
        const page = await selectTablePage.clickNewOrder();
        await page.expectLoaded();
        return page;
      });

      await test.step('添加两道菜并分别改价后添加母单 tips', async () => {
        await orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderDishesPage.clickAddLine();
        await orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );
        await orderDishesPage.changeOrderedDishPrice(
          orderServiceDishes.regular.name,
          orderServiceSplitTipsCase.changedDishPrice,
        );
        await orderDishesPage.changeOrderedDishPrice(
          orderServiceDishes.test.name,
          orderServiceSplitTipsCase.changedDishPrice,
        );
        await orderDishesPage.addTip(orderServiceSplitTipsCase.tipAmountInCents);

        const priceSummary = await orderDishesPage.readPriceSummary();
        expect(priceSummary.Tips).toBe(orderServiceSplitTipsCase.expectedTipAmount);
      });

      const recallPage = await test.step('按座位分单并进入 Recall', async () => {
        const splitOrderPage = await orderDishesPage.openSplitOrder();
        await splitOrderFlow.splitOrderBySeats(splitOrderPage);
        const returnedPage = await splitOrderFlow.submitAndReturnPage(splitOrderPage);
        return await enterRecallFromReturnedPage(returnedPage);
      });

      const { orderNumber, paidTargetOrderNumber, voidTargetOrderNumber, originalTip } =
        await test.step('读取分单后的两个子单号并确认第一个子单 tips', async () => {
          const latestOrderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
          await recallPage.openOrderDetails(latestOrderNumber);
          const targetOrderNumbers = await recallPage.readTargetOrderNumbers(latestOrderNumber);
          expect(targetOrderNumbers.length).toBeGreaterThanOrEqual(2);

          const [firstTargetOrderNumber, secondTargetOrderNumber] = targetOrderNumbers;
          expect(firstTargetOrderNumber).toBeTruthy();
          expect(secondTargetOrderNumber).toBeTruthy();

          const targetTip = await readTargetTips(
            recallPage,
            latestOrderNumber,
            firstTargetOrderNumber,
          );
          expect(targetTip).toBeGreaterThan(0);

          return {
            orderNumber: latestOrderNumber,
            paidTargetOrderNumber: firstTargetOrderNumber,
            voidTargetOrderNumber: secondTargetOrderNumber,
            originalTip: targetTip,
          };
        });

      await test.step('支付第一个子单并回到 Recall 详情上下文', async () => {
        await recallPage.openOrderDetails(orderNumber, paidTargetOrderNumber);
        const paymentPage = await recallPage.openPayment();
        await paymentFlow.payByCash(paymentPage, { printReceipt: false });
        await recallPage.closeOrderDetailsDialog();
      });

      await test.step('删除另一个子单后回到已支付子单', async () => {
        await recallPage.openOrderDetails(orderNumber, voidTargetOrderNumber);
        await recallPage.voidCurrentOrderKeepingDetails({
          reason: orderServiceSplitTipsCase.voidReason,
          restoreInventory: true,
        });
        await recallPage.selectTargetOrder(paidTargetOrderNumber);
      });

      await test.step('确认已支付子单 tips 未被删除子单影响', async () => {
        const finalSummary = await recallPage.readDisplayedOrderPriceSummary();
        expect(finalSummary.Tips).toBe(originalTip);
        await recallPage.closeOrderDetailsDialog();
      });
    },
  );
});

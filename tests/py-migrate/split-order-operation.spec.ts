import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { test } from '../../fixtures/test.fixture';
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
import type { OrderDishesPage } from '../../pages/order-dishes.page';
import type { RecallPage } from '../../pages/recall.page';
import {
  orderServiceDishes,
  orderServiceSplitOperationCase,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

type AppEntryPages = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
};

type SplitOrderTargets = {
  orderNumber: string;
  firstTargetOrderNumber: string;
  secondTargetOrderNumber: string;
};

async function enterReadyHome({
  employeeLoginPage,
  homePage,
}: AppEntryPages): Promise<HomePage> {
  const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
  await readyHomePage.expectPrimaryFunctionCardsVisible();
  return readyHomePage;
}

async function enterDineInNoTableOrder(homePage: HomePage): Promise<OrderDishesPage> {
  const selectTablePage = await homePage.enterDineIn();
  const orderDishesPage = await new SelectTableFlow().skipTableSelectionAndEnterOrderDishes(selectTablePage);
  await orderDishesPage.expectLoaded();
  return orderDishesPage;
}

async function addTwoRegularDishes(orderDishesPage: OrderDishesPage): Promise<void> {
  const orderDishesFlow = new OrderDishesFlow();
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
}

async function enterRecallFromReturnedPage(
  returnedPage: HomePage | OrderDishesPage | RecallPage,
): Promise<RecallPage> {
  if ('openOrderDetails' in returnedPage) {
    return returnedPage;
  }

  return await returnedPage.clickRecall();
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

async function openLatestSplitOrderTargets(recallPage: RecallPage): Promise<SplitOrderTargets> {
  const recallFlow = new RecallFlow();
  const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
  await recallPage.openOrderDetails(orderNumber);
  const targetOrderNumbers = await recallPage.readTargetOrderNumbers(orderNumber);

  expect(targetOrderNumbers.length, 'Recall 详情应至少展示两个分单子单').toBeGreaterThanOrEqual(2);

  const [firstTargetOrderNumber, secondTargetOrderNumber] = targetOrderNumbers;
  expect(firstTargetOrderNumber, '第一个子单号应存在').toBeTruthy();
  expect(secondTargetOrderNumber, '第二个子单号应存在').toBeTruthy();

  return {
    firstTargetOrderNumber,
    orderNumber,
    secondTargetOrderNumber,
  };
}

async function payTargetOrderByCash(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<void> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const paymentPage = await recallPage.openPayment();
  await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
  await recallPage.closeOrderDetailsDialog();
}

test.describe('分单操作回归第一批', { tag: ['@点单', '@分单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-19362] 应能在支付一个子单并删除另一个子单后保持已支付子单 tips 不变',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19362')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const orderDishesPage = await test.step('从堂食无桌路径进入点单页并添加两道菜和小费', async () => {
        const page = await enterDineInNoTableOrder(readyHomePage);
        await addTwoRegularDishes(page);
        await page.addTip(orderServiceSplitOperationCase.tipAmountInCents);
        const priceSummary = await page.readPriceSummary();
        expect(priceSummary.Tips).toBe(orderServiceSplitOperationCase.tipAmount);
        return page;
      });

      const recallPage = await test.step('按座位分单并进入 Recall', async () => {
        const splitOrderPage = await orderDishesPage.openSplitOrder();
        await new SplitOrderFlow().splitOrderBySeats(splitOrderPage);
        const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
        return await enterRecallFromReturnedPage(returnedPage);
      });

      const targets = await test.step('记录两个子单号和已支付子单初始 tips', async () => {
        const splitTargets = await openLatestSplitOrderTargets(recallPage);
        const originalTip = await readTargetTips(
          recallPage,
          splitTargets.orderNumber,
          splitTargets.firstTargetOrderNumber,
        );
        expect(originalTip).toBeGreaterThan(0);
        return { ...splitTargets, originalTip };
      });

      await test.step('支付第一个子单并作废第二个子单', async () => {
        await payTargetOrderByCash(recallPage, targets.orderNumber, targets.firstTargetOrderNumber);
        await recallPage.openOrderDetails(targets.orderNumber, targets.secondTargetOrderNumber);
        await recallPage.voidCurrentOrderKeepingDetails({
          reason: orderServiceSplitOperationCase.voidReason,
          restoreInventory: true,
        });
      });

      await test.step('重新打开已支付子单并确认 tips 未变化', async () => {
        await recallPage.openOrderDetails(targets.orderNumber, targets.firstTargetOrderNumber);
        const finalSummary = await recallPage.readDisplayedOrderPriceSummary();
        expect(finalSummary.Tips).toBe(targets.originalTip);
        await recallPage.closeOrderDetailsDialog();
      });
    },
  );
});

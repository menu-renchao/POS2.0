import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { test } from '../../fixtures/test.fixture';
import type { SystemConfigurationApiClient } from '../../api/clients/system-configuration-api.client';
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
import type { OrderDishesPage } from '../../pages/order-dishes.page';
import type { RecallPage } from '../../pages/recall.page';
import {
  orderServiceDishes,
  orderServiceSeatDisplayConfigurationUpdate,
  orderServiceSplitOperationCase,
} from '../../test-data/order-service';
import { expectOkEnvelope } from '../../api/setup/setup-resource';
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

type SplitOrderTargetsWithRecallPage = SplitOrderTargets & {
  recallPage: RecallPage;
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
  const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(homePage);
  await orderDishesPage.expectLoaded();
  return orderDishesPage;
}

async function enableSeatDisplayOnHome(
  systemConfigurationApi: SystemConfigurationApiClient,
  homePage: HomePage,
): Promise<void> {
  await expectOkEnvelope(
    await systemConfigurationApi.updateSystemConfigurations(
      orderServiceSeatDisplayConfigurationUpdate,
    ),
  );
  await homePage.clickRefresh();
}

async function addTwoRegularDishes(orderDishesPage: OrderDishesPage): Promise<void> {
  const orderDishesFlow = new OrderDishesFlow();
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.test.name,
    orderServiceDishes.test.menu,
  );
}

async function addSharedAndSeatDishes(orderDishesPage: OrderDishesPage): Promise<void> {
  const orderDishesFlow = new OrderDishesFlow();
  await orderDishesPage.changeGuestCount(2);
  await orderDishesPage.selectSharedSeat();
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await orderDishesPage.selectSeat(1);
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.test.name,
    orderServiceDishes.test.menu,
  );
}

async function createSeatSplitRecallOrder(
  readyHomePage: HomePage,
  options: { addTip?: boolean; tipAmountInCents?: number } = {},
): Promise<{ recallPage: RecallPage; targets: SplitOrderTargets }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await addSharedAndSeatDishes(orderDishesPage);

  if (options.addTip || options.tipAmountInCents !== undefined) {
    await orderDishesPage.addTip(
      options.tipAmountInCents ?? orderServiceSplitOperationCase.tipAmountInCents,
    );
  }

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  await new SplitOrderFlow().splitOrderBySeats(splitOrderPage);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);
  return { recallPage, targets };
}

async function createAmountSplitRecallOrder(
  readyHomePage: HomePage,
): Promise<{ recallPage: RecallPage; targets: SplitOrderTargets }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await addTwoRegularDishes(orderDishesPage);
  await orderDishesPage.addTip(orderServiceSplitOperationCase.tipAmountInCents);

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  const beforeSplitSnapshot = await splitOrderPage.readSnapshot();
  const totalBeforeSplit = Number(beforeSplitSnapshot.total);
  expect(totalBeforeSplit, '按金额分单前应能读取订单总额。').toBeGreaterThan(0);

  const firstAmount = orderServiceSplitOperationCase.amountSplitFirstAmount;
  const secondAmount = Number((totalBeforeSplit - firstAmount).toFixed(2));
  await new SplitOrderFlow().splitOrderByAmounts(splitOrderPage, [firstAmount, secondAmount]);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);
  return { recallPage, targets };
}

async function createEvenSplitRecallOrder(
  readyHomePage: HomePage,
): Promise<{ recallPage: RecallPage; targets: SplitOrderTargets }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await addTwoRegularDishes(orderDishesPage);
  await orderDishesPage.addTip(orderServiceSplitOperationCase.tipAmountInCents);

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);
  return { recallPage, targets };
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

async function readTargetTotal(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<number> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();
  return priceSummary.Total ?? priceSummary['Total(Cash)'] ?? 0;
}

async function openLatestSplitOrderTargets(recallPage: RecallPage): Promise<SplitOrderTargets> {
  const recallFlow = new RecallFlow();
  const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
  await recallPage.openOrderDetails(orderNumber);
  const targetOrderNumbers = await recallPage.readTargetOrderNumbers(orderNumber);

  expect(targetOrderNumbers.length, 'Recall 详情应至少展示两个分单子单。').toBeGreaterThanOrEqual(2);

  const [firstTargetOrderNumber, secondTargetOrderNumber] = targetOrderNumbers;
  expect(firstTargetOrderNumber, '第一个子单号应存在。').toBeTruthy();
  expect(secondTargetOrderNumber, '第二个子单号应存在。').toBeTruthy();

  return {
    firstTargetOrderNumber,
    orderNumber,
    secondTargetOrderNumber,
  };
}

async function createMultiAmountSplitRecallOrder(
  readyHomePage: HomePage,
): Promise<{
  beforeTotal: number;
  recallPage: RecallPage;
  targets: SplitOrderTargets;
}> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await orderDishesPage.changeOrderedDishPrice(
    orderServiceDishes.regular.name,
    orderServiceSplitOperationCase.multiAmountSplitChangedDishPrice,
  );
  const beforeSummary = await orderDishesPage.readPriceSummary();
  const beforeTotal = beforeSummary['Total(Cash)'];
  expect(beforeTotal).toBeCloseTo(orderServiceSplitOperationCase.multiAmountExpectedTotal, 2);

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  await new SplitOrderFlow().splitOrderByAmounts(splitOrderPage, [
    orderServiceSplitOperationCase.multiAmountFirstSplitAmount,
    orderServiceSplitOperationCase.multiAmountSecondSplitAmount,
  ]);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);

  return {
    beforeTotal,
    recallPage,
    targets,
  };
}

async function createSavedRecallOrder(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{ orderNumber: string; recallPage: RecallPage }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
  return { orderNumber, recallPage };
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

async function payTargetOrderByPartialCash(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<void> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const paymentPage = await recallPage.openPayment();
  await new PaymentFlow().payPartialByCash(paymentPage, {
    amountInCents: orderServiceSplitOperationCase.partialPaymentAmountInCents,
    printReceipt: false,
  });
  await recallPage.closeOrderDetailsDialog();
}

async function createMultiPaymentRecallOrder(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{ orderNumber: string; paidAmounts: number[]; recallPage: RecallPage }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await orderDishesPage.changeOrderedDishPrice(
    orderServiceDishes.regular.name,
    orderServiceSplitOperationCase.multiPaymentChangedDishPrice,
  );
  await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
  const priceSummary = await orderDishesPage.readPriceSummary();
  expect(priceSummary.Tax).toBe(0);
  expect(priceSummary['Total(Cash)']).toBe(orderServiceSplitOperationCase.multiPaymentChangedDishPrice);

  const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
  const paymentPage = await new RecallFlow().openPayment(recallPage, orderNumber);
  const paymentFlow = new PaymentFlow();
  await paymentFlow.payPartialByCash(paymentPage, {
    amountInCents: orderServiceSplitOperationCase.multiPaymentAmountInCents,
    printReceipt: false,
  });
  await recallPage.closeOrderDetailsDialog();
  const remainingPaymentPage = await new RecallFlow().openPayment(recallPage, orderNumber);
  await paymentFlow.payByCreditCard(remainingPaymentPage, { printReceipt: false });
  await recallPage.closeOrderDetailsDialog();

  await recallPage.openOrderDetails(orderNumber);
  const paidAmounts = (await recallPage.readOrderPaymentAmounts()).filter((amount) => amount > 0);
  await recallPage.closeOrderDetailsDialog();

  expect(paidAmounts).toHaveLength(2);
  return { orderNumber, paidAmounts, recallPage };
}

async function saveEditingOrderAndOpenRecall(
  orderDishesPage: OrderDishesPage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<RecallPage> {
  const savedHomePage = await orderDishesPage.saveOrder();
  const readyHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
    savedHomePage,
    employeeLoginPage,
  );
  return await new RecallFlow().openRecallFromHome(readyHomePage);
}

test.describe('分单操作回归第一批', { tag: ['@点单', '@分单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-19365] 应能在共享菜已支付后阻止作废另一子单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19365')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      test.fail(
        true,
        '当前产品未对“已支付共享菜后作废另一子单”返回 POS-19365 预期阻断提示，保留用例作为预期失败覆盖。',
      );

      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const { recallPage, targets } = await test.step('创建包含共享菜的座位分单并支付第一个子单', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, { addTip: true });
        await payTargetOrderByCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return context;
      });

      await test.step('尝试作废另一个包含共享菜的子单并校验阻断提示', async () => {
        const blockingMessage = await new RecallFlow().attemptVoidOrder(
          recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
          {
            reason: orderServiceSplitOperationCase.voidReason,
            restoreInventory: true,
          },
        );

        expect(blockingMessage).toContain(orderServiceSplitOperationCase.sharedItemVoidBlockingMessage);
      });
    },
  );

  test(
    '[POS-19368] 应能修改一个子单 tips 且另一个子单 tips 保持不变',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19368')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const tipsBeforeEdit = await test.step('记录两个子单修改前 tips', async () => {
        const { recallPage, targets } = await createSeatSplitRecallOrder(readyHomePage, {
          addTip: true,
        });
        return {
          ...targets,
          recallPage,
          firstTipBefore: await readTargetTips(recallPage, targets.orderNumber, targets.firstTargetOrderNumber),
          secondTipBefore: await readTargetTips(recallPage, targets.orderNumber, targets.secondTargetOrderNumber),
        };
      });

      await test.step('只修改第一个子单 tips', async () => {
        await new RecallFlow().addOrderDetailsTip(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.firstTargetOrderNumber,
          orderServiceSplitOperationCase.updatedTipAmountInCents,
        );
      });

      await test.step('校验第一个子单 tips 更新且第二个子单 tips 不变', async () => {
        const firstTipAfter = await readTargetTips(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.firstTargetOrderNumber,
        );
        const secondTipAfter = await readTargetTips(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.secondTargetOrderNumber,
        );

        expect(firstTipAfter).toBe(orderServiceSplitOperationCase.updatedTipAmount);
        expect(secondTipAfter).toBe(tipsBeforeEdit.secondTipBefore);
        expect(tipsBeforeEdit.firstTipBefore).not.toBe(firstTipAfter);
      });
    },
  );
  test(
    '[POS-19371] 应能在半支付状态阻止撤销分单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19371')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      test.fail(
        true,
        '当前产品在半支付座位分单点击 Unsplit 后未返回 POS-19371 预期阻断提示，保留用例作为预期失败覆盖。',
      );

      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('读取子单号并支付第一个子单', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, { addTip: true });
        await payTargetOrderByCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return {
          ...context.targets,
          recallPage: context.recallPage,
        };
      });

      await test.step('从 Recall 重新进入分单并尝试撤销分单', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        const splitOrderFlow = new SplitOrderFlow();
        await splitOrderFlow.cancelSplit(splitOrderPage);
        const blockingMessage = await splitOrderFlow.readBlockingMessage(splitOrderPage);

        expect(blockingMessage).toContain(orderServiceSplitOperationCase.splitHalfPaidBlockingMessage);
      });
    },
  );

  test(
    '[POS-19374] 应能在按金额分单半支付后保持分单状态',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19374')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const targets = await test.step('创建按金额分单订单并现金半支付第一个子单', async () => {
        const context = await createAmountSplitRecallOrder(readyHomePage);
        await payTargetOrderByPartialCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return {
          ...context.targets,
          recallPage: context.recallPage,
        };
      });

      await test.step('重新进入分单尝试撤销后校验仍处于半支付分单状态', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);

        const panelText = await splitOrderPage.readPanelText();
        const snapshot = await splitOrderPage.readSnapshot();
        expect(panelText).toContain('Semi-Paid');
        expect(panelText).toMatch(/Split into\s*2\s*orders/i);
        expect(snapshot.suborders).toHaveLength(2);
      });
    },
  );

  test(
    '[POS-19377] 应能撤销未支付的按金额分单',
    {
      annotation: [jiraIssueAnnotation('POS-19377')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const { recallPage, targets } = await test.step('创建未支付的按金额分单订单', async () => {
        return await createAmountSplitRecallOrder(readyHomePage);
      });

      await test.step('重新进入分单并撤销分单', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);
        const afterCancelSnapshot = await splitOrderPage.readSnapshot();

        expect(afterCancelSnapshot.suborders.length).toBeLessThan(2);
        await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
      });
    },
  );

  test(
    '[POS-19380] 应能在按金额分单半支付后阻止撤销分单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19380')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const targets = await test.step('创建按金额分单订单并部分支付第一个子单', async () => {
        const context = await createAmountSplitRecallOrder(readyHomePage);
        await payTargetOrderByPartialCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return {
          ...context.targets,
          recallPage: context.recallPage,
        };
      });

      await test.step('重新进入分单后尝试撤销并校验阻断提示', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);
        const blockingMessage = await new SplitOrderFlow().readBlockingMessage(splitOrderPage);

        expect(blockingMessage).toContain(orderServiceSplitOperationCase.splitHalfPaidBlockingMessage);
      });
    },
  );

  test(
    '[POS-19383] 应能平分后修改子单 tips 再撤销分单并校验 tips',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19383')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const targets = await test.step('创建平分订单并修改第一个子单 tips', async () => {
        const context = await createEvenSplitRecallOrder(readyHomePage);
        await new RecallFlow().addOrderDetailsTip(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
          orderServiceSplitOperationCase.updatedTipAmountInCents,
        );
        return {
          ...context.targets,
          recallPage: context.recallPage,
        };
      });

      const recallPageAfterUnsplit = await test.step('重新进入分单撤销分单并保存', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);
        const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
        return await enterRecallFromReturnedPage(returnedPage);
      });

      await test.step('校验撤销分单后的订单 tips', async () => {
        await recallPageAfterUnsplit.openOrderDetails(targets.orderNumber);
        const priceSummary = await recallPageAfterUnsplit.readDisplayedOrderPriceSummary();
        expect(priceSummary.Tips).toBe(orderServiceSplitOperationCase.evenSplitUnsplitExpectedTip);
      });
    },
  );

  test(
    '[POS-19386] 应能在座位分单子单减菜后按 subtotal 重算 tips',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19386')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('创建带 6 元 tips 的座位分单并记录第一个子单 tips', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, {
          tipAmountInCents: orderServiceSplitOperationCase.redistributedTipAmountInCents,
        });
        const firstTipBefore = await readTargetTips(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        expect(firstTipBefore).toBeGreaterThan(0);
        return {
          ...context.targets,
          recallPage: context.recallPage,
          firstTipBefore,
        };
      });

      const recallPageAfterSave = await test.step('编辑第一个子单减少座位菜品并保存', async () => {
        const editingPage = await new RecallFlow().editOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        await editingPage.reduceOrderedDishQuantity(orderServiceDishes.test.name, 1);
        return await saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
      });

      await test.step('校验两个子单 tips 均按 subtotal 重算为 3 元', async () => {
        const firstTipAfter = await readTargetTips(
          recallPageAfterSave,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        const secondTipAfter = await readTargetTips(
          recallPageAfterSave,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );

        expect(firstTipAfter).toBe(orderServiceSplitOperationCase.redistributedTipAfter);
        expect(secondTipAfter).toBe(orderServiceSplitOperationCase.redistributedTipAfter);
      });
    },
  );

  test(
    '[POS-19389] 应能在座位分单子单折扣后按 subtotal 重算 tips',
    {
      tag: ['@小费', '@加收'],
      annotation: [jiraIssueAnnotation('POS-19389')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('创建带 6 元 tips 的座位分单并记录第一个子单 tips', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, {
          tipAmountInCents: orderServiceSplitOperationCase.redistributedTipAmountInCents,
        });
        const firstTipBefore = await readTargetTips(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        expect(firstTipBefore).toBeGreaterThan(0);
        return {
          ...context.targets,
          recallPage: context.recallPage,
          firstTipBefore,
        };
      });

      const recallPageAfterSave = await test.step('编辑第一个子单添加 5 元菜品折扣并保存', async () => {
        const editingPage = await new RecallFlow().editOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        await new OrderDishesFlow().applyCustomCharge(editingPage, {
          dishNames: [orderServiceDishes.test.name],
          scope: 'item',
          type: 'fixed',
          value: -orderServiceSplitOperationCase.itemDiscountAmount,
        });
        return await saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
      });

      await test.step('校验两个子单 tips 均按 subtotal 重算为 3 元', async () => {
        const firstTipAfter = await readTargetTips(
          recallPageAfterSave,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        const secondTipAfter = await readTargetTips(
          recallPageAfterSave,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );

        expect(firstTipAfter).toBe(orderServiceSplitOperationCase.redistributedTipAfter);
        expect(secondTipAfter).toBe(orderServiceSplitOperationCase.redistributedTipAfter);
      });
    },
  );

  test(
    '[POS-19517] 应能对多笔支付流水分别退款并生成对应负向流水',
    {
      tag: ['@信用卡支付', '@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19517')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const paidOrder = await test.step('创建免税改价订单并完成现金与信用卡两笔支付', async () => {
        return await createMultiPaymentRecallOrder(readyHomePage, employeeLoginPage);
      });

      const refundAmounts = await test.step('对两笔支付流水发起退款并读取退款流水金额', async () => {
        await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
        await new RecallFlow().refundAllPaymentRecords(paidOrder.recallPage);
        const allAmounts = await paidOrder.recallPage.readOrderPaymentAmounts();
        await paidOrder.recallPage.closeOrderDetailsDialog();
        return allAmounts.filter((amount) => amount < 0);
      });

      await test.step('校验退款流水金额分别等于原支付流水金额的负数', async () => {
        expect(refundAmounts).toHaveLength(paidOrder.paidAmounts.length);
        expect(refundAmounts[0]).toBe(-paidOrder.paidAmounts[0]);
        expect(refundAmounts[1]).toBe(-paidOrder.paidAmounts[1]);
      });
    },
  );

  test(
    '[POS-21845] 应能按多个金额拆分订单并在 Recall 保持子单总额',
    {
      tag: ['@分单'],
      annotation: [jiraIssueAnnotation('POS-21845')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const splitOrder = await test.step('创建改价订单并按 10 元和 10 元拆分', async () => {
        return await createMultiAmountSplitRecallOrder(readyHomePage);
      });

      const afterTotals = await test.step('在 Recall 读取两个子单总额', async () => {
        const firstTotal = await readTargetTotal(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        const secondTotal = await readTargetTotal(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.secondTargetOrderNumber,
        );

        return [firstTotal, secondTotal] as const;
      });

      await test.step('校验拆分后子单总额之和等于拆分前总额且为 20 元', async () => {
        const afterTotal = Number((afterTotals[0] + afterTotals[1]).toFixed(2));

        expect(afterTotal).toBeCloseTo(splitOrder.beforeTotal, 2);
        expect(afterTotal).toBeCloseTo(orderServiceSplitOperationCase.multiAmountExpectedTotal, 2);
      });
    },
  );

  test(
    '[POS-21855] 应能在订单作废时展示 7 个作废原因',
    {
      annotation: [jiraIssueAnnotation('POS-21855')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const savedOrder = await test.step('创建并保存堂食订单后进入 Recall', async () => {
        return await createSavedRecallOrder(readyHomePage, employeeLoginPage);
      });

      const reasonCount = await test.step('打开最新订单的 Void 弹窗并读取作废原因数量', async () => {
        await savedOrder.recallPage.openOrderDetails(savedOrder.orderNumber);
        return await savedOrder.recallPage.readVoidReasonCount();
      });

      await test.step('校验作废原因数量为 7', async () => {
        expect(reasonCount).toBe(orderServiceSplitOperationCase.voidReasonCount);
      });
    },
  );
});

import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import type { RecallPage } from '../../pages/recall.page';
import {
  orderServiceDishes,
  orderServiceSplitOperationCase,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';
import { annotateKnownProductFailure } from '../../utils/test-annotation';

test.describe('分单核心操作回归', { tag: ['@点单', '@分单', '@ui-exclusive-config'] }, () => {
  test.describe.configure({ timeout: 180_000 });

test(
    '[POS-19365] 应能在共享菜已支付后阻止作废另一子单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19365')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      annotateKnownProductFailure(
        '当前产品未对“已支付共享菜后作废另一子单”返回 POS-19365 预期阻断提示，用例保持普通 Failed。',
      );

      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        await flows.splitOrderOperationFlow.enableSeatDisplayOnHome(page);
        return page;
      });

      const { recallPage, targets } = await test.step('创建包含共享菜的座位分单并支付第一个子单', async () => {
        const context =
          await flows.splitOrderOperationFlow.createSeatSplitRecallOrder(
            readyHomePage,
            { addTip: true },
          );
        await flows.splitOrderOperationFlow.payTargetOrderByCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return context;
      });

      await test.step('尝试作废另一个包含共享菜的子单并校验阻断提示', async () => {
        const blockingMessage = await flows.recallFlow.attemptVoidOrder(
          recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
          {
            reason: orderServiceSplitOperationCase.voidReason,
            restoreInventory: true,
          },
        );

        expect(
          blockingMessage,
          '已支付共享菜后作废另一子单应返回阻断提示',
        ).not.toBeNull();
        expect(blockingMessage!).toContain(
          orderServiceSplitOperationCase.sharedItemVoidBlockingMessage,
        );
      });
    },
  );

test(
    '[POS-19368] 应能修改一个子单 tips 且另一个子单 tips 保持不变',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19368')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        await flows.splitOrderOperationFlow.enableSeatDisplayOnHome(page);
        return page;
      });

      const tipsBeforeEdit = await test.step('记录两个子单修改前 tips', async () => {
        const { recallPage, targets } =
          await flows.splitOrderOperationFlow.createSeatSplitRecallOrder(
            readyHomePage,
            { addTip: true },
          );
        return {
          ...targets,
          recallPage,
          firstTipBefore: await flows.orderRegressionFlow.readTargetTips(recallPage, targets.orderNumber, targets.firstTargetOrderNumber),
          secondTipBefore: await flows.orderRegressionFlow.readTargetTips(recallPage, targets.orderNumber, targets.secondTargetOrderNumber),
        };
      });

      await test.step('只修改第一个子单 tips', async () => {
        await flows.recallFlow.addOrderDetailsTip(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.firstTargetOrderNumber,
          orderServiceSplitOperationCase.updatedTipAmountInCents,
        );
      });

      await test.step('校验第一个子单 tips 更新且第二个子单 tips 不变', async () => {
        const firstTipAfter = await flows.orderRegressionFlow.readTargetTips(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.firstTargetOrderNumber,
        );
        const secondTipAfter = await flows.orderRegressionFlow.readTargetTips(
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
    async ({ flows, homePage, employeeLoginPage }) => {
      annotateKnownProductFailure(
        '当前产品在半支付座位分单点击 Unsplit 后未返回 POS-19371 预期阻断提示，用例保持普通 Failed。',
      );

      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        await flows.splitOrderOperationFlow.enableSeatDisplayOnHome(page);
        return page;
      });

      const targets = await test.step('读取子单号并支付第一个子单', async () => {
        const context =
          await flows.splitOrderOperationFlow.createSeatSplitRecallOrder(
            readyHomePage,
            { addTip: true },
          );
        await flows.splitOrderOperationFlow.payTargetOrderByCash(
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
        const splitOrderPage = await flows.recallFlow.openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        const splitOrderFlow = flows.splitOrderFlow;
        await splitOrderFlow.cancelSplit(splitOrderPage);
        const blockingMessage = await splitOrderFlow.readBlockingMessage(splitOrderPage);

        expect(
          blockingMessage,
          '半支付座位分单撤销分单时应返回阻断提示',
        ).not.toBeNull();
        expect(blockingMessage!).toContain(
          orderServiceSplitOperationCase.splitHalfPaidBlockingMessage,
        );
      });
    },
  );

test(
    '[POS-19374] 应能在按金额分单半支付后保持分单状态',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19374')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const targets = await test.step('创建按金额分单订单并现金半支付第一个子单', async () => {
        const context =
          await flows.splitOrderOperationFlow.createAmountSplitRecallOrder(
            readyHomePage,
          );
        await flows.splitOrderOperationFlow.payTargetOrderByPartialCash(
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
        const splitOrderPage = await flows.recallFlow.openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await flows.splitOrderFlow.cancelSplit(splitOrderPage);

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
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const { recallPage, targets } = await test.step('创建未支付的按金额分单订单', async () => {
        return await flows.splitOrderOperationFlow.createAmountSplitRecallOrder(
          readyHomePage,
        );
      });

      await test.step('重新进入分单并撤销分单', async () => {
        const splitOrderPage = await flows.recallFlow.openSplitOrder(
          recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await flows.splitOrderFlow.cancelSplit(splitOrderPage);
        const afterCancelSnapshot = await splitOrderPage.readSnapshot();

        expect(afterCancelSnapshot.suborders.length).toBeLessThan(2);
        await flows.splitOrderFlow.submitAndReturnPage(splitOrderPage);
      });
    },
  );

test(
    '[POS-19380] 应能在按金额分单半支付后阻止撤销分单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19380')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const targets = await test.step('创建按金额分单订单并部分支付第一个子单', async () => {
        const context =
          await flows.splitOrderOperationFlow.createAmountSplitRecallOrder(
            readyHomePage,
          );
        await flows.splitOrderOperationFlow.payTargetOrderByPartialCash(
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
        const splitOrderPage = await flows.recallFlow.openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await splitOrderPage.clickCancelSplit();
        await splitOrderPage.confirmCurrentSplitPanel();

        const reopenedSplitOrderPage = await flows.recallFlow.openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        const blockingMessage = await reopenedSplitOrderPage.retryCancelSplitAndReadToast();

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
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const targets = await test.step('创建平分订单并修改第一个子单 tips', async () => {
        const context =
          await flows.splitOrderOperationFlow.createEvenSplitRecallOrder(
            readyHomePage,
          );
        await flows.recallFlow.addOrderDetailsTip(
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
        const splitOrderPage = await flows.recallFlow.openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        await flows.splitOrderFlow.cancelSplit(splitOrderPage);
        const returnedPage = await flows.splitOrderFlow.submitAndReturnPage(splitOrderPage);
        return await flows.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
      });

      await test.step('校验撤销分单后的订单 tips', async () => {
        await recallPageAfterUnsplit.orderDetails.openOrderDetails(targets.orderNumber);
        const priceSummary = await recallPageAfterUnsplit.orderDetails.readDisplayedOrderPriceSummary();
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
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        await flows.splitOrderOperationFlow.enableSeatDisplayOnHome(page);
        return page;
      });

      const targets = await test.step('创建带 6 元 tips 的座位分单并记录第一个子单 tips', async () => {
        const context =
          await flows.splitOrderOperationFlow.createSeatSplitRecallOrder(
            readyHomePage,
            {
              tipAmountInCents:
                orderServiceSplitOperationCase.redistributedTipAmountInCents,
            },
          );
        const firstTipBefore = await flows.orderRegressionFlow.readTargetTips(
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
        const editingPage = await flows.recallFlow.editOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        await editingPage.menu.reduceOrderedDishQuantity(orderServiceDishes.test.name, 1);
        return await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
      });

      await test.step('校验两个子单 tips 均按 subtotal 重算为 3 元', async () => {
        const firstTipAfter = await flows.orderRegressionFlow.readTargetTips(
          recallPageAfterSave,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        const secondTipAfter = await flows.orderRegressionFlow.readTargetTips(
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
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        await flows.splitOrderOperationFlow.enableSeatDisplayOnHome(page);
        return page;
      });

      const targets = await test.step('创建带 6 元 tips 的座位分单并记录第一个子单 tips', async () => {
        const context =
          await flows.splitOrderOperationFlow.createSeatSplitRecallOrder(
            readyHomePage,
            {
              tipAmountInCents:
                orderServiceSplitOperationCase.redistributedTipAmountInCents,
            },
          );
        const firstTipBefore = await flows.orderRegressionFlow.readTargetTips(
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
        const editingPage = await flows.recallFlow.editOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        await flows.orderDishesFlow.applyCustomItemFixedDiscount(
          editingPage,
          [orderServiceDishes.test.name],
          orderServiceSplitOperationCase.itemDiscountAmount,
        );
        const discountName = `Charge($${orderServiceSplitOperationCase.itemDiscountAmount.toFixed(2)})`;
        await editingPage.reads.expectOrderedDishAddition(
          orderServiceDishes.test.name,
          discountName,
          `$${orderServiceSplitOperationCase.itemDiscountAmount.toFixed(2)}`,
        );
        return await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
      });

      await test.step('校验两个子单 tips 按 subtotal 比例分配且总额不变', async () => {
        const firstSummary = await flows.splitOrderScenarioFlow.readTargetPriceSummary(
          recallPageAfterSave,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        const secondSummary = await flows.splitOrderScenarioFlow.readTargetPriceSummary(
          recallPageAfterSave,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        const totalTip = orderServiceSplitOperationCase.redistributedTipAmountInCents / 100;
        const firstTipAfter = firstSummary.Tips ?? 0;
        const secondTipAfter = secondSummary.Tips ?? 0;

        expect(firstTipAfter).toBeGreaterThan(0);
        expect(secondTipAfter).toBeGreaterThan(0);
        expect(Math.sign(firstTipAfter - secondTipAfter)).toBe(
          Math.sign(firstSummary.Subtotal - secondSummary.Subtotal),
        );
        expect(firstTipAfter + secondTipAfter).toBe(totalTip);
      });
    },
  );

test(
    '[POS-19517] 应能对多笔支付流水分别退款并生成对应负向流水',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19517')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const paidOrder = await test.step('创建免税改价订单并完成两笔现金支付', async () => {
        return await flows.splitOrderOperationFlow.createMultiPaymentRecallOrder(
          readyHomePage,
          employeeLoginPage,
        );
      });

      const refundResult = await test.step('对两笔支付流水发起退款并读取退款流水金额', async () => {
        await paidOrder.recallPage.orderDetails.openOrderDetails(paidOrder.orderNumber);
        await flows.recallFlow.refundAllPaymentRecords(paidOrder.recallPage);
        const allAmounts = await paidOrder.recallPage.orderDetails.readOrderPaymentAmounts();
        await paidOrder.recallPage.orderDetails.closeOrderDetailsDialog();
        return {
          allAmounts,
          refundAmounts: allAmounts.filter((amount) => amount < 0),
        };
      });

      await test.step('校验退款流水金额分别等于原支付流水金额的负数', async () => {
        expect(
          refundResult.refundAmounts,
          `退款后读取到的全部支付流水金额：${refundResult.allAmounts.join(', ')}`,
        ).toHaveLength(paidOrder.paidAmounts.length);
        expect(refundResult.refundAmounts[0]).toBe(-paidOrder.paidAmounts[0]);
        expect(refundResult.refundAmounts[1]).toBe(-paidOrder.paidAmounts[1]);
      });
    },
  );

test(
    '[POS-21845] 应能按多个金额拆分订单并在 Recall 保持子单总额',
    {
      tag: ['@分单'],
      annotation: [jiraIssueAnnotation('POS-21845')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const splitOrder = await test.step('创建改价订单并按 10 元和 10 元拆分', async () => {
        return await flows.splitOrderOperationFlow.createMultiAmountSplitRecallOrder(
          readyHomePage,
        );
      });

      const afterTotals = await test.step('在 Recall 读取两个子单总额', async () => {
        const firstTotal =
          await flows.splitOrderOperationFlow.readTargetTotal(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        const secondTotal =
          await flows.splitOrderOperationFlow.readTargetTotal(
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
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const savedOrder = await test.step('创建并保存堂食订单后进入 Recall', async () => {
        return await flows.splitOrderScenarioFlow.createSavedRecallOrder(readyHomePage, employeeLoginPage);
      });

      const reasonCount = await test.step('打开最新订单的 Void 弹窗并读取作废原因数量', async () => {
        await savedOrder.recallPage.orderDetails.openOrderDetails(savedOrder.orderNumber);
        return await savedOrder.recallPage.voidDialog.readVoidReasonCount();
      });

      await test.step('校验作废原因数量为 7', async () => {
        expect(reasonCount).toBe(orderServiceSplitOperationCase.voidReasonCount);
      });
    },
  );

test(
    '[POS-22813] 应能在加收订单按菜分单并逐个清除子单加收后现金结清',
    {
      tag: ['@加收', '@分单', '@现金支付'],
      annotation: [jiraIssueAnnotation('POS-22813')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const splitOrder = await test.step('创建含整单加收的已送厨订单并按菜分单', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.splitOrderOperationFlow.addTwoRegularDishes(
          orderDishesPage,
        );
        await flows.orderDishesFlow.clearAllCharges(orderDishesPage, { scope: 'whole' });
        await flows.orderDishesFlow.applyCustomCharge(orderDishesPage, {
          scope: 'whole',
          taxed: true,
          type: 'percentage',
          value: orderServiceSplitOperationCase.orderChargeClearRate,
        });
        const recallPage = await flows.splitOrderScenarioFlow.sendEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
        const splitOrderPage = await flows.recallFlow.openSplitOrder(
          recallPage,
          orderNumber,
          undefined,
          { chargePromptAction: 'keep' },
        );
        await flows.splitOrderFlow.moveDishToNewSuborder(
          splitOrderPage,
          orderServiceDishes.test.name,
        );
        const returnedPage = await flows.splitOrderFlow.submitAndReturnPage(splitOrderPage);
        const recallPageAfterSplit = await flows.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
        const targets = await flows.splitOrderScenarioFlow.openLatestSplitOrderTargets(recallPageAfterSplit);
        return { recallPage: recallPageAfterSplit, targets };
      });

      const recallPageAfterPayment = await test.step('逐个编辑子单清空加收并现金结清', async () => {
        let currentRecallPage = splitOrder.recallPage;
        const targetOrderNumbers = [
          splitOrder.targets.firstTargetOrderNumber,
          splitOrder.targets.secondTargetOrderNumber,
        ];

        for (const targetOrderNumber of targetOrderNumbers) {
          const editingPage = await flows.recallFlow.editOrder(
            currentRecallPage,
            splitOrder.targets.orderNumber,
            targetOrderNumber,
          );
          await flows.orderDishesFlow.clearAllCharges(editingPage, { scope: 'whole' });
          const clearedChargeSnapshot = await flows.splitOrderScenarioFlow.readOrderDishesChargeSnapshot(editingPage);
          expect(clearedChargeSnapshot.wholeOrderCharges).toHaveLength(0);

          const paymentPage = await editingPage.navigation.openPayment();
          await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
          currentRecallPage = await readyHomePage.clickRecall();
        }

        return currentRecallPage;
      });

      const childCharges = await test.step('读取两个子单详情中的加收金额', async () => {
        await flows.recallFlow.clearSearchConditions(recallPageAfterPayment);
        const firstCharge = await flows.splitOrderScenarioFlow.readTargetCharge(
          recallPageAfterPayment,
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        const secondCharge = await flows.splitOrderScenarioFlow.readTargetCharge(
          recallPageAfterPayment,
          splitOrder.targets.orderNumber,
          splitOrder.targets.secondTargetOrderNumber,
        );

        return [firstCharge, secondCharge] as const;
      });

      await test.step('校验两个现金结清子单不再保留加收金额', async () => {
        expect(childCharges[0]).toBe(0);
        expect(childCharges[1]).toBe(0);
      });
    },
  );

test(
    '[POS-23204] 应能清空整单折扣并恢复订单总额',
    {
      tag: ['@点单'],
      annotation: [
        jiraIssueAnnotation('POS-23204'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const discountResult = await test.step('添加整单折扣后清空折扣并保存订单', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await flows.orderDishesFlow.applyCustomWholePercentageDiscount(
          orderDishesPage,
          orderServiceSplitOperationCase.orderDiscountClearRate,
        );
        const beforeClearSnapshot = await flows.splitOrderScenarioFlow.readOrderDishesChargeSnapshot(orderDishesPage);
        await flows.orderDishesFlow.clearAllCharges(orderDishesPage, { scope: 'whole' });
        const afterClearSnapshot = await flows.splitOrderScenarioFlow.readOrderDishesChargeSnapshot(orderDishesPage);
        await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);

        return { afterClearSnapshot, beforeClearSnapshot };
      });

      await test.step('校验整单折扣明细已清空', async () => {
        const expectedName = `Charge(${orderServiceSplitOperationCase.orderDiscountClearRate}%)`;
        expect(discountResult.beforeClearSnapshot.wholeOrderCharges.map((charge) => charge.name)).toContain(
          expectedName,
        );
        expect(discountResult.afterClearSnapshot.wholeOrderCharges.map((charge) => charge.name)).not.toContain(
          expectedName,
        );
      });
    },
  );

test(
    '[POS-23204] 应能清空菜品折扣并恢复订单总额',
    {
      tag: ['@点单'],
      annotation: [
        jiraIssueAnnotation('POS-23204'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const discountResult = await test.step('添加菜品折扣后清空折扣并保存订单', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await flows.orderDishesFlow.applyCustomItemPercentageDiscount(
          orderDishesPage,
          [orderServiceDishes.regular.name],
          orderServiceSplitOperationCase.itemDiscountRate,
        );
        const beforeClearItems = await orderDishesPage.reads.readOrderedItems();
        await flows.orderDishesFlow.clearAllCharges(orderDishesPage, {
          dishNames: [orderServiceDishes.regular.name],
          scope: 'item',
        });
        const afterClearItems = await orderDishesPage.reads.readOrderedItems();
        await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);

        return { afterClearItems, beforeClearItems };
      });

      await test.step('校验菜品折扣明细已清空', async () => {
        const expectedName = `Charge(${orderServiceSplitOperationCase.itemDiscountRate}%)`;
        const beforeClearNames = discountResult.beforeClearItems.flatMap((item) =>
          item.additions.map((addition) => addition.name),
        );
        const afterClearNames = discountResult.afterClearItems.flatMap((item) =>
          item.additions.map((addition) => addition.name),
        );

        expect(beforeClearNames).toContain(expectedName);
        expect(afterClearNames).not.toContain(expectedName);
      });
    },
  );

test(
    '[POS-23322] 应能在 Payment 页设置小费后部分现金支付并保持未付金额正确',
    {
      tag: ['@小费', '@现金支付'],
      annotation: [
        jiraIssueAnnotation('POS-23322'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const paymentContext = await test.step('创建免税订单并打开 Payment 页面', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderDishesPage.menu.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
  const recallPage = await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(
    orderDishesPage,
    employeeLoginPage,
  );
        const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
        const paymentPage = await flows.recallFlow.openPayment(recallPage, orderNumber);

        return { orderNumber, paymentPage, recallPage };
      });

      const balanceBeforePayment = await test.step('设置 5 元支付金额和 1 元 Tips 并校验支付前余额', async () => {
        await paymentContext.paymentPage.fillAmountTendered(
          orderServiceSplitOperationCase.tipAmountInCents,
        );
        await flows.paymentFlow.addTip(
          paymentContext.paymentPage,
          orderServiceSplitOperationCase.postPaymentTipAmountInCents,
        );
        await paymentContext.paymentPage.expectPaymentFlowText('Tips$1.00');
        const balanceDue = await paymentContext.paymentPage.readBalanceDue();
        expect(balanceDue).toBeGreaterThan(0);
        return balanceDue;
      });

      await test.step('现金支付 5 元并校验支付后余额', async () => {
        await flows.paymentFlow.payPartialByCashKeepingPaymentOpen(paymentContext.paymentPage, {
          amountInCents: orderServiceSplitOperationCase.tipAmountInCents,
          printReceipt: false,
        });
        expect(await paymentContext.paymentPage.readBalanceDue()).toBeCloseTo(
          balanceBeforePayment - orderServiceSplitOperationCase.tipAmountInCents / 100,
          2,
        );
      });

      await test.step('返回 Recall 并校验订单状态为 Semi-Paid', async () => {
        await paymentContext.paymentPage.closePaymentPanel();
        await paymentContext.recallPage.orderDetails.closeOrderDetailsDialog();
        await flows.recallFlow.clearSearchConditions(paymentContext.recallPage);
        await paymentContext.recallPage.orderDetails.openOrderDetails(paymentContext.orderNumber);
        const paymentStatus = await paymentContext.recallPage.orderDetails.readOrderPaymentStatus();
        expect(paymentStatus).toContain('Semi-Paid');
        await paymentContext.recallPage.orderDetails.closeOrderDetailsDialog();
      });
    },
  );

test(
    '[POS-24394] 应能复制带自定义调味的订单并保持总额不变',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-24394')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const savedOrder = await test.step('创建带自定义调味的堂食订单并保存', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const beforeTotal = (await orderDishesPage.reads.readPriceSummary())['Total(Cash)'];
        await flows.orderDishesFlow.addCustomModifier(orderDishesPage, {
          dishName: orderServiceDishes.regular.name,
          name: 'POS-24394',
        });
        const afterModifierTotal = (await orderDishesPage.reads.readPriceSummary())['Total(Cash)'];
        const recallPage = await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);

        return { afterModifierTotal, beforeTotal, orderNumber, recallPage };
      });

      const copiedOrderTotal = await test.step('从 Recall 复制订单并读取复制后总额', async () => {
        const copiedOrderPage = await flows.recallFlow.openCopyFromMore(
          savedOrder.recallPage,
          savedOrder.orderNumber,
        );
        return (await copiedOrderPage.reads.readPriceSummary())['Total(Cash)'];
      });

      await test.step('校验复制前后订单总额保持一致', async () => {
        expect(savedOrder.afterModifierTotal).toBeCloseTo(savedOrder.beforeTotal, 2);
        expect(copiedOrderTotal).toBeCloseTo(savedOrder.afterModifierTotal, 2);
      });
    },
  );

test(
    '[POS-23671] 应能合并不含税订单加收订单并保持合并总额等于原订单之和',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-23671')],
    },
    async ({ flows, homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const restoreCombineChargeRecalculation = await test.step(
        '关闭合单重新计算加收配置',
        async () => await flows.splitOrderScenarioFlow.configureCombineChargeRecalculation(false, readyHomePage),
      );

      try {
      const chargedOrders = await test.step('创建两笔免税且含不计税整单加收的订单', async () => {
        const orderNumbers: string[] = [];
        const totals: number[] = [];
        let recallPage: RecallPage | null = null;

        for (let index = 0; index < 2; index += 1) {
          const orderReadyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
          const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(orderReadyHomePage);
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await flows.orderDishesFlow.applyCustomCharge(orderDishesPage, {
            scope: 'whole',
            taxed: false,
            type: 'percentage',
            value: orderServiceSplitOperationCase.orderChargeMergeRate,
          });
          await orderDishesPage.menu.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
          totals.push((await orderDishesPage.reads.readPriceSummary())['Total(Cash)']);
          recallPage = await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
          orderNumbers.push(await flows.recallFlow.readLatestVisibleOrderNumber(recallPage));
        }

        expect(recallPage).not.toBeNull();
        return { orderNumbers, recallPage: recallPage!, totals };
      });

      await test.step('从 Recall 合并订单并校验合并后总额', async () => {
        const [sourceOrderNumber, targetOrderNumber] = chargedOrders.orderNumbers;
        expect(sourceOrderNumber).toBeTruthy();
        expect(targetOrderNumber).toBeTruthy();
        await flows.recallFlow.combineOrders(
          chargedOrders.recallPage,
          sourceOrderNumber,
          targetOrderNumber,
        );
        const mergedSummary = await chargedOrders.recallPage.orderDetails.readDisplayedOrderPriceSummary();
        const mergedTotal = mergedSummary.Total ?? mergedSummary['Total(Cash)'] ?? 0;
        expect(mergedTotal).toBeCloseTo(
          chargedOrders.totals.reduce((sum, total) => sum + total, 0),
          2,
        );
      });
      } finally {
        await test.step('恢复合单重新计算加收配置', restoreCombineChargeRecalculation);
      }
    },
  );

test(
    '[POS-23672] 应能合并计税订单加收订单并保持合并总额等于原订单之和',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-23672')],
    },
    async ({ flows, homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const restoreCombineChargeRecalculation = await test.step(
        '关闭合单重新计算加收配置',
        async () => await flows.splitOrderScenarioFlow.configureCombineChargeRecalculation(false, readyHomePage),
      );

      try {
      const chargedOrders = await test.step('创建两笔免税菜品且含计税整单加收的订单', async () => {
        const orderNumbers: string[] = [];
        const totals: number[] = [];
        let recallPage: RecallPage | null = null;

        for (let index = 0; index < 2; index += 1) {
          const orderReadyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
          const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(orderReadyHomePage);
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.menu.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
          await flows.orderDishesFlow.applyCustomCharge(orderDishesPage, {
            scope: 'whole',
            taxed: true,
            type: 'percentage',
            value: orderServiceSplitOperationCase.orderChargeMergeRate,
          });
          totals.push((await orderDishesPage.reads.readPriceSummary())['Total(Cash)']);
          recallPage = await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
          orderNumbers.push(await flows.recallFlow.readLatestVisibleOrderNumber(recallPage));
        }

        expect(recallPage).not.toBeNull();
        return { orderNumbers, recallPage: recallPage!, totals };
      });

      await test.step('从 Recall 合并订单并校验合并后总额', async () => {
        const [sourceOrderNumber, targetOrderNumber] = chargedOrders.orderNumbers;
        expect(sourceOrderNumber).toBeTruthy();
        expect(targetOrderNumber).toBeTruthy();
        await flows.recallFlow.combineOrders(
          chargedOrders.recallPage,
          sourceOrderNumber,
          targetOrderNumber,
        );
        const mergedSummary = await chargedOrders.recallPage.orderDetails.readDisplayedOrderPriceSummary();
        const mergedTotal = mergedSummary.Total ?? mergedSummary['Total(Cash)'] ?? 0;
        expect(mergedTotal).toBeCloseTo(
          chargedOrders.totals.reduce((sum, total) => sum + total, 0),
          2,
        );
      });
      } finally {
        await test.step('恢复合单重新计算加收配置', restoreCombineChargeRecalculation);
      }
    },
  );

test(
    '[POS-25235] 应能在 To Go 平分子单现金支付后追加 1 元小费',
    {
      tag: ['@分单', '@小费', '@现金支付'],
      annotation: [
        jiraIssueAnnotation('POS-25235'),
        {
          type: 'known-issue',
          description:
            'To Go 平分子单现金支付后执行追加 1 元小费，最终读取到的小费仍为 0，产品未保存追加小费。',
        },
      ],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const splitOrder = await test.step('创建 To Go 订单并平分为两个子单', async () => {
        return await flows.splitOrderOperationFlow.createToGoEvenSplitRecallOrder(
          readyHomePage,
        );
      });

      await test.step('使用现金结清两个子单', async () => {
        await flows.splitOrderOperationFlow.payTargetOrderByCash(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        await flows.splitOrderOperationFlow.payTargetOrderByCash(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.secondTargetOrderNumber,
        );
      });

      const paymentTip = await test.step('打开第一个已支付子单并在现金支付卡片追加 1 元小费', async () => {
        await flows.recallFlow.clearSearchConditions(splitOrder.recallPage);
        await splitOrder.recallPage.orderDetails.openOrderDetails(
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        await splitOrder.recallPage.orderDetails.addPaymentCardTip(
          orderServiceSplitOperationCase.postPaymentTipAmountInCents,
          'Cash',
        );
        await splitOrder.recallPage.orderDetails.closeOrderDetailsDialog();
        await splitOrder.recallPage.orderDetails.openOrderDetails(
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        const priceSummary = await splitOrder.recallPage.orderDetails.readDisplayedOrderPriceSummary();
        await splitOrder.recallPage.orderDetails.closeOrderDetailsDialog();
        return priceSummary.Tips ?? 0;
      });

      await test.step('校验追加后子单小费为 1 元', async () => {
        expect(paymentTip).toBeCloseTo(orderServiceSplitOperationCase.postPaymentTipAmount, 2);
      });
    },
  );

test(
    '[POS-30756] 应能在现金支付后追加小费并成功转服务员',
    {
      tag: ['@小费', '@现金支付'],
      annotation: [
        jiraIssueAnnotation('POS-30756'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const paidOrder = await test.step('创建堂食无桌台订单并使用现金全额结账', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const paymentPage = await orderDishesPage.navigation.openPayment();
        await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
        const recallPage = await readyHomePage.clickRecall();
        await flows.recallFlow.clearSearchConditions(recallPage);
        const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
        return { orderNumber, recallPage };
      });

      await test.step('现金支付完成后从订单详情追加一元小费', async () => {
        await paidOrder.recallPage.orderDetails.openOrderDetails(paidOrder.orderNumber);
        await paidOrder.recallPage.orderDetails.addPaymentCardTip(
          orderServiceSplitOperationCase.postPaymentTipAmountInCents,
          'Cash',
        );
      });

      const transferredSnapshot = await test.step('转移订单服务员后读取订单状态和金额快照', async () => {
        return await flows.splitOrderOperationFlow.transferOrderServerAndReadSnapshot(
          paidOrder.recallPage,
          orderServiceSplitOperationCase.transferredServerName,
        );
      });

      await test.step('校验订单支付状态和服务员切换结果', async () => {
        expect(transferredSnapshot.serverName).toBe(
          orderServiceSplitOperationCase.transferredServerName,
        );
        expect(transferredSnapshot.status).toBe('Success');
      });
    },
  );

test(
    '[POS-31301] 应能清空单菜折扣并保存',
    {
      tag: ['@折扣'],
      annotation: [
        jiraIssueAnnotation('POS-31301'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const discountOrder = await test.step('创建含单菜折扣的订单并保存', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await flows.orderDishesFlow.applyCustomItemPercentageDiscount(
          orderDishesPage,
          [orderServiceDishes.regular.name],
          orderServiceSplitOperationCase.itemDiscountRate,
        );
        const discountedItems = await orderDishesPage.reads.readOrderedItems();
        const recallPage = await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
        return { discountedItems, orderNumber };
      });

      const afterClearItems = await test.step('重新打开订单清空单菜折扣并保存', async () => {
        const editingPage = await flows.splitOrderScenarioFlow.editSavedOrderAfterConfigurationRefresh(homePage,
          employeeLoginPage,
          discountOrder.orderNumber,
        );
        await flows.orderDishesFlow.clearAllCharges(editingPage, {
          dishNames: [orderServiceDishes.regular.name],
          scope: 'item',
        });
        const items = await editingPage.reads.readOrderedItems();
        await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
        return items;
      });

      await test.step('校验清空单菜折扣后折扣明细消失', async () => {
        const discountAdditionNames = discountOrder.discountedItems.flatMap((item) =>
          item.additions.map((addition) => addition.name),
        );
        const afterClearAdditionNames = afterClearItems.flatMap((item) =>
          item.additions.map((addition) => addition.name),
        );

        expect(discountAdditionNames).toContain(
          `Charge(${orderServiceSplitOperationCase.itemDiscountRate}%)`,
        );
        expect(afterClearAdditionNames).not.toContain(
          `Charge(${orderServiceSplitOperationCase.itemDiscountRate}%)`,
        );
      });
    },
  );

test(
    '[POS-31081] 应能在自动加收计入小费后按金额分单并保持报表费用金额一致',
    {
      tag: ['@分单', '@加收', '@小费'],
      annotation: [jiraIssueAnnotation('POS-31081')],
    },
    async ({ flows, homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const chargeResource = await test.step('预置计入小费的自动加收配置并刷新 POS', async () => {
        const resource = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, {
          name: 'other_charge',
          orderType: 'dine in,delivery,pick up,to go',
          rate: 10,
          rateType: 1,
          sharedTip: true,
          triggerMode: 1,
          type: 'DEFAULT',
        });
        await readyHomePage.clickRefresh();
        return resource;
      });

      const reportFeeBefore = await test.step('读取下单前报表费用金额', async () => {
        return await flows.splitOrderOperationFlow.readReportFeeAmount(
          readyHomePage,
        );
      });

      const savedOrder = await test.step('创建自动加收订单并保存', async () => {
        return await flows.splitOrderScenarioFlow.createSavedOrderWithAutoCharge(readyHomePage, employeeLoginPage);
      });

      const reportFeeAfterOrder = await test.step('读取保存订单后的报表费用金额', async () => {
        return await flows.splitOrderOperationFlow.readReportFeeAmount(
          readyHomePage,
        );
      });

      await test.step('从 Recall 进入分单并按金额拆分订单', async () => {
        const splitOrderPage = await flows.recallFlow.openSplitOrder(
          savedOrder.recallPage,
          savedOrder.orderNumber,
        );
        await flows.splitOrderFlow.splitOrderByAmounts(splitOrderPage, [
          orderServiceSplitOperationCase.amountSplitFirstAmount,
        ]);
        await flows.splitOrderFlow.submitAndReturnPage(splitOrderPage);
      });

      const reportFeeAfterSplit = await test.step('读取按金额分单后的报表费用金额', async () => {
        return await flows.splitOrderOperationFlow.readReportFeeAmount(
          readyHomePage,
        );
      });

      await test.step('校验自动加收计入小费后的报表费用金额符合预期', async () => {
        expect(reportFeeAfterOrder).toBeCloseTo(reportFeeBefore + 10, 2);
        expect(reportFeeAfterSplit).toBeCloseTo(reportFeeAfterOrder, 2);
      });

      await test.step('清理后台加收配置并刷新 POS', async () => {
        await apiSetup.charge.delete(chargeResource.id);
        await readyHomePage.clickRefresh();
      });
    },
  );

test(
    '[POS-30566] 应能在现金支付订单退款后保持报表首页 unpaid 数值不变',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-30566')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const unpaidBefore = await test.step('读取现金支付前报表首页 unpaid 数值', async () => {
        return await flows.splitOrderOperationFlow.readReportHomeUnpaidAmount(
          readyHomePage,
        );
      });

      const paidOrder = await test.step('创建堂食无桌台订单并使用现金全额结账', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const paymentPage = await orderDishesPage.navigation.openPayment();
        await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
        const recallPage = await readyHomePage.clickRecall();
        const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
        return { orderNumber, recallPage };
      });

      await test.step('打开现金支付订单并退款所有正向支付流水', async () => {
        await paidOrder.recallPage.orderDetails.openOrderDetails(paidOrder.orderNumber);
        await flows.recallFlow.refundAllPaymentRecords(paidOrder.recallPage);
      });

      const unpaidAfterRefund = await test.step('读取现金退款后报表首页 unpaid 数值', async () => {
        return await flows.splitOrderOperationFlow.readReportHomeUnpaidAmount(
          readyHomePage,
        );
      });

      await test.step('校验现金退款前后报表首页 unpaid 数值不变', async () => {
        expect(unpaidAfterRefund).toBeCloseTo(unpaidBefore, 2);
      });
    },
  );

});

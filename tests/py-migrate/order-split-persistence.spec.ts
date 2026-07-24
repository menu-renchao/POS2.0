import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import type {
  SplitOrderPage,
  SplitOrderReturnPage,
  SplitOrderSnapshot,
} from '../../pages/split-order.page';
import {
  orderPageRegressionCases,
  orderServiceDishes,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

function suborderTotal(snapshot: SplitOrderSnapshot): number {
  return snapshot.suborders.reduce((sum, suborder) => sum + suborder.total, 0);
}

function expectUnpaidSuborders(snapshot: SplitOrderSnapshot): void {
  for (const suborder of snapshot.suborders) {
    expect(suborder.paidStatus, `子单 ${suborder.orderNumber} 应保持未支付状态`).toBeNull();
  }
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

test.describe('点单页面回归', { tag: ['@点单'] }, () => {
test.describe('持久化分单回归', { tag: ['@分单'] }, () => {
    test.describe.configure({ timeout: 180_000 });

    test(
      '[POS-16303] 应能保存 To Go 订单后从 Recall 平分两份并保持金额守恒',
      {
        annotation: [jiraIssueAnnotation('POS-16303')],
      },
      async ({ homePage, employeeLoginPage, flows }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });

        const orderPage = await test.step('创建 To Go 订单并添加普通菜', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(ready);
          await flows.orderDishesFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        const splitOrderPage = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return (
            await flows.orderRegressionFlow.saveAndOpenSplit(
              orderPage,
              employeeLoginPage,
            )
          ).splitOrderPage;
        });
        const splitFlow = flows.splitOrderFlow;
        const original = await test.step('读取平分前母单金额', async () => {
          return await splitOrderPage.readSnapshot();
        });

        await test.step('将订单平分为两个子单', async () => {
          await splitFlow.splitOrderEvenly(splitOrderPage, 2);
        });

        await test.step('校验两个未支付子单各为母单一半且金额总和守恒', async () => {
          const even = await splitOrderPage.readSnapshot();
          expect(even.suborders).toHaveLength(2);
          expectUnpaidSuborders(even);
          const originalTotalCents = toCents(original.total);
          for (const suborder of even.suborders) {
            expect(toCents(suborder.total) * 2).toBe(originalTotalCents);
          }
          expect(toCents(suborderTotal(even))).toBe(originalTotalCents);
          expect(toCents(even.total)).toBe(originalTotalCents);
        });

        await test.step('提交平分结果', async () => {
          await splitFlow.submitAndReturnPage(splitOrderPage);
        });
      },
    );

    test(
      '[POS-16324] 应能在分单页现金支付一个子单并查看两个子单状态',
      {
        annotation: [jiraIssueAnnotation('POS-16324')],
        tag: ['@现金支付'],
      },
      async ({ homePage, employeeLoginPage, flows }) => {
        test.setTimeout(90_000);
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });

        const splitOrderPage = await test.step('创建 To Go 订单并从点单页进入分单', async () => {
          const orderPage = await flows.takeoutFlow.startToGoOrder(ready);
          await flows.orderDishesFlow.addRegularDish(
            orderPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return await orderPage.navigation.openSplitOrder();
        });
        const splitFlow = flows.splitOrderFlow;

        await test.step('将普通菜1平分两份并把其中一份移入新子单', async () => {
          await splitFlow.evenSplitDishOnSuborder(splitOrderPage, {
            dishName: orderServiceDishes.regular.name,
            splitCount: 2,
            suborderIndex: '1',
          });
          await splitFlow.moveDishToNewSuborder(splitOrderPage, orderServiceDishes.regular.name);
        });

        await test.step('校验两个子单金额相等且总额守恒', async () => {
          const snapshot = await splitOrderPage.readSnapshot();
          expect(snapshot.suborders).toHaveLength(2);
          expectUnpaidSuborders(snapshot);
          expect(toCents(snapshot.suborders[0].total)).toBe(toCents(snapshot.suborders[1].total));
          expect(toCents(suborderTotal(snapshot))).toBe(toCents(snapshot.total));
        });
        await test.step('现金支付第一个子单并点击 NO RECEIPT 关闭支付成功页', async () => {
          const paymentPage = await splitOrderPage.openSuborderPayment(1);
          await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
          await splitOrderPage.expectLoaded();
        });

        await test.step('校验一个子单已支付且另一个子单仍未支付', async () => {
          const paidSnapshot = await splitOrderPage.readSnapshot();
          expect(paidSnapshot.suborders.filter((suborder) => suborder.paidStatus)).toHaveLength(1);
          expect(paidSnapshot.suborders.filter((suborder) => !suborder.paidStatus)).toHaveLength(1);
          expect(toCents(suborderTotal(paidSnapshot))).toBe(toCents(paidSnapshot.total));
        });
      },
    );

    test(
      '[POS-16314] 应能保存两道不同菜品后从 Recall 将普通菜2移入新子单',
      {
        annotation: [jiraIssueAnnotation('POS-16314')],
      },
      async ({ homePage, employeeLoginPage, flows }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });

        const orderPage = await test.step('创建 To Go 订单并添加两道不同菜品', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(ready);
          const orderFlow = flows.orderDishesFlow;
          await orderFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderFlow.addRegularDish(
            page,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );
          return page;
        });

        const splitOrderPage = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return (
            await flows.orderRegressionFlow.saveAndOpenSplit(
              orderPage,
              employeeLoginPage,
            )
          ).splitOrderPage;
        });
        const splitFlow = flows.splitOrderFlow;
        const beforeMove = await test.step('读取移动前源子单菜品归属', async () => {
          return await splitOrderPage.readSnapshot();
        });
        const sourceOrderNumber = beforeMove.suborders.find((suborder) =>
          suborder.dishes.some((dish) => dish.name === orderServiceDishes.test.name),
        )?.orderNumber;
        expect(sourceOrderNumber, '移动前应读取到同时包含普通菜2的源子单').toBeDefined();

        if (!sourceOrderNumber) {
          throw new Error('POS-16314 移动前未读取到普通菜2所在源子单。');
        }

        await test.step('将普通菜2移入新建子单', async () => {
          await splitFlow.moveDishToNewSuborder(splitOrderPage, orderServiceDishes.test.name);
        });

        await test.step('校验普通菜2从源子单移出并进入新子单且金额守恒', async () => {
          const moved = await splitOrderPage.readSnapshot();
          expect(moved.suborders).toHaveLength(2);
          expectUnpaidSuborders(moved);
          const sourceOrder = moved.suborders.find(
            (suborder) => suborder.orderNumber === sourceOrderNumber,
          );
          const targetOrder = moved.suborders.find(
            (suborder) => suborder.orderNumber !== sourceOrderNumber,
          );
          expect(sourceOrder, '移动后应保留原源子单').toBeDefined();
          expect(targetOrder, '移动后应创建目标子单').toBeDefined();
          expect(sourceOrder?.dishes.map((dish) => dish.name)).toContain(
            orderServiceDishes.regular.name,
          );
          expect(sourceOrder?.dishes.map((dish) => dish.name)).not.toContain(
            orderServiceDishes.test.name,
          );
          expect(targetOrder?.dishes.map((dish) => dish.name)).toContain(
            orderServiceDishes.test.name,
          );
          expect(toCents(suborderTotal(moved))).toBe(toCents(moved.total));
        });

        await test.step('提交按菜移动结果', async () => {
          await splitFlow.submitAndReturnPage(splitOrderPage);
        });
      },
    );

    test(
      '[POS-16316] 应能保存改价为 10.60 的订单后从 Recall 按 2 和 8.6 分单',
      {
        annotation: [
          jiraIssueAnnotation('POS-16316'),
          {
            type: 'known-issue',
            description:
              '按金额拆分已正确得到 2.00 和 8.60 两个未支付子单，但点击 Submit 后分单面板不关闭、页面不切换且无空子单确认，属于产品提交状态未流转。',
          },
        ],
      },
      async ({ homePage, employeeLoginPage, flows }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });

        const orderPage = await test.step('创建 To Go 订单并将普通菜1价格修改为 10.60', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(ready);
          await flows.orderDishesFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await page.menu.changeOrderedDishPrice(orderServiceDishes.regular.name, 10.6);
          return page;
        });

        const splitOrderPage = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return (
            await flows.orderRegressionFlow.saveAndOpenSplit(
              orderPage,
              employeeLoginPage,
            )
          ).splitOrderPage;
        });
        const splitFlow = flows.splitOrderFlow;

        await test.step('按金额 2 和 8.6 拆分订单', async () => {
          await splitFlow.splitOrderByAmounts(splitOrderPage, [2, 8.6]);
        });

        await test.step('校验两个未支付子单金额依次为 2 和 8.6', async () => {
          const amounts = await splitOrderPage.readSnapshot();
          expect(amounts.suborders.map((order) => order.total)).toEqual([2, 8.6]);
          expectUnpaidSuborders(amounts);
        });

        await test.step('提交按金额分单结果', async () => {
          await splitFlow.submitAndReturnPage(splitOrderPage);
        });
      },
    );

    test(
      '[POS-16318] 应能保存订单并提交平分后从 Recall 撤销分单恢复总额',
      {
        annotation: [jiraIssueAnnotation('POS-16318')],
      },
      async ({ homePage, employeeLoginPage, flows }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });

        const orderPage = await test.step('创建 To Go 订单并添加普通菜', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(ready);
          await flows.orderDishesFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        const persistedOrder = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return await flows.orderRegressionFlow.saveAndOpenSplit(
            orderPage,
            employeeLoginPage,
          );
        });
        const splitFlow = flows.splitOrderFlow;
        const original = await test.step('读取分单前订单总额', async () => {
          return (await persistedOrder.splitOrderPage.readSnapshot()).total;
        });

        await test.step('将订单平分两份并校验子单未支付后提交', async () => {
          await splitFlow.splitOrderEvenly(persistedOrder.splitOrderPage, 2);
          const even = await persistedOrder.splitOrderPage.readSnapshot();
          expect(even.suborders).toHaveLength(2);
          expectUnpaidSuborders(even);
          await splitFlow.submitAndReturnPage(persistedOrder.splitOrderPage);
        });

        const reopened = await test.step('从 Recall 重新打开已提交订单的分单页面', async () => {
          return await flows.recallFlow.openSplitOrder(
            persistedOrder.recallPage,
            persistedOrder.orderNumber,
          );
        });

        await test.step('撤销已提交的平分结果', async () => {
          await splitFlow.cancelSplit(reopened);
        });

        await test.step('校验撤销后恢复为一个未支付子单且订单总额不变', async () => {
          const restored = await reopened.readSnapshot();
          expect(restored.suborders).toHaveLength(1);
          expectUnpaidSuborders(restored);
          expect(toCents(restored.total)).toBe(toCents(original));
        });

        await test.step('提交撤销分单结果', async () => {
          await splitFlow.submitAndReturnPage(reopened);
        });
      },
    );

    test(
      '[POS-16315] 应能保存共享座位与座位一菜品后从 Recall 按座位分单',
      {
        annotation: [jiraIssueAnnotation('POS-16315')],
      },
      async ({ homePage, employeeLoginPage, flows }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });

        const orderPage = await test.step('选择任意空桌和两位客人并分别向共享座位与座位一添加菜品', async () => {
          const dineInEntryPage = await ready.enterDineInEntry();
          if (dineInEntryPage instanceof OrderDishesPage) {
            throw new Error('POS-16315 需要真实选桌入口，但当前环境直接进入了点单页。');
          }

          const { orderDishesPage } =
            await flows.selectTableFlow.selectAnyAvailableTableAndEnterOrderDishes(
              dineInEntryPage,
              orderPageRegressionCases.splitBySeats.guestCount,
            );
          const orderFlow = flows.orderDishesFlow;
          await orderDishesPage.menu.selectSharedSeat();
          await orderFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.menu.selectSeat(1);
          await orderFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );
          return orderDishesPage;
        });

        const persistedOrder = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return await flows.orderRegressionFlow.saveAndOpenSplit(
            orderPage,
            employeeLoginPage,
            { chargePromptAction: 'remove' },
          );
        });
        const { splitOrderPage } = persistedOrder;
        const splitFlow = flows.splitOrderFlow;
        let pendingSplitOrderPage: SplitOrderPage | undefined = splitOrderPage;
        let returnedPage: SplitOrderReturnPage | undefined;

        try {
          const original = await test.step('读取按座位分单前订单快照', async () => {
            return await splitOrderPage.readSnapshot();
          });

          await test.step('将订单按座位分为两个子单', async () => {
            await splitFlow.splitOrderBySeats(splitOrderPage);
          });

          await test.step('校验共享座位分摊且座位一菜品归属正确并保持金额守恒', async () => {
            const bySeats = await splitOrderPage.readSnapshot();
            expect(bySeats.suborders).toHaveLength(2);
            expectUnpaidSuborders(bySeats);
            const seatOneOrder = bySeats.suborders.find((suborder) =>
              suborder.seats.includes('Seat 1'),
            );
            const sharedOnlyOrder = bySeats.suborders.find(
              (suborder) =>
                suborder.seats.length === 1 && suborder.seats[0] === 'Shared',
            );
            expect(seatOneOrder, '按座位分单后应存在 Seat 1 子单').toBeDefined();
            expect(sharedOnlyOrder, '按座位分单后应存在仅含 Shared 的子单').toBeDefined();
            expect(seatOneOrder?.seats).toContain('Shared');
            expect(seatOneOrder?.dishes.map((dish) => dish.name)).toContain(
              orderServiceDishes.test.name,
            );
            expect(seatOneOrder?.dishes.map((dish) => dish.name)).toContain(
              orderServiceDishes.regular.name,
            );
            expect(sharedOnlyOrder?.dishes.map((dish) => dish.name)).not.toContain(
              orderServiceDishes.test.name,
            );
            expect(sharedOnlyOrder?.dishes.map((dish) => dish.name)).toContain(
              orderServiceDishes.regular.name,
            );
            expect(
              bySeats.suborders
                .flatMap((suborder) => suborder.dishes)
                .filter((dish) => dish.name === orderServiceDishes.regular.name)
                .map((dish) => dish.proportion),
            ).toEqual(['1/2', '1/2']);
            expect(toCents(suborderTotal(bySeats))).toBe(toCents(original.total));
          });

          await test.step('提交按座位分单结果', async () => {
            returnedPage = await splitFlow.submitAndReturnPage(splitOrderPage);
            pendingSplitOrderPage = undefined;
          });
        } finally {
          await test.step('尽量提交分单并按精确母单号作废本用例订单释放桌台', async () => {
            await flows.recallFlow.cleanupPersistedSplitOrder(
              ready,
              persistedOrder.recallPage,
              persistedOrder.orderNumber,
              pendingSplitOrderPage,
              returnedPage,
              { requireSplitChildren: true, reason: 'POS-16315 自动化清理' },
            );
          });
        }
      },
    );

    test(
      '[POS-39762] 应能平分含 2.00 小费的 To Go 订单后再合并并恢复母单小费',
      {
        tag: ['@小费'],
        annotation: [jiraIssueAnnotation('POS-39762')],
      },
      async ({ homePage, employeeLoginPage, flows }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });

        const orderPage = await test.step('创建 To Go 订单并添加普通菜和 2.00 小费', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(ready);
          await flows.orderDishesFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await page.tips.addTip(orderPageRegressionCases.splitTips.tipAmountInCents);
          return page;
        });

        const persistedOrder = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return await flows.orderRegressionFlow.saveAndOpenSplit(
            orderPage,
            employeeLoginPage,
            { chargePromptAction: 'keep' },
          );
        });
        const splitFlow = flows.splitOrderFlow;
        const childOrderNumbers = await test.step('平分为两个子单并读取全部子单号', async () => {
          await splitFlow.splitOrderEvenly(
            persistedOrder.splitOrderPage,
            orderPageRegressionCases.splitEvenly.count,
          );
          const split = await persistedOrder.splitOrderPage.readSnapshot();
          expect(split.suborders).toHaveLength(orderPageRegressionCases.splitEvenly.count);
          expectUnpaidSuborders(split);

          const orderNumbers = split.suborders.map((suborder) => suborder.orderNumber);
          expect(orderNumbers.every(Boolean), '平分后应读取到两个精确子单号').toBe(true);
          return orderNumbers;
        });

        await test.step('提交平分结果并在 Recall 校验两个子单小费各为 1.00 且合计 2.00', async () => {
          await splitFlow.submitAndReturnPage(persistedOrder.splitOrderPage);
          const childTipCents: number[] = [];

          for (const childOrderNumber of childOrderNumbers) {
            await persistedOrder.recallPage.orderDetails.openOrderDetails(
              persistedOrder.orderNumber,
              childOrderNumber,
            );
            const splitSummary = await persistedOrder.recallPage.orderDetails.readDisplayedOrderPriceSummary();
            await persistedOrder.recallPage.orderDetails.closeOrderDetailsDialog();
            childTipCents.push(toCents(splitSummary.Tips ?? 0));
          }

          expect(childTipCents).toEqual([
            toCents(orderPageRegressionCases.splitTips.splitTip),
            toCents(orderPageRegressionCases.splitTips.splitTip),
          ]);
          expect(childTipCents.reduce((sum, tip) => sum + tip, 0)).toBe(
            orderPageRegressionCases.splitTips.tipAmountInCents,
          );
        });

        await test.step('从 Recall 重新打开分单页面并合并两个子单', async () => {
          const reopened = await flows.recallFlow.openSplitOrder(
            persistedOrder.recallPage,
            persistedOrder.orderNumber,
          );
          await splitFlow.combineSuborders(reopened);
          await splitFlow.submitAndReturnPage(reopened);
        });

        await test.step('在 Recall 校验合并后母单小费恢复为 2.00', async () => {
          await persistedOrder.recallPage.orderDetails.openOrderDetails(persistedOrder.orderNumber);
          const mergedSummary = await persistedOrder.recallPage.orderDetails.readDisplayedOrderPriceSummary();
          await persistedOrder.recallPage.orderDetails.closeOrderDetailsDialog();
          expect(toCents(mergedSummary.Tips ?? 0)).toBe(
            toCents(orderPageRegressionCases.splitTips.mergedTip),
          );
        });
      },
    );

    test(
      '[POS-16325] 应能保存两人堂食两菜订单后从 Recall 对普通菜1执行 Even Item',
      {
        annotation: [jiraIssueAnnotation('POS-16325')],
      },
      async ({ homePage, employeeLoginPage, flows }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });

        const orderPage = await test.step('选择任意空桌和两位客人并添加两道菜', async () => {
          const selectTablePage = await ready.enterDineIn();
          const { orderDishesPage } =
            await flows.selectTableFlow.selectAnyAvailableTableAndEnterOrderDishes(
              selectTablePage,
              2,
            );
          const orderFlow = flows.orderDishesFlow;
          await orderFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );
          return orderDishesPage;
        });

        const persistedOrder = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return await flows.orderRegressionFlow.saveAndOpenSplit(
            orderPage,
            employeeLoginPage,
            { chargePromptAction: 'remove' },
          );
        });
        const { splitOrderPage } = persistedOrder;
        const splitFlow = flows.splitOrderFlow;
        let pendingSplitOrderPage: SplitOrderPage | undefined = splitOrderPage;
        let returnedPage: SplitOrderReturnPage | undefined;

        try {
          await test.step('在子单 1 将普通菜1按两份执行 Even Item', async () => {
            await splitFlow.evenSplitDishOnSuborder(splitOrderPage, {
              dishName: orderServiceDishes.regular.name,
              splitCount: 2,
              suborderIndex: '1',
            });
          });

          await test.step('校验普通菜1拆成两个二分之一且子单保持未支付', async () => {
            const items = await splitOrderPage.readSnapshot();
            expect(
              items.suborders
                .flatMap((order) => order.dishes)
                .filter((dish) => dish.name === orderServiceDishes.regular.name)
                .map((dish) => dish.proportion),
            ).toEqual(['1/2', '1/2']);
            expectUnpaidSuborders(items);
          });

          await test.step('提交按菜品平分结果', async () => {
            returnedPage = await splitFlow.submitAndReturnPage(splitOrderPage);
            pendingSplitOrderPage = undefined;
          });
        } finally {
          await test.step('尽量提交分单并按精确母单号作废本用例订单释放桌台', async () => {
            await flows.recallFlow.cleanupPersistedSplitOrder(
              ready,
              persistedOrder.recallPage,
              persistedOrder.orderNumber,
              pendingSplitOrderPage,
              returnedPage,
              { requireSplitChildren: false, reason: 'POS-16325 自动化清理' },
            );
          });
        }
      },
    );
  });
});

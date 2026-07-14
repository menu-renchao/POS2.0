import { expect } from '@playwright/test';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import type { SplitOrderSnapshot } from '../../pages/split-order.page';
import {
  orderPageRegressionCases,
  orderServiceDishes,
  orderServiceMenu,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

async function enterReadyHome(homePage: HomePage, employeeLoginPage: EmployeeLoginPage) {
  const ready = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
  await ready.expectPrimaryFunctionCardsVisible();
  return ready;
}

async function saveAndReadLatestRecallDetails(orderDishesPage: OrderDishesPage) {
  const homePage = await orderDishesPage.saveOrder();
  const recallPage = await new RecallFlow().openRecallFromHome(homePage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
  await recallPage.openOrderDetails(orderNumber);
  return { details: await recallPage.readOrderDetailsSnapshot(), orderNumber, recallPage };
}

async function saveAndOpenSplit(
  orderPage: OrderDishesPage,
  options?: Parameters<RecallFlow['openSplitOrder']>[3],
) {
  const homePage = await orderPage.saveOrder();
  const recallFlow = new RecallFlow();
  const recallPage = await recallFlow.openRecallFromHome(homePage);
  const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
  const splitOrderPage = await recallFlow.openSplitOrder(
    recallPage,
    orderNumber,
    undefined,
    options,
  );
  return { orderNumber, recallPage, splitOrderPage };
}

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
  test(
    '[POS-15602] 应能切换菜单组并保存目标组菜品',
    {
      annotation: [jiraIssueAnnotation('POS-15602')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome(homePage, employeeLoginPage);
      });

      const { orderPage, before, beforeSubtotal } = await test.step(
        '切换到目标菜单组并添加普通菜',
        async () => {
          const page = await new TakeoutFlow().startToGoOrder(ready);
          await page.switchMenu(orderServiceMenu.group, orderServiceMenu.category);
          expect(await page.readSelectedMenuGroupName()).toBe(orderServiceMenu.group);
          await page.clickDish(orderServiceDishes.regular.name);
          const orderedDish = (await page.readOrderedItems()).find(
            (item) => item.name === orderServiceDishes.regular.name,
          );
          const subtotal = (await page.readPriceSummary()).Subtotal;

          return { orderPage: page, before: orderedDish, beforeSubtotal: subtotal };
        },
      );

      await test.step('保存订单后在 Recall 校验目标菜品名称和价格', async () => {
        const { details } = await saveAndReadLatestRecallDetails(orderPage);
        const after = details.items.find(
          (item) => item.name === orderServiceDishes.regular.name,
        );

        expect(before, '点单页应读取到目标菜品').toBeDefined();
        expect(after, 'Recall 应读取到目标菜品').toBeDefined();

        if (!before || !after) {
          throw new Error('点单页和 Recall 均应读取到目标菜品。');
        }

        expect(after.name).toBe(before.name);
        expect(toCents(details.priceSummary.Subtotal)).toBe(toCents(beforeSubtotal));
      });
    },
  );

  test(
    '[POS-32905] 应能以整数原文展示累计菜品数量并保存',
    {
      annotation: [jiraIssueAnnotation('POS-32905')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome(homePage, employeeLoginPage);
      });

      const orderPage = await test.step('添加三份普通菜和一份测试菜', async () => {
        const page = await new TakeoutFlow().startToGoOrder(ready);
        await new OrderDishesFlow().addDishToCart(page, {
          ...orderServiceDishes.regular.menu,
          dishName: orderServiceDishes.regular.name,
          quantity: 3,
        });
        await new OrderDishesFlow().addRegularDish(
          page,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );

        return page;
      });

      await test.step('校验点单页 Count 以整数原文展示累计数量', async () => {
        expect(await orderPage.readCountText()).toBe('4');
      });

      await test.step('保存订单后在 Recall 校验两个菜品数量', async () => {
        const { details } = await saveAndReadLatestRecallDetails(orderPage);

        expect(
          details.items.find((item) => item.name === orderServiceDishes.regular.name)?.quantity,
        ).toBe('3');
        expect(
          details.items.find((item) => item.name === orderServiceDishes.test.name)?.quantity,
        ).toBe('1');
      });
    },
  );

  test.describe('折扣与备注回归', () => {
    test(
      '[POS-42888] 应能通过 Modify 添加备注并在 Recall 保留',
      {
        annotation: [jiraIssueAnnotation('POS-42888')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const { orderPage, dishName } = await test.step(
          '创建堂食无桌位订单并添加普通菜',
          async () => {
            const page = await new SelectTableFlow().enterDineInNoTableOrder(ready);
            const name = orderServiceDishes.regular.name;
            await new OrderDishesFlow().addRegularDish(
              page,
              name,
              orderServiceDishes.regular.menu,
            );
            return { orderPage: page, dishName: name };
          },
        );

        await test.step('通过 Modify 添加自定义备注', async () => {
          const orderFlow = new OrderDishesFlow();
          await orderFlow.addCustomModifier(orderPage, {
            dishName,
            ...orderPageRegressionCases.modifier,
          });
        });

        await test.step('保存订单后在 Recall 校验备注', async () => {
          const { details } = await saveAndReadLatestRecallDetails(orderPage);
          expect(
            details.items
              .find((item) => item.name === dishName)
              ?.additions.map((addition) => addition.name.trim()),
          ).toContain('POS-42888');
        });
      },
    );
  });

  test.describe('持久化分单回归', { tag: ['@分单'] }, () => {
    test.describe.configure({ timeout: 180_000 });

    test(
      '[POS-16303] 应能保存 To Go 订单后从 Recall 平分两份并保持金额守恒',
      {
        annotation: [jiraIssueAnnotation('POS-16303')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const orderPage = await test.step('创建 To Go 订单并添加普通菜', async () => {
          const page = await new TakeoutFlow().startToGoOrder(ready);
          await new OrderDishesFlow().addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        const splitOrderPage = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return (await saveAndOpenSplit(orderPage)).splitOrderPage;
        });
        const splitFlow = new SplitOrderFlow();

        await test.step('将订单平分为两个子单', async () => {
          await splitFlow.splitOrderEvenly(splitOrderPage, 2);
        });

        await test.step('校验两个未支付子单的金额总和与订单总额一致', async () => {
          const even = await splitOrderPage.readSnapshot();
          expect(even.suborders).toHaveLength(2);
          expectUnpaidSuborders(even);
          expect(suborderTotal(even)).toBeCloseTo(even.total, 2);
        });

        await test.step('提交平分结果', async () => {
          await splitFlow.submitAndReturnPage(splitOrderPage);
        });
      },
    );

    test(
      '[POS-16314] 应能保存两道不同菜品后从 Recall 将普通菜2移入新子单',
      {
        annotation: [jiraIssueAnnotation('POS-16314')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const orderPage = await test.step('创建 To Go 订单并添加两道不同菜品', async () => {
          const page = await new TakeoutFlow().startToGoOrder(ready);
          const orderFlow = new OrderDishesFlow();
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
          return (await saveAndOpenSplit(orderPage)).splitOrderPage;
        });
        const splitFlow = new SplitOrderFlow();

        await test.step('将普通菜2移入新建子单', async () => {
          await splitFlow.moveDishToNewSuborder(splitOrderPage, orderServiceDishes.test.name);
        });

        await test.step('校验普通菜2仅在一个未支付子单中且金额守恒', async () => {
          const moved = await splitOrderPage.readSnapshot();
          expect(moved.suborders).toHaveLength(2);
          expectUnpaidSuborders(moved);
          expect(
            moved.suborders.filter((order) =>
              order.dishes.some((dish) => dish.name === orderServiceDishes.test.name),
            ),
          ).toHaveLength(1);
          expect(suborderTotal(moved)).toBeCloseTo(moved.total, 2);
        });

        await test.step('提交按菜移动结果', async () => {
          await splitFlow.submitAndReturnPage(splitOrderPage);
        });
      },
    );

    test(
      '[POS-16316] 应能保存改价为 10.60 的订单后从 Recall 按 2 和 8.6 分单',
      {
        annotation: [jiraIssueAnnotation('POS-16316')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const orderPage = await test.step('创建 To Go 订单并将普通菜1价格修改为 10.60', async () => {
          const page = await new TakeoutFlow().startToGoOrder(ready);
          await new OrderDishesFlow().addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await page.changeOrderedDishPrice(orderServiceDishes.regular.name, 10.6);
          return page;
        });

        const splitOrderPage = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return (await saveAndOpenSplit(orderPage)).splitOrderPage;
        });
        const splitFlow = new SplitOrderFlow();

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
      async ({ homePage, employeeLoginPage }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const orderPage = await test.step('创建 To Go 订单并添加普通菜', async () => {
          const page = await new TakeoutFlow().startToGoOrder(ready);
          await new OrderDishesFlow().addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        const persistedOrder = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return await saveAndOpenSplit(orderPage);
        });
        const splitFlow = new SplitOrderFlow();
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
          return await new RecallFlow().openSplitOrder(
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
          expect(restored.total).toBeCloseTo(original, 2);
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
      async ({ homePage, employeeLoginPage }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const orderPage = await test.step('选择任意空桌和两位客人并分别向共享座位与座位一添加菜品', async () => {
          const dineInEntryPage = await ready.enterDineInEntry();
          if (dineInEntryPage instanceof OrderDishesPage) {
            throw new Error('POS-16315 需要真实选桌入口，但当前环境直接进入了点单页。');
          }

          const { orderDishesPage } =
            await new SelectTableFlow().selectAnyAvailableTableAndEnterOrderDishes(
              dineInEntryPage,
              orderPageRegressionCases.splitBySeats.guestCount,
            );
          const orderFlow = new OrderDishesFlow();
          await orderDishesPage.selectSharedSeat();
          await orderFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.selectSeat(1);
          await orderFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );
          return orderDishesPage;
        });

        const splitOrderPage = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return (await saveAndOpenSplit(orderPage)).splitOrderPage;
        });
        const splitFlow = new SplitOrderFlow();
        const original = await test.step('读取按座位分单前订单快照', async () => {
          return await splitOrderPage.readSnapshot();
        });

        await test.step('将订单按座位分为两个子单', async () => {
          await splitFlow.splitOrderBySeats(splitOrderPage);
        });

        await test.step('校验两个未支付子单的金额总和与分单前订单总额一致', async () => {
          const bySeats = await splitOrderPage.readSnapshot();
          expect(bySeats.suborders).toHaveLength(2);
          expectUnpaidSuborders(bySeats);
          expect(toCents(suborderTotal(bySeats))).toBe(toCents(original.total));
        });

        await test.step('提交按座位分单结果', async () => {
          await splitFlow.submitAndReturnPage(splitOrderPage);
        });
      },
    );

    test(
      '[POS-39762] 应能平分含 2.00 小费的 To Go 订单后再合并并恢复母单小费',
      {
        tag: ['@小费'],
        annotation: [jiraIssueAnnotation('POS-39762')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const orderPage = await test.step('创建 To Go 订单并添加普通菜和 2.00 小费', async () => {
          const page = await new TakeoutFlow().startToGoOrder(ready);
          await new OrderDishesFlow().addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await page.addTip(orderPageRegressionCases.splitTips.tipAmountInCents);
          return page;
        });

        const persistedOrder = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return await saveAndOpenSplit(orderPage, { chargePromptAction: 'keep' });
        });
        const splitFlow = new SplitOrderFlow();
        const firstChildOrderNumber = await test.step('平分为两个子单并读取首个子单号', async () => {
          await splitFlow.splitOrderEvenly(
            persistedOrder.splitOrderPage,
            orderPageRegressionCases.splitEvenly.count,
          );
          const split = await persistedOrder.splitOrderPage.readSnapshot();
          expect(split.suborders).toHaveLength(orderPageRegressionCases.splitEvenly.count);
          expectUnpaidSuborders(split);

          const childOrderNumber = split.suborders[0]?.orderNumber;
          expect(childOrderNumber, '平分后应读取到首个子单号').toBeDefined();
          if (!childOrderNumber) {
            throw new Error('POS-39762 平分后未读取到首个子单号。');
          }
          return childOrderNumber;
        });

        await test.step('提交平分结果并在 Recall 校验首个子单小费为 1.00', async () => {
          await splitFlow.submitAndReturnPage(persistedOrder.splitOrderPage);
          await persistedOrder.recallPage.openOrderDetails(
            persistedOrder.orderNumber,
            firstChildOrderNumber,
          );
          const splitSummary = await persistedOrder.recallPage.readDisplayedOrderPriceSummary();
          await persistedOrder.recallPage.closeOrderDetailsDialog();
          expect(toCents(splitSummary.Tips ?? 0)).toBe(
            toCents(orderPageRegressionCases.splitTips.splitTip),
          );
        });

        await test.step('从 Recall 重新打开分单页面并合并两个子单', async () => {
          const reopened = await new RecallFlow().openSplitOrder(
            persistedOrder.recallPage,
            persistedOrder.orderNumber,
          );
          await splitFlow.combineSuborders(reopened);
          await splitFlow.submitAndReturnPage(reopened);
        });

        await test.step('在 Recall 校验合并后母单小费恢复为 2.00', async () => {
          await persistedOrder.recallPage.openOrderDetails(persistedOrder.orderNumber);
          const mergedSummary = await persistedOrder.recallPage.readDisplayedOrderPriceSummary();
          await persistedOrder.recallPage.closeOrderDetailsDialog();
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
      async ({ homePage, employeeLoginPage }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const orderPage = await test.step('选择任意空桌和两位客人并添加两道菜', async () => {
          const selectTablePage = await ready.enterDineIn();
          const { orderDishesPage } =
            await new SelectTableFlow().selectAnyAvailableTableAndEnterOrderDishes(
              selectTablePage,
              2,
            );
          const orderFlow = new OrderDishesFlow();
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

        const splitOrderPage = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return (await saveAndOpenSplit(orderPage)).splitOrderPage;
        });
        const splitFlow = new SplitOrderFlow();

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
          await splitFlow.submitAndReturnPage(splitOrderPage);
        });
      },
    );
  });
});

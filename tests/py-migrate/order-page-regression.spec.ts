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
  orderServiceMenu,
  orderServiceModifyGlobalOptionCase,
  orderServicePresetItemDiscountCases,
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

test.describe('点单页面回归', { tag: ['@点单', '@ui-exclusive-config'] }, () => {
  test(
    '[POS-15602] 应能切换菜单组并保存目标组菜品',
    {
      annotation: [jiraIssueAnnotation('POS-15602')],
    },
    async ({ homePage, employeeLoginPage, flows }) => {
      const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const { orderPage, before, beforeSubtotal } = await test.step(
        '先切换到备用菜单组，再切回目标菜单组并添加普通菜',
        async () => {
          const page = await flows.takeoutFlow.startToGoOrder(ready);
          await page.menu.switchMenuGroup(orderServiceMenu.alternateGroup);
          expect(await page.menu.readSelectedMenuGroupName()).toBe(orderServiceMenu.alternateGroup);
          await page.menu.switchMenu(orderServiceMenu.group, orderServiceMenu.category);
          expect(await page.menu.readSelectedMenuGroupName()).toBe(orderServiceMenu.group);
          await page.menu.clickDish(orderServiceDishes.regular.name);
          const orderedDish = (await page.reads.readOrderedItems()).find(
            (item) => item.name === orderServiceDishes.regular.name,
          );
          const subtotal = (await page.reads.readPriceSummary()).Subtotal;

          return { orderPage: page, before: orderedDish, beforeSubtotal: subtotal };
        },
      );

      await test.step('保存订单后在 Recall 校验目标菜品名称和价格', async () => {
        const { details } =
          await flows.orderRegressionFlow.saveAndReadRecallDetails(
            orderPage,
            employeeLoginPage,
          );
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
    async ({ homePage, employeeLoginPage, flows }) => {
      const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const orderPage = await test.step('添加三份普通菜和一份测试菜', async () => {
        const page = await flows.takeoutFlow.startToGoOrder(ready);
        await flows.orderDishesFlow.addDishToCart(page, {
          ...orderServiceDishes.regular.menu,
          dishName: orderServiceDishes.regular.name,
          quantity: 3,
        });
        await flows.orderDishesFlow.addRegularDish(
          page,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );

        return page;
      });

      await test.step('校验点单页 Count 以整数原文展示累计数量', async () => {
        expect(await orderPage.reads.readCountText()).toBe('4');
      });

      await test.step('保存订单后在 Recall 校验两个菜品数量', async () => {
        const { details } =
          await flows.orderRegressionFlow.saveAndReadRecallDetails(
            orderPage,
            employeeLoginPage,
          );

        expect(
          details.items.find((item) => item.name === orderServiceDishes.regular.name)?.quantity,
        ).toBe('3');
        expect(
          details.items.find((item) => item.name === orderServiceDishes.test.name)?.quantity,
        ).toBe('1');
      });
    },
  );

  test(
    '[POS-33244] 应能合并含小数数量的两笔 To Go 订单并保持数量和小计守恒',
    {
      annotation: [jiraIssueAnnotation('POS-33244')],
    },
    async ({ homePage, employeeLoginPage, flows }) => {
      const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });
      const recallFlow = flows.recallFlow;
      const orderFlow = flows.orderDishesFlow;

      const firstOrder = await test.step('创建第一笔 To Go 订单并将普通菜1数量改为 2.55', async () => {
        const orderPage = await flows.takeoutFlow.startToGoOrder(ready);
        await orderFlow.addRegularDish(
          orderPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderPage.menu.changeOrderedDishQuantity(
          orderServiceDishes.regular.name,
          orderPageRegressionCases.combineDecimal.quantity,
        );
        const subtotal = (await orderPage.reads.readPriceSummary()).Subtotal;
        const { homePage: savedHomePage, orderNumber } =
          await orderPage.navigation.saveOrderWithReference();
        const recallPage = await recallFlow.openRecallFromHome(savedHomePage);

        return { orderNumber, recallPage, subtotal };
      });

      const secondOrderPage = await test.step('退出 Recall 并从首页创建第二笔 To Go 测试菜订单', async () => {
        await firstOrder.recallPage.exitRecall();
        await homePage.expectPrimaryFunctionCardsVisible();
        const orderPage = await flows.takeoutFlow.startToGoOrder(homePage);
        await orderFlow.addRegularDish(
          orderPage,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );
        return orderPage;
      });

      const secondOrder = await test.step('保存第二笔订单并记录精确订单号和数字小计', async () => {
        const subtotal = (await secondOrderPage.reads.readPriceSummary()).Subtotal;
        const { homePage: savedHomePage, orderNumber } =
          await secondOrderPage.navigation.saveOrderWithReference();
        const recallPage = await recallFlow.openRecallFromHome(savedHomePage);

        return { orderNumber, recallPage, subtotal };
      });

      await test.step('从 Recall 将第一笔订单合并到第二笔目标订单', async () => {
        expect(firstOrder.orderNumber).not.toBe(secondOrder.orderNumber);
        await recallFlow.combineOrders(
          secondOrder.recallPage,
          firstOrder.orderNumber,
          secondOrder.orderNumber,
        );
      });

      await test.step('按目标订单号回查并校验两道菜数量和小计金额守恒', async () => {
        await secondOrder.recallPage.orderDetails.openOrderDetails(secondOrder.orderNumber);
        const combined = await secondOrder.recallPage.orderDetails.readOrderDetailsSnapshot();
        const expectedSubtotal = firstOrder.subtotal + secondOrder.subtotal;

        expect(
          combined.items.find((item) => item.name === orderServiceDishes.regular.name)?.quantity,
        ).toBe(String(orderPageRegressionCases.combineDecimal.quantity));
        expect(
          combined.items.find((item) => item.name === orderServiceDishes.test.name)?.quantity,
        ).toBe('1');
        expect(toCents(combined.priceSummary.Subtotal)).toBe(toCents(expectedSubtotal));
      });
    },
  );

  test(
    '[POS-33600] 应能保存改价为 6.50 且数量为 1.5 的菜品并保持小计一致',
    {
      annotation: [jiraIssueAnnotation('POS-33600')],
    },
    async ({ homePage, employeeLoginPage, flows }) => {
      const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const { orderPage, beforeSubtotal } = await test.step(
        '创建 To Go 订单并将普通菜1改价为 6.50、数量改为 1.5 后添加普通菜2',
        async () => {
          const page = await flows.takeoutFlow.startToGoOrder(ready);
          const orderFlow = flows.orderDishesFlow;
          const testCase = orderPageRegressionCases.pricedDecimal;
          await orderFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await page.menu.changeOrderedDishPrice(orderServiceDishes.regular.name, testCase.price);
          await page.menu.changeOrderedDishQuantity(orderServiceDishes.regular.name, testCase.quantity);
          const changedDishSubtotal = (await page.reads.readPriceSummary()).Subtotal;
          expect(toCents(changedDishSubtotal)).toBe(testCase.expectedLineCents);
          await orderFlow.addRegularDish(
            page,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );
          const subtotal = (await page.reads.readPriceSummary()).Subtotal;

          return { orderPage: page, beforeSubtotal: subtotal };
        },
      );

      await test.step('保存订单后从 Recall 校验小数数量和数字小计金额一致', async () => {
        const { details } =
          await flows.orderRegressionFlow.saveAndReadRecallDetails(
            orderPage,
            employeeLoginPage,
          );

        expect(
          details.items.find((item) => item.name === orderServiceDishes.regular.name)?.quantity,
        ).toBe(String(orderPageRegressionCases.pricedDecimal.quantity));
        expect(
          details.items.find((item) => item.name === orderServiceDishes.test.name)?.quantity,
        ).toBe('1');
        expect(toCents(details.priceSummary.Subtotal)).toBe(toCents(beforeSubtotal));
      });
    },
  );

  test(
    '[POS-33600] 应能保存改价为 6.50 且数量为 2.55 的菜品和两份追加菜',
    {
      tag: ['@数量'],
      annotation: [jiraIssueAnnotation('POS-33600')],
    },
    async ({ apiSetup, homePage, employeeLoginPage, flows }) => {
      test.setTimeout(90_000);
      const testCase = orderPageRegressionCases.pricedDecimalWithTwoAdditions;
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        testCase.configuration,
        { verify: true },
      );

      try {
        const ready = await test.step('刷新 POS 并在开启小数数量后建立员工上下文', async () => {
          return await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        });

        const { orderPage, beforeSubtotal } = await test.step(
          '创建 To Go 订单，将普通菜1改价为 6.50、数量改为 2.55，再添加两份普通菜2',
          async () => {
            const page = await flows.takeoutFlow.startToGoOrder(ready);
            const orderFlow = flows.orderDishesFlow;
            await orderFlow.addRegularDish(
              page,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
            await page.menu.changeOrderedDishPrice(orderServiceDishes.regular.name, testCase.price);
            await page.menu.changeOrderedDishQuantity(orderServiceDishes.regular.name, testCase.quantity);

            expect(toCents(await page.reads.readOrderedDishPrice(orderServiceDishes.regular.name))).toBe(
              testCase.expectedLineCents,
            );

            for (let index = 0; index < testCase.additionalDishCount; index += 1) {
              await orderFlow.addRegularDish(
                page,
                orderServiceDishes.test.name,
                orderServiceDishes.test.menu,
              );
            }

            const orderedItems = await page.reads.readOrderedItems();
            const additionalQuantity = orderedItems
              .filter((item) => item.name === orderServiceDishes.test.name)
              .reduce((total, item) => total + Number(item.quantity), 0);
            expect(additionalQuantity).toBe(testCase.additionalDishCount);

            return {
              orderPage: page,
              beforeSubtotal: (await page.reads.readPriceSummary()).Subtotal,
            };
          },
        );

        await test.step('保存后从 Recall 校验小数数量、行金额、追加数量和小计均持久化', async () => {
          const { details, recallPage } =
            await flows.orderRegressionFlow.saveAndReadRecallDetails(
              orderPage,
              employeeLoginPage,
            );
          const decimalDish = details.items.find(
            (item) => item.name === orderServiceDishes.regular.name,
          );
          const additionalQuantity = details.items
            .filter((item) => item.name === orderServiceDishes.test.name)
            .reduce((total, item) => total + Number(item.quantity), 0);

          expect(decimalDish?.quantity).toBe(String(testCase.quantity));
          expect(
            toCents(await recallPage.orderDetails.readOrderItemPrice(orderServiceDishes.regular.name)),
          ).toBe(testCase.expectedLineCents);
          expect(additionalQuantity).toBe(testCase.additionalDishCount);
          expect(toCents(details.priceSummary.Subtotal)).toBe(toCents(beforeSubtotal));
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-35129] 应能保存数量为 2.55 的菜品并在 Recall 保持数量和价格',
    {
      tag: ['@数量'],
      annotation: [jiraIssueAnnotation('POS-35129')],
    },
    async ({ apiSetup, homePage, employeeLoginPage, flows }) => {
      test.setTimeout(90_000);
      const testCase = orderPageRegressionCases.decimalRecallPersistence;
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        testCase.configuration,
        { verify: true },
      );

      try {
        const ready = await test.step('刷新 POS 并在开启小数数量后建立员工上下文', async () => {
          return await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        });

        const { orderPage, beforeSubtotal } = await test.step(
          '创建 To Go 订单并将普通菜1数量修改为 2.55',
          async () => {
            const page = await flows.takeoutFlow.startToGoOrder(ready);
            await flows.orderDishesFlow.addRegularDish(
              page,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
            await page.menu.changeOrderedDishQuantity(
              orderServiceDishes.regular.name,
              testCase.quantity,
            );

            expect(toCents(await page.reads.readOrderedDishPrice(orderServiceDishes.regular.name))).toBe(
              testCase.expectedLineCents,
            );

            return {
              orderPage: page,
              beforeSubtotal: (await page.reads.readPriceSummary()).Subtotal,
            };
          },
        );

        await test.step('保存后按订单号从 Recall 校验数量、价格和小计持久化', async () => {
          const { details, recallPage } =
            await flows.orderRegressionFlow.saveAndReadRecallDetails(
              orderPage,
              employeeLoginPage,
            );
          const recalledDish = details.items.find(
            (item) => item.name === orderServiceDishes.regular.name,
          );

          expect(recalledDish?.quantity).toBe(String(testCase.quantity));
          expect(
            toCents(await recallPage.orderDetails.readOrderItemPrice(orderServiceDishes.regular.name)),
          ).toBe(testCase.expectedLineCents);
          expect(toCents(details.priceSummary.Subtotal)).toBe(toCents(beforeSubtotal));
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-35660] 开启相同菜合并后应能为小数数量菜品添加两份全局调味',
    {
      tag: ['@数量'],
      annotation: [jiraIssueAnnotation('POS-35660')],
    },
    async ({ apiSetup, homePage, employeeLoginPage, flows }) => {
      test.setTimeout(90_000);
      const testCase = orderPageRegressionCases.decimalModifierPersistence;
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        testCase.configuration,
        { verify: true },
      );

      try {
        const ready = await test.step('开启同状态菜合并和小数数量配置并刷新 POS', async () => {
          return await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        });

        const { orderPage, beforeSubtotal } = await test.step(
          '创建 To Go 订单，将普通菜1改价为 7.95、数量改为 2.3，并添加两份加柴',
          async () => {
            const page = await flows.takeoutFlow.startToGoOrder(ready);
            const orderFlow = flows.orderDishesFlow;
            await orderFlow.addRegularDish(
              page,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
            await page.menu.changeOrderedDishPrice(orderServiceDishes.regular.name, testCase.price);
            await page.menu.changeOrderedDishQuantity(
              orderServiceDishes.regular.name,
              testCase.quantity,
            );

            expect(toCents(await page.reads.readOrderedDishPrice(orderServiceDishes.regular.name))).toBe(
              testCase.expectedLineCents,
            );

            const modifierResult = await orderFlow.changeGlobalOptionQuantity(page, {
              closeAfter: true,
              dishName: orderServiceDishes.regular.name,
              operations: [{ type: 'count', quantity: testCase.modifierQuantity }],
              optionName: orderServiceModifyGlobalOptionCase.optionName,
            });
            expect(modifierResult.quantities).toEqual([1, testCase.modifierQuantity]);

            const orderedDish = (await page.reads.readOrderedItems()).find(
              (item) => item.name === orderServiceDishes.regular.name,
            );
            expect(orderedDish?.quantity).toBe(String(testCase.quantity));
            expect(
              await page.reads.readOrderedDishAdditionQuantity(
                orderServiceDishes.regular.name,
                orderServiceModifyGlobalOptionCase.optionName,
              ),
            ).toBe(testCase.modifierQuantity);

            return {
              orderPage: page,
              beforeSubtotal: (await page.reads.readPriceSummary()).Subtotal,
            };
          },
        );

        await test.step('保存后从 Recall 校验小数数量、调味数量、价格和小计', async () => {
          const { details, recallPage } =
            await flows.orderRegressionFlow.saveAndReadRecallDetails(
              orderPage,
              employeeLoginPage,
            );
          const recalledDish = details.items.find(
            (item) => item.name === orderServiceDishes.regular.name,
          );
          const recalledModifier = recalledDish?.additions.find((addition) =>
            addition.name.startsWith(orderServiceModifyGlobalOptionCase.optionName),
          );

          expect(recalledDish?.quantity).toBe(String(testCase.quantity));
          expect(recalledModifier?.quantity).toBe(testCase.modifierQuantity);
          expect(
            toCents(await recallPage.orderDetails.readOrderItemPrice(orderServiceDishes.regular.name)),
          ).toBe(testCase.expectedLineCents);
          expect(toCents(details.priceSummary.Subtotal)).toBe(toCents(beforeSubtotal));
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );
});

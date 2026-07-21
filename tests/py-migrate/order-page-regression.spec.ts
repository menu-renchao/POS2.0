import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
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

async function enterReadyHome(homePage: HomePage, employeeLoginPage: EmployeeLoginPage) {
  const ready = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
  await ready.expectPrimaryFunctionCardsVisible();
  return ready;
}

async function saveAndReadRecallDetails(
  orderDishesPage: OrderDishesPage,
  employeeLoginPage: EmployeeLoginPage,
) {
  const { homePage, orderNumber } = await orderDishesPage.saveOrderWithReference();
  const readyHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
    homePage,
    employeeLoginPage,
  );
  const recallPage = await new RecallFlow().openRecallFromHome(readyHomePage);
  await recallPage.openOrderDetails(orderNumber);
  return { details: await recallPage.readOrderDetailsSnapshot(), orderNumber, recallPage };
}

async function saveAndOpenSplit(
  orderPage: OrderDishesPage,
  employeeLoginPage: EmployeeLoginPage,
  options?: Parameters<RecallFlow['openSplitOrder']>[3],
) {
  const { homePage, orderNumber } = await orderPage.saveOrderWithReference();
  const readyHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
    homePage,
    employeeLoginPage,
  );
  const recallFlow = new RecallFlow();
  const recallPage = await recallFlow.openRecallFromHome(readyHomePage);
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
        '先切换到备用菜单组，再切回目标菜单组并添加普通菜',
        async () => {
          const page = await new TakeoutFlow().startToGoOrder(ready);
          await page.switchMenuGroup(orderServiceMenu.alternateGroup);
          expect(await page.readSelectedMenuGroupName()).toBe(orderServiceMenu.alternateGroup);
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
        const { details } = await saveAndReadRecallDetails(orderPage, employeeLoginPage);
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
        const { details } = await saveAndReadRecallDetails(orderPage, employeeLoginPage);

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
    async ({ homePage, employeeLoginPage }) => {
      const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome(homePage, employeeLoginPage);
      });
      const recallFlow = new RecallFlow();
      const orderFlow = new OrderDishesFlow();

      const firstOrder = await test.step('创建第一笔 To Go 订单并将普通菜1数量改为 2.55', async () => {
        const orderPage = await new TakeoutFlow().startToGoOrder(ready);
        await orderFlow.addRegularDish(
          orderPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderPage.changeOrderedDishQuantity(
          orderServiceDishes.regular.name,
          orderPageRegressionCases.combineDecimal.quantity,
        );
        const subtotal = (await orderPage.readPriceSummary()).Subtotal;
        const { homePage: savedHomePage, orderNumber } =
          await orderPage.saveOrderWithReference();
        const recallPage = await recallFlow.openRecallFromHome(savedHomePage);

        return { orderNumber, recallPage, subtotal };
      });

      const secondOrderPage = await test.step('退出 Recall 并从首页创建第二笔 To Go 测试菜订单', async () => {
        await firstOrder.recallPage.exitRecall();
        await homePage.expectPrimaryFunctionCardsVisible();
        const orderPage = await new TakeoutFlow().startToGoOrder(homePage);
        await orderFlow.addRegularDish(
          orderPage,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );
        return orderPage;
      });

      const secondOrder = await test.step('保存第二笔订单并记录精确订单号和数字小计', async () => {
        const subtotal = (await secondOrderPage.readPriceSummary()).Subtotal;
        const { homePage: savedHomePage, orderNumber } =
          await secondOrderPage.saveOrderWithReference();
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
        await secondOrder.recallPage.openOrderDetails(secondOrder.orderNumber);
        const combined = await secondOrder.recallPage.readOrderDetailsSnapshot();
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
    async ({ homePage, employeeLoginPage }) => {
      const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome(homePage, employeeLoginPage);
      });

      const { orderPage, beforeSubtotal } = await test.step(
        '创建 To Go 订单并将普通菜1改价为 6.50、数量改为 1.5 后添加普通菜2',
        async () => {
          const page = await new TakeoutFlow().startToGoOrder(ready);
          const orderFlow = new OrderDishesFlow();
          const testCase = orderPageRegressionCases.pricedDecimal;
          await orderFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await page.changeOrderedDishPrice(orderServiceDishes.regular.name, testCase.price);
          await page.changeOrderedDishQuantity(orderServiceDishes.regular.name, testCase.quantity);
          const changedDishSubtotal = (await page.readPriceSummary()).Subtotal;
          expect(toCents(changedDishSubtotal)).toBe(testCase.expectedLineCents);
          await orderFlow.addRegularDish(
            page,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );
          const subtotal = (await page.readPriceSummary()).Subtotal;

          return { orderPage: page, beforeSubtotal: subtotal };
        },
      );

      await test.step('保存订单后从 Recall 校验小数数量和数字小计金额一致', async () => {
        const { details } = await saveAndReadRecallDetails(orderPage, employeeLoginPage);

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
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const testCase = orderPageRegressionCases.pricedDecimalWithTwoAdditions;
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        testCase.configuration,
        { verify: true },
      );

      try {
        const ready = await test.step('刷新 POS 并在开启小数数量后建立员工上下文', async () => {
          return await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        });

        const { orderPage, beforeSubtotal } = await test.step(
          '创建 To Go 订单，将普通菜1改价为 6.50、数量改为 2.55，再添加两份普通菜2',
          async () => {
            const page = await new TakeoutFlow().startToGoOrder(ready);
            const orderFlow = new OrderDishesFlow();
            await orderFlow.addRegularDish(
              page,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
            await page.changeOrderedDishPrice(orderServiceDishes.regular.name, testCase.price);
            await page.changeOrderedDishQuantity(orderServiceDishes.regular.name, testCase.quantity);

            expect(toCents(await page.readOrderedDishPrice(orderServiceDishes.regular.name))).toBe(
              testCase.expectedLineCents,
            );

            for (let index = 0; index < testCase.additionalDishCount; index += 1) {
              await orderFlow.addRegularDish(
                page,
                orderServiceDishes.test.name,
                orderServiceDishes.test.menu,
              );
            }

            const orderedItems = await page.readOrderedItems();
            const additionalQuantity = orderedItems
              .filter((item) => item.name === orderServiceDishes.test.name)
              .reduce((total, item) => total + Number(item.quantity), 0);
            expect(additionalQuantity).toBe(testCase.additionalDishCount);

            return {
              orderPage: page,
              beforeSubtotal: (await page.readPriceSummary()).Subtotal,
            };
          },
        );

        await test.step('保存后从 Recall 校验小数数量、行金额、追加数量和小计均持久化', async () => {
          const { details, recallPage } = await saveAndReadRecallDetails(
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
            toCents(await recallPage.readOrderItemPrice(orderServiceDishes.regular.name)),
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
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const testCase = orderPageRegressionCases.decimalRecallPersistence;
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        testCase.configuration,
        { verify: true },
      );

      try {
        const ready = await test.step('刷新 POS 并在开启小数数量后建立员工上下文', async () => {
          return await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        });

        const { orderPage, beforeSubtotal } = await test.step(
          '创建 To Go 订单并将普通菜1数量修改为 2.55',
          async () => {
            const page = await new TakeoutFlow().startToGoOrder(ready);
            await new OrderDishesFlow().addRegularDish(
              page,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
            await page.changeOrderedDishQuantity(
              orderServiceDishes.regular.name,
              testCase.quantity,
            );

            expect(toCents(await page.readOrderedDishPrice(orderServiceDishes.regular.name))).toBe(
              testCase.expectedLineCents,
            );

            return {
              orderPage: page,
              beforeSubtotal: (await page.readPriceSummary()).Subtotal,
            };
          },
        );

        await test.step('保存后按订单号从 Recall 校验数量、价格和小计持久化', async () => {
          const { details, recallPage } = await saveAndReadRecallDetails(
            orderPage,
            employeeLoginPage,
          );
          const recalledDish = details.items.find(
            (item) => item.name === orderServiceDishes.regular.name,
          );

          expect(recalledDish?.quantity).toBe(String(testCase.quantity));
          expect(
            toCents(await recallPage.readOrderItemPrice(orderServiceDishes.regular.name)),
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
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const testCase = orderPageRegressionCases.decimalModifierPersistence;
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        testCase.configuration,
        { verify: true },
      );

      try {
        const ready = await test.step('开启同状态菜合并和小数数量配置并刷新 POS', async () => {
          return await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        });

        const { orderPage, beforeSubtotal } = await test.step(
          '创建 To Go 订单，将普通菜1改价为 7.95、数量改为 2.3，并添加两份加柴',
          async () => {
            const page = await new TakeoutFlow().startToGoOrder(ready);
            const orderFlow = new OrderDishesFlow();
            await orderFlow.addRegularDish(
              page,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
            await page.changeOrderedDishPrice(orderServiceDishes.regular.name, testCase.price);
            await page.changeOrderedDishQuantity(
              orderServiceDishes.regular.name,
              testCase.quantity,
            );

            expect(toCents(await page.readOrderedDishPrice(orderServiceDishes.regular.name))).toBe(
              testCase.expectedLineCents,
            );

            const modifierResult = await orderFlow.changeGlobalOptionQuantity(page, {
              closeAfter: true,
              dishName: orderServiceDishes.regular.name,
              operations: [{ type: 'count', quantity: testCase.modifierQuantity }],
              optionName: orderServiceModifyGlobalOptionCase.optionName,
            });
            expect(modifierResult.quantities).toEqual([1, testCase.modifierQuantity]);

            const orderedDish = (await page.readOrderedItems()).find(
              (item) => item.name === orderServiceDishes.regular.name,
            );
            expect(orderedDish?.quantity).toBe(String(testCase.quantity));
            expect(
              await page.readOrderedDishAdditionQuantity(
                orderServiceDishes.regular.name,
                orderServiceModifyGlobalOptionCase.optionName,
              ),
            ).toBe(testCase.modifierQuantity);

            return {
              orderPage: page,
              beforeSubtotal: (await page.readPriceSummary()).Subtotal,
            };
          },
        );

        await test.step('保存后从 Recall 校验小数数量、调味数量、价格和小计', async () => {
          const { details, recallPage } = await saveAndReadRecallDetails(
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
            toCents(await recallPage.readOrderItemPrice(orderServiceDishes.regular.name)),
          ).toBe(testCase.expectedLineCents);
          expect(toCents(details.priceSummary.Subtotal)).toBe(toCents(beforeSubtotal));
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test.describe('折扣与备注回归', () => {
    test(
      '[POS-42886] 应能在菜品改价弹窗选择预置单菜折扣并保存',
      {
        annotation: [jiraIssueAnnotation('POS-42886')],
      },
      async ({ apiSetup, homePage, employeeLoginPage }) => {
        const testCase = orderServicePresetItemDiscountCases.regularPrice;
        const discount = await test.step('通过 API 创建本次测试使用的 10% 预置折扣', async () => {
          return await apiSetup.discount.create({
            rate: testCase.discountRate,
            rateType: 2,
          });
        });
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });
        const orderPage = await test.step('创建堂食无桌订单并添加普通菜1', async () => {
          const page = await new SelectTableFlow().enterDineInNoTableOrder(ready);
          await new OrderDishesFlow().addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          expect(toCents((await page.readPriceSummary()).Subtotal)).toBe(
            toCents(orderServiceDishes.regular.expectedBasePrice),
          );
          return page;
        });

        await test.step('从 Price 弹窗选择 10% 单菜折扣并使用主管口令授权', async () => {
          await new OrderDishesFlow().applyPresetItemDiscount(orderPage, {
            authorizationPasscode: testCase.authorizationPasscode,
            discountName: discount.name,
            dishName: orderServiceDishes.regular.name,
          });
          expect(toCents((await orderPage.readPriceSummary()).Subtotal)).toBe(
            toCents(testCase.expectedSubtotal),
          );
        });

        await test.step('保存订单并校验单菜折扣请求及 Recall 结果', async () => {
          const savedOrder = await orderPage.saveOrderWithReference();
          const savedItem = savedOrder.orderItems.find(
            (item) => Number(item.saleItemId) === orderServiceDishes.regular.saleItemId,
          );
          expect(savedItem).toMatchObject({
            discountName: discount.name,
            discountRate: testCase.discountRate,
            discountRateType: 2,
            originalSalePrice: orderServiceDishes.regular.expectedBasePrice,
            price: orderServiceDishes.regular.expectedBasePrice,
            totalAmount: testCase.expectedSubtotal,
          });

          const readyHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
            savedOrder.homePage,
            employeeLoginPage,
          );
          const recallPage = await new RecallFlow().openRecallFromHome(readyHomePage);
          await recallPage.openOrderDetails(savedOrder.orderNumber);
          const details = await recallPage.readOrderDetailsSnapshot();
          expect(toCents(details.priceSummary.Subtotal)).toBe(toCents(testCase.expectedSubtotal));
          expect(
            details.items
              .find((item) => item.name === orderServiceDishes.regular.name)
              ?.additions.map((addition) => addition.name.trim()),
          ).toContain(discount.name);
        });
      },
    );

    test(
      '[POS-28674] 特殊价格菜品应用 50% 单菜折扣后应按产品规则舍入并保存',
      {
        annotation: [
          jiraIssueAnnotation('POS-28674'),
          jiraIssueAnnotation('POS-28534'),
        ],
      },
      async ({ apiSetup, homePage, employeeLoginPage }) => {
        const testCase = orderServicePresetItemDiscountCases.specialPrice;
        const discount = await test.step('通过 API 创建本次测试使用的 50% 预置折扣', async () => {
          return await apiSetup.discount.create({
            rate: testCase.discountRate,
            rateType: 2,
          });
        });
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });
        const orderPage = await test.step('创建堂食无桌订单并添加普通菜1', async () => {
          const page = await new SelectTableFlow().enterDineInNoTableOrder(ready);
          await new OrderDishesFlow().addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        await test.step('在 Price 弹窗输入 5.85 并选择 50% 单菜折扣后授权', async () => {
          await new OrderDishesFlow().applyPresetItemDiscount(orderPage, {
            authorizationPasscode: testCase.authorizationPasscode,
            discountName: discount.name,
            dishName: orderServiceDishes.regular.name,
            price: testCase.price,
          });
          expect(toCents((await orderPage.readPriceSummary()).Subtotal)).toBe(
            toCents(testCase.expectedSubtotal),
          );
        });

        await test.step('保存订单并校验特殊价格、折扣字段及 Recall 舍入结果', async () => {
          const savedOrder = await orderPage.saveOrderWithReference();
          const savedItem = savedOrder.orderItems.find(
            (item) => Number(item.saleItemId) === orderServiceDishes.regular.saleItemId,
          );
          expect(savedItem).toMatchObject({
            discountName: discount.name,
            discountRate: testCase.discountRate,
            discountRateType: 2,
            originalSalePrice: orderServiceDishes.regular.expectedBasePrice,
            price: testCase.price,
            totalAmount: testCase.expectedSubtotal,
          });

          const readyHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
            savedOrder.homePage,
            employeeLoginPage,
          );
          const recallPage = await new RecallFlow().openRecallFromHome(readyHomePage);
          await recallPage.openOrderDetails(savedOrder.orderNumber);
          const details = await recallPage.readOrderDetailsSnapshot();
          expect(toCents(details.priceSummary.Subtotal)).toBe(toCents(testCase.expectedSubtotal));
          expect(
            details.items
              .find((item) => item.name === orderServiceDishes.regular.name)
              ?.additions.map((addition) => addition.name.trim()),
          ).toContain(discount.name);
        });
      },
    );

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
          const { details } = await saveAndReadRecallDetails(orderPage, employeeLoginPage);
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
          return (await saveAndOpenSplit(orderPage, employeeLoginPage)).splitOrderPage;
        });
        const splitFlow = new SplitOrderFlow();
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
      async ({ homePage, employeeLoginPage }) => {
        test.setTimeout(90_000);
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const splitOrderPage = await test.step('创建 To Go 订单并从点单页进入分单', async () => {
          const orderPage = await new TakeoutFlow().startToGoOrder(ready);
          await new OrderDishesFlow().addRegularDish(
            orderPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return await orderPage.openSplitOrder();
        });
        const splitFlow = new SplitOrderFlow();

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
          await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
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
          return (await saveAndOpenSplit(orderPage, employeeLoginPage)).splitOrderPage;
        });
        const splitFlow = new SplitOrderFlow();
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
          return (await saveAndOpenSplit(orderPage, employeeLoginPage)).splitOrderPage;
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
          return await saveAndOpenSplit(orderPage, employeeLoginPage);
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

        const persistedOrder = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return await saveAndOpenSplit(orderPage, employeeLoginPage, {
            chargePromptAction: 'remove',
          });
        });
        const { splitOrderPage } = persistedOrder;
        const splitFlow = new SplitOrderFlow();
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
            await new RecallFlow().cleanupPersistedSplitOrder(
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
          return await saveAndOpenSplit(orderPage, employeeLoginPage, {
            chargePromptAction: 'keep',
          });
        });
        const splitFlow = new SplitOrderFlow();
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
            await persistedOrder.recallPage.openOrderDetails(
              persistedOrder.orderNumber,
              childOrderNumber,
            );
            const splitSummary = await persistedOrder.recallPage.readDisplayedOrderPriceSummary();
            await persistedOrder.recallPage.closeOrderDetailsDialog();
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

        const persistedOrder = await test.step('保存订单并从 Recall 打开分单页面', async () => {
          return await saveAndOpenSplit(orderPage, employeeLoginPage, {
            chargePromptAction: 'remove',
          });
        });
        const { splitOrderPage } = persistedOrder;
        const splitFlow = new SplitOrderFlow();
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
            await new RecallFlow().cleanupPersistedSplitOrder(
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

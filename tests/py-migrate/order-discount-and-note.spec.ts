import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import {
  orderPageRegressionCases,
  orderServiceDishes,
  orderServicePresetItemDiscountCases,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

function toCents(value: number): number {
  return Math.round(value * 100);
}

test.describe('点单页面回归', { tag: ['@点单'] }, () => {
test.describe('折扣与备注回归', () => {
    test(
      '[POS-42886] 应能在菜品改价弹窗选择预置单菜折扣并保存',
      {
        annotation: [jiraIssueAnnotation('POS-42886')],
      },
      async ({ apiSetup, homePage, employeeLoginPage, flows }) => {
        const testCase = orderServicePresetItemDiscountCases.regularPrice;
        const discount = await test.step('通过 API 创建本次测试使用的 10% 预置折扣', async () => {
          return await apiSetup.discount.create({
            rate: testCase.discountRate,
            rateType: 2,
          });
        });
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });
        const orderPage = await test.step('创建堂食无桌订单并添加普通菜1', async () => {
          const page = await flows.selectTableFlow.enterDineInNoTableOrder(ready);
          await flows.orderDishesFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          expect(toCents((await page.reads.readPriceSummary()).Subtotal)).toBe(
            toCents(orderServiceDishes.regular.expectedBasePrice),
          );
          return page;
        });

        await test.step('从 Price 弹窗选择 10% 单菜折扣并使用主管口令授权', async () => {
          await flows.orderDishesFlow.applyPresetItemDiscount(orderPage, {
            authorizationPasscode: testCase.authorizationPasscode,
            discountName: discount.name,
            dishName: orderServiceDishes.regular.name,
          });
          expect(toCents((await orderPage.reads.readPriceSummary()).Subtotal)).toBe(
            toCents(testCase.expectedSubtotal),
          );
        });

        await test.step('保存订单并校验单菜折扣请求及 Recall 结果', async () => {
          const savedOrder = await orderPage.navigation.saveOrderWithReference();
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

          const readyHomePage = await flows.employeeLoginFlow.enterEmployeeContext(
            savedOrder.homePage,
            employeeLoginPage,
          );
          const recallPage = await flows.recallFlow.openRecallFromHome(readyHomePage);
          await recallPage.orderDetails.openOrderDetails(savedOrder.orderNumber);
          const details = await recallPage.orderDetails.readOrderDetailsSnapshot();
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
      async ({ apiSetup, homePage, employeeLoginPage, flows }) => {
        const testCase = orderServicePresetItemDiscountCases.specialPrice;
        const discount = await test.step('通过 API 创建本次测试使用的 50% 预置折扣', async () => {
          return await apiSetup.discount.create({
            rate: testCase.discountRate,
            rateType: 2,
          });
        });
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });
        const orderPage = await test.step('创建堂食无桌订单并添加普通菜1', async () => {
          const page = await flows.selectTableFlow.enterDineInNoTableOrder(ready);
          await flows.orderDishesFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        await test.step('在 Price 弹窗输入 5.85 并选择 50% 单菜折扣后授权', async () => {
          await flows.orderDishesFlow.applyPresetItemDiscount(orderPage, {
            authorizationPasscode: testCase.authorizationPasscode,
            discountName: discount.name,
            dishName: orderServiceDishes.regular.name,
            price: testCase.price,
          });
          expect(toCents((await orderPage.reads.readPriceSummary()).Subtotal)).toBe(
            toCents(testCase.expectedSubtotal),
          );
        });

        await test.step('保存订单并校验特殊价格、折扣字段及 Recall 舍入结果', async () => {
          const savedOrder = await orderPage.navigation.saveOrderWithReference();
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

          const readyHomePage = await flows.employeeLoginFlow.enterEmployeeContext(
            savedOrder.homePage,
            employeeLoginPage,
          );
          const recallPage = await flows.recallFlow.openRecallFromHome(readyHomePage);
          await recallPage.orderDetails.openOrderDetails(savedOrder.orderNumber);
          const details = await recallPage.orderDetails.readOrderDetailsSnapshot();
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
      async ({ homePage, employeeLoginPage, flows }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(
            homePage,
            employeeLoginPage,
          );
        });

        const { orderPage, dishName } = await test.step(
          '创建堂食无桌位订单并添加普通菜',
          async () => {
            const page = await flows.selectTableFlow.enterDineInNoTableOrder(ready);
            const name = orderServiceDishes.regular.name;
            await flows.orderDishesFlow.addRegularDish(
              page,
              name,
              orderServiceDishes.regular.menu,
            );
            return { orderPage: page, dishName: name };
          },
        );

        await test.step('通过 Modify 添加自定义备注', async () => {
          const orderFlow = flows.orderDishesFlow;
          await orderFlow.addCustomModifier(orderPage, {
            dishName,
            ...orderPageRegressionCases.modifier,
          });
        });

        await test.step('保存订单后在 Recall 校验备注', async () => {
          const { details } =
            await flows.orderRegressionFlow.saveAndReadRecallDetails(
              orderPage,
              employeeLoginPage,
            );
          expect(
            details.items
              .find((item) => item.name === dishName)
              ?.additions.map((addition) => addition.name.trim()),
          ).toContain('POS-42888');
        });
      },
    );
  });
});

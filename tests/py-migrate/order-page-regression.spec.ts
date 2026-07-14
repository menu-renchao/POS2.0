import { expect } from '@playwright/test';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
import type { OrderDishesPage } from '../../pages/order-dishes.page';
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
});

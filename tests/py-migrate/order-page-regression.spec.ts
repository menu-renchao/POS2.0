import { expect } from '@playwright/test';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
import type { OrderDishesPage } from '../../pages/order-dishes.page';
import { orderServiceDishes, orderServiceMenu } from '../../test-data/order-service';
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

      const { orderPage, before } = await test.step('切换到目标菜单组并添加普通菜', async () => {
        const page = await new TakeoutFlow().startToGoOrder(ready);
        await page.switchMenu(orderServiceMenu.group, orderServiceMenu.category);
        expect(await page.readSelectedMenuGroupName()).toBe(orderServiceMenu.group);
        await page.clickDish(orderServiceDishes.regular.name);
        const orderedDish = (await page.readOrderedItems()).find(
          (item) => item.name === orderServiceDishes.regular.name,
        );

        return { orderPage: page, before: orderedDish };
      });

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
        expect(before.price, '点单页目标菜品应包含价格').not.toBeNull();
        expect(after.price, 'Recall 目标菜品应包含价格').not.toBeNull();

        if (before.price === null || after.price === null) {
          throw new Error('点单页和 Recall 的目标菜品均应包含价格。');
        }

        const beforePrice = Number(before.price.replace(/[$,]/g, ''));
        const afterPrice = Number(after.price.replace(/[$,]/g, ''));
        expect(Number.isFinite(beforePrice), '点单页目标菜品价格应为有效金额').toBe(true);
        expect(Number.isFinite(afterPrice), 'Recall 目标菜品价格应为有效金额').toBe(true);
        expect(toCents(afterPrice)).toBe(toCents(beforePrice));
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
});

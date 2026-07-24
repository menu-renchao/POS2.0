import { expect } from '@playwright/test';
import { test, type FlowFixtures } from '../../fixtures/test.fixture';
import { EmployeeLoginPage } from '../../pages/employee-login.page';
import { HomePage } from '../../pages/home.page';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import {
  inventoryDishes,
  inventoryInsufficientStockAlert,
  inventoryStockLabel,
} from '../../test-data/inventory';
import { jiraIssueAnnotation, jiraIssueAnnotations } from '../../utils/jira';

const dish = inventoryDishes.supermanItem4;

async function startInventoryToGoOrder(
  homePage: HomePage,
  flows: Readonly<FlowFixtures>,
): Promise<OrderDishesPage> {
  return await flows.takeoutFlow.startToGoOrder(homePage);
}

async function saveOrderAndReturnHome(orderDishesPage: OrderDishesPage): Promise<HomePage> {
  const savedHomePage = await orderDishesPage.navigation.saveOrder();
  await savedHomePage.expectPrimaryFunctionCardsVisible();
  return savedHomePage;
}

async function readLatestRecallOrderNumberAndReturnHome(
  homePage: HomePage,
  flows: Readonly<FlowFixtures>,
): Promise<string> {
  const recallPage = await flows.recallFlow.openRecallFromHome(homePage);
  const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
  await recallPage.exitRecall();
  await homePage.expectPrimaryFunctionCardsVisible();
  return orderNumber;
}

async function recallRecentOrderFromHome(
  homePage: HomePage,
  orderDishesPage: OrderDishesPage,
  flows: Readonly<FlowFixtures>,
) {
  await orderDishesPage.navigation.exitOrderPage();
  await homePage.expectPrimaryFunctionCardsVisible();
  return await flows.recallFlow.openRecallFromHome(homePage);
}

test.describe(
  '库存管理',
  { tag: ['@库存', '@点单', '@ui-exclusive-config'] },
  () => {
  test.describe.configure({ timeout: 120_000 });

  test(
    '[POS-43898 POS-43890 POS-43889] 未送厨点菜、加菜、减菜应正确更新库存',
    {
      annotation: jiraIssueAnnotations(['POS-43898', 'POS-43890', 'POS-43889']),
    },
    async ({ homePage, employeeLoginPage, flows }) => {
      let trackedOrderNumber: string | null = null;
      let currentHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      let orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);

      orderDishesPage = await test.step('配置 superman item4 为有限库存 20', async () => {
        return await flows.inventoryFlow.configureLimitedStock(orderDishesPage, dish.name, 20);
      });

      await test.step('点菜 10 份并保存后库存应剩余 10', async () => {
        await flows.orderDishesFlow.addRegularDish(orderDishesPage, dish.name, dish.menu, 10);
        currentHomePage = await saveOrderAndReturnHome(orderDishesPage);
        trackedOrderNumber = await readLatestRecallOrderNumberAndReturnHome(currentHomePage, flows);
        await currentHomePage.expectPrimaryFunctionCardsVisible();
        await currentHomePage.clickRefresh();
        orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);
        orderDishesPage = await flows.inventoryFlow.expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(10),
        );
      });

      await test.step('Recall 加菜 5 份后库存应剩余 5', async () => {
        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage, flows);
        expect(trackedOrderNumber, '首次保存后应记录目标 Recall 订单号').toBeTruthy();
        orderDishesPage = await recallPage.orderDetails.openOrderForEditing(trackedOrderNumber as string);
        await flows.orderDishesFlow.addRegularDish(orderDishesPage, dish.name, dish.menu, 5);
        currentHomePage = await saveOrderAndReturnHome(orderDishesPage);
        await currentHomePage.expectPrimaryFunctionCardsVisible();
        await currentHomePage.clickRefresh();
        orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);
        orderDishesPage = await flows.inventoryFlow.expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(5),
        );
      });

      await test.step('Recall 减菜 3 份后库存应剩余 6', async () => {
        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage, flows);
        expect(trackedOrderNumber, 'Recall 减菜前应已有目标订单号').toBeTruthy();
        orderDishesPage = await recallPage.orderDetails.openOrderForEditing(trackedOrderNumber as string);
        await orderDishesPage.menu.reduceOrderedDishQuantity(dish.name, 3);
        currentHomePage = await saveOrderAndReturnHome(orderDishesPage);
        await currentHomePage.expectPrimaryFunctionCardsVisible();
        await currentHomePage.clickRefresh();
        orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);
        orderDishesPage = await flows.inventoryFlow.expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(8),
        );
      });
    },
  );

  test(
    '[POS-43898 POS-43890 POS-43889] 送厨后退菜应支持恢复或不恢复库存',
    {
      annotation: jiraIssueAnnotations(['POS-43898', 'POS-43890', 'POS-43889']),
    },
    async ({ homePage, employeeLoginPage, flows }) => {
      test.info().annotations.push({
        type: '已知产品问题',
        description:
          '第二次 Void 前已确认 Restore inventory 隐藏复选框切换为 checked=false，但产品仍把库存从 15 恢复为 20，忽略了“不恢复库存”选择。',
      });
      let trackedOrderNumber: string | null = null;
      let currentHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      let orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);

      orderDishesPage = await test.step('配置 superman item4 为有限库存 20', async () => {
        return await flows.inventoryFlow.configureLimitedStock(orderDishesPage, dish.name, 20);
      });

      await test.step('送厨 10 份后库存应剩余 10', async () => {
        await flows.orderDishesFlow.addRegularDish(orderDishesPage, dish.name, dish.menu, 10);
        currentHomePage = await flows.orderDishesFlow.sendOrderToKitchen(orderDishesPage);
        trackedOrderNumber = await readLatestRecallOrderNumberAndReturnHome(currentHomePage, flows);
        orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);
        orderDishesPage = await flows.inventoryFlow.expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(10),
        );
      });

      await test.step('勾选恢复库存 Void 后库存应回到 20', async () => {
        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage, flows);
        expect(trackedOrderNumber, '送厨后应记录目标 Recall 订单号').toBeTruthy();
        await recallPage.orderDetails.openOrderDetails(trackedOrderNumber as string);
        await recallPage.voidDialog.voidCurrentOrder({ restoreInventory: true });
        await recallPage.exitRecall();
        await currentHomePage.expectPrimaryFunctionCardsVisible();
        await currentHomePage.clickRefresh();
        orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);
        orderDishesPage = await flows.inventoryFlow.expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(20),
        );
      });

      await test.step('不勾选恢复库存 Void 后库存应保持 15', async () => {
        await flows.orderDishesFlow.addRegularDish(orderDishesPage, dish.name, dish.menu, 5);
        currentHomePage = await flows.orderDishesFlow.sendOrderToKitchen(orderDishesPage);
        trackedOrderNumber = await readLatestRecallOrderNumberAndReturnHome(currentHomePage, flows);
        await currentHomePage.expectPrimaryFunctionCardsVisible();
        await currentHomePage.clickRefresh();
        orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);
        orderDishesPage = await flows.inventoryFlow.expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(15),
        );

        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage, flows);
        expect(trackedOrderNumber, '第二次送厨后应更新目标 Recall 订单号').toBeTruthy();
        await recallPage.orderDetails.openOrderDetails(trackedOrderNumber as string);
        await recallPage.voidDialog.voidCurrentOrder({ restoreInventory: false });
        await recallPage.exitRecall();
        await currentHomePage.expectPrimaryFunctionCardsVisible();
        await currentHomePage.clickRefresh();
        orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);
        orderDishesPage = await flows.inventoryFlow.expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(15),
        );
      });
    },
  );

  test(
    '[POS-43891] 库存点餐数量为小数时应正确扣减并在恢复库存后回退',
    {
      annotation: [jiraIssueAnnotation('POS-43891')],
    },
    async ({ homePage, employeeLoginPage, flows }) => {
      let trackedOrderNumber: string | null = null;
      let currentHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      let orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);

      orderDishesPage = await flows.inventoryFlow.configureLimitedStock(orderDishesPage, dish.name, 10);

      await test.step('点小数数量送厨后库存应剩余 6', async () => {
        await flows.orderDishesFlow.addRegularDish(orderDishesPage, dish.name, dish.menu, 1);
        await orderDishesPage.menu.changeOrderedDishQuantity(dish.name, 3.44);
        currentHomePage = await flows.orderDishesFlow.sendOrderToKitchen(orderDishesPage);
        trackedOrderNumber = await readLatestRecallOrderNumberAndReturnHome(currentHomePage, flows);
        orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);
        orderDishesPage = await flows.inventoryFlow.expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(6),
        );
      });

      await test.step('恢复库存 Void 后库存应回到 10', async () => {
        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage, flows);
        expect(trackedOrderNumber, '小数数量送厨后应记录目标 Recall 订单号').toBeTruthy();
        await recallPage.orderDetails.openOrderDetails(trackedOrderNumber as string);
        await recallPage.voidDialog.voidCurrentOrder({ restoreInventory: true });
        await recallPage.exitRecall();

        await currentHomePage.expectPrimaryFunctionCardsVisible();
        await currentHomePage.clickRefresh();
        orderDishesPage = await startInventoryToGoOrder(currentHomePage, flows);
        orderDishesPage = await flows.inventoryFlow.expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(10),
        );
      });
    },
  );

  test(
    '[POS-43892] 超出库存点单保存时应提示库存不足',
    {
      annotation: [jiraIssueAnnotation('POS-43892')],
    },
    async ({ homePage, employeeLoginPage, flows }) => {
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      let orderDishesPage = await startInventoryToGoOrder(readyHomePage, flows);

      orderDishesPage = await flows.inventoryFlow.configureLimitedStock(orderDishesPage, dish.name, 2);
      await orderDishesPage.navigation.exitOrderPage();
      await readyHomePage.expectPrimaryFunctionCardsVisible();
      await readyHomePage.clickRefresh();
      orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
      await flows.orderDishesFlow.addRegularDishByRepeatedCardClicks(
        orderDishesPage,
        dish.name,
        dish.menu,
        3,
      );
      await orderDishesPage.navigation.clickSaveOrder();

      const alertText = await orderDishesPage.navigation.readInventoryAlertText();
      expect(alertText).toBe(inventoryInsufficientStockAlert(dish.name, 2));
    },
  );
  },
);

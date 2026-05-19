import { expect } from '@playwright/test';
import { enterEmployeeContext } from '../../flows/employee-login.flow';
import { expectPosItemStockStateAndReturn, configureLimitedStock } from '../../flows/inventory.flow';
import { openHome } from '../../flows/home.flow';
import { enterWithAvailableLicense } from '../../flows/license-selection.flow';
import { addRegularDish, sendOrderToKitchen } from '../../flows/order-dishes.flow';
import { openRecallFromHome } from '../../flows/recall.flow';
import { startToGoOrder } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import { EmployeeLoginPage } from '../../pages/employee-login.page';
import { HomePage } from '../../pages/home.page';
import { LicenseSelectionPage } from '../../pages/license-selection.page';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import {
  inventoryDishes,
  inventoryInsufficientStockAlert,
  inventoryStockLabel,
} from '../../test-data/inventory';
import { jiraIssueAnnotation, jiraIssueAnnotations } from '../../utils/jira';

type AppEntryPages = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
  licenseSelectionPage: LicenseSelectionPage;
};

const dish = inventoryDishes.supermanItem4;

async function enterReadyHome({
  employeeLoginPage,
  homePage,
  licenseSelectionPage,
}: AppEntryPages): Promise<HomePage> {
  await openHome(homePage);

  if (await licenseSelectionPage.isVisible(30_000)) {
    await enterWithAvailableLicense(licenseSelectionPage, homePage);
  }

  const readyHomePage = await enterEmployeeContext(homePage, employeeLoginPage);
  await readyHomePage.expectPrimaryFunctionCardsVisible();
  return readyHomePage;
}

async function startInventoryToGoOrder(homePage: HomePage): Promise<OrderDishesPage> {
  return await startToGoOrder(homePage);
}

async function saveOrderAndReturnHome(orderDishesPage: OrderDishesPage): Promise<HomePage> {
  const savedHomePage = await orderDishesPage.saveOrder();
  await savedHomePage.expectPrimaryFunctionCardsVisible();
  return savedHomePage;
}

async function recallRecentOrderFromHome(homePage: HomePage, orderDishesPage: OrderDishesPage) {
  await orderDishesPage.exitOrderPage();
  await homePage.expectPrimaryFunctionCardsVisible();
  return await openRecallFromHome(homePage);
}

test.describe('库存管理', () => {
  test.describe.configure({ timeout: 120_000 });

  test(
    '未送厨点菜、加菜、减菜应正确更新库存',
    {
      annotation: jiraIssueAnnotations(['POS-43898', 'POS-43890', 'POS-43889']),
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      let currentHomePage = await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
      let orderDishesPage = await startInventoryToGoOrder(currentHomePage);

      orderDishesPage = await test.step('配置 superman item4 为有限库存 20', async () => {
        return await configureLimitedStock(orderDishesPage, dish.name, 20);
      });

      await test.step('点菜 10 份并保存后库存应剩余 10', async () => {
        await addRegularDish(orderDishesPage, dish.name, dish.menu, 10);
        currentHomePage = await saveOrderAndReturnHome(orderDishesPage);
        orderDishesPage = await startInventoryToGoOrder(currentHomePage);
        orderDishesPage = await expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(10),
        );
      });

      await test.step('Recall 加菜 5 份后库存应剩余 5', async () => {
        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage);
        orderDishesPage = await recallPage.openRecentOrderForEditing();
        await addRegularDish(orderDishesPage, dish.name, dish.menu, 5);
        currentHomePage = await saveOrderAndReturnHome(orderDishesPage);
        orderDishesPage = await startInventoryToGoOrder(currentHomePage);
        orderDishesPage = await expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(5),
        );
      });

      await test.step('Recall 减菜 3 份后库存应剩余 6', async () => {
        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage);
        orderDishesPage = await recallPage.openRecentOrderForEditing();
        await orderDishesPage.reduceOrderedDishQuantity(dish.name, 3);
        currentHomePage = await saveOrderAndReturnHome(orderDishesPage);
        orderDishesPage = await startInventoryToGoOrder(currentHomePage);
        orderDishesPage = await expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(6),
        );
      });
    },
  );

  test(
    '送厨后退菜应支持恢复或不恢复库存',
    {
      annotation: jiraIssueAnnotations(['POS-43898', 'POS-43890', 'POS-43889']),
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      let currentHomePage = await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
      let orderDishesPage = await startInventoryToGoOrder(currentHomePage);

      orderDishesPage = await test.step('配置 superman item4 为有限库存 20', async () => {
        return await configureLimitedStock(orderDishesPage, dish.name, 20);
      });

      await test.step('送厨 10 份后库存应剩余 10', async () => {
        await addRegularDish(orderDishesPage, dish.name, dish.menu, 10);
        currentHomePage = await sendOrderToKitchen(orderDishesPage);
        orderDishesPage = await startInventoryToGoOrder(currentHomePage);
        orderDishesPage = await expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(10),
        );
      });

      await test.step('勾选恢复库存 Void 后库存应回到 20', async () => {
        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage);
        await recallPage.voidRecentVisibleOrder({ restoreInventory: true });
        await recallPage.exitRecall();

        orderDishesPage = await startInventoryToGoOrder(currentHomePage);
        orderDishesPage = await expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(20),
        );
      });

      await test.step('不勾选恢复库存 Void 后库存应保持 15', async () => {
        await addRegularDish(orderDishesPage, dish.name, dish.menu, 5);
        currentHomePage = await sendOrderToKitchen(orderDishesPage);
        orderDishesPage = await startInventoryToGoOrder(currentHomePage);
        orderDishesPage = await expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(15),
        );

        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage);
        await recallPage.voidRecentVisibleOrder({ restoreInventory: false });
        await recallPage.exitRecall();

        orderDishesPage = await startInventoryToGoOrder(currentHomePage);
        orderDishesPage = await expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(15),
        );
      });
    },
  );

  test(
    '库存点餐数量为小数时应正确扣减并在恢复库存后回退',
    {
      annotation: [jiraIssueAnnotation('POS-43891')],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      let currentHomePage = await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
      let orderDishesPage = await startInventoryToGoOrder(currentHomePage);

      orderDishesPage = await configureLimitedStock(orderDishesPage, dish.name, 10);

      await test.step('点小数数量送厨后库存应剩余 6', async () => {
        await addRegularDish(orderDishesPage, dish.name, dish.menu, 1);
        await orderDishesPage.changeOrderedDishQuantity(dish.name, 3.44);
        currentHomePage = await sendOrderToKitchen(orderDishesPage);
        orderDishesPage = await startInventoryToGoOrder(currentHomePage);
        orderDishesPage = await expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(6),
        );
      });

      await test.step('恢复库存 Void 后库存应回到 10', async () => {
        const recallPage = await recallRecentOrderFromHome(currentHomePage, orderDishesPage);
        await recallPage.voidRecentVisibleOrder({ restoreInventory: true });
        await recallPage.exitRecall();

        await currentHomePage.expectPrimaryFunctionCardsVisible();
        await currentHomePage.clickRefresh();
        orderDishesPage = await startInventoryToGoOrder(currentHomePage);
        orderDishesPage = await expectPosItemStockStateAndReturn(
          orderDishesPage,
          dish.name,
          inventoryStockLabel(10),
        );
      });
    },
  );

  test(
    '超出库存点单保存时应提示库存不足',
    {
      annotation: [jiraIssueAnnotation('POS-43892')],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      const readyHomePage = await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
      let orderDishesPage = await startInventoryToGoOrder(readyHomePage);

      orderDishesPage = await configureLimitedStock(orderDishesPage, dish.name, 2);
      await addRegularDish(orderDishesPage, dish.name, dish.menu, 3);
      await orderDishesPage.clickSaveOrder();

      const alertText = await orderDishesPage.readInventoryAlertText();
      expect(alertText).toBe(inventoryInsufficientStockAlert(dish.name, 2));
    },
  );
});

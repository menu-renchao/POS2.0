import { expect } from '@playwright/test';
import { HomeFlow } from '../../flows/home.flow';
import { OrderCustomerFlow } from '../../flows/order-customer.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { OrderPermissionFlow } from '../../flows/order-permission.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import {
  buildOpenFoodWithoutTaxCase,
  buildRequiredPaymentCustomer,
  orderServiceDishes,
  orderServiceKitchenVoidPermissionCase,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

test.describe('录制补充的点单页核心回归', { tag: ['@点单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-42889] 应能在支付前校验客户姓名和电话必填并完成现金支付',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-42889')],
    },
    async ({ apiSetup, employeeLoginPage, homePage }) => {
      await apiSetup.systemConfiguration.updateManyByName({
        IS_PAYMENT_CONFIRM_REQUIRED: true,
        IS_NAME_REQUIRED: true,
        IS_PHONE_REQUIRED: true,
      });

      try {
        const readyHomePage = await test.step('启用支付前客户信息必填配置并刷新 POS', async () => {
          const readyPage = await new HomeFlow().openHomeWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
          await readyPage.clickRefresh();
          return readyPage;
        });

        const orderDishesPage = await test.step('创建 To Go 订单并添加普通菜品', async () => {
          const orderPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return orderPage;
        });

        const paymentPage = await test.step('逐项校验客户必填提示并提交完整客户信息', async () => {
          return await new OrderCustomerFlow().validateRequiredInformationAndOpenPayment(
            orderDishesPage,
            buildRequiredPaymentCustomer(),
          );
        });

        await test.step('完成现金支付', async () => {
          await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
          expect(await paymentPage.isPaymentPanelVisible()).toBe(false);
        });
      } finally {
        await apiSetup.systemConfiguration.updateManyByName({
          IS_PAYMENT_CONFIRM_REQUIRED: false,
          IS_NAME_REQUIRED: false,
          IS_PHONE_REQUIRED: false,
        });
      }
    },
  );

  test(
    '[POS-39750] 应能拦截无送厨删菜权限的员工并通过主管口令完成删菜',
    {
      annotation: [jiraIssueAnnotation('POS-39750')],
    },
    async ({ apiSetup, employeeLoginPage, homePage }) => {
      const restrictedEmployee = await apiSetup.staff.createWithoutKitchenVoidPermission();
      const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
        restrictedEmployee.passcode,
      );

      const sentOrder = await test.step('以受限员工创建两道菜的无桌堂食订单并送厨', async () => {
        const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
        for (const dish of [orderServiceDishes.regular, orderServiceDishes.test]) {
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            dish.name,
            dish.menu,
          );
        }
        return await orderDishesPage.sendOrderWithReference();
      });

      const editingPage = await test.step('从 Recall 精确打开已送厨订单并进入编辑页', async () => {
        const recallPage = await new RecallFlow().openRecallFromHome(sentOrder.homePage);
        return await new RecallFlow().editOrder(recallPage, sentOrder.orderNumber);
      });

      await test.step('校验权限阻断并使用主管口令授权删除已送厨菜品', async () => {
        await new OrderPermissionFlow().removeSentDishWithAuthorization(
          editingPage,
          orderServiceDishes.regular.name,
          orderServiceKitchenVoidPermissionCase.authorizationPasscode,
        );
      });

      const savedHomePage = await test.step('保存授权后的删菜结果并选择作废原因', async () => {
        return await editingPage.saveOrder();
      });

      await test.step('回查同一订单并确认目标菜品标记为已作废', async () => {
        const recallPage = await new RecallFlow().openRecallFromHome(savedHomePage);
        await recallPage.openOrderDetails(sentOrder.orderNumber);
        const detailsText = await recallPage.readOrderDetailsText();
        expect(detailsText).toContain(orderServiceDishes.regular.name);
        expect(detailsText).toContain(orderServiceKitchenVoidPermissionCase.expectedVoidMarker);
      });
    },
  );

  test(
    '[POS-42011] 应能添加不选择税的 Open Food 菜品并完成现金支付',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-42011')],
    },
    async ({ apiSetup, employeeLoginPage, homePage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        'IS_PAYMENT_CONFIRM_REQUIRED',
        false,
        { verify: true },
      );

      try {
        const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        await readyHomePage.clickRefresh();
        const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
        const openFood = buildOpenFoodWithoutTaxCase();

        await test.step('添加 Open Food 并确认无税告警后读取税额', async () => {
          await new OrderDishesFlow().addOpenFoodItemWithoutTax(
            orderDishesPage,
            openFood.name,
            openFood.price,
          );
          expect(await orderDishesPage.readTaxAmount()).toBe(0);
        });

        await test.step('完成无税 Open Food 订单现金支付', async () => {
          const paymentPage = await orderDishesPage.openPayment();
          await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
          expect(await paymentPage.isPaymentPanelVisible()).toBe(false);
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );
});

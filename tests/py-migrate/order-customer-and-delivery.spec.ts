import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';

import { buildAnonymousPickupEditCustomer, buildOrderServiceDineInCustomer, orderServiceCustomDeliveryPrintCase, orderServiceCustomers, orderServiceDeliveryInformationCase, orderServiceDishes } from '../../test-data/order-service';

import { jiraIssueAnnotation } from '../../utils/jira';

test.describe('客户、外送与取餐订单回归', { tag: ['@点单', '@ui-exclusive-config'] }, () => {

  test.describe.configure({ timeout: 180_000 });



  test(
    '[POS-30575] 应能在 Delivery 点单页 Info 和 Recall 中展示一致的客户信息',
    {
      annotation: [jiraIssueAnnotation('POS-30575')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const deliveryResult = await test.step(
        '填写 Delivery 信息并读取点单页客户 Info 与摘要',
        async () => {
          return await flows.takeoutFlow.startDeliveryOrderWithCustomerInformationSnapshot(
            readyHomePage,
            orderServiceDeliveryInformationCase.input,
            orderServiceDeliveryInformationCase.expected.customerButtonLabel,
          );
        },
      );

      await test.step('校验 Info 姓名、电话、地址及保存摘要 Apt 与首次输入一致', async () => {
        expect(deliveryResult.customerInformation.customerName).toBe(
          orderServiceDeliveryInformationCase.input.customerName,
        );
        expect(deliveryResult.customerInformation.normalizedPhone).toBe(
          orderServiceDeliveryInformationCase.input.phoneNumber,
        );
        expect(deliveryResult.customerInformation.informationText.replace(/\s+/g, '')).toContain(
          orderServiceDeliveryInformationCase.input.customerName.replace(/\s+/g, ''),
        );
        expect(deliveryResult.customerInformation.informationText.replace(/\s+/g, '')).toContain(
          orderServiceDeliveryInformationCase.expected.informationText.replace(/\s+/g, ''),
        );
        expect(deliveryResult.orderCustomerSummaryText.replace(/\s+/g, '')).toContain(
          orderServiceDeliveryInformationCase.expected.orderSummaryText.replace(/\s+/g, ''),
        );
      });

      await test.step('添加菜品、保存订单并在 Recall 校验客户信息', async () => {
        await flows.orderDishesFlow.addRegularDish(
          deliveryResult.orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );

        const orderDetails =
          await flows.orderRegressionFlow.saveOrderAndOpenLatestRecallDetails(
            deliveryResult.orderDishesPage,
          );
        expect(orderDetails.customerInfo?.name).toContain(
          orderServiceDeliveryInformationCase.input.customerName,
        );
        expect(orderDetails.customerInfo?.address).toContain(
          orderServiceDeliveryInformationCase.input.address,
        );
        expect(orderDetails.customerInfo?.address).toContain(
          orderServiceDeliveryInformationCase.input.street,
        );
        expect(orderDetails.customerInfo?.note).toContain(
          orderServiceDeliveryInformationCase.input.note,
        );
        expect(orderDetails.customerInfo?.phone.replace(/\D/g, '')).toContain(
          orderServiceDeliveryInformationCase.input.phoneNumber,
        );
      });
    },
  );

  test(
    '[POS-36286] Delivery 填写客户信息进入点单页后应能无提示直接退出',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-36286')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const orderDishesPage = await test.step('填写 Delivery 客户及地址信息并进入点单页', async () => {
        return await flows.takeoutFlow.startDeliveryOrder(
          readyHomePage,
          orderServiceCustomers.delivery,
        );
      });

      await test.step('点击返回后不出现确认提示并直接回到 POS 首页', async () => {
        const returnedHomePage = await orderDishesPage.navigation.exitOrderPageWithoutConfirmation();
        await returnedHomePage.expectPrimaryFunctionCardsVisible();
      });
    },
  );

  test(
    '[POS-22640] 自定义 Delivery 应能保存订单并打单成功',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-22640')],
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const customDeliveryCase = orderServiceCustomDeliveryPrintCase;

      const configured = await test.step('启用并映射自定义订单类型 1 为 Delivery', async () => {
        return await apiSetup.customOrderType.configureDelivery({
          name: customDeliveryCase.customOrderType.name,
          displayName: customDeliveryCase.customOrderType.displayName,
          shortName: customDeliveryCase.customOrderType.shortName,
        });
      });

      expect(configured.orderType.orderType).toBe('DELIVERY');
      expect(configured.layout.hide).toBe(false);
      expect(configured.layout.layoutType).toBe('BODY');

      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      await readyHomePage.clickRefresh();

      const orderDishesPage = await test.step('从自定义类型入口录入 Delivery 信息并添加菜品', async () => {
        const page = await flows.takeoutFlow.startCustomDeliveryOrderType1(
          readyHomePage,
          employeeLoginPage,
          customDeliveryCase.customer,
        );
        const orderFlow = flows.orderDishesFlow;

        for (const dish of customDeliveryCase.dishes) {
          await orderFlow.addRegularDish(page, dish.name, dish.menu);
        }

        return page;
      });

      const savedOrder = await test.step('保存并确认请求使用自定义订单类型', async () => {
        const result = await orderDishesPage.navigation.saveOrderWithReference();
        expect(result.orderType).toBe(customDeliveryCase.customOrderType.name);
        return result;
      });

      const recallFlow = flows.recallFlow;
      const recallPage = await recallFlow.openRecallFromHome(savedOrder.homePage);

      await test.step('Recall 精确回查自定义 Delivery 的客户和菜品', async () => {
        const details = await recallFlow.viewOrderDetails(recallPage, savedOrder.orderNumber);

        expect(details.customerInfo?.name).toBe(customDeliveryCase.customer.customerName);
        expect(details.customerInfo?.phone.replace(/\D/g, '')).toBe(
          customDeliveryCase.customer.phoneNumber,
        );
        expect(details.items.map((item) => item.name)).toEqual(
          customDeliveryCase.dishes.map((dish) => dish.name),
        );
      });

      await test.step('从 Recall 点击 Print 并确认打单接口成功', async () => {
        const status = await recallFlow.printOrderAndReadKitchenTicketStatus(
          recallPage,
          savedOrder.orderNumber,
        );
        expect(status).toBe(200);
      });
    },
  );

  test(
    '[POS-42943] 修改一笔匿名 Pick Up 订单的客户姓名不应影响另一笔订单',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-42943')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const firstOrder = await test.step('创建第一笔匿名 Pick Up 订单', async () => {
        const orderDishesPage = await flows.takeoutFlow.startPickUpOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return await orderDishesPage.navigation.saveOrderWithReference();
      });

      const secondOrder = await test.step('创建第二笔匿名 Pick Up 订单', async () => {
        const orderDishesPage = await flows.takeoutFlow.startPickUpOrder(firstOrder.homePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );
        return await orderDishesPage.navigation.saveOrderWithReference();
      });

      const customer = buildAnonymousPickupEditCustomer();
      const editedHomePage = await test.step('只为第一笔订单补充客户姓名和电话', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(secondOrder.homePage);
        const editingPage = await flows.recallFlow.editOrder(
          recallPage,
          firstOrder.orderNumber,
        );
        await flows.orderCustomerFlow.addCustomerInformationToOrder(editingPage, customer);
        return (await editingPage.navigation.saveOrderWithReference()).homePage;
      });

      await test.step('按精确订单号确认两笔订单客户信息相互隔离', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(editedHomePage);
        const recallFlow = flows.recallFlow;
        const firstDetails = await recallFlow.viewOrderDetails(
          recallPage,
          firstOrder.orderNumber,
        );
        const secondDetails = await recallFlow.viewOrderDetails(
          recallPage,
          secondOrder.orderNumber,
        );

        expect(firstDetails.customerInfo?.name).toBe(customer.customerName);
        expect(secondDetails.customerInfo?.name?.trim() ?? '').toBe('');
      });
    },
  );

  test(
    '[POS-31409] 应能在无姓名堂食订单补充客户信息并在 Recall 详情及编辑页展示',
    {
      tag: ['@smoke'],
      annotation: [jiraIssueAnnotation('POS-31409')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });
      const customer = buildOrderServiceDineInCustomer();

      const orderDishesPage = await test.step('进入无桌堂食并补充客户信息', async () => {
        const page = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        const customerButtonText = await flows.orderCustomerFlow.addCustomerInformationToOrder(
          page,
          customer,
        );

        expect(customerButtonText).toBe(customer.customerButtonLabel);
        return page;
      });

      await test.step('保存订单并校验 Recall 详情卡片和 Edit 点单页客户信息', async () => {
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );

        const recallPage = await flows.orderRegressionFlow.saveOrderAndOpenRecallPage(orderDishesPage);
        const orderDetails = await flows.recallFlow.viewFirstVisibleOrderDetails(recallPage);

        expect(orderDetails.customerInfo?.name).toBe(customer.customerName);
        expect(orderDetails.customerInfo?.phone.replace(/\D/g, '')).toBe(customer.phoneNumber);

        const editingPage = await flows.recallFlow.editFirstVisibleOrder(recallPage);
        await editingPage.customer.openCustomerInformationPage(customer.customerButtonLabel);
        const editingCustomer = await editingPage.customer.readCustomerInformationPageIdentity();

        expect(editingCustomer.customerName).toBe(customer.customerName);
        expect(editingCustomer.normalizedPhone).toBe(customer.phoneNumber);
        await editingPage.customer.saveCustomerInformationPage();
        await editingPage.navigation.exitOrderPage();
      });
    },
  );
});

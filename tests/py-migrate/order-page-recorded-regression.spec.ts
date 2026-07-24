import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import {
  buildOpenFoodWithoutTaxCase,
  buildRequiredPaymentCustomer,
  orderServiceDecimalReduceCase,
  orderServiceDecimalSplitCase,
  orderServiceDishes,
  orderServiceKitchenVoidPermissionCase,
  orderServiceReduceCategoryCase,
  orderServiceSameDishKitchenCombineCase,
  orderServiceSameDishSeparateCase,
  orderServiceSameDishStatusCombineCase,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

test.describe('录制补充的点单页核心回归', { tag: ['@点单', '@ui-exclusive-config'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-42889] 应能在支付前校验客户姓名和电话必填并完成现金支付',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-42889')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      const restoreConfiguration =
        await apiSetup.systemConfiguration.updateManyByName(
          {
            IS_PAYMENT_CONFIRM_REQUIRED: true,
            IS_NAME_REQUIRED: true,
            IS_PHONE_REQUIRED: true,
          },
          { verify: true },
        );

      try {
        const readyHomePage = await test.step('启用支付前客户信息必填配置并刷新 POS', async () => {
          const readyPage = await flows.homeFlow.openHomeWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
          await readyPage.clickRefresh();
          return readyPage;
        });

        const orderDishesPage = await test.step('创建 To Go 订单并添加普通菜品', async () => {
          const orderPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
          await flows.orderDishesFlow.addRegularDish(
            orderPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return orderPage;
        });

        const paymentPage = await test.step('逐项校验客户必填提示并提交完整客户信息', async () => {
          return await flows.orderCustomerFlow.validateRequiredInformationAndOpenPayment(
            orderDishesPage,
            buildRequiredPaymentCustomer(),
          );
        });

        await test.step('完成现金支付', async () => {
          await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
          expect(await paymentPage.isPaymentPanelVisible()).toBe(false);
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-39750] 应能拦截无送厨删菜权限的员工并通过主管口令完成删菜',
    {
      annotation: [jiraIssueAnnotation('POS-39750')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      const restrictedEmployee = await apiSetup.staff.createWithoutKitchenVoidPermission();
      const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
        restrictedEmployee.passcode,
      );

      const sentOrder = await test.step('以受限员工创建两道菜的无桌堂食订单并送厨', async () => {
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        for (const dish of [orderServiceDishes.regular, orderServiceDishes.test]) {
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            dish.name,
            dish.menu,
          );
        }
        return await orderDishesPage.navigation.sendOrderWithReference();
      });

      const editingPage = await test.step('从 Recall 精确打开已送厨订单并进入编辑页', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(sentOrder.homePage);
        return await flows.recallFlow.editOrder(recallPage, sentOrder.orderNumber);
      });

      await test.step('校验权限阻断并使用主管口令授权删除已送厨菜品', async () => {
        await flows.orderPermissionFlow.removeSentDishWithAuthorization(
          editingPage,
          orderServiceDishes.regular.name,
          orderServiceKitchenVoidPermissionCase.authorizationPasscode,
        );
      });

      const savedHomePage = await test.step('保存授权后的删菜结果并选择作废原因', async () => {
        return await editingPage.navigation.saveOrder();
      });

      await test.step('回查同一订单并确认目标菜品标记为已作废', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(savedHomePage);
        await recallPage.orderDetails.openOrderDetails(sentOrder.orderNumber);
        const detailsText = await recallPage.orderDetails.readOrderDetailsText();
        expect(detailsText).toContain(orderServiceDishes.regular.name);
        expect(detailsText).toContain(orderServiceKitchenVoidPermissionCase.expectedVoidMarker);
      });
    },
  );

  test(
    '[POS-34873] 应能拦截无权限员工删除 Hold 菜品并通过主管口令完成删除',
    {
      annotation: [jiraIssueAnnotation('POS-34873')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      test.info().annotations.push({
        type: '已知产品问题',
        description:
          '受限员工对 Delay 菜品执行 Count=0 后，产品未显示 VOID_KITCHEN_ITEM 授权提示，无法继续输入主管口令完成删除。',
      });
      const restrictedEmployee = await apiSetup.staff.createWithoutKitchenVoidPermission();
      const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
        restrictedEmployee.passcode,
      );

      const sentOrder = await test.step('以受限员工创建两道菜的无桌堂食订单并送厨', async () => {
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        for (const dish of [orderServiceDishes.regular, orderServiceDishes.test]) {
          await flows.orderDishesFlow.addRegularDish(orderDishesPage, dish.name, dish.menu);
        }
        return await orderDishesPage.navigation.sendOrderWithReference();
      });

      await test.step('将目标已送厨菜品设置为 Hold', async () => {
        await flows.orderKitchenFlow.holdSentDish(
          apiSetup.kitchen,
          sentOrder.orderItems,
          orderServiceDishes.regular.name,
        );
      });

      const editingPage = await test.step('从 Recall 精确打开 Hold 订单并进入编辑页', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(sentOrder.homePage);
        return await flows.recallFlow.editOrder(recallPage, sentOrder.orderNumber);
      });

      await test.step('校验权限阻断并使用主管口令授权 Reduce 删除 Hold 菜品', async () => {
        await flows.orderPermissionFlow.removeSentDishWithAuthorization(
          editingPage,
          orderServiceDishes.regular.name,
          orderServiceKitchenVoidPermissionCase.authorizationPasscode,
        );
      });

      const savedHomePage = await test.step('保存授权后的删菜结果并选择作废原因', async () => {
        return await editingPage.navigation.saveOrder();
      });

      await test.step('回查同一订单并确认 Hold 菜品标记为已作废', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(savedHomePage);
        await recallPage.orderDetails.openOrderDetails(sentOrder.orderNumber);
        const detailsText = await recallPage.orderDetails.readOrderDetailsText();
        expect(detailsText).toContain(orderServiceDishes.regular.name);
        expect(detailsText).toContain(orderServiceKitchenVoidPermissionCase.expectedVoidMarker);
      });
    },
  );

  test(
    '[POS-35325] 应能拦截无权限员工通过 Count 删除 Delay 菜品并通过主管口令完成删除',
    {
      annotation: [jiraIssueAnnotation('POS-35325')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      const restrictedEmployee = await apiSetup.staff.createWithoutKitchenVoidPermission();
      const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
        restrictedEmployee.passcode,
      );

      const sentOrder = await test.step('以受限员工创建两道菜的无桌堂食订单并送厨', async () => {
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        for (const dish of [orderServiceDishes.regular, orderServiceDishes.test]) {
          await flows.orderDishesFlow.addRegularDish(orderDishesPage, dish.name, dish.menu);
        }
        return await orderDishesPage.navigation.sendOrderWithReference();
      });

      await test.step('将目标已送厨菜品设置为 Delay', async () => {
        await flows.orderKitchenFlow.delaySentDish(
          apiSetup.kitchen,
          sentOrder.orderItems,
          orderServiceDishes.regular.name,
          orderServiceKitchenVoidPermissionCase.delayInMillis,
        );
      });

      const editingPage = await test.step('从 Recall 精确打开 Delay 订单并进入编辑页', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(sentOrder.homePage);
        return await flows.recallFlow.editOrder(recallPage, sentOrder.orderNumber);
      });

      await test.step('校验 Count=0 被权限阻断并使用主管口令完成授权', async () => {
        await flows.orderPermissionFlow.removeDelayedDishByCountWithAuthorization(
          editingPage,
          orderServiceDishes.regular.name,
          orderServiceKitchenVoidPermissionCase.authorizationPasscode,
        );
      });

      const savedHomePage = await test.step('保存授权后的删菜结果并选择作废原因', async () => {
        return await editingPage.navigation.saveOrder();
      });

      await test.step('回查同一订单并确认 Delay 菜品标记为已作废', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(savedHomePage);
        await recallPage.orderDetails.openOrderDetails(sentOrder.orderNumber);
        const detailsText = await recallPage.orderDetails.readOrderDetailsText();
        expect(detailsText).toContain(orderServiceDishes.regular.name);
        expect(detailsText).toContain(orderServiceKitchenVoidPermissionCase.expectedVoidMarker);
      });
    },
  );

  test(
    '[POS-34895] 应能按配置将连续添加的相同菜分为独立订单行',
    {
      annotation: [jiraIssueAnnotation('POS-34895')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        orderServiceSameDishSeparateCase.configuration,
        { verify: true },
      );

      try {
        const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        await readyHomePage.clickRefresh();
        await readyHomePage.confirmDelayedConfigurationRefresh();
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);

        await test.step('连续三次添加同一道普通菜', async () => {
          for (let index = 0; index < orderServiceSameDishSeparateCase.expectedLineCount; index += 1) {
            await flows.orderDishesFlow.addRegularDish(
              orderDishesPage,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
          }
        });

        await test.step('校验相同菜分为三行且每行数量为一', async () => {
          const matchingItems = (await orderDishesPage.reads.readOrderedItems()).filter(
            (item) => item.name === orderServiceDishes.regular.name,
          );
          expect(matchingItems).toHaveLength(orderServiceSameDishSeparateCase.expectedLineCount);
          expect(matchingItems.map((item) => item.quantity)).toEqual(
            Array(orderServiceSameDishSeparateCase.expectedLineCount).fill(
              orderServiceSameDishSeparateCase.expectedQuantityPerLine,
            ),
          );
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-34903] 应能仅合并状态一致的相同菜并与已送厨菜分行展示',
    {
      annotation: [jiraIssueAnnotation('POS-34903')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        orderServiceSameDishStatusCombineCase.configuration,
        { verify: true },
      );

      try {
        const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        await readyHomePage.clickRefresh();
        await readyHomePage.confirmDelayedConfigurationRefresh();
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);

        const sentOrder = await test.step('添加普通菜并送厨', async () => {
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return await orderDishesPage.navigation.sendOrderWithReference();
        });

        const recallPage = await flows.recallFlow.openRecallFromHome(sentOrder.homePage);
        const editingPage = await flows.recallFlow.editOrder(recallPage, sentOrder.orderNumber);

        await test.step('在已送厨订单中连续两次添加同一道普通菜', async () => {
          for (let index = 0; index < orderServiceSameDishStatusCombineCase.newDishAdds; index += 1) {
            await flows.orderDishesFlow.addRegularDish(
              editingPage,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
          }
        });

        await test.step('校验已送厨菜与新加菜分行且新加同状态菜合并', async () => {
          const rowStates = await editingPage.reads.readOrderedDishRowStates(orderServiceDishes.regular.name);
          const sentRow = rowStates.find((row) => row.sentToKitchen);
          const pendingRow = rowStates.find((row) => !row.sentToKitchen);

          expect(rowStates).toHaveLength(orderServiceSameDishStatusCombineCase.expectedLineCount);
          expect(sentRow?.quantity).toBe(orderServiceSameDishStatusCombineCase.sentQuantity);
          expect(pendingRow?.quantity).toBe(orderServiceSameDishStatusCombineCase.pendingQuantity);
        });

        await editingPage.navigation.saveOrder();
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-34910] 应能将新加同菜合并到已送厨行并显示厨房数量和红色菜名',
    {
      annotation: [jiraIssueAnnotation('POS-34910')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        orderServiceSameDishKitchenCombineCase.configuration,
        { verify: true },
      );

      try {
        const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        await readyHomePage.clickRefresh();
        await readyHomePage.confirmDelayedConfigurationRefresh();
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);

        const sentOrder = await test.step('添加普通菜并送厨', async () => {
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return await orderDishesPage.navigation.sendOrderWithReference();
        });

        const recallPage = await flows.recallFlow.openRecallFromHome(sentOrder.homePage);
        const editingPage = await flows.recallFlow.editOrder(recallPage, sentOrder.orderNumber);

        await test.step('在已送厨订单中继续添加同一道普通菜', async () => {
          for (let index = 0; index < orderServiceSameDishKitchenCombineCase.newDishAdds; index += 1) {
            await flows.orderDishesFlow.addRegularDish(
              editingPage,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
          }
        });

        await test.step('校验同菜合并到一行并展示厨房数量和红色菜名', async () => {
          const rowStates = await editingPage.reads.readOrderedDishRowStates(orderServiceDishes.regular.name);

          expect(rowStates).toHaveLength(orderServiceSameDishKitchenCombineCase.expectedLineCount);
          expect(rowStates[0]?.quantity).toBe(orderServiceSameDishKitchenCombineCase.expectedTotalQuantity);
          expect(rowStates[0]?.kitchenQuantity).toBe(
            orderServiceSameDishKitchenCombineCase.expectedKitchenQuantity,
          );
          expect(await editingPage.reads.readOrderedDishNameColor(orderServiceDishes.regular.name)).toBe(
            orderServiceSameDishKitchenCombineCase.expectedDishNameColor,
          );
        });

        await editingPage.navigation.saveOrder();
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-34842] 关闭减菜自动跳转后应在删除跨类别菜品时停留当前类别',
    {
      annotation: [jiraIssueAnnotation('POS-34842')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        orderServiceReduceCategoryCase.configuration,
        { verify: true },
      );

      try {
        const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        await readyHomePage.clickRefresh();
        await readyHomePage.confirmDelayedConfigurationRefresh();
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);

        await test.step('从两个不同菜单类别各添加一道普通菜', async () => {
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.alternateCategory.name,
            orderServiceDishes.alternateCategory.menu,
          );
          expect(await orderDishesPage.menu.readSelectedMenuCategoryName()).toBe(
            orderServiceReduceCategoryCase.expectedCategory,
          );
        });

        await test.step('将当前类别的菜品减到删除并校验仍停留原类别', async () => {
          await orderDishesPage.menu.reduceOrderedDishQuantity(orderServiceDishes.alternateCategory.name, 1);
          const orderedDishNames = (await orderDishesPage.reads.readOrderedItems()).map((item) => item.name);

          expect(orderedDishNames).toContain(orderServiceDishes.regular.name);
          expect(orderedDishNames).not.toContain(orderServiceDishes.alternateCategory.name);
          expect(await orderDishesPage.menu.readSelectedMenuCategoryName()).toBe(
            orderServiceReduceCategoryCase.expectedCategory,
          );
        });

      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-33186] 小数数量菜品应先按一份递减再在不足一份时删除',
    {
      annotation: [jiraIssueAnnotation('POS-33186')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        orderServiceDecimalReduceCase.configuration,
        { verify: true },
      );

      try {
        const readyHomePage = await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);

        await test.step('添加普通菜并将数量修改为一点二五', async () => {
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.menu.changeOrderedDishQuantity(
            orderServiceDishes.regular.name,
            orderServiceDecimalReduceCase.initialQuantity,
          );
        });

        await test.step('第一次减菜后数量应变为零点二五', async () => {
          await orderDishesPage.menu.reduceOrderedDishQuantity(orderServiceDishes.regular.name, 1);
          const rowStates = await orderDishesPage.reads.readOrderedDishRowStates(orderServiceDishes.regular.name);
          expect(rowStates[0]?.quantity).toBe(orderServiceDecimalReduceCase.expectedAfterFirstReduce);
        });

        await test.step('第二次减菜后应删除菜品', async () => {
          await orderDishesPage.menu.reduceOrderedDishQuantity(orderServiceDishes.regular.name, 1);
          await orderDishesPage.reads.expectOrderedDishAbsent(orderServiceDishes.regular.name);
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-33241] 应能通过点击菜品新增子单并保持小数数量和价格正确',
    {
      tag: ['@分单'],
      annotation: [jiraIssueAnnotation('POS-33241')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      test.setTimeout(90_000);
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        orderServiceDecimalSplitCase.configuration,
        { verify: true },
      );

      try {
        const readyHomePage = await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
        const orderFlow = flows.orderDishesFlow;

        await test.step('添加小数数量菜品和另一道普通菜', async () => {
          await orderFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.menu.changeOrderedDishQuantity(
            orderServiceDishes.regular.name,
            orderServiceDecimalSplitCase.quantity,
          );
          await orderFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );
        });

        const splitOrderPage = await orderDishesPage.navigation.openSplitOrder();
        const splitFlow = flows.splitOrderFlow;
        await test.step('点击普通菜二并通过 Add Suborder 新增子单', async () => {
          await splitFlow.moveDishToNewSuborder(splitOrderPage, orderServiceDishes.test.name);
        });

        const splitSnapshot = await splitOrderPage.readSnapshot();
        const decimalDishOrder = splitSnapshot.suborders.find((suborder) =>
          suborder.dishes.some((dish) => dish.name === orderServiceDishes.regular.name),
        );
        expect(decimalDishOrder, '分单页面应保留小数数量菜品所在子单').toBeDefined();

        await test.step('校验分单页面小数数量和行金额正确', async () => {
          const display = await splitOrderPage.readDishDisplay(
            decimalDishOrder!.orderNumber,
            orderServiceDishes.regular.name,
          );
          expect(display.quantity).toBe(String(orderServiceDecimalSplitCase.quantity));
          expect(display.price).toBe(orderServiceDecimalSplitCase.expectedLinePrice);
          expect(splitSnapshot.suborders).toHaveLength(2);
        });

        const returnedPage = await splitFlow.submitAndReturnPage(splitOrderPage);
        const recallPage = await flows.recallFlow.openRecallFromSplitReturnPage(returnedPage, homePage);
        const parentOrderNumber = decimalDishOrder!.orderNumber.replace(/-\d+$/, '');

        await test.step('从 Recall 回查小数数量子单', async () => {
          await recallPage.orderDetails.openOrderDetails(parentOrderNumber, decimalDishOrder!.orderNumber);
          const detailsText = await recallPage.orderDetails.readOrderDetailsText();
          expect(detailsText).toContain(orderServiceDishes.regular.name);
          expect(detailsText).toContain(String(orderServiceDecimalSplitCase.quantity));
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-42011] 应能添加不选择税的 Open Food 菜品并完成现金支付',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-42011')],
    },
    async ({ apiSetup, employeeLoginPage, homePage, flows }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        'IS_PAYMENT_CONFIRM_REQUIRED',
        false,
        { verify: true },
      );

      try {
        const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        await readyHomePage.clickRefresh();
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        const openFood = buildOpenFoodWithoutTaxCase();

        await test.step('添加 Open Food 并确认无税告警后读取税额', async () => {
          await flows.orderDishesFlow.addOpenFoodItemWithoutTax(
            orderDishesPage,
            openFood.name,
            openFood.price,
          );
          expect(await orderDishesPage.reads.readTaxAmount()).toBe(0);
        });

        await test.step('完成无税 Open Food 订单现金支付', async () => {
          const paymentPage = await orderDishesPage.navigation.openPayment();
          await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
          expect(await paymentPage.isPaymentPanelVisible()).toBe(false);
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );
});

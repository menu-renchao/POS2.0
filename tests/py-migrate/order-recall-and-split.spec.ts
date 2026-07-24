import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';

import { orderServiceDishes, orderServiceEditRecallTaxCase, orderServiceSplitChildDiscountCase } from '../../test-data/order-service';

import { jiraIssueAnnotation } from '../../utils/jira';

import { parseCurrencyAmount } from '../../utils/currency';

const recallDishRoundTripCases = [
  {
    title: '[POS-15641] 应能 To Go 点另一个分类菜品后在 Recall 校验菜品名称和价格',
    issue: 'POS-15641',
    dish: orderServiceDishes.test,
    stepTitle: '从 To Go 进入点单页，添加 test 菜品并保存后在 Recall 校验',
  },
] as const;

test.describe('点单保存、Recall 编辑与分单回归', { tag: ['@点单', '@ui-exclusive-config'] }, () => {

  test.describe.configure({ timeout: 180_000 });



  test(
    '[POS-30543] 应能堂食保存后在 Recall 编辑菜品数量并校验税额实时更新',
    {
      tag: ['@smoke'],
      annotation: [jiraIssueAnnotation('POS-30543')],
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        'BREAK_OR_COMBIN_SAME_DISHES',
        true,
        { verify: true },
      );

      try {
        const readyHomePage = await test.step('启用同菜合并配置并刷新 POS', async () => {
          const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
          await readyPage.clickRefresh();
          return readyPage;
        });

        const savedOrderContext = await test.step('创建无桌堂食订单并保存精确订单号', async () => {
          const selectTablePage = await readyHomePage.enterDineIn();
          const orderDishesPage = await flows.selectTableFlow.skipTableSelectionAndEnterOrderDishes(
            selectTablePage,
          );
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );

          const savedOrder = await orderDishesPage.navigation.saveOrderWithReference();
          await savedOrder.homePage.expectPrimaryFunctionCardsVisible();
          return savedOrder;
        });

        const recallBeforeEdit = await test.step('按精确订单号读取编辑前小计和税额', async () => {
          const recallPage = await flows.recallFlow.openRecallFromHome(savedOrderContext.homePage);
          await recallPage.orderDetails.openOrderDetails(savedOrderContext.orderNumber);
          const orderDetails = await recallPage.orderDetails.readOrderDetailsSnapshot();
          const testItem = orderDetails.items.find(
            (item) => item.name === orderServiceDishes.test.name,
          );

          expect(testItem?.price, 'Recall 中目标菜品应有单价').toBeTruthy();
          expect(orderDetails.priceSummary.Subtotal, '编辑前应能读取 Subtotal').toBeGreaterThan(0);
          expect(orderDetails.priceSummary.Tax, '编辑前应能读取税额').toBeGreaterThan(0);

          return {
            recallPage,
            subtotal: orderDetails.priceSummary.Subtotal,
            tax: orderDetails.priceSummary.Tax,
            testItemPrice: parseCurrencyAmount(testItem?.price),
          };
        });

        const editResult = await test.step('从 Recall 编辑目标订单，将同一菜品数量加一后保存', async () => {
          const editingOrderDishesPage = await flows.recallFlow.editOrder(
            recallBeforeEdit.recallPage,
            savedOrderContext.orderNumber,
          );
          await flows.orderDishesFlow.increaseOrderedDishQuantityByOne(
            editingOrderDishesPage,
            orderServiceDishes.test.name,
          );

          const editedSummary = await editingOrderDishesPage.reads.readPriceSummary();
          expect(editedSummary.Subtotal - recallBeforeEdit.subtotal).toBeCloseTo(
            recallBeforeEdit.testItemPrice,
            2,
          );

          const savedOrder = await editingOrderDishesPage.navigation.saveOrderWithReference();
          return { ...savedOrder, subtotal: editedSummary.Subtotal };
        });

        await test.step('回查同一订单并校验数量、小计和税额均已更新', async () => {
          const refreshedHomePage = await flows.employeeLoginFlow.enterEmployeeContext(
            editResult.homePage,
            employeeLoginPage,
          );
          const recallPage = await flows.recallFlow.openRecallFromHome(refreshedHomePage);
          await recallPage.orderDetails.openOrderDetails(editResult.orderNumber);
          const orderDetails = await recallPage.orderDetails.readOrderDetailsSnapshot();
          const subtotalAfterEdit = orderDetails.priceSummary.Subtotal;
          const taxAfterEdit = orderDetails.priceSummary.Tax;

          const savedTargetQuantity = orderDetails.items
            .filter((item) => item.name === orderServiceDishes.test.name)
            .reduce((total, item) => total + Number(item.quantity), 0);
          expect(savedTargetQuantity).toBe(
            Number(orderServiceEditRecallTaxCase.editedTestDishQuantity),
          );
          expect(subtotalAfterEdit).toBe(editResult.subtotal);
          expect(taxAfterEdit, '数量增加后税额应增加').toBeGreaterThan(recallBeforeEdit.tax);
          expect(taxAfterEdit / subtotalAfterEdit).toBeCloseTo(
            recallBeforeEdit.tax / recallBeforeEdit.subtotal,
            2,
          );
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );



  for (const testCase of recallDishRoundTripCases) {
    test(
      testCase.title,
      {
        annotation: [jiraIssueAnnotation(testCase.issue)],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        await test.step(testCase.stepTitle, async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);

          await flows.orderDishesFlow.addRegularDish(orderDishesPage, testCase.dish.name, testCase.dish.menu);
          await flows.orderOptionVerificationFlow.expectLatestRecallDishMatches(
            orderDishesPage,
            testCase.dish.name,
          );
        });
      },
    );
  }

  test(
    '[POS-36254] 按菜分单后子单折扣界面应显示当前子单整单金额',
    {
      tag: ['@点单', '@分单', '@加收'],
      annotation: [jiraIssueAnnotation('POS-36254')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const splitCase = orderServiceSplitChildDiscountCase;
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
      const orderFlow = flows.orderDishesFlow;

      await test.step('创建包含三条普通菜的无桌堂食订单', async () => {
        for (const dish of splitCase.orderLines) {
          await orderFlow.addRegularDish(orderDishesPage, dish.name, dish.menu);
        }
      });

      const splitResult = await test.step('点击菜品并通过 Add Suborder 建立子单', async () => {
        const splitOrderPage = await orderDishesPage.navigation.openSplitOrder();
        const splitFlow = flows.splitOrderFlow;
        await splitFlow.moveDishToNewSuborder(splitOrderPage, splitCase.movedDishName);
        const snapshot = await splitOrderPage.readSnapshot();
        const movedDishSuborder = snapshot.suborders.find((suborder) =>
          suborder.dishes.some((dish) => dish.name === splitCase.movedDishName),
        );

        expect(snapshot.suborders, '按菜分单后应形成两个子单').toHaveLength(2);
        expect(movedDishSuborder, '新子单应包含被点击移动的菜品').toBeTruthy();
        expect(movedDishSuborder?.dishes.map((dish) => dish.name)).toEqual([
          splitCase.movedDishName,
        ]);

        const returnedPage = await splitFlow.submitAndReturnPage(splitOrderPage);
        return {
          movedDishSuborderNumber: movedDishSuborder?.orderNumber ?? '',
          recallPage: await flows.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage),
        };
      });

      const targetDetails = await test.step('在 Recall 精确打开移动菜品所在子单并读取金额', async () => {
        const recallFlow = flows.recallFlow;
        const orderNumber = await recallFlow.readLatestVisibleOrderNumber(splitResult.recallPage);
        await splitResult.recallPage.orderDetails.openOrderDetails(orderNumber);
        const targetOrderNumbers = await splitResult.recallPage.orderDetails.readTargetOrderNumbers();
        const targetOrderNumber = targetOrderNumbers[splitCase.targetSuborderIndex];

        expect(targetOrderNumbers, 'Recall 应展示两个分单子单').toHaveLength(2);
        expect(targetOrderNumber, '应能解析新增子单引用').toBeTruthy();

        await splitResult.recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
        const details = await splitResult.recallPage.orderDetails.readOrderDetailsSnapshot();

        expect(details.orderNumber.replace(/^#/, '')).toBe(
          splitResult.movedDishSuborderNumber.replace(/^#/, ''),
        );
        expect(details.items.map((item) => item.name)).toEqual([splitCase.movedDishName]);
        expect(details.priceSummary.Subtotal).toBeGreaterThan(0);

        return { details, orderNumber, targetOrderNumber };
      });

      await test.step('打开子单 Discount 并校验 Whole Order 为当前子单金额', async () => {
        await splitResult.recallPage.orderDetails.clickDiscountInOrderDetails();
        const wholeOrderSummary =
          await splitResult.recallPage.orderDetails.readDiscountWholeOrderSummary();

        expect(wholeOrderSummary.orderNumber).toBe(targetDetails.details.orderNumber);
        expect(wholeOrderSummary.subtotal).toBeCloseTo(
          targetDetails.details.priceSummary.Subtotal,
          2,
        );
      });
    },
  );
});

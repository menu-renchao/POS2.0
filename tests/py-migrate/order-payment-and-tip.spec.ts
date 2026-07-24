import { expect } from '@playwright/test';
import { test, type FlowFixtures } from '../../fixtures/test.fixture';
import { EmployeeLoginPage } from '../../pages/employee-login.page';
import { HomePage } from '../../pages/home.page';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import { RecallPage } from '../../pages/recall.page';
import {
  buildLargeTipAmountInCents,
  buildAnonymousPickupEditCustomer,
  buildOrderServiceCategoryPosNameCase,
  buildOrderServiceOrderChargeExcludedCategoryCase,
  buildOrderServiceMenuProductModeCase,
  buildOrderServiceRequiredCategoryCase,
  buildOrderServiceDineInCustomer,
  orderServiceCategoryOptions,
  orderServiceChineseInitialSearchCase,
  orderServiceComboOptionRemovalCase,
  orderServiceComboParentOptionCase,
  orderServiceComboSubItemPriceCase,
  orderServiceComboSubItemNotePermissionCase,
  orderServiceCustomDeliveryPrintCase,
  orderServiceCustomers,
  orderServiceDeliveryInformationCase,
  orderServiceDishes,
  orderServiceEditRecallTaxCase,
  orderServiceMenu,
  orderServiceModifyGlobalOptionCase,
  orderServiceOpenFoodChineseKeyboardCase,
  orderServiceSavedComboSubItemModifyCase,
  orderServiceSameNameAndNumberSearchCase,
  orderServiceSplitChildDiscountCase,
  orderServiceSplitTipsCase,
  orderServiceSearchMenuConfigurationCase,
} from '../../test-data/order-service';
import {
  RecallManualSearchTags,
  RecallPaymentStatuses,
  RecallOrderPaymentSuccessStatus,
} from '../../test-data/recall-search-options';
import { jiraIssueAnnotation, jiraIssueAnnotations } from '../../utils/jira';
import { waitUntil } from '../../utils/wait';

test.describe('点单支付与小费回归', { tag: ['@点单', '@ui-exclusive-config'] }, () => {
test.describe('支付回归', () => {
    test(
      '应能在 Recall 为最新 To Go 订单完成现金支付后看到 Success 状态',
      {
        tag: ['@现金支付'],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const paymentFlow = flows.paymentFlow;
        const recallPage = await test.step('创建 To Go 订单并保存后进入 Recall', async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );

          return await flows.orderRegressionFlow.saveOrderAndOpenRecallPage(orderDishesPage);
        });

        const latestOrderNumber = await test.step('读取最新订单号并从 Recall 详情进入支付页', async () => {
          const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
          await recallPage.orderDetails.openOrderDetails(orderNumber);
          const paymentPage = await recallPage.orderDetails.openPayment();
          await paymentFlow.payByCash(paymentPage, { printReceipt: false });
          await recallPage.orderDetails.closeOrderDetailsDialog();
          return orderNumber;
        });

        await test.step('按订单号搜索并校验支付后状态为 Success', async () => {
          await recallPage.expectLoaded();
          await flows.recallFlow.searchOrders(recallPage, {
            manualSearch: {
              tag: RecallManualSearchTags.orderNumber,
              keyword: latestOrderNumber.replace(/^#/, ''),
            },
          });

          const orderDetails = await flows.recallFlow.viewOrderDetails(recallPage, latestOrderNumber);
          expect(orderDetails.orderNumber).toBe(latestOrderNumber);
          expect(orderDetails.paymentStatus).toBe(RecallOrderPaymentSuccessStatus);
        });
      },
    );

    test(
      '应能在 Recall 为最新 To Go 订单完成信用卡支付后看到 Success 状态',
      {
        tag: ['@信用卡支付'],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const paymentFlow = flows.paymentFlow;
        const recallPage = await test.step('创建 To Go 订单并保存后进入 Recall', async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );

          return await flows.orderRegressionFlow.saveOrderAndOpenRecallPage(orderDishesPage);
        });

        const latestOrderNumber = await test.step('读取最新订单号并从 Recall 详情进入信用卡支付页', async () => {
          const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
          await recallPage.orderDetails.openOrderDetails(orderNumber);
          const paymentPage = await recallPage.orderDetails.openPayment();
          await paymentFlow.payByCreditCard(paymentPage, { printReceipt: false });
          await recallPage.orderDetails.closeOrderDetailsDialog();
          return orderNumber;
        });

        await test.step('按订单号搜索并校验支付后状态为 Success', async () => {
          await recallPage.expectLoaded();
          await flows.recallFlow.searchOrders(recallPage, {
            manualSearch: {
              tag: RecallManualSearchTags.orderNumber,
              keyword: latestOrderNumber.replace(/^#/, ''),
            },
          });

          const orderDetails = await flows.recallFlow.viewOrderDetails(recallPage, latestOrderNumber);
          expect(orderDetails.orderNumber).toBe(latestOrderNumber);
          expect(orderDetails.paymentStatus).toBe(RecallOrderPaymentSuccessStatus);
        });
      },
    );
  });

test.describe('小费回归', { tag: ['@小费'] }, () => {
    test(
      '[POS-33110] 应能在点单页添加超过餐费 50% 的小费并完成确认',
      {
        annotation: [jiraIssueAnnotation('POS-33110')],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        await test.step('从 To Go 进入点单页，添加菜品并输入超过 50% 的小费', async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);

          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );

          const priceSummaryBeforeTip = await orderDishesPage.reads.readPriceSummary();
          const bigTipAmountInCents = buildLargeTipAmountInCents(
            priceSummaryBeforeTip['Total Before Tips'],
          );

          const bigTipConfirmMessage = await orderDishesPage.tips.addTip(bigTipAmountInCents);

          expect(bigTipConfirmMessage).toBe(
            'The tip is more than 50% of the meal. Confirm to add?',
          );

          const savedHomePage = await orderDishesPage.navigation.saveOrder();
          const readyHomePageAfterSave = await flows.employeeLoginFlow.enterEmployeeContext(
            savedHomePage,
            employeeLoginPage,
          );
          const recallPage = await flows.recallFlow.openRecallFromHome(readyHomePageAfterSave);
          const orderDetails = await flows.recallFlow.viewFirstVisibleOrderDetails(recallPage);

          expect(orderDetails.priceSummary.Tips).toBeCloseTo(bigTipAmountInCents / 100, 2);
        });
      },
    );

    test(
      '[POS-33122] 应能在信用卡支付后追加超过餐费 50% 的小费并完成确认',
      {
        tag: ['@信用卡支付'],
        annotation: [jiraIssueAnnotation('POS-33122')],
      },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const paymentFlow = flows.paymentFlow;
      const { recallPage, bigTipAmountInCents } = await test.step(
        '创建 To Go 订单并保存后进入 Recall',
        async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);

          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );

          const priceSummaryBeforeTip = await orderDishesPage.reads.readPriceSummary();
          const bigTipAmountInCents = buildLargeTipAmountInCents(
            priceSummaryBeforeTip['Total Before Tips'],
          );

          const savedHomePage = await orderDishesPage.navigation.saveOrder();
          const readyHomePageAfterSave = await flows.employeeLoginFlow.enterEmployeeContext(
            savedHomePage,
            employeeLoginPage,
          );
          return {
            recallPage: await flows.recallFlow.openRecallFromHome(readyHomePageAfterSave),
            bigTipAmountInCents,
          };
        },
      );

      const paidOrderNumber = await test.step('从 Recall 为最新订单完成信用卡支付', async () => {
          const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
          await recallPage.orderDetails.openOrderDetails(orderNumber);
          const paymentPage = await recallPage.orderDetails.openPayment();
          await paymentFlow.payByCreditCard(paymentPage, { printReceipt: false });
          await recallPage.orderDetails.closeOrderDetailsDialog();
          return orderNumber;
        });

        await test.step('重新打开已支付订单并追加超过 50% 的小费', async () => {
          await recallPage.expectLoaded();
          await flows.recallFlow.searchOrders(recallPage, {
            paymentStatus: RecallPaymentStatuses.paid,
            manualSearch: {
              tag: RecallManualSearchTags.orderNumber,
              keyword: paidOrderNumber.replace(/^#/, ''),
            },
          });
          await recallPage.orderDetails.openOrderDetails(paidOrderNumber);
          const payments = await recallPage.orderDetails.readOrderPayments();

          expect(payments.length, '已支付订单应至少有一条支付记录').toBeGreaterThan(0);

          const bigTipConfirmMessage = await recallPage.orderDetails.addPaymentCardTip(
            bigTipAmountInCents,
            payments[0]?.method,
          );

          expect(bigTipConfirmMessage).toBe(
            'The tip is more than 50% of the meal. Confirm to add?',
          );
          await recallPage.orderDetails.closeOrderDetailsDialog();
          await recallPage.orderDetails.openOrderDetails(paidOrderNumber);
          const displayedPriceSummary = await waitUntil(
            async () => await recallPage.orderDetails.readDisplayedOrderPriceSummary(),
            (priceSummary) => priceSummary.Tips !== undefined,
            {
              timeout: 15_000,
              probeTimeout: 5_000,
              message: '已支付订单详情价格汇总中的 Tips 未在预期时间内出现。',
            },
          );
          expect(displayedPriceSummary.Tips).toBeCloseTo(bigTipAmountInCents / 100, 2);
        });
      },
    );

    test(
      '[POS-19362] 应能在支付一个子单并删除另一个子单后保持已支付子单 tips 不变',
      {
        tag: ['@分单', '@现金支付'],
        annotation: [jiraIssueAnnotation('POS-19362')],
      },
      async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
        const restoreSeatDisplay = await apiSetup.systemConfiguration.updateByName(
          'IS_SHOW_SEATS',
          null,
          { verify: true },
        );

        try {
          const orderDishesFlow = flows.orderDishesFlow;
          const splitOrderFlow = flows.splitOrderFlow;
          const recallFlow = flows.recallFlow;
          const paymentFlow = flows.paymentFlow;

          const readyHomePage = await test.step(
            '关闭座位显示配置并刷新 POS 员工上下文',
            async () => {
              const page = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
              await page.clickRefresh();
              await page.confirmDelayedConfigurationRefresh();
              return page;
            },
          );

          const orderDishesPage = await test.step('从堂食 New Order 进入点餐页', async () => {
            const selectTablePage = await readyHomePage.enterDineIn();
            const page = await selectTablePage.clickNewOrder();
            await page.expectLoaded();
            return page;
          });

          await test.step('添加两道菜并分别改价后添加母单 tips', async () => {
            await orderDishesFlow.addRegularDish(
              orderDishesPage,
              orderServiceDishes.regular.name,
              orderServiceDishes.regular.menu,
            );
            await orderDishesPage.menu.clickAddLine();
            await orderDishesFlow.addRegularDish(
              orderDishesPage,
              orderServiceDishes.test.name,
              orderServiceDishes.test.menu,
            );
            await orderDishesPage.menu.changeOrderedDishPrice(
              orderServiceDishes.regular.name,
              orderServiceSplitTipsCase.changedDishPrice,
            );
            await orderDishesPage.menu.changeOrderedDishPrice(
              orderServiceDishes.test.name,
              orderServiceSplitTipsCase.changedDishPrice,
            );
            await orderDishesPage.tips.addTip(orderServiceSplitTipsCase.tipAmountInCents);

            const priceSummary = await orderDishesPage.reads.readPriceSummary();
            expect(priceSummary.Tips).toBe(orderServiceSplitTipsCase.expectedTipAmount);
          });

          const recallPage = await test.step('按座位分单并进入 Recall', async () => {
            const splitOrderPage = await orderDishesPage.navigation.openSplitOrder();
            await splitOrderFlow.splitOrderBySeats(splitOrderPage);
            const returnedPage = await splitOrderFlow.submitAndReturnPage(splitOrderPage);
            return await flows.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
          });

          const { orderNumber, paidTargetOrderNumber, voidTargetOrderNumber, originalTip } =
            await test.step('读取分单后的两个子单号并确认第一个子单 tips', async () => {
              const latestOrderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
              await recallPage.orderDetails.openOrderDetails(latestOrderNumber);
              const targetOrderNumbers = await recallPage.orderDetails.readTargetOrderNumbers();
              expect(targetOrderNumbers.length).toBeGreaterThanOrEqual(2);

              const [firstTargetOrderNumber, secondTargetOrderNumber] = targetOrderNumbers;
              expect(firstTargetOrderNumber).toBeTruthy();
              expect(secondTargetOrderNumber).toBeTruthy();

              const targetTip = await flows.orderRegressionFlow.readTargetTips(
                recallPage,
                latestOrderNumber,
                firstTargetOrderNumber,
              );
              expect(targetTip).toBeGreaterThan(0);

              return {
                orderNumber: latestOrderNumber,
                paidTargetOrderNumber: firstTargetOrderNumber,
                voidTargetOrderNumber: secondTargetOrderNumber,
                originalTip: targetTip,
              };
            });

          await test.step('支付第一个子单并回到 Recall 详情上下文', async () => {
            await recallPage.orderDetails.openOrderDetails(orderNumber, paidTargetOrderNumber);
            const paymentPage = await recallPage.orderDetails.openPayment();
            await paymentFlow.payByCash(paymentPage, { printReceipt: false });
            await recallPage.orderDetails.closeOrderDetailsDialog();
          });

          await test.step('删除另一个子单后回到已支付子单', async () => {
            await recallPage.orderDetails.openOrderDetails(orderNumber, voidTargetOrderNumber);
            await recallPage.voidDialog.voidCurrentOrderKeepingDetails({
              reason: orderServiceSplitTipsCase.voidReason,
              restoreInventory: true,
            });
            await recallPage.orderDetails.openOrderDetails(orderNumber, paidTargetOrderNumber);
          });

          await test.step('确认已支付子单 tips 未被删除子单影响', async () => {
            const finalSummary = await recallPage.orderDetails.readDisplayedOrderPriceSummary();
            expect(finalSummary.Tips).toBe(originalTip);
            await recallPage.orderDetails.closeOrderDetailsDialog();
          });
        } finally {
          await restoreSeatDisplay();
        }
      },
    );
  });
});

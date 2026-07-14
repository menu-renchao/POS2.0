import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import { EmployeeLoginPage } from '../../pages/employee-login.page';
import { HomePage } from '../../pages/home.page';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import { RecallPage } from '../../pages/recall.page';
import {
  buildOrderServicePickupCustomer,
  orderServiceCategoryOptions,
  orderServiceCustomers,
  orderServiceDishes,
  orderServiceEditRecallTaxCase,
  orderServiceSplitTipsCase,
} from '../../test-data/order-service';
import {
  RecallManualSearchTags,
  RecallPaymentStatuses,
  RecallOrderPaymentSuccessStatus,
} from '../../test-data/recall-search-options';
import { jiraIssueAnnotation, jiraIssueAnnotations } from '../../utils/jira';
import { waitUntil } from '../../utils/wait';

type AppEntryPages = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
};

const recallDishRoundTripCases = [
  {
    title: '[POS-15641] 应能 To Go 点另一个分类菜品后在 Recall 校验菜品名称和价格',
    issue: 'POS-15641',
    dish: orderServiceDishes.test,
    stepTitle: '从 To Go 进入点单页，添加 test 菜品并保存后在 Recall 校验',
  },
] as const;

function readCurrencyAmount(value: string | undefined): number {
  if (!value) {
    throw new Error('Expected a currency value, but received empty content.');
  }

  const parsed = Number(value.replace(/[$,]/g, ''));

  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to parse currency value: ${value}`);
  }

  return parsed;
}

function buildLargeTipAmountInCents(totalBeforeTips: number): number {
  return Math.floor(totalBeforeTips * 100 * 0.5) + 100;
}

function formatCurrencyFromCents(amountInCents: number): string {
  return `$${(amountInCents / 100).toFixed(2)}`;
}

async function enterReadyHome({
  employeeLoginPage,
  homePage,
}: AppEntryPages): Promise<HomePage> {
  const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
  await readyHomePage.expectPrimaryFunctionCardsVisible();
  return readyHomePage;
}

async function enterRecallFromReturnedPage(
  returnedPage: HomePage | OrderDishesPage | RecallPage,
): Promise<RecallPage> {
  if (returnedPage instanceof RecallPage) {
    return returnedPage;
  }

  if (returnedPage instanceof OrderDishesPage) {
    return await returnedPage.clickRecall();
  }

  return await returnedPage.enterRecall();
}

async function saveOrderAndOpenLatestRecallDetails(
  orderDishesPage: OrderDishesPage,
): Promise<Awaited<ReturnType<RecallFlow['viewFirstVisibleOrderDetails']>>> {
  const savedHomePage = await orderDishesPage.saveOrder();
  await savedHomePage.expectPrimaryFunctionCardsVisible();

  const recallPage = await new RecallFlow().openRecallFromHome(savedHomePage);
  return await new RecallFlow().viewFirstVisibleOrderDetails(recallPage);
}

async function saveOrderAndOpenRecallPage(
  orderDishesPage: OrderDishesPage,
): Promise<RecallPage> {
  const savedHomePage = await orderDishesPage.saveOrder();
  await savedHomePage.expectPrimaryFunctionCardsVisible();
  return await new RecallFlow().openRecallFromHome(savedHomePage);
}

async function readTargetTips(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<number> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();

  return priceSummary.Tips ?? 0;
}

async function assertCategoryOptionOrderRoundTrip(
  orderDishesPage: OrderDishesPage,
  dishName: string,
  option: string,
  suboption?: string,
): Promise<void> {
  await orderDishesPage.clickDish(dishName);
  await orderDishesPage.selectCategoryOption(option, suboption);

  const orderedItems = await orderDishesPage.readOrderedItems();
  const orderedItem = orderedItems.find((item) => item.name === dishName);

  expect(orderedItem, `点单页应包含菜品 ${dishName}`).toBeTruthy();
  expect(orderedItem?.price, `点单页应展示菜品 ${dishName} 的价格`).toBeTruthy();
  expect(
    orderedItem?.additions.map((addition) => addition.name.trim()) ?? [],
    `点单页应回显 ${dishName} 的 option`,
  ).toEqual(suboption ? [option, suboption] : [option]);

  const orderDetails = await saveOrderAndOpenLatestRecallDetails(orderDishesPage);
  const recallItem = orderDetails.items.find((item) => item.name === dishName);

  expect(orderDetails.items, 'Recall 最新订单应只包含本次保存的菜品').toHaveLength(1);
  expect(recallItem, `Recall 中应包含菜品 ${dishName}`).toBeTruthy();
  expect(recallItem?.price).toBe(orderedItem?.price);
  expect(
    recallItem?.additions.map((addition) => addition.name.trim()) ?? [],
    `Recall 中应回显 ${dishName} 的 option`,
  ).toEqual(suboption ? [option, suboption] : [option]);
}

async function expectLatestRecallDishMatches(
  orderDishesPage: OrderDishesPage,
  dishName: string,
): Promise<void> {
  const orderedItems = await orderDishesPage.readOrderedItems();
  const orderedDish = orderedItems.find((item) => item.name === dishName);

  expect(orderedDish, `点单页应包含菜品 ${dishName}`).toBeTruthy();

  const orderDetails = await saveOrderAndOpenLatestRecallDetails(orderDishesPage);
  const recallDish = orderDetails.items.find((item) => item.name === dishName);

  expect(orderDetails.items, 'Recall 最新订单应只包含本次保存的菜品').toHaveLength(1);
  expect(recallDish?.name).toBe(orderedDish?.name);
  expect(recallDish?.price).toBe(orderedDish?.price);
}

test.describe('堂食点单后 Recall 编辑税额校验', { tag: ['@点单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-30543] 应能堂食保存后在 Recall 编辑菜品数量并校验税额实时更新',
    {
      tag: ['@smoke'],
      annotation: [jiraIssueAnnotation('POS-30543')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('从首页进入系统并建立员工上下文前置条件', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const savedOrderContext = await test.step('通过 New Order 不选桌完成堂食点单并保存', async () => {
        const selectTablePage = await readyHomePage.enterDineIn();
        const orderDishesPage = await new SelectTableFlow().skipTableSelectionAndEnterOrderDishes(selectTablePage);

        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );

        const savedHomePage = await orderDishesPage.saveOrder();
        await savedHomePage.expectPrimaryFunctionCardsVisible();

        return {
          savedHomePage,
        };
      });

      const recallBeforeEdit = await test.step('进入 Recall 读取最新订单并记录编辑前税额', async () => {
        const recallPage = await new RecallFlow().openRecallFromHome(savedOrderContext.savedHomePage);
        const orderDetails = await new RecallFlow().viewFirstVisibleOrderDetails(recallPage);
        const subtotalBeforeEdit = orderDetails.priceSummary.Subtotal;
        const taxBeforeEdit = orderDetails.priceSummary.Tax;
        const testItem = orderDetails.items.find(
          (item) => item.name === orderServiceDishes.test.name,
        );

        expect(orderDetails.items.map((item) => item.name), 'Recall 应包含送厨菜品').toEqual(
          expect.arrayContaining([orderServiceDishes.regular.name, orderServiceDishes.test.name]),
        );
        expect(subtotalBeforeEdit, '编辑前 Recall 应能读取 Subtotal').toBeTruthy();
        expect(taxBeforeEdit, '编辑前 Recall 应能读取税额').toBeTruthy();
        expect(testItem?.price, 'Recall 中 test 菜品应有单价').toBeTruthy();

        return {
          recallPage,
          subtotalBeforeEdit,
          taxBeforeEdit,
          testItemPrice: testItem?.price ?? '',
        };
      });

      const editResult = await test.step(
        `从 Recall 编辑订单并将 ${orderServiceDishes.test.name} 加 1 后保存`,
        async () => {
          const recallPage: RecallPage = recallBeforeEdit.recallPage;
          const editingOrderDishesPage = await new RecallFlow().editFirstVisibleOrder(recallPage);

          await new OrderDishesFlow().increaseOrderedDishQuantityByOne(
            editingOrderDishesPage,
            orderServiceDishes.test.name,
          );
          const priceSummaryAfterQuantityChange = await editingOrderDishesPage.readPriceSummary();
          const subtotalAfterQuantityChange = priceSummaryAfterQuantityChange.Subtotal;
          const subtotalDelta = subtotalAfterQuantityChange - recallBeforeEdit.subtotalBeforeEdit;
          const testItemPrice = readCurrencyAmount(recallBeforeEdit.testItemPrice);

          expect(
            subtotalDelta,
            `点单页加 1 后 Subtotal 应增加 ${orderServiceDishes.test.name} 单价`,
          ).toBeCloseTo(testItemPrice, 2);

          const savedHomePage = await editingOrderDishesPage.saveOrder();
          await savedHomePage.expectPrimaryFunctionCardsVisible();

          return {
            savedHomePage,
            subtotalAfterQuantityChange,
          };
        },
      );

      await test.step('再次进入 Recall 校验保存后的税额已更新', async () => {
        const readyHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
          editResult.savedHomePage,
          employeeLoginPage,
        );
        const recallPage = await new RecallFlow().openRecallFromHome(readyHomePage);

        const orderDetailsAfterEdit = await new RecallFlow().viewFirstVisibleOrderDetails(recallPage);
        const subtotalAfterEdit = orderDetailsAfterEdit.priceSummary.Subtotal;
        const taxAfterEdit = orderDetailsAfterEdit.priceSummary.Tax;
        const afterTaxRate = taxAfterEdit / subtotalAfterEdit;
        const beforeTaxRate = recallBeforeEdit.taxBeforeEdit / recallBeforeEdit.subtotalBeforeEdit;

        expect(
          orderDetailsAfterEdit.items.find((item) => item.name === orderServiceDishes.test.name)
            ?.quantity,
        ).toBe(orderServiceEditRecallTaxCase.editedTestDishQuantity);
        expect(subtotalAfterEdit, 'Recall 保存后应保留更新后的 Subtotal').toBeTruthy();
        expect(taxAfterEdit, 'Recall 保存后应保留更新后的税额').toBeTruthy();
        expect(afterTaxRate, 'Recall 保存后的 tax/subtotal 比例应与修改前近似一致').toBeCloseTo(
          beforeTaxRate,
          2,
        );
        expect(subtotalAfterEdit, 'Recall 保存后 Subtotal 应与点单页实时值一致').toBe(
          editResult.subtotalAfterQuantityChange,
        );
      });
    },
  );

  for (const testCase of recallDishRoundTripCases) {
    test(
      testCase.title,
      {
        annotation: [jiraIssueAnnotation(testCase.issue)],
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        await test.step(testCase.stepTitle, async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);

          await new OrderDishesFlow().addRegularDish(orderDishesPage, testCase.dish.name, testCase.dish.menu);
          await expectLatestRecallDishMatches(orderDishesPage, testCase.dish.name);
        });
      },
    );
  }

  test(
    '[POS-30575] 应能创建 Delivery 订单并在 Recall 详情展示客户信息',
    {
      annotation: [jiraIssueAnnotation('POS-30575')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const orderDishesPage = await test.step('填写 Delivery 客户信息并进入点单页', async () => {
        return await new TakeoutFlow().startDeliveryOrder(readyHomePage, orderServiceCustomers.delivery);
      });

      await test.step('添加菜品、保存订单并在 Recall 校验客户信息', async () => {
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );

        const orderDetails = await saveOrderAndOpenLatestRecallDetails(orderDishesPage);

        expect(orderDetails.customerInfo?.name).toContain(
          orderServiceCustomers.delivery.customerName,
        );
        expect(orderDetails.customerInfo?.address).toContain(
          orderServiceCustomers.delivery.address,
        );
        expect(orderDetails.customerInfo?.note).toContain(orderServiceCustomers.delivery.note);
        expect(orderDetails.customerInfo?.phone.replace(/\D/g, '')).toContain(
          orderServiceCustomers.delivery.phoneNumber,
        );
      });
    },
  );

  test(
    '[POS-31409] 应能创建带姓名的 Pick Up 订单并在 Recall 详情展示客户姓名',
    {
      tag: ['@smoke'],
      annotation: [jiraIssueAnnotation('POS-31409')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const customer = buildOrderServicePickupCustomer();

      const orderDishesPage = await test.step('填写 Pick Up 姓名并进入点单页', async () => {
        return await new TakeoutFlow().startPickUpOrder(readyHomePage, customer);
      });

      await test.step('添加菜品、保存订单并在 Recall 校验客户姓名', async () => {
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );

        const orderDetails = await saveOrderAndOpenLatestRecallDetails(orderDishesPage);

        expect(orderDetails.customerInfo?.name).toContain(customer.customerName);
      });
    },
  );

  test.describe('支付回归', () => {
    test(
      '应能在 Recall 为最新 To Go 订单完成现金支付后看到 Success 状态',
      {
        tag: ['@现金支付'],
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const paymentFlow = new PaymentFlow();
        const recallPage = await test.step('创建 To Go 订单并保存后进入 Recall', async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );

          return await saveOrderAndOpenRecallPage(orderDishesPage);
        });

        const latestOrderNumber = await test.step('读取最新订单号并从 Recall 详情进入支付页', async () => {
          const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
          await recallPage.openOrderDetails(orderNumber);
          const paymentPage = await recallPage.openPayment();
          await paymentFlow.payByCash(paymentPage, { printReceipt: false });
          await recallPage.closeOrderDetailsDialog();
          return orderNumber;
        });

        await test.step('按订单号搜索并校验支付后状态为 Success', async () => {
          await recallPage.expectLoaded();
          await new RecallFlow().searchOrders(recallPage, {
            manualSearch: {
              tag: RecallManualSearchTags.orderNumber,
              keyword: latestOrderNumber.replace(/^#/, ''),
            },
          });

          const orderDetails = await new RecallFlow().viewOrderDetails(recallPage, latestOrderNumber);
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
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const paymentFlow = new PaymentFlow();
        const recallPage = await test.step('创建 To Go 订单并保存后进入 Recall', async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );

          return await saveOrderAndOpenRecallPage(orderDishesPage);
        });

        const latestOrderNumber = await test.step('读取最新订单号并从 Recall 详情进入信用卡支付页', async () => {
          const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
          await recallPage.openOrderDetails(orderNumber);
          const paymentPage = await recallPage.openPayment();
          await paymentFlow.payByCreditCard(paymentPage, { printReceipt: false });
          await recallPage.closeOrderDetailsDialog();
          return orderNumber;
        });

        await test.step('按订单号搜索并校验支付后状态为 Success', async () => {
          await recallPage.expectLoaded();
          await new RecallFlow().searchOrders(recallPage, {
            manualSearch: {
              tag: RecallManualSearchTags.orderNumber,
              keyword: latestOrderNumber.replace(/^#/, ''),
            },
          });

          const orderDetails = await new RecallFlow().viewOrderDetails(recallPage, latestOrderNumber);
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
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        await test.step('从 To Go 进入点单页，添加菜品并输入超过 50% 的小费', async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);

          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );

          const priceSummaryBeforeTip = await orderDishesPage.readPriceSummary();
          const bigTipAmountInCents = buildLargeTipAmountInCents(
            priceSummaryBeforeTip['Total Before Tips'],
          );

          const bigTipConfirmMessage = await orderDishesPage.addTip(bigTipAmountInCents);

          expect(bigTipConfirmMessage).toBe(
            'The tip is more than 50% of the meal. Confirm to add?',
          );

          const savedHomePage = await orderDishesPage.saveOrder();
          const readyHomePageAfterSave = await new EmployeeLoginFlow().enterEmployeeContext(
            savedHomePage,
            employeeLoginPage,
          );
          const recallPage = await new RecallFlow().openRecallFromHome(readyHomePageAfterSave);
          const orderDetails = await new RecallFlow().viewFirstVisibleOrderDetails(recallPage);

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
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const paymentFlow = new PaymentFlow();
      const { recallPage, bigTipAmountInCents } = await test.step(
        '创建 To Go 订单并保存后进入 Recall',
        async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);

          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );

          const priceSummaryBeforeTip = await orderDishesPage.readPriceSummary();
          const bigTipAmountInCents = buildLargeTipAmountInCents(
            priceSummaryBeforeTip['Total Before Tips'],
          );

          const savedHomePage = await orderDishesPage.saveOrder();
          const readyHomePageAfterSave = await new EmployeeLoginFlow().enterEmployeeContext(
            savedHomePage,
            employeeLoginPage,
          );
          return {
            recallPage: await new RecallFlow().openRecallFromHome(readyHomePageAfterSave),
            bigTipAmountInCents,
          };
        },
      );

      const paidOrderNumber = await test.step('从 Recall 为最新订单完成信用卡支付', async () => {
          const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
          await recallPage.openOrderDetails(orderNumber);
          const paymentPage = await recallPage.openPayment();
          await paymentFlow.payByCreditCard(paymentPage, { printReceipt: false });
          await recallPage.closeOrderDetailsDialog();
          return orderNumber;
        });

        await test.step('重新打开已支付订单并追加超过 50% 的小费', async () => {
          await recallPage.expectLoaded();
          await new RecallFlow().searchOrders(recallPage, {
            paymentStatus: RecallPaymentStatuses.paid,
            manualSearch: {
              tag: RecallManualSearchTags.orderNumber,
              keyword: paidOrderNumber.replace(/^#/, ''),
            },
          });
          await recallPage.openOrderDetails(paidOrderNumber);
          const payments = await recallPage.readOrderPayments();

          expect(payments.length, '已支付订单应至少有一条支付记录').toBeGreaterThan(0);

          const bigTipConfirmMessage = await recallPage.addPaymentCardTip(
            bigTipAmountInCents,
            payments[0]?.method,
          );

          expect(bigTipConfirmMessage).toBe(
            'The tip is more than 50% of the meal. Confirm to add?',
          );
          await recallPage.closeOrderDetailsDialog();
          await recallPage.openOrderDetails(paidOrderNumber);
          const displayedPriceSummary = await waitUntil(
            async () => await recallPage.readDisplayedOrderPriceSummary(),
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
      async ({ homePage, employeeLoginPage }) => {
        const orderDishesFlow = new OrderDishesFlow();
        const splitOrderFlow = new SplitOrderFlow();
        const recallFlow = new RecallFlow();
        const paymentFlow = new PaymentFlow();

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

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
          await orderDishesPage.clickAddLine();
          await orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );
          await orderDishesPage.changeOrderedDishPrice(
            orderServiceDishes.regular.name,
            orderServiceSplitTipsCase.changedDishPrice,
          );
          await orderDishesPage.changeOrderedDishPrice(
            orderServiceDishes.test.name,
            orderServiceSplitTipsCase.changedDishPrice,
          );
          await orderDishesPage.addTip(orderServiceSplitTipsCase.tipAmountInCents);

          const priceSummary = await orderDishesPage.readPriceSummary();
          expect(priceSummary.Tips).toBe(orderServiceSplitTipsCase.expectedTipAmount);
        });

        const recallPage = await test.step('按座位分单并进入 Recall', async () => {
          const splitOrderPage = await orderDishesPage.openSplitOrder();
          await splitOrderFlow.splitOrderBySeats(splitOrderPage);
          const returnedPage = await splitOrderFlow.submitAndReturnPage(splitOrderPage);
          return await enterRecallFromReturnedPage(returnedPage);
        });

        const { orderNumber, paidTargetOrderNumber, voidTargetOrderNumber, originalTip } =
          await test.step('读取分单后的两个子单号并确认第一个子单 tips', async () => {
            const latestOrderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
            await recallPage.openOrderDetails(latestOrderNumber);
            const targetOrderNumbers = await recallPage.readTargetOrderNumbers(latestOrderNumber);
            expect(targetOrderNumbers.length).toBeGreaterThanOrEqual(2);

            const [firstTargetOrderNumber, secondTargetOrderNumber] = targetOrderNumbers;
            expect(firstTargetOrderNumber).toBeTruthy();
            expect(secondTargetOrderNumber).toBeTruthy();

            const targetTip = await readTargetTips(
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
          await recallPage.openOrderDetails(orderNumber, paidTargetOrderNumber);
          const paymentPage = await recallPage.openPayment();
          await paymentFlow.payByCash(paymentPage, { printReceipt: false });
          await recallPage.closeOrderDetailsDialog();
        });

        await test.step('删除另一个子单后回到已支付子单', async () => {
          await recallPage.openOrderDetails(orderNumber, voidTargetOrderNumber);
          await recallPage.voidCurrentOrderKeepingDetails({
            reason: orderServiceSplitTipsCase.voidReason,
            restoreInventory: true,
          });
          await recallPage.openOrderDetails(orderNumber, paidTargetOrderNumber);
        });

        await test.step('确认已支付子单 tips 未被删除子单影响', async () => {
          const finalSummary = await recallPage.readDisplayedOrderPriceSummary();
          expect(finalSummary.Tips).toBe(originalTip);
          await recallPage.closeOrderDetailsDialog();
        });
      },
    );
  });

  test.describe('option 选择回显', () => {
    test(
      '[POS-24394] 应能在分类菜品上选择有价格 option 并正确计算总额',
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation('POS-24394')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        await test.step('从 To Go 进入点单页，选择有价格 option 并校验总额变化', async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
          await orderDishesPage.clickDish(orderServiceDishes.categoryOption.name);

          const subtotalBeforeOption = (await orderDishesPage.readPriceSummary()).Subtotal;
          await orderDishesPage.selectCategoryOption(orderServiceCategoryOptions.priced.name);

          const subtotalAfterOption = (await orderDishesPage.readPriceSummary()).Subtotal;
          const orderedItems = await orderDishesPage.readOrderedItems();
          const orderedItem = orderedItems.find(
            (item) => item.name === orderServiceDishes.categoryOption.name,
          );

          expect(
            subtotalAfterOption,
            '选择有价格 option 后 Subtotal 应增加',
          ).toBeGreaterThan(subtotalBeforeOption);
          expect(
            subtotalAfterOption - subtotalBeforeOption,
            '有价格 option 的金额增量应符合测试数据配置',
          ).toBeCloseTo(orderServiceCategoryOptions.priced.expectedSubtotalDelta, 2);
          expect(orderedItem?.additions.map((addition) => addition.name.trim()) ?? []).toEqual([
            orderServiceCategoryOptions.priced.name,
          ]);

          const orderDetails = await saveOrderAndOpenLatestRecallDetails(orderDishesPage);
          const recallDish = orderDetails.items.find(
            (item) => item.name === orderServiceDishes.categoryOption.name,
          );

          expect(orderDetails.priceSummary.Subtotal).toBe(subtotalAfterOption);
          expect(recallDish?.additions.map((addition) => addition.name.trim()) ?? []).toEqual([
            orderServiceCategoryOptions.priced.name,
          ]);
        });
      },
    );

    test(
      '[POS-15643 POS-15758 POS-15759] 应能在分类菜品上选择 option 和二级 option 并在 Recall 正确回显',
      {
        annotation: jiraIssueAnnotations(['POS-15643', 'POS-15758', 'POS-15759']),
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        await test.step(
          `从 To Go 进入点单页，选择 ${orderServiceCategoryOptions.freeNested.name} 和 ${orderServiceCategoryOptions.freeNested.suboptionName} 并校验回显`,
          async () => {
            const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
            await assertCategoryOptionOrderRoundTrip(
              orderDishesPage,
              orderServiceDishes.categoryOption.name,
              orderServiceCategoryOptions.freeNested.name,
              orderServiceCategoryOptions.freeNested.suboptionName,
            );
          },
        );
      },
    );

  });
});

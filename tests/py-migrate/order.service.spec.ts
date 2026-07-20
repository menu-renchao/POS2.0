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
  orderServiceComboOptionRemovalCase,
  orderServiceCustomers,
  orderServiceDeliveryInformationCase,
  orderServiceDishes,
  orderServiceEditRecallTaxCase,
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

function readCurrencyAmount(value: string | null | undefined): number {
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

async function assertDishOptionsRoundTrip(
  orderDishesPage: OrderDishesPage,
  dishName: string,
  expectedOptions: readonly string[],
  expectedPrice?: number,
): Promise<void> {
  const orderedItems = await orderDishesPage.readOrderedItems();
  const orderedItem = orderedItems.find((item) => item.name === dishName);

  expect(orderedItem, `点单页应包含菜品 ${dishName}`).toBeTruthy();
  expect(
    orderedItem?.additions.map((addition) => addition.name.trim()) ?? [],
    `点单页菜品 ${dishName} 的 option 应与录制一致`,
  ).toEqual(expectedOptions);

  if (expectedPrice !== undefined) {
    expect(await orderDishesPage.readOrderedDishPrice(dishName)).toBeCloseTo(expectedPrice, 2);
  }

  const savedOrder = await orderDishesPage.saveOrderWithReference();
  const recallPage = await new RecallFlow().openRecallFromHome(savedOrder.homePage);
  await recallPage.openOrderDetails(savedOrder.orderNumber);
  const orderDetails = await recallPage.readOrderDetailsSnapshot();
  const recallItem = orderDetails.items.find((item) => item.name === dishName);

  expect(orderDetails.items, 'Recall 精确订单应只包含本次保存的菜品').toHaveLength(1);
  expect(recallItem, `Recall 中应包含菜品 ${dishName}`).toBeTruthy();
  expect(recallItem?.additions.map((addition) => addition.name.trim()) ?? []).toEqual(
    expectedOptions,
  );

  if (expectedPrice !== undefined) {
    expect(await recallPage.readOrderItemPrice(dishName)).toBeCloseTo(expectedPrice, 2);
  }
}

async function expectOrderedDishDetails(
  orderDishesPage: OrderDishesPage,
  dishName: string,
  visibleDetails: readonly string[],
  hiddenDetails: readonly string[] = [],
): Promise<void> {
  for (const detailText of visibleDetails) {
    expect(await orderDishesPage.isOrderedDishDetailVisible(dishName, detailText)).toBe(true);
  }

  for (const detailText of hiddenDetails) {
    expect(await orderDishesPage.isOrderedDishDetailVisible(dishName, detailText)).toBe(false);
  }
}

async function expectRecallDishDetails(
  recallPage: RecallPage,
  dishName: string,
  visibleDetails: readonly string[],
  hiddenDetails: readonly string[] = [],
): Promise<void> {
  for (const detailText of visibleDetails) {
    expect(
      await recallPage.isOrderItemDetailVisible(dishName, detailText),
      `Recall 菜品 ${dishName} 应展示 ${detailText}`,
    ).toBe(true);
  }

  for (const detailText of hiddenDetails) {
    expect(
      await recallPage.isOrderItemDetailVisible(dishName, detailText),
      `Recall 菜品 ${dishName} 不应展示 ${detailText}`,
    ).toBe(false);
  }
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
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        'BREAK_OR_COMBIN_SAME_DISHES',
        true,
        { verify: true },
      );

      try {
        const readyHomePage = await test.step('启用同菜合并配置并刷新 POS', async () => {
          const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
          await readyPage.clickRefresh();
          return readyPage;
        });

        const savedOrderContext = await test.step('创建无桌堂食订单并保存精确订单号', async () => {
          const selectTablePage = await readyHomePage.enterDineIn();
          const orderDishesPage = await new SelectTableFlow().skipTableSelectionAndEnterOrderDishes(
            selectTablePage,
          );
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );

          const savedOrder = await orderDishesPage.saveOrderWithReference();
          await savedOrder.homePage.expectPrimaryFunctionCardsVisible();
          return savedOrder;
        });

        const recallBeforeEdit = await test.step('按精确订单号读取编辑前小计和税额', async () => {
          const recallPage = await new RecallFlow().openRecallFromHome(savedOrderContext.homePage);
          await recallPage.openOrderDetails(savedOrderContext.orderNumber);
          const orderDetails = await recallPage.readOrderDetailsSnapshot();
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
            testItemPrice: readCurrencyAmount(testItem?.price),
          };
        });

        const editResult = await test.step('从 Recall 编辑目标订单，将同一菜品数量加一后保存', async () => {
          const editingOrderDishesPage = await new RecallFlow().editOrder(
            recallBeforeEdit.recallPage,
            savedOrderContext.orderNumber,
          );
          await new OrderDishesFlow().increaseOrderedDishQuantityByOne(
            editingOrderDishesPage,
            orderServiceDishes.test.name,
          );

          const editedSummary = await editingOrderDishesPage.readPriceSummary();
          expect(editedSummary.Subtotal - recallBeforeEdit.subtotal).toBeCloseTo(
            recallBeforeEdit.testItemPrice,
            2,
          );

          const savedOrder = await editingOrderDishesPage.saveOrderWithReference();
          return { ...savedOrder, subtotal: editedSummary.Subtotal };
        });

        await test.step('回查同一订单并校验数量、小计和税额均已更新', async () => {
          const refreshedHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
            editResult.homePage,
            employeeLoginPage,
          );
          const recallPage = await new RecallFlow().openRecallFromHome(refreshedHomePage);
          await recallPage.openOrderDetails(editResult.orderNumber);
          const orderDetails = await recallPage.readOrderDetailsSnapshot();
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
    '[POS-30575] 应能在 Delivery 点单页 Info 和 Recall 中展示一致的客户信息',
    {
      annotation: [jiraIssueAnnotation('POS-30575')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const deliveryResult = await test.step(
        '填写 Delivery 信息并读取点单页客户 Info 与摘要',
        async () => {
          return await new TakeoutFlow().startDeliveryOrderWithCustomerInformationSnapshot(
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
        await new OrderDishesFlow().addRegularDish(
          deliveryResult.orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );

        const orderDetails = await saveOrderAndOpenLatestRecallDetails(
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
            const targetOrderNumbers = await recallPage.readTargetOrderNumbers();
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

  test(
    '[POS-33447 POS-33456] 应能按配置控制新订单与 Recall 编辑页的菜单搜索入口',
    {
      annotation: jiraIssueAnnotations(['POS-33447', 'POS-33456']),
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        orderServiceSearchMenuConfigurationCase.configurationName,
        orderServiceSearchMenuConfigurationCase.visibleValue,
        { verify: true },
      );

      try {
        const readyHomePage = await test.step('设置搜索入口可见并刷新 POS', async () => {
          const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
          await readyPage.clickRefresh();
          return readyPage;
        });

        const savedOrder = await test.step('在新订单搜索并保存精确订单号', async () => {
          const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
          await orderDishesPage.expectSearchMenuVisible(true);
          await orderDishesPage.openSearchMenuAndFill(
            orderServiceSearchMenuConfigurationCase.query,
          );
          await orderDishesPage.expectSearchMenuResult(
            orderServiceSearchMenuConfigurationCase.resultTestId,
            orderServiceSearchMenuConfigurationCase.resultName,
          );
          await orderDishesPage.clickSearchMenuResult(
            orderServiceSearchMenuConfigurationCase.resultTestId,
          );
          return await orderDishesPage.saveOrderWithReference();
        });

        await test.step('切换为隐藏配置并确认新订单不展示搜索入口', async () => {
          await apiSetup.systemConfiguration.updateByName(
            orderServiceSearchMenuConfigurationCase.configurationName,
            orderServiceSearchMenuConfigurationCase.hiddenValue,
            { verify: true },
          );
          await savedOrder.homePage.clickRefresh();
          const hiddenSearchPage = await new SelectTableFlow().enterDineInNoTableOrder(
            savedOrder.homePage,
          );
          await hiddenSearchPage.expectSearchMenuVisible(false);
          await hiddenSearchPage.exitOrderPage();
          await savedOrder.homePage.expectPrimaryFunctionCardsVisible();
        });

        await test.step('恢复可见配置并从 Recall 编辑页完成搜索', async () => {
          await apiSetup.systemConfiguration.updateByName(
            orderServiceSearchMenuConfigurationCase.configurationName,
            orderServiceSearchMenuConfigurationCase.visibleValue,
            { verify: true },
          );
          await savedOrder.homePage.clickRefresh();
          const recallPage = await new RecallFlow().openRecallFromHome(savedOrder.homePage);
          const editingPage = await new RecallFlow().editOrder(
            recallPage,
            savedOrder.orderNumber,
          );
          await editingPage.expectSearchMenuVisible(true);
          await editingPage.openSearchMenuAndFill(orderServiceSearchMenuConfigurationCase.query);
          await editingPage.expectSearchMenuResult(
            orderServiceSearchMenuConfigurationCase.resultTestId,
            orderServiceSearchMenuConfigurationCase.resultName,
          );
          await editingPage.clickSearchMenuResult(
            orderServiceSearchMenuConfigurationCase.resultTestId,
          );
          await editingPage.exitOrderPage();
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test.describe('option 选择回显', () => {
    test(
      '[POS-15760] 应能只选择菜品一级选项并跳过二级选项后在 Recall 正确回显',
      {
        annotation: [jiraIssueAnnotation('POS-15760')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        await test.step('选择普通菜1的免费一级选项并保留二级选项未选择', async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.selectCategoryOption(orderServiceCategoryOptions.freeNested.name);
          await orderDishesPage.expectItemOptionVisible(
            orderServiceCategoryOptions.freeNested.suboptionName,
          );
          await assertDishOptionsRoundTrip(
            orderDishesPage,
            orderServiceDishes.regular.name,
            [orderServiceCategoryOptions.freeNested.name],
            orderServiceDishes.regular.expectedBasePrice,
          );
        });
      },
    );

    test(
      '[POS-15762] 应能不选择菜品选项直接保存并在 Recall 保持无选项',
      {
        annotation: [jiraIssueAnnotation('POS-15762')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        await test.step('添加普通菜1但不选择任何菜品选项并保存回查', async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.expectItemOptionVisible(orderServiceCategoryOptions.freeNested.name);
          await assertDishOptionsRoundTrip(
            orderDishesPage,
            orderServiceDishes.regular.name,
            [],
            orderServiceDishes.regular.expectedBasePrice,
          );
        });
      },
    );

    test(
      '[POS-15763] 应能选择菜品一级和二级选项并在 Recall 正确回显',
      {
        annotation: [jiraIssueAnnotation('POS-15763')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        await test.step('选择普通菜1的 A 与 a1 两级选项并保存回查', async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.selectCategoryOption(
            orderServiceCategoryOptions.paidNested.name,
            orderServiceCategoryOptions.paidNested.suboptionName,
          );
          await assertDishOptionsRoundTrip(
            orderDishesPage,
            orderServiceDishes.regular.name,
            [
              orderServiceCategoryOptions.paidNested.name,
              orderServiceCategoryOptions.paidNested.suboptionName,
            ],
            orderServiceCategoryOptions.paidNested.expectedDishPrice,
          );
        });
      },
    );

    test(
      '[POS-31045] 应能连续删除套餐子菜选项并在 Recall 保留剩余选项',
      {
        annotation: [jiraIssueAnnotation('POS-31045')],
      },
      async ({ homePage, employeeLoginPage }) => {
        test.setTimeout(60_000);
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const orderDishesPage = await test.step('创建无桌堂食并为套餐子菜选择四个选项', async () => {
          const orderPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
          await new OrderDishesFlow().addComboDishWithItemOptions(orderPage, {
            comboName: orderServiceComboOptionRemovalCase.comboName,
            itemIndex: orderServiceComboOptionRemovalCase.itemIndex,
            menuSelection: orderServiceDishes.regular.menu,
            saleItemId: orderServiceComboOptionRemovalCase.saleItemId,
            sectionId: orderServiceComboOptionRemovalCase.sectionId,
            selections: [
              {
                option: orderServiceCategoryOptions.paidNested.name,
                suboption: orderServiceCategoryOptions.paidNested.suboptionName,
              },
              { option: orderServiceCategoryOptions.priced.name },
              { option: orderServiceCategoryOptions.freeNested.name },
            ],
          });
          return orderPage;
        });

        await test.step('连续删除 a1 和 A 并校验套餐剩余选项及价格', async () => {
          await expectOrderedDishDetails(
            orderDishesPage,
            orderServiceComboOptionRemovalCase.comboName,
            [
              orderServiceComboOptionRemovalCase.itemName,
              ...orderServiceComboOptionRemovalCase.initialOptions,
            ],
          );
          expect(
            await orderDishesPage.readOrderedDishPrice(orderServiceComboOptionRemovalCase.comboName),
          ).toBeCloseTo(orderServiceComboOptionRemovalCase.initialPrice, 2);

          await orderDishesPage.reduceSelectedComboOption(
            orderServiceComboOptionRemovalCase.comboName,
          );
          await expectOrderedDishDetails(
            orderDishesPage,
            orderServiceComboOptionRemovalCase.comboName,
            [
              orderServiceComboOptionRemovalCase.itemName,
              ...orderServiceComboOptionRemovalCase.firstRemovalOptions,
            ],
            [orderServiceCategoryOptions.paidNested.suboptionName],
          );

          await orderDishesPage.reduceSelectedComboOption(
            orderServiceComboOptionRemovalCase.comboName,
          );
          await expectOrderedDishDetails(
            orderDishesPage,
            orderServiceComboOptionRemovalCase.comboName,
            [
              orderServiceComboOptionRemovalCase.itemName,
              ...orderServiceComboOptionRemovalCase.finalOptions,
            ],
            [
              orderServiceCategoryOptions.paidNested.name,
              orderServiceCategoryOptions.paidNested.suboptionName,
            ],
          );
          expect(
            await orderDishesPage.readOrderedDishPrice(orderServiceComboOptionRemovalCase.comboName),
          ).toBeCloseTo(orderServiceComboOptionRemovalCase.finalPrice, 2);
        });

        await test.step('保存并按精确订单号在 Recall 校验套餐剩余选项', async () => {
          const savedOrder = await orderDishesPage.saveOrderWithReference();
          const recallPage = await new RecallFlow().openRecallFromHome(savedOrder.homePage);
          await recallPage.openOrderDetails(savedOrder.orderNumber);
          await expectRecallDishDetails(
            recallPage,
            orderServiceComboOptionRemovalCase.comboName,
            [
              orderServiceComboOptionRemovalCase.itemName,
              ...orderServiceComboOptionRemovalCase.finalOptions,
            ],
            [
              orderServiceCategoryOptions.paidNested.name,
              orderServiceCategoryOptions.paidNested.suboptionName,
            ],
          );
          expect(
            await recallPage.readOrderItemPrice(orderServiceComboOptionRemovalCase.comboName),
          ).toBeCloseTo(orderServiceComboOptionRemovalCase.finalPrice, 2);
        });
      },
    );

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

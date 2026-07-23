import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderCustomerFlow } from '../../flows/order-customer.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { OrderPermissionFlow } from '../../flows/order-permission.flow';
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
    '[POS-36286] Delivery 填写客户信息进入点单页后应能无提示直接退出',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-36286')],
    },
    async ({ homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const orderDishesPage = await test.step('填写 Delivery 客户及地址信息并进入点单页', async () => {
        return await new TakeoutFlow().startDeliveryOrder(
          readyHomePage,
          orderServiceCustomers.delivery,
        );
      });

      await test.step('点击返回后不出现确认提示并直接回到 POS 首页', async () => {
        const returnedHomePage = await orderDishesPage.exitOrderPageWithoutConfirmation();
        await returnedHomePage.expectPrimaryFunctionCardsVisible();
      });
    },
  );

  test(
    '[POS-15605 POS-15737] 切换中文后应展示中文菜单组和类别',
    {
      tag: ['@点单'],
      annotation: jiraIssueAnnotations(['POS-15605', 'POS-15737']),
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并切换为中文', async () => {
        const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
        await readyPage.switchLanguage('zh-cn');
        expect(await readyPage.readCurrentLanguage()).toBe('zh-cn');
        return readyPage;
      });

      let orderDishesPage: OrderDishesPage | undefined;

      try {
        orderDishesPage = await test.step('进入 To Go 点单页读取当前菜单组和类别', async () => {
          return await new TakeoutFlow().startToGoOrder(readyHomePage, employeeLoginPage);
        });

        await test.step('确认菜单组和类别均展示配置的中文名称', async () => {
          expect(await orderDishesPage?.readSelectedMenuGroupName()).toBe(
            orderServiceMenu.group,
          );
          expect(await orderDishesPage?.readSelectedMenuCategoryName()).toBe(
            orderServiceMenu.category,
          );
        });
      } finally {
        const returnedHomePage = orderDishesPage
          ? await orderDishesPage.exitOrderPageWithoutConfirmation()
          : readyHomePage;
        await returnedHomePage.switchLanguage('en');
        expect(await returnedHomePage.readCurrentLanguage()).toBe('en');
      }
    },
  );

  test(
    '[POS-43827] 中文界面按菜品拼音首字母搜索应返回对应菜品',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-43827')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(150_000);
      const restoreSearchMenuConfiguration =
        await apiSetup.systemConfiguration.updateByName(
          orderServiceSearchMenuConfigurationCase.configurationName,
          orderServiceSearchMenuConfigurationCase.visibleValue,
          { verify: true },
        );

      try {
        const readyHomePage = await test.step('刷新 POS 并将界面切换为中文', async () => {
          const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
          await readyPage.clickRefresh();
          await readyPage.confirmDelayedConfigurationRefresh();
          await readyPage.switchLanguage('zh-cn');
          expect(await readyPage.readCurrentLanguage()).toBe('zh-cn');
          return readyPage;
        });

        const orderDishesPage = await test.step('进入 To Go 并按 ptc 搜索普通菜1', async () => {
          const page = await new TakeoutFlow().startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await page.openChineseSearchMenuAndFill(orderServiceChineseInitialSearchCase.query);
          await page.expectSearchMenuResult(
            orderServiceChineseInitialSearchCase.resultTestId,
            orderServiceChineseInitialSearchCase.resultName,
          );
          await page.clickSearchMenuResult(orderServiceChineseInitialSearchCase.resultTestId);
          return page;
        });

        const savedOrder = await test.step('确认目标菜进入订单并保存', async () => {
          const orderedItems = await orderDishesPage.readOrderedItems();
          expect(orderedItems.map((item) => item.name)).toContain(
            orderServiceChineseInitialSearchCase.resultName,
          );
          return await orderDishesPage.saveOrderWithReference();
        });

        await test.step('恢复英文界面', async () => {
          await savedOrder.homePage.switchLanguage('en');
          expect(await savedOrder.homePage.readCurrentLanguage()).toBe('en');
        });
      } finally {
        await restoreSearchMenuConfiguration();
      }
    },
  );

  test(
    '[POS-42097] 点单页面类别应展示配置的 POS NAME',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-42097')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      const categoryCase = buildOrderServiceCategoryPosNameCase();

      await test.step('创建后台名称与 POS NAME 不同的临时类别和菜品', async () => {
        const createdCategory = await apiSetup.category.create({
          displayName: categoryCase.backendName,
          menuGroupId: categoryCase.menuGroupId,
          menuId: categoryCase.menuId,
          name: categoryCase.backendName,
          posName: categoryCase.posName,
        });
        await apiSetup.saleItem.create({
          categoryId: createdCategory.id,
          displayName: categoryCase.dishName,
          menuGroupId: categoryCase.menuGroupId,
          menuId: categoryCase.menuId,
          name: categoryCase.dishName,
          posName: categoryCase.dishName,
          price: categoryCase.price,
        });
      });

      const readyHomePage = await test.step('进入 POS 主页并刷新菜单数据', async () => {
        const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
        await readyPage.clickRefresh();
        await readyPage.confirmDelayedConfigurationRefresh();
        return readyPage;
      });

      const orderDishesPage = await test.step('进入 To Go 并切换到目标菜单组', async () => {
        const page = await new TakeoutFlow().startToGoOrder(readyHomePage, employeeLoginPage);
        await page.switchMenuGroup(categoryCase.menuGroupName);
        return page;
      });

      await test.step('确认类别卡展示 POS NAME 而不是后台名称', async () => {
        const categoryNames = await orderDishesPage.readMenuCategoryNames();
        expect(categoryNames).toContain(categoryCase.posName);
        expect(categoryNames).not.toContain(categoryCase.backendName);

        await orderDishesPage.switchMenuCategory(categoryCase.posName);
        expect(await orderDishesPage.readSelectedMenuCategoryName()).toBe(categoryCase.posName);
      });

      await test.step('确认选择 POS NAME 类别后显示关联菜品', async () => {
        const dishNames = await orderDishesPage.readCurrentCategoryDishNames();
        expect(dishNames.length).toBeGreaterThan(0);
      });
    },
  );

  test(
    '[POS-42060] 未满足必选类别时应阻止保存并自动跳转到该类别',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-42060')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      const requiredCase = buildOrderServiceRequiredCategoryCase();

      await test.step('创建必选类别及其关联菜品', async () => {
        const category = await apiSetup.category.create({
          displayName: requiredCase.backendName,
          menuGroupId: requiredCase.menuGroupId,
          menuId: requiredCase.menuId,
          name: requiredCase.backendName,
          posName: requiredCase.posName,
          requireCategory: true,
        });
        await apiSetup.saleItem.create({
          categoryId: category.id,
          displayName: requiredCase.dishName,
          menuGroupId: requiredCase.menuGroupId,
          menuId: requiredCase.menuId,
          name: requiredCase.dishName,
          posName: requiredCase.dishName,
          price: requiredCase.price,
        });
      });

      const readyHomePage = await test.step('进入 POS 主页并刷新菜单数据', async () => {
        const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
        await readyPage.clickRefresh();
        await readyPage.confirmDelayedConfigurationRefresh();
        return readyPage;
      });

      const orderDishesPage = await test.step('进入 To Go 并只添加普通类别菜品', async () => {
        const page = await new TakeoutFlow().startToGoOrder(readyHomePage, employeeLoginPage);
        await new OrderDishesFlow().addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return page;
      });

      await test.step('确认保存被阻止且自动跳转到未满足的必选类别', async () => {
        await orderDishesPage.clickSaveOrder();
        await orderDishesPage.expectLoaded();
        expect(await orderDishesPage.readSelectedMenuCategoryName()).toBe(requiredCase.posName);
      });

      await test.step('添加必选类别菜品后应能正常保存', async () => {
        await orderDishesPage.clickFirstCurrentCategoryDish();
        await orderDishesPage.saveOrderWithReference();
      });
    },
  );

  test(
    '[POS-42958] 未启用整单折扣适用性的类别菜品不应参与整单比例加收',
    {
      tag: ['@点单', '@加收'],
      annotation: [jiraIssueAnnotation('POS-42958')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      test.info().annotations.push({
        type: '已知产品问题',
        description:
          '10% 整单加收预期仅按普通菜 $8.80 计算为 $0.88，实际为 $1.88，未启用整单折扣适用性的 $10 类别菜仍被计入加收基数。',
      });
      const chargeCase = buildOrderServiceOrderChargeExcludedCategoryCase();

      await test.step('创建不参与整单折扣的类别及两道菜品', async () => {
        const category = await apiSetup.category.create({
          applicableToOrderDiscount: false,
          discountAllowed: true,
          displayName: chargeCase.backendName,
          menuGroupId: chargeCase.menuGroupId,
          menuId: chargeCase.menuId,
          name: chargeCase.backendName,
          posName: chargeCase.posName,
        });
        const categoryData = (await apiSetup.category.read(category.id)) as {
          menuCategory?: { applicableToOrderDiscount?: boolean };
        };
        expect(categoryData.menuCategory?.applicableToOrderDiscount).toBe(false);

        for (let index = 0; index < chargeCase.dishNames.length; index += 1) {
          await apiSetup.saleItem.create({
            categoryId: category.id,
            displayName: chargeCase.dishNames[index],
            menuGroupId: chargeCase.menuGroupId,
            menuId: chargeCase.menuId,
            name: chargeCase.dishNames[index],
            posName: chargeCase.dishNames[index],
            price: chargeCase.dishPrices[index],
          });
        }
      });

      const readyHomePage = await test.step('进入 POS 主页并刷新菜单数据', async () => {
        const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
        await readyPage.clickRefresh();
        await readyPage.confirmDelayedConfigurationRefresh();
        return readyPage;
      });

      const orderDishesPage = await test.step('添加目标类别全部菜品及参与加收的对照菜', async () => {
        const page = await new TakeoutFlow().startToGoOrder(readyHomePage, employeeLoginPage);
        await page.switchMenu(chargeCase.menuGroupName, chargeCase.posName);

        for (const dishName of chargeCase.dishNames) {
          await page.clickCurrentCategoryDish(dishName);
        }

        await new OrderDishesFlow().addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return page;
      });

      await test.step('确认目标类别的两道菜均未进入整单比例加收基数', async () => {
        const beforeSummary = await orderDishesPage.readPriceSummary();
        expect(beforeSummary.Subtotal).toBeCloseTo(
          chargeCase.dishPrices.reduce((sum, price) => sum + price, 0) +
            orderServiceDishes.regular.expectedBasePrice,
          2,
        );

        await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
          scope: 'whole',
          type: 'percentage',
          value: chargeCase.percentageCharge,
        });

        const afterSummary = await orderDishesPage.readPriceSummary();
        const expectedCharge =
          orderServiceDishes.regular.expectedBasePrice * chargeCase.percentageCharge / 100;
        expect(afterSummary.Charge).toBeCloseTo(expectedCharge, 2);
        expect(afterSummary.Subtotal).toBeCloseTo(beforeSummary.Subtotal + expectedCharge, 2);
      });

      await orderDishesPage.saveOrderWithReference();
    },
  );

  test(
    '[POS-30762] 切换 POS 与 EMENU 菜单模式后应能搜索对应菜单菜品',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-30762')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(150_000);
      const modeCase = buildOrderServiceMenuProductModeCase();
      const originalConfigurationIndex = await apiSetup.systemConfiguration.listIndex();
      const originalMode = originalConfigurationIndex.get(modeCase.configurationName)?.value;
      const originalSearchMenu = originalConfigurationIndex.get(
        orderServiceSearchMenuConfigurationCase.configurationName,
      )?.value;

      if (originalMode === undefined || originalSearchMenu === undefined) {
        throw new Error('未能读取菜单模式或搜索菜单配置原值。');
      }

      await apiSetup.systemConfiguration.updateManyByName(
        {
          [modeCase.configurationName]: modeCase.posMode,
          [orderServiceSearchMenuConfigurationCase.configurationName]: true,
        },
        { verify: true },
      );
      let returnedHomePage: HomePage | undefined;
      let finalOrderDishesPage: OrderDishesPage | undefined;

      try {
        await test.step('分别创建 POS 与 EMENU 模式的目标搜索菜品', async () => {
          await apiSetup.saleItem.create({
            categoryId: modeCase.posCategoryId,
            displayName: modeCase.posDishName,
            menuGroupId: modeCase.posMenuGroupId,
            menuId: modeCase.posMenuId,
            name: modeCase.posDishName,
            posName: modeCase.posDishName,
            price: modeCase.price,
          });

          const emenuGroup = await apiSetup.menuGroup.create({
            menuId: modeCase.emenuMenuId,
            name: modeCase.emenuGroupName,
          });
          const emenuCategory = await apiSetup.category.create({
            displayName: modeCase.emenuCategoryName,
            menuGroupId: emenuGroup.id,
            menuId: modeCase.emenuMenuId,
            name: modeCase.emenuCategoryName,
            posName: modeCase.emenuCategoryName,
          });
          await apiSetup.saleItem.create({
            categoryId: emenuCategory.id,
            displayName: modeCase.emenuDishName,
            menuGroupId: emenuGroup.id,
            menuId: modeCase.emenuMenuId,
            name: modeCase.emenuDishName,
            posName: modeCase.emenuDishName,
            price: modeCase.price,
          });
        });

        const readyHomePage = await test.step('以 POS 菜单模式刷新主页', async () => {
          const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
          await readyPage.clickRefresh();
          await readyPage.confirmDelayedConfigurationRefresh();
          return readyPage;
        });

        returnedHomePage = await test.step('POS 模式应能搜索 Broccoli Garlic Sauce', async () => {
          const page = await new TakeoutFlow().startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await page.openSearchMenuAndFill(modeCase.posSearchQuery);
          await page.expectSearchMenuResultByName(modeCase.posDishName);
          return await page.exitOrderPageWithoutConfirmation();
        });

        await apiSetup.systemConfiguration.updateByName(
          modeCase.configurationName,
          modeCase.emenuMode,
          { verify: true },
        );
        await returnedHomePage.clickRefresh();
        await returnedHomePage.confirmDelayedConfigurationRefresh();

        finalOrderDishesPage = await test.step('EMENU 模式应能搜索 All you can eat item', async () => {
          const page = await new TakeoutFlow().startToGoOrder(
            returnedHomePage!,
            employeeLoginPage,
          );
          await page.openSearchMenuAndFill(modeCase.emenuSearchQuery);
          await page.expectSearchMenuResultByName(modeCase.emenuDishName);
          return page;
        });
      } finally {
        await apiSetup.systemConfiguration.updateManyByName(
          {
            [modeCase.configurationName]: String(originalMode),
            [orderServiceSearchMenuConfigurationCase.configurationName]: String(originalSearchMenu),
          },
          { verify: true },
        );

        if (finalOrderDishesPage) {
          await finalOrderDishesPage.confirmConfigurationRefresh();
        }
      }
    },
  );

  test(
    '[ORDER-PAGE-015] Open Food 屏幕键盘应能切换中文并输入候选字',
    { tag: ['@点单'] },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      const keyboardCase = orderServiceOpenFoodChineseKeyboardCase;
      const restoreKeyboardConfiguration =
        await apiSetup.systemConfiguration.updateByName(
          keyboardCase.configurationName,
          keyboardCase.configurationValue,
          { verify: true },
        );
      let returnedHomePage: HomePage | undefined;

      try {
        const readyHomePage = await test.step('刷新 POS 使屏幕键盘配置生效', async () => {
          const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
          await readyPage.clickRefresh();
          await readyPage.confirmDelayedConfigurationRefresh();
          return readyPage;
        });
        const orderDishesPage = await new TakeoutFlow().startToGoOrder(
          readyHomePage,
          employeeLoginPage,
        );

        await test.step('切换 Open Food 屏幕键盘为中文并输入候选字', async () => {
          await orderDishesPage.openOpenFoodDialog();
          expect(await orderDishesPage.readOpenFoodKeyboardLanguage()).toBe(
            keyboardCase.initialLanguage,
          );
          await orderDishesPage.switchOpenFoodKeyboardLanguage();
          expect(await orderDishesPage.readOpenFoodKeyboardLanguage()).toBe(
            keyboardCase.switchedLanguage,
          );
          await orderDishesPage.pressOpenFoodKeyboardLetters(keyboardCase.pinyinKeys);
          await orderDishesPage.selectOpenFoodKeyboardCandidate(keyboardCase.name);
          expect(await orderDishesPage.readOpenFoodName()).toBe(keyboardCase.name);
          await orderDishesPage.fillOpenFoodPriceAndConfirm(keyboardCase.price);
        });

        await test.step('确认中文名称进入订单行并保存', async () => {
          const orderedItems = await orderDishesPage.readOrderedItems();
          expect(orderedItems.map((item) => item.name)).toContain(keyboardCase.name);
          const savedOrder = await orderDishesPage.saveOrderWithReference();
          returnedHomePage = savedOrder.homePage;
        });
      } finally {
        await restoreKeyboardConfiguration();

        if (returnedHomePage) {
          await returnedHomePage.clickRefresh();
          await returnedHomePage.confirmDelayedConfigurationRefresh();
        }
      }
    },
  );

  test(
    '[POS-42061] 套餐子菜应支持独立改价并更新套餐总价',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-42061')],
    },
    async ({ homePage, employeeLoginPage }) => {
      test.setTimeout(60_000);
      const priceCase = orderServiceComboSubItemPriceCase;
      const readyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);

      await test.step('添加包含目标子菜的套餐', async () => {
        await new OrderDishesFlow().addComboDishWithItemOptions(orderDishesPage, {
          comboName: priceCase.comboName,
          itemIndex: priceCase.itemIndex,
          menuSelection: orderServiceDishes.regular.menu,
          saleItemId: priceCase.saleItemId,
          sectionId: priceCase.sectionId,
          selections: [{ option: orderServiceCategoryOptions.priced.name }],
        });
      });

      await test.step('选中套餐子菜并改价后校验子菜与套餐总价', async () => {
        const beforeComboPrice = await orderDishesPage.readOrderedDishPrice(priceCase.comboName);
        expect(
          await orderDishesPage.readComboSubItemPrice(
            priceCase.comboName,
            priceCase.saleItemId,
          ),
        ).toBeCloseTo(priceCase.initialSubItemPrice, 2);

        await orderDishesPage.changeComboSubItemPrice(
          priceCase.comboName,
          priceCase.saleItemId,
          priceCase.changedPrice,
        );

        expect(
          await orderDishesPage.readComboSubItemPrice(
            priceCase.comboName,
            priceCase.saleItemId,
          ),
        ).toBeCloseTo(priceCase.changedPrice, 2);
        expect(await orderDishesPage.readOrderedDishPrice(priceCase.comboName)).toBeCloseTo(
          beforeComboPrice - priceCase.initialSubItemPrice + priceCase.changedPrice,
          2,
        );
      });

      await orderDishesPage.saveOrderWithReference();
    },
  );

  test(
    '[POS-37804] 无 Note 权限员工为套餐子菜添加备注时应要求授权',
    {
      tag: ['@点单', '@套餐', '@调味'],
      annotation: jiraIssueAnnotations(['POS-37804', 'POS-36081']),
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const noteCase = orderServiceComboSubItemNotePermissionCase;
      const restrictedEmployee = await test.step('创建不含 Note 权限的一次性员工', async () => {
        return await apiSetup.staff.createWithoutNotePermission();
      });
      const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
        restrictedEmployee.passcode,
      );
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);

      await test.step('添加包含目标子菜的套餐', async () => {
        await new OrderDishesFlow().addComboDishWithItemOptions(orderDishesPage, {
          comboName: noteCase.comboName,
          itemIndex: noteCase.itemIndex,
          menuSelection: orderServiceDishes.regular.menu,
          saleItemId: noteCase.saleItemId,
          sectionId: noteCase.sectionId,
          selections: [{ option: noteCase.optionName }],
        });
      });

      await test.step('选中套餐子菜并校验权限提示后使用主管口令授权添加 Note', async () => {
        await new OrderPermissionFlow().addNoteToComboSubItemWithAuthorization(
          orderDishesPage,
          noteCase.comboName,
          noteCase.saleItemId,
          noteCase.authorizationPasscode,
          noteCase.note,
        );
      });

      const savedOrder = await test.step('保存并确认 Note 写入套餐子菜层级', async () => {
        const result = await orderDishesPage.saveOrderWithReference();
        const comboItem = result.orderItems.find(
          (item) => String(item.saleItemId) === String(noteCase.comboSaleItemId),
        );
        const comboSubItem = comboItem?.comboSubItems.find(
          (item) => String(item.saleItemId) === String(noteCase.saleItemId),
        );
        const noteOptions =
          comboSubItem?.options.filter((option) => option.type === 'NOTE') ?? [];

        expect(comboItem, '保存请求应包含套餐主菜').toBeTruthy();
        expect(comboItem?.displayText, '套餐主菜自身不应写入子菜 Note').toBe('');
        expect(noteOptions).toEqual([{ name: noteCase.note, type: 'NOTE' }]);
        return result;
      });

      await test.step('Recall 精确回查套餐并确认备注已持久化', async () => {
        const recallFlow = new RecallFlow();
        const recallPage = await recallFlow.openRecallFromHome(savedOrder.homePage);
        const details = await recallFlow.viewOrderDetails(recallPage, savedOrder.orderNumber);
        const comboItem = details.items.find((item) => item.name === noteCase.comboName);

        expect(comboItem, 'Recall 应展示目标套餐').toBeTruthy();
        expect(comboItem?.additions.map((addition) => addition.name)).toContain(noteCase.note);
      });
    },
  );

  test(
    '[POS-43823] 选择无 option 套餐子菜后应返回主菜并可选择 option',
    {
      tag: ['@点单', '@调味', '@套餐'],
      annotation: [jiraIssueAnnotation('POS-43823')],
    },
    async ({ homePage, employeeLoginPage }) => {
      test.setTimeout(60_000);
      const comboCase = orderServiceComboParentOptionCase;
      const readyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);

      await test.step('选择无 option 套餐子菜并返回主菜 option 面板', async () => {
        await orderDishesPage.clickDish(comboCase.comboName);
        await orderDishesPage.selectComboItem(
          comboCase.comboSubItem.sectionId,
          comboCase.comboSubItem.saleItemId,
          comboCase.comboSubItem.itemIndex,
        );
        await orderDishesPage.expectItemOptionVisible(comboCase.parentOption);
        await orderDishesPage.selectCategoryOption(comboCase.parentOption);
        await orderDishesPage.confirmComboDialog();
      });

      await test.step('添加带自身 option 的普通菜作为归属对照', async () => {
        await orderDishesPage.clickDish(comboCase.ordinaryDish.name);
        await orderDishesPage.selectCategoryOption(
          comboCase.ordinaryOption.name,
          comboCase.ordinaryOption.suboptionName,
        );
      });

      await test.step('校验套餐主菜 option 与普通菜 option 互不混淆并保存', async () => {
        const orderedItems = await orderDishesPage.readOrderedItems();
        const comboItem = orderedItems.find((item) => item.name === comboCase.comboName);
        const ordinaryItem = orderedItems.find(
          (item) => item.name === comboCase.ordinaryDish.name,
        );
        const comboAdditionNames = comboItem?.additions.map((addition) => addition.name) ?? [];
        const ordinaryAdditionNames =
          ordinaryItem?.additions.map((addition) => addition.name) ?? [];
        const comboSubItem = comboItem?.additions.find(
          (addition) => addition.name === comboCase.comboSubItem.name,
        );

        expect(comboItem, '订单应包含目标套餐').toBeTruthy();
        expect(comboAdditionNames).toEqual([
          comboCase.comboSubItem.name,
          comboCase.parentOption,
        ]);
        expect(comboSubItem?.subAdditions ?? []).toEqual([]);
        expect(ordinaryItem, '订单应包含普通菜对照项').toBeTruthy();
        expect(ordinaryAdditionNames).toEqual([
          comboCase.ordinaryOption.name,
          comboCase.ordinaryOption.suboptionName,
        ]);
        expect(ordinaryAdditionNames).not.toContain(comboCase.parentOption);

        await orderDishesPage.saveOrderWithReference();
      });
    },
  );

  test(
    '[POS-43956] 已保存套餐应能编辑子菜并保留 display-all 与 max 选择结果',
    {
      tag: ['@点单', '@套餐', '@调味'],
      annotation: [jiraIssueAnnotation('POS-43956')],
    },
    async ({ homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const comboCase = orderServiceSavedComboSubItemModifyCase;
      const readyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);

      const savedOrder = await test.step('一次展示全部候选子菜并按 max 规则保存套餐', async () => {
        await orderDishesPage.clickDish(comboCase.comboName);
        for (const item of comboCase.displayAllItems) {
          await orderDishesPage.expectComboItemVisible(
            comboCase.sectionId,
            item.saleItemId,
            item.itemIndex,
          );
        }
        await orderDishesPage.selectComboItem(
          comboCase.sectionId,
          comboCase.targetSaleItemId,
          comboCase.targetItemIndex,
        );
        await orderDishesPage.expectItemOptionVisible(comboCase.parentOption);
        await orderDishesPage.selectCategoryOption(comboCase.parentOption);
        await orderDishesPage.confirmComboDialog();

        const comboItem = (await orderDishesPage.readOrderedItems()).find(
          (item) => item.name === comboCase.comboName,
        );
        expect(
          comboItem?.additions.filter(
            (addition) => addition.name === comboCase.targetSubItemName,
          ),
        ).toHaveLength(1);
        return await orderDishesPage.saveOrderWithReference();
      });

      const updatedOrder = await test.step('从 Recall 编辑已保存订单并修改套餐子菜', async () => {
        const recallPage = await new RecallFlow().openRecallFromHome(savedOrder.homePage);
        const editingPage = await new RecallFlow().editOrder(
          recallPage,
          savedOrder.orderNumber,
        );
        await editingPage.selectComboSubItem(
          comboCase.comboName,
          comboCase.targetSaleItemId,
        );
        await editingPage.openModifyForSelectedItem();
        await editingPage.selectModifyOption(comboCase.modifierName);
        await editingPage.closeModifyPanel();

        const editedComboItem = (await editingPage.readOrderedItems()).find(
          (item) => item.name === comboCase.comboName,
        );
        expect(
          editedComboItem?.additions.some((addition) =>
            addition.name.includes(comboCase.modifierName),
          ),
        ).toBe(true);
        return await editingPage.saveOrderWithReference();
      });

      await test.step('再次 Recall 校验子菜、主菜 option 与调味均已保存', async () => {
        const recallPage = await new RecallFlow().openRecallFromHome(updatedOrder.homePage);
        const details = await new RecallFlow().viewOrderDetails(
          recallPage,
          updatedOrder.orderNumber,
        );
        const comboItem = details.items.find((item) => item.name === comboCase.comboName);
        const additionNames = comboItem?.additions.map((addition) => addition.name) ?? [];

        expect(comboItem, 'Recall 应展示目标套餐').toBeTruthy();
        expect(
          additionNames.filter((name) => name === comboCase.targetSubItemName),
        ).toHaveLength(1);
        expect(additionNames).toContain(comboCase.parentOption);
        expect(additionNames).toContain(comboCase.modifierName);
      });
    },
  );

  test(
    '[POS-36254] 按菜分单后子单折扣界面应显示当前子单整单金额',
    {
      tag: ['@点单', '@分单', '@加收'],
      annotation: [jiraIssueAnnotation('POS-36254')],
    },
    async ({ homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const splitCase = orderServiceSplitChildDiscountCase;
      const readyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
      const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
      const orderFlow = new OrderDishesFlow();

      await test.step('创建包含三条普通菜的无桌堂食订单', async () => {
        for (const dish of splitCase.orderLines) {
          await orderFlow.addRegularDish(orderDishesPage, dish.name, dish.menu);
        }
      });

      const splitResult = await test.step('点击菜品并通过 Add Suborder 建立子单', async () => {
        const splitOrderPage = await orderDishesPage.openSplitOrder();
        const splitFlow = new SplitOrderFlow();
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
          recallPage: await enterRecallFromReturnedPage(returnedPage),
        };
      });

      const targetDetails = await test.step('在 Recall 精确打开移动菜品所在子单并读取金额', async () => {
        const recallFlow = new RecallFlow();
        const orderNumber = await recallFlow.readLatestVisibleOrderNumber(splitResult.recallPage);
        await splitResult.recallPage.openOrderDetails(orderNumber);
        const targetOrderNumbers = await splitResult.recallPage.readTargetOrderNumbers();
        const targetOrderNumber = targetOrderNumbers[splitCase.targetSuborderIndex];

        expect(targetOrderNumbers, 'Recall 应展示两个分单子单').toHaveLength(2);
        expect(targetOrderNumber, '应能解析新增子单引用').toBeTruthy();

        await splitResult.recallPage.openOrderDetails(orderNumber, targetOrderNumber);
        const details = await splitResult.recallPage.readOrderDetailsSnapshot();

        expect(details.orderNumber.replace(/^#/, '')).toBe(
          splitResult.movedDishSuborderNumber.replace(/^#/, ''),
        );
        expect(details.items.map((item) => item.name)).toEqual([splitCase.movedDishName]);
        expect(details.priceSummary.Subtotal).toBeGreaterThan(0);

        return { details, orderNumber, targetOrderNumber };
      });

      await test.step('打开子单 Discount 并校验 Whole Order 为当前子单金额', async () => {
        await splitResult.recallPage.clickDiscountInOrderDetails();
        const wholeOrderSummary =
          await splitResult.recallPage.readDiscountWholeOrderSummary();

        expect(wholeOrderSummary.orderNumber).toBe(targetDetails.details.orderNumber);
        expect(wholeOrderSummary.subtotal).toBeCloseTo(
          targetDetails.details.priceSummary.Subtotal,
          2,
        );
      });
    },
  );

  test(
    '[POS-22640] 自定义 Delivery 应能保存订单并打单成功',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-22640')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
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

      const readyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
      await readyHomePage.clickRefresh();

      const orderDishesPage = await test.step('从自定义类型入口录入 Delivery 信息并添加菜品', async () => {
        const page = await new TakeoutFlow().startCustomDeliveryOrderType1(
          readyHomePage,
          employeeLoginPage,
          customDeliveryCase.customer,
        );
        const orderFlow = new OrderDishesFlow();

        for (const dish of customDeliveryCase.dishes) {
          await orderFlow.addRegularDish(page, dish.name, dish.menu);
        }

        return page;
      });

      const savedOrder = await test.step('保存并确认请求使用自定义订单类型', async () => {
        const result = await orderDishesPage.saveOrderWithReference();
        expect(result.orderType).toBe(customDeliveryCase.customOrderType.name);
        return result;
      });

      const recallFlow = new RecallFlow();
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
    '[POS-36255] 菜品名称与编号相同时搜索结果应只展示一次',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-36255')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      test.info().annotations.push({
        type: '已知产品问题',
        description: '同一菜品的名称与编号同时命中 AA 时，搜索结果实际重复显示 2 条，需求预期为 1 条。',
      });
      const searchCase = orderServiceSameNameAndNumberSearchCase;
      const restoreSearchMenuConfiguration =
        await apiSetup.systemConfiguration.updateByName(
          orderServiceSearchMenuConfigurationCase.configurationName,
          orderServiceSearchMenuConfigurationCase.visibleValue,
          { verify: true },
        );

      try {
        await test.step('创建名称和编号均为 AA 的临时菜品', async () => {
          await apiSetup.saleItem.create({
            categoryId: searchCase.categoryId,
            itemNumber: searchCase.itemNumber,
            menuGroupId: searchCase.menuGroupId,
            menuId: searchCase.menuId,
            name: searchCase.name,
            posName: searchCase.name,
            price: searchCase.price,
          });
        });

        const readyHomePage = await test.step('进入 POS 主页并刷新菜单数据', async () => {
          const readyPage = await enterReadyHome({ employeeLoginPage, homePage });
          await readyPage.clickRefresh();
          await readyPage.confirmDelayedConfigurationRefresh();
          return readyPage;
        });

        const orderDishesPage = await test.step('进入 To Go 并搜索 AA', async () => {
          const page = await new TakeoutFlow().startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await page.openSearchMenuAndFill(searchCase.name);
          return page;
        });

        await test.step('确认同一菜品不会因名称和编号同时命中而重复展示', async () => {
          const resultCount = await orderDishesPage.readSearchMenuResultCountByNameAndNumber(
            searchCase.name,
            searchCase.itemNumber,
          );

          expect(resultCount).toBe(1);
        });
      } finally {
        await restoreSearchMenuConfiguration();
      }
    },
  );

  test(
    '[POS-42943] 修改一笔匿名 Pick Up 订单的客户姓名不应影响另一笔订单',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-42943')],
    },
    async ({ homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const firstOrder = await test.step('创建第一笔匿名 Pick Up 订单', async () => {
        const orderDishesPage = await new TakeoutFlow().startPickUpOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return await orderDishesPage.saveOrderWithReference();
      });

      const secondOrder = await test.step('创建第二笔匿名 Pick Up 订单', async () => {
        const orderDishesPage = await new TakeoutFlow().startPickUpOrder(firstOrder.homePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );
        return await orderDishesPage.saveOrderWithReference();
      });

      const customer = buildAnonymousPickupEditCustomer();
      const editedHomePage = await test.step('只为第一笔订单补充客户姓名和电话', async () => {
        const recallPage = await new RecallFlow().openRecallFromHome(secondOrder.homePage);
        const editingPage = await new RecallFlow().editOrder(
          recallPage,
          firstOrder.orderNumber,
        );
        await new OrderCustomerFlow().addCustomerInformationToOrder(editingPage, customer);
        return (await editingPage.saveOrderWithReference()).homePage;
      });

      await test.step('按精确订单号确认两笔订单客户信息相互隔离', async () => {
        const recallPage = await new RecallFlow().openRecallFromHome(editedHomePage);
        const recallFlow = new RecallFlow();
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
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const customer = buildOrderServiceDineInCustomer();

      const orderDishesPage = await test.step('进入无桌堂食并补充客户信息', async () => {
        const page = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
        const customerButtonText = await new OrderCustomerFlow().addCustomerInformationToOrder(
          page,
          customer,
        );

        expect(customerButtonText).toBe(customer.customerButtonLabel);
        return page;
      });

      await test.step('保存订单并校验 Recall 详情卡片和 Edit 点单页客户信息', async () => {
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );

        const recallPage = await saveOrderAndOpenRecallPage(orderDishesPage);
        const orderDetails = await new RecallFlow().viewFirstVisibleOrderDetails(recallPage);

        expect(orderDetails.customerInfo?.name).toBe(customer.customerName);
        expect(orderDetails.customerInfo?.phone.replace(/\D/g, '')).toBe(customer.phoneNumber);

        const editingPage = await new RecallFlow().editFirstVisibleOrder(recallPage);
        await editingPage.openCustomerInformationPage(customer.customerButtonLabel);
        const editingCustomer = await editingPage.readCustomerInformationPageIdentity();

        expect(editingCustomer.customerName).toBe(customer.customerName);
        expect(editingCustomer.normalizedPhone).toBe(customer.phoneNumber);
        await editingPage.saveCustomerInformationPage();
        await editingPage.exitOrderPage();
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
      async ({ apiSetup, homePage, employeeLoginPage }) => {
        const restoreSeatDisplay = await apiSetup.systemConfiguration.updateByName(
          'IS_SHOW_SEATS',
          null,
          { verify: true },
        );

        try {
          const orderDishesFlow = new OrderDishesFlow();
          const splitOrderFlow = new SplitOrderFlow();
          const recallFlow = new RecallFlow();
          const paymentFlow = new PaymentFlow();

          const readyHomePage = await test.step(
            '关闭座位显示配置并刷新 POS 员工上下文',
            async () => {
              const page = await enterReadyHome({ employeeLoginPage, homePage });
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
        } finally {
          await restoreSeatDisplay();
        }
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

  test.describe('Modify 全局选项数量调整', () => {
    test(
      '[POS-31662] 应能通过 Add 增加全局选项数量并保持 Modify 面板可见',
      {
        annotation: [jiraIssueAnnotation('POS-31662')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const orderDishesPage = await test.step('进入 To Go 并添加普通菜', async () => {
          const page = await new TakeoutFlow().startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await new OrderDishesFlow().addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        await test.step('选择全局选项并通过 Add 增加数量', async () => {
          const result = await new OrderDishesFlow().changeGlobalOptionQuantity(
            orderDishesPage,
            {
              dishName: orderServiceDishes.regular.name,
              operations: [{ type: 'add' }],
              optionName: orderServiceModifyGlobalOptionCase.optionName,
            },
          );

          expect(result.quantities).toEqual(
            orderServiceModifyGlobalOptionCase.addExpectedQuantities,
          );
          expect(result.modifyPanelVisible).toEqual(
            orderServiceModifyGlobalOptionCase.addExpectedQuantities.map(() => true),
          );
          await orderDishesPage.closeModifyPanel();
        });
      },
    );

    test(
      '[POS-31663] 应能通过 Count 设置全局选项数量并在归零后移除选项',
      {
        annotation: [
          jiraIssueAnnotation('POS-31663'),
          jiraIssueAnnotation('POS-50142'),
        ],
      },
      async ({ homePage, employeeLoginPage }) => {
        test.info().annotations.push({
          type: '已知产品问题',
          description:
            'Count 弹窗已将全局选项数量显示为 0，但 Confirm 按钮仍为 disabled，无法按需求确认归零并移除选项。',
        });
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const orderDishesPage = await test.step('进入 To Go 并添加普通菜', async () => {
          const page = await new TakeoutFlow().startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await new OrderDishesFlow().addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        await test.step('通过 Count 将全局选项设为 5 后再归零', async () => {
          const result = await new OrderDishesFlow().changeGlobalOptionQuantity(
            orderDishesPage,
            {
              dishName: orderServiceDishes.regular.name,
              operations: [
                { type: 'count', quantity: orderServiceModifyGlobalOptionCase.countQuantity },
                { type: 'count', quantity: 0 },
              ],
              optionName: orderServiceModifyGlobalOptionCase.optionName,
            },
          );

          expect(result.quantities).toEqual(
            orderServiceModifyGlobalOptionCase.countExpectedQuantities,
          );
          expect(result.modifyPanelVisible).toEqual(
            orderServiceModifyGlobalOptionCase.countExpectedQuantities.map(() => true),
          );
          await orderDishesPage.closeModifyPanel();
        });
      },
    );

    test(
      '[POS-31664] 应能通过 Reduce 将全局选项从 2 逐次减至移除',
      {
        annotation: [
          jiraIssueAnnotation('POS-31664'),
          jiraIssueAnnotation('POS-50141'),
        ],
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const orderDishesPage = await test.step('进入 To Go 并添加普通菜', async () => {
          const page = await new TakeoutFlow().startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await new OrderDishesFlow().addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        await test.step('将全局选项设为 2 并通过 Reduce 逐次减至移除', async () => {
          const result = await new OrderDishesFlow().changeGlobalOptionQuantity(
            orderDishesPage,
            {
              dishName: orderServiceDishes.regular.name,
              operations: [
                {
                  type: 'count',
                  quantity: orderServiceModifyGlobalOptionCase.reduceStartQuantity,
                },
                { type: 'reduce' },
                { type: 'reduce' },
              ],
              optionName: orderServiceModifyGlobalOptionCase.optionName,
            },
          );

          expect(result.quantities).toEqual(
            orderServiceModifyGlobalOptionCase.reduceExpectedQuantities,
          );
          expect(result.modifyPanelVisible).toEqual(
            orderServiceModifyGlobalOptionCase.reduceExpectedQuantities.map(
              (quantity) => quantity > 0,
            ),
          );
          await orderDishesPage.closeModifyPanel();
        });
      },
    );
  });

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

        await test.step('选择普通菜1的菜品级一级选项并保留二级选项未选择', async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.selectCategoryOption(orderServiceCategoryOptions.paidNested.name);
          await orderDishesPage.expectItemOptionVisible(
            orderServiceCategoryOptions.paidNested.suboptionName,
          );
          await assertDishOptionsRoundTrip(
            orderDishesPage,
            orderServiceDishes.regular.name,
            [orderServiceCategoryOptions.paidNested.name],
            orderServiceCategoryOptions.paidNested.expectedDishPrice,
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
      '[POS-15761 POS-15763] 应能选择菜品一级和二级选项并在 Recall 正确回显',
      {
        annotation: jiraIssueAnnotations(['POS-15761', 'POS-15763']),
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
      '[POS-15759] 应能选择分类一级 option 并跳过二级 option 后在 Recall 正确回显',
      {
        annotation: [jiraIssueAnnotation('POS-15759')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        await test.step('选择分类一级 option 并保留二级 option 未选择', async () => {
          const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
          await assertCategoryOptionOrderRoundTrip(
            orderDishesPage,
            orderServiceDishes.categoryOption.name,
            orderServiceCategoryOptions.freeNested.name,
          );
        });
      },
    );

    test(
      '[POS-15643 POS-15758] 应能在分类菜品上选择 option 和二级 option 并在 Recall 正确回显',
      {
        annotation: jiraIssueAnnotations(['POS-15643', 'POS-15758']),
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

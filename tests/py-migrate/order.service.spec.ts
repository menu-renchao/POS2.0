import { expect } from '@playwright/test';
import { enterEmployeeContext } from '../../flows/employee-login.flow';
import { openHome } from '../../flows/home.flow';
import { enterWithAvailableLicense } from '../../flows/license-selection.flow';
import {
  addDishToCart,
  addRegularDish,
  increaseOrderedDishQuantityByOne,
} from '../../flows/order-dishes.flow';
import {
  editFirstVisibleRecallOrder,
  openRecallFromHome,
  viewFirstVisibleRecallOrderDetails,
} from '../../flows/recall.flow';
import { skipTableSelectionAndEnterOrderDishes } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import {
  startDeliveryOrder,
  startPickUpOrder,
  startToGoOrder,
} from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import { EmployeeLoginPage } from '../../pages/employee-login.page';
import { HomePage } from '../../pages/home.page';
import { LicenseSelectionPage } from '../../pages/license-selection.page';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import { RecallPage } from '../../pages/recall.page';
import {
  buildOrderServicePickupCustomer,
  orderServiceCategoryOptions,
  orderServiceCustomers,
  orderServiceDishes,
  orderServiceEditRecallTaxCase,
  orderServiceMultiDishQuantityCase,
  orderServiceSplitEvenlyCase,
} from '../../test-data/order-service';
import { jiraIssueAnnotation, jiraIssueAnnotations } from '../../utils/jira';

type AppEntryPages = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
  licenseSelectionPage: LicenseSelectionPage;
};

const recallDishRoundTripCases = [
  {
    title: '应能 To Go 点普通菜后在 Recall 校验菜品名称和价格',
    issue: 'POS-15602',
    dish: orderServiceDishes.regular,
    stepTitle: '从 To Go 进入点单页，添加普通菜并保存后在 Recall 校验',
  },
  {
    title: '应能 To Go 点另一个分类菜品后在 Recall 校验菜品名称和价格',
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

async function saveOrderAndOpenLatestRecallDetails(
  orderDishesPage: OrderDishesPage,
): Promise<Awaited<ReturnType<typeof viewFirstVisibleRecallOrderDetails>>> {
  const savedHomePage = await orderDishesPage.saveOrder();
  await savedHomePage.expectPrimaryFunctionCardsVisible();

  const recallPage = await openRecallFromHome(savedHomePage);
  return await viewFirstVisibleRecallOrderDetails(recallPage);
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

test.describe('堂食点单后 Recall 编辑税额校验', () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '应能堂食保存后在 Recall 编辑菜品数量并校验税额实时更新',
    {
      tag: ['@smoke'],
      annotation: [jiraIssueAnnotation('POS-30543')],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      const readyHomePage = await test.step('从首页进入系统并完成授权与员工口令前置条件', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
      });

      const savedOrderContext = await test.step('通过 New Order 不选桌完成堂食点单并保存', async () => {
        const selectTablePage = await readyHomePage.clickDineIn();
        const orderDishesPage = await skipTableSelectionAndEnterOrderDishes(selectTablePage);

        await addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await addRegularDish(
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
        const recallPage = await openRecallFromHome(savedOrderContext.savedHomePage);
        const orderDetails = await viewFirstVisibleRecallOrderDetails(recallPage);
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
          const editingOrderDishesPage = await editFirstVisibleRecallOrder(recallPage);

          await increaseOrderedDishQuantityByOne(
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
        const readyHomePage = await enterEmployeeContext(
          editResult.savedHomePage,
          employeeLoginPage,
        );
        const recallPage = await openRecallFromHome(readyHomePage);

        const orderDetailsAfterEdit = await viewFirstVisibleRecallOrderDetails(recallPage);
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
      async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并完成授权与员工口令', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
        });

        await test.step(testCase.stepTitle, async () => {
          const orderDishesPage = await startToGoOrder(readyHomePage);

          await addRegularDish(orderDishesPage, testCase.dish.name, testCase.dish.menu);
          await expectLatestRecallDishMatches(orderDishesPage, testCase.dish.name);
        });
      },
    );
  }

  test(
    '应能点单时累计整数菜品数量并在 Recall 保持数量',
    {
      annotation: [jiraIssueAnnotation('POS-32905')],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并完成授权与员工口令', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
      });

      const orderDishesPage = await test.step(
        `从 To Go 点两个菜并将第一个菜数量调整为 ${orderServiceMultiDishQuantityCase.multiDishFirstQuantity}`,
        async () => {
          const page = await startToGoOrder(readyHomePage);

          await addDishToCart(page, {
            ...orderServiceDishes.regular.menu,
            dishName: orderServiceDishes.regular.name,
            quantity: orderServiceMultiDishQuantityCase.multiDishFirstQuantity,
          });
          await addRegularDish(page, orderServiceDishes.test.name, orderServiceDishes.test.menu);

          return page;
        },
      );

      await test.step(
        `校验点单页 Count 为整数 ${orderServiceMultiDishQuantityCase.multiDishTotalCount}`,
        async () => {
          const priceSummary = await orderDishesPage.readPriceSummary();

          expect(priceSummary.Count).toBe(orderServiceMultiDishQuantityCase.multiDishTotalCount);
        },
      );

      await test.step('保存订单后在 Recall 校验两个菜的数量保持一致', async () => {
        const orderDetails = await saveOrderAndOpenLatestRecallDetails(orderDishesPage);
        const firstDish = orderDetails.items.find(
          (item) => item.name === orderServiceDishes.regular.name,
        );
        const secondDish = orderDetails.items.find(
          (item) => item.name === orderServiceDishes.test.name,
        );

        expect(firstDish?.quantity).toBe(
          orderServiceMultiDishQuantityCase.multiDishFirstRecallQuantity,
        );
        expect(secondDish?.quantity).toBe(
          orderServiceMultiDishQuantityCase.multiDishSecondRecallQuantity,
        );
      });
    },
  );

  test(
    '应能创建 Delivery 订单并在 Recall 详情展示客户信息',
    {
      annotation: [jiraIssueAnnotation('POS-30575')],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并完成授权与员工口令', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
      });

      const orderDishesPage = await test.step('填写 Delivery 客户信息并进入点单页', async () => {
        return await startDeliveryOrder(readyHomePage, orderServiceCustomers.delivery);
      });

      await test.step('添加菜品、保存订单并在 Recall 校验客户信息', async () => {
        await addRegularDish(
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
    '应能创建带姓名的 Pick Up 订单并在 Recall 详情展示客户姓名',
    {
      tag: ['@smoke'],
      annotation: [jiraIssueAnnotation('POS-31409')],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并完成授权与员工口令', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
      });
      const customer = buildOrderServicePickupCustomer();

      const orderDishesPage = await test.step('填写 Pick Up 姓名并进入点单页', async () => {
        return await startPickUpOrder(readyHomePage, customer);
      });

      await test.step('添加菜品、保存订单并在 Recall 校验客户姓名', async () => {
        await addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );

        const orderDetails = await saveOrderAndOpenLatestRecallDetails(orderDishesPage);

        expect(orderDetails.customerInfo?.name).toContain(customer.customerName);
      });
    },
  );

  test(
    '应能在点单页将订单平分为两份并校验子单金额',
    {
      annotation: [jiraIssueAnnotation('POS-16303')],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并完成授权与员工口令', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
      });

      await test.step(
        `添加 To Go 菜品并打开分单面板执行平分为 ${orderServiceSplitEvenlyCase.splitSuborderCount} 份`,
        async () => {
          const orderDishesPage = await startToGoOrder(readyHomePage);
          const splitOrderFlow = new SplitOrderFlow();

          await addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );

          const splitOrderPage = await orderDishesPage.openSplitOrder();
          const beforeSplitSnapshot = await splitOrderPage.readSnapshot();
          const totalBeforeSplit = Number(beforeSplitSnapshot.total);

          expect(totalBeforeSplit, '分单前应能读取订单总额').toBeGreaterThan(0);

          await splitOrderFlow.splitOrderEvenly(
            splitOrderPage,
            orderServiceSplitEvenlyCase.splitSuborderCount,
          );

          const afterSplitSnapshot = await splitOrderPage.readSnapshot();

          expect(afterSplitSnapshot.suborders).toHaveLength(
            orderServiceSplitEvenlyCase.splitSuborderCount,
          );

          for (const suborder of afterSplitSnapshot.suborders) {
            expect(Number(suborder.total)).toBeCloseTo(
              totalBeforeSplit / orderServiceSplitEvenlyCase.splitSuborderCount,
              2,
            );
          }

          await splitOrderFlow.submitAndReturnPage(splitOrderPage);
        },
      );

    },
  );

  test.describe('option 选择回显', () => {
    test(
      '应能在分类菜品上选择有价格 option 并正确计算总额',
      {
        annotation: [jiraIssueAnnotation('POS-24394')],
      },
      async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并完成授权与员工口令', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
        });

        await test.step('从 To Go 进入点单页，选择有价格 option 并校验总额变化', async () => {
          const orderDishesPage = await startToGoOrder(readyHomePage);
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
      '应能在分类菜品上选择 option 和二级 option 并在 Recall 正确回显',
      {
        annotation: jiraIssueAnnotations(['POS-15643', 'POS-15758', 'POS-15759']),
      },
      async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并完成授权与员工口令', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage, licenseSelectionPage });
        });

        await test.step(
          `从 To Go 进入点单页，选择 ${orderServiceCategoryOptions.freeNested.name} 和 ${orderServiceCategoryOptions.freeNested.suboptionName} 并校验回显`,
          async () => {
            const orderDishesPage = await startToGoOrder(readyHomePage);
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

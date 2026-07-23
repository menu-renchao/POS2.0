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
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
import { RecallPage } from '../../pages/recall.page';
import {
  orderServiceCategoryOptions,
  orderServiceComboOptionRemovalCase,
  orderServiceDishes,
  orderServiceModifyGlobalOptionCase,
  orderServiceSavedComboSubItemModifyCase,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';
import { waitUntil } from '../../utils/wait';

type ReadyPages = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
};

async function enterReadyHome({ employeeLoginPage, homePage }: ReadyPages): Promise<HomePage> {
  const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(
    homePage,
    employeeLoginPage,
  );
  await readyHomePage.expectPrimaryFunctionCardsVisible();
  return readyHomePage;
}

async function createCashPaidToGoOrder(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  options: {
    firstItem?: 'combo' | 'regular';
    itemFixedCharge?: number;
    orderType?: 'dine-in' | 'to-go';
    partialCreditAmountInCents?: number;
    presetItemDiscount?: {
      authorizationPasscode: string;
      dishNames?: string[];
      name: string;
    };
    secondDish?: boolean;
    splitPaymentAmountInCents?: number;
    taxExemptFirstDish?: boolean;
    withChange?: boolean;
  } = {},
): Promise<{
  firstDishTotal: number;
  orderNumber: string;
  paidAmounts: number[];
  recallPage: RecallPage;
  total: number;
}> {
  const orderDishesPage = options.orderType === 'dine-in'
    ? await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage)
    : await new TakeoutFlow().startToGoOrder(readyHomePage, employeeLoginPage);
  const orderDishesFlow = new OrderDishesFlow();
  if (options.firstItem === 'combo') {
    await orderDishesFlow.addComboDishWithItemOptions(orderDishesPage, {
      comboName: orderServiceComboOptionRemovalCase.comboName,
      menuSelection: orderServiceDishes.regular.menu,
      saleItemId: orderServiceComboOptionRemovalCase.saleItemId,
      sectionId: orderServiceComboOptionRemovalCase.sectionId,
      selections: [],
    });
  } else {
    await orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );
  }

  if (options.taxExemptFirstDish) {
    await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
  }

  if (options.itemFixedCharge !== undefined) {
    await orderDishesFlow.applyCustomCharge(orderDishesPage, {
      dishNames: [orderServiceDishes.regular.name],
      scope: 'item',
      taxed: false,
      type: 'fixed',
      value: options.itemFixedCharge,
    });
  }

  const firstDishSummary = await orderDishesPage.readPriceSummary();
  const firstDishTotal =
    firstDishSummary.Subtotal +
    firstDishSummary.Tax +
    (options.itemFixedCharge ?? 0);

  if (options.secondDish) {
    await orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.test.name,
      orderServiceDishes.test.menu,
    );
  }

  if (options.presetItemDiscount) {
    for (const dishName of options.presetItemDiscount.dishNames ?? [orderServiceDishes.regular.name]) {
      await orderDishesFlow.applyPresetItemDiscount(orderDishesPage, {
        authorizationPasscode: options.presetItemDiscount.authorizationPasscode,
        discountName: options.presetItemDiscount.name,
        dishName,
      });
    }
  }

  const total = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
  const savedOrder = await orderDishesPage.saveOrderWithReference();
  const employeeHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
    savedOrder.homePage,
    employeeLoginPage,
  );
  const recallPage = await new RecallFlow().openRecallFromHome(employeeHomePage);
  const orderNumber = savedOrder.orderNumber;
  const paymentPage = await new RecallFlow().openPayment(recallPage, orderNumber);
  const paymentFlow = new PaymentFlow();

  if (options.partialCreditAmountInCents !== undefined) {
    await paymentFlow.payPartialByCreditCard(paymentPage, {
      amountInCents: options.partialCreditAmountInCents,
      printReceipt: false,
    });
  } else if (options.splitPaymentAmountInCents !== undefined) {
    await paymentFlow.payPartialByCashKeepingPaymentOpen(paymentPage, {
      amountInCents: options.splitPaymentAmountInCents,
      printReceipt: false,
    });
    await paymentFlow.payByCash(paymentPage, { printReceipt: false });
  } else if (options.withChange) {
    await paymentFlow.payPartialByCash(paymentPage, {
      amountInCents: Math.ceil((total + 10) * 100),
      printReceipt: false,
      successButtonText: 'NO RECEIPT',
    });
  } else {
    await paymentFlow.payByCash(paymentPage, { printReceipt: false });
  }

  const paidAmounts = (await recallPage.readOrderPaymentAmounts()).filter(
    (amount) => amount > 0,
  );
  await recallPage.closeOrderDetailsDialog();
  await new RecallFlow().clearSearchConditions(recallPage);

  return { firstDishTotal, orderNumber, paidAmounts, recallPage, total };
}

async function refundDishAndReadLatestRefund(
  paidOrder: Awaited<ReturnType<typeof createCashPaidToGoOrder>>,
  dishName: string,
): Promise<number> {
  await new RecallFlow().refundOrderItem(
    paidOrder.recallPage,
    paidOrder.orderNumber,
    dishName,
  );
  const refundAmounts = await waitUntil(
    async () =>
      (await paidOrder.recallPage.readOrderPaymentAmounts()).filter((amount) => amount < 0),
    (amounts) => amounts.length > 0,
    {
      timeout: 10_000,
      interval: 200,
      message: '按菜退款成功后应显示负向退款流水。',
    },
  );
  const latestRefund = refundAmounts.at(-1);

  if (latestRefund === undefined) {
    throw new Error('按菜退款完成后未读取到负向退款流水。');
  }

  return latestRefund;
}

test.describe('订单操作剩余回归', { tag: ['@点单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-35134] 应能按菜退款计税菜品并退回菜价与税额',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-35134')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const paidOrder = await test.step('创建包含两道菜的现金已支付 To Go 订单', async () => {
        return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
          secondDish: true,
        });
      });

      await test.step('从 Recall 对第一道计税菜品发起按菜退款', async () => {
        await refundDishAndReadLatestRefund(paidOrder, orderServiceDishes.regular.name);
      });

      await test.step('校验退款流水等于第一道菜含税金额', async () => {
        const refundAmounts = (await paidOrder.recallPage.readOrderPaymentAmounts())
          .filter((amount) => amount < 0);
        expect(refundAmounts.at(-1)).toBeCloseTo(-paidOrder.firstDishTotal, 2);
      });
    },
  );

  test(
    '[POS-35135] 应能按菜退款免税菜品并仅退回菜价',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-35135')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const paidOrder = await test.step('创建第一道菜免税的现金已支付 To Go 订单', async () => {
        return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
          secondDish: true,
          taxExemptFirstDish: true,
        });
      });

      const refundAmount = await test.step('对免税菜品退款并读取退款流水', async () => {
        return await refundDishAndReadLatestRefund(paidOrder, orderServiceDishes.regular.name);
      });

      expect(refundAmount).toBeCloseTo(-paidOrder.firstDishTotal, 2);
    },
  );

  test(
    '[POS-35142] 应能按菜退款参与整单百分比折扣的计税菜品',
    {
      tag: ['@现金支付', '@加收'],
      annotation: [jiraIssueAnnotation('POS-35142')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      const discount = await test.step('通过 API 创建本次使用的 10% 单菜折扣', async () => {
        return await apiSetup.discount.create({ rate: 10, rateType: 2 });
      });
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const paidOrder = await test.step('创建含百分比折扣的现金已支付 To Go 订单', async () => {
        return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
          presetItemDiscount: {
            authorizationPasscode: '11',
            name: discount.name,
          },
          secondDish: true,
        });
      });

      const refundAmount = await test.step('对参与折扣的第一道菜退款并读取流水', async () => {
        return await refundDishAndReadLatestRefund(paidOrder, orderServiceDishes.regular.name);
      });

      expect(refundAmount).toBeCloseTo(-paidOrder.firstDishTotal, 2);
    },
  );

  test(
    '[POS-35150] 按菜退款金额应不超过对应支付流水金额',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-35150')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const paidOrder = await test.step('创建首笔支付五美元并完成尾款的 To Go 订单', async () => {
        return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
          splitPaymentAmountInCents: 500,
        });
      });

      const refundAmount = await test.step('对金额高于支付流水的菜品发起退款', async () => {
        return await refundDishAndReadLatestRefund(paidOrder, orderServiceDishes.regular.name);
      });

      expect(paidOrder.paidAmounts).toContain(5);
      expect(refundAmount).toBeCloseTo(-5, 2);
    },
  );

  test(
    '[POS-35155] 已支付未送厨订单按菜退款后再次送厨不应发送已退款菜品',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-35155')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.info().annotations.push({
        type: '已知产品问题',
        description:
          '退款金额与未退款菜品送厨结果均正确，但再次送厨后已退款菜品仍被写入 Sent in 时间，未满足“已退款菜品不得送厨”。',
      });
      const discount = await apiSetup.discount.create({ rate: 10, rateType: 2 });
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          AUTO_SEND_TO_KITCHEN_AFTER_SETTLED: false,
          REFUND_BY_ITEMS: true,
          SEND_TO_KITCHEN_WHEN_CLICK_SETTLE: false,
        },
        { verify: true },
      );

      try {
        const readyHomePage = await test.step('进入 POS 主页并刷新支付后送厨配置', async () => {
          const page = await enterReadyHome({ employeeLoginPage, homePage });
          await page.clickRefresh();
          await page.confirmDelayedConfigurationRefresh();
          return page;
        });
        const paidOrder = await test.step('创建两道菜且支付后尚未送厨的堂食无桌订单', async () => {
          return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
            orderType: 'dine-in',
            secondDish: true,
          });
        });

        const refundAmount = await test.step('按菜退款普通菜1并记录退款金额', async () => {
          return await refundDishAndReadLatestRefund(paidOrder, orderServiceDishes.regular.name);
        });

        await test.step('关闭退款后的详情并从 Recall 再次送厨该订单', async () => {
          await paidOrder.recallPage.closeOrderDetailsDialog();
          await new RecallFlow().sendOrderToKitchen(
            paidOrder.recallPage,
            paidOrder.orderNumber,
          );
        });

        await test.step('确认未退款菜品已送厨且退款金额正确', async () => {
          await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
          const details = await paidOrder.recallPage.readOrderDetailsSnapshot();
          const refundedItem = details.items.find(
            (item) => item.name === orderServiceDishes.regular.name,
          );
          const retainedItem = details.items.find(
            (item) => item.name === orderServiceDishes.test.name,
          );

          expect(refundAmount).toBeCloseTo(-paidOrder.firstDishTotal, 2);
          expect(retainedItem, '未退款菜品应保留在订单详情中').toBeTruthy();
          expect(retainedItem?.sentTime, '未退款菜品应记录送厨时间').not.toBeNull();
          expect(
            refundedItem?.sentTime ?? null,
            '已退款菜品不应产生送厨时间',
          ).toBeNull();
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-35163] 多次按菜退款时应分别生成正确退款流水',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-35163')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const paidOrder = await test.step('创建包含两道菜的现金已支付 To Go 订单', async () => {
        return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
          secondDish: true,
        });
      });
      const secondDishTotal = paidOrder.total - paidOrder.firstDishTotal;

      const firstRefund = await test.step('第一次按菜退款普通菜1', async () => {
        return await refundDishAndReadLatestRefund(paidOrder, orderServiceDishes.regular.name);
      });
      await paidOrder.recallPage.closeOrderDetailsDialog();
      const secondRefund = await test.step('第二次按菜退款普通菜2', async () => {
        return await refundDishAndReadLatestRefund(paidOrder, orderServiceDishes.test.name);
      });

      expect(firstRefund).toBeCloseTo(-paidOrder.firstDishTotal, 2);
      expect(secondRefund).toBeCloseTo(-secondDishTotal, 2);
    },
  );

  test(
    '[POS-35166] 现金找零订单按金额退款应默认实际支付金额',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-35166')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const paidOrder = await test.step('创建现金支付并产生找零的 To Go 订单', async () => {
        return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
          withChange: true,
        });
      });

      await test.step('对实际支付流水执行整笔退款', async () => {
        await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
        await paidOrder.recallPage.refundPaymentRecord(0);
      });
      const refundAmounts = (await paidOrder.recallPage.readOrderPaymentAmounts()).filter(
        (amount) => amount < 0,
      );

      expect(refundAmounts.at(-1)).toBeCloseTo(-paidOrder.total, 2);
    },
  );

  test(
    '[POS-35173] 信用卡部分支付后应不提供按菜退款',
    {
      tag: ['@信用卡支付'],
      annotation: [jiraIssueAnnotation('POS-35173')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const paidOrder = await test.step('创建信用卡部分支付一美元的 To Go 订单', async () => {
        return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
          partialCreditAmountInCents: 100,
        });
      });

      await test.step('打开信用卡支付流水并校验不提供按菜退款', async () => {
        await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
        await paidOrder.recallPage.expectOrderItemRefundUnavailable(0);
      });
    },
  );

  test(
    '[POS-35498] 菜品不计税加收并应用整单百分比折扣后全菜退款应等于实付金额',
    {
      tag: ['@现金支付', '@加收'],
      annotation: [jiraIssueAnnotation('POS-35498')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      const discount = await apiSetup.discount.create({ rate: 10, rateType: 2 });
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          IS_DISCOUNT_VOID_TAX: true,
          REFUND_BY_ITEMS: true,
        },
        { verify: true },
      );

      try {
        const readyHomePage = await test.step('进入 POS 主页并刷新退款及折扣计税配置', async () => {
          const page = await enterReadyHome({ employeeLoginPage, homePage });
          await page.clickRefresh();
          await page.confirmDelayedConfigurationRefresh();
          return page;
        });
        const paidOrder = await test.step('创建含三美元单菜加收和整单九折的两菜订单并现金结账', async () => {
          return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
            itemFixedCharge: 3,
            presetItemDiscount: {
              authorizationPasscode: '11',
              dishNames: [orderServiceDishes.regular.name, orderServiceDishes.test.name],
              name: discount.name,
            },
            secondDish: true,
          });
        });

        const firstRefund = await test.step('按菜退款普通菜1', async () => {
          return await refundDishAndReadLatestRefund(paidOrder, orderServiceDishes.regular.name);
        });
        await paidOrder.recallPage.closeOrderDetailsDialog();
        const secondRefund = await test.step('按菜退款普通菜2', async () => {
          return await refundDishAndReadLatestRefund(paidOrder, orderServiceDishes.test.name);
        });

        await test.step('确认全部按菜退款金额合计等于原订单实付金额', async () => {
          const paidTotal = paidOrder.paidAmounts.reduce((sum, amount) => sum + amount, 0);
          expect(Math.abs(firstRefund + secondRefund)).toBeCloseTo(paidTotal, 2);
          expect(paidTotal).toBeCloseTo(paidOrder.total, 2);
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-36140] 折扣原因可选时不填写原因也应成功保存整单折扣',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-36140')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      const discount = await apiSetup.discount.create({ rate: 10, rateType: 2 });
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        'DISCOUNT_REASON_REQUIRED',
        'OPTIONAL',
        { verify: true },
      );

      try {
        const readyHomePage = await test.step('进入 POS 主页并刷新折扣原因可选配置', async () => {
          const page = await enterReadyHome({ employeeLoginPage, homePage });
          await page.clickRefresh();
          await page.confirmDelayedConfigurationRefresh();
          return page;
        });
        const orderDishesPage = await test.step('进入 To Go 并添加普通菜1', async () => {
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

        await test.step('添加百分之十折扣且不填写折扣原因', async () => {
          await new OrderDishesFlow().applyPresetItemDiscount(orderDishesPage, {
            authorizationPasscode: '11',
            discountName: discount.name,
            dishName: orderServiceDishes.regular.name,
          });
        });
        const savedOrder = await test.step('保存订单并读取精确订单号', async () => {
          return await orderDishesPage.saveOrderWithReference();
        });
        const employeeHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
          savedOrder.homePage,
          employeeLoginPage,
        );
        const recallPage = await new RecallFlow().openRecallFromHome(employeeHomePage);

        await test.step('在 Recall 确认订单已保存负向折扣金额', async () => {
          const details = await new RecallFlow().viewOrderDetails(
            recallPage,
            savedOrder.orderNumber,
          );
          expect(details.priceSummary.Discount).toBeLessThan(0);
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-36148] 折扣原因必填时整单自定义百分比折扣应保存所选原因',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-36148')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      const discount = await apiSetup.discount.create({ rate: 10, rateType: 2 });
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          DISCOUNT_REASON: 'Waited Too Long, Improperly Prepared',
          DISCOUNT_REASON_REQUIRED: 'REQUIRED',
        },
        { verify: true },
      );

      try {
        const readyHomePage = await test.step('进入 POS 主页并刷新折扣原因必填配置', async () => {
          const page = await enterReadyHome({ employeeLoginPage, homePage });
          await page.clickRefresh();
          await page.confirmDelayedConfigurationRefresh();
          return page;
        });
        const orderDishesPage = await test.step('进入 To Go 并添加普通菜1', async () => {
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

        await test.step('添加百分之十折扣并选择 Waited Too Long 原因', async () => {
          await new OrderDishesFlow().applyPresetItemDiscount(orderDishesPage, {
            authorizationPasscode: '11',
            discountName: discount.name,
            dishName: orderServiceDishes.regular.name,
          });
        });

        const savedOrder = await test.step('保存订单并读取精确订单号', async () => {
          return await orderDishesPage.saveOrderWithReference();
        });
        const employeeHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
          savedOrder.homePage,
          employeeLoginPage,
        );
        const recallPage = await new RecallFlow().openRecallFromHome(employeeHomePage);

        await test.step('在 Recall 校验普通菜1保留 Waited Too Long 折扣原因', async () => {
          const details = await new RecallFlow().viewOrderDetails(
            recallPage,
            savedOrder.orderNumber,
          );
          const item = details.items.find(
            (orderItem) => orderItem.name === orderServiceDishes.regular.name,
          );
          expect(item, 'Recall 应展示普通菜1').toBeTruthy();
          expect(item?.additions.map((addition) => addition.name).join(' ')).toContain(
            'Waited Too Long',
          );
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-37798] 分单中新增零元空子单后保存应自动删除该子单',
    {
      tag: ['@分单'],
      annotation: [jiraIssueAnnotation('POS-37798')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const orderDishesPage = await test.step('创建包含两道普通菜的堂食无桌订单', async () => {
        const page = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
        const orderFlow = new OrderDishesFlow();
        await orderFlow.addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderFlow.addRegularDish(
          page,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );
        return page;
      });
      const splitOrderPage = await orderDishesPage.openSplitOrder();
      const splitFlow = new SplitOrderFlow();

      await test.step('将一道菜移入第二子单并新增第三个零元空子单', async () => {
        await splitFlow.moveDishToNewSuborder(splitOrderPage, orderServiceDishes.test.name);
        await splitOrderPage.clickAddSuborder();
        const draft = await splitOrderPage.readSnapshot();

        expect(draft.suborders, '保存前应存在两个有菜子单和一个空子单').toHaveLength(3);
        expect(draft.suborders.filter((suborder) => suborder.total === 0)).toHaveLength(1);
      });

      const recallPage = await test.step('提交分单并进入 Recall', async () => {
        const returnedPage = await splitFlow.submitAndReturnPage(splitOrderPage);
        if (returnedPage instanceof RecallPage) {
          return returnedPage;
        }

        return await returnedPage.clickRecall();
      });

      await test.step('确认保存后只保留两个非空子单', async () => {
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        await recallPage.openOrderDetails(orderNumber);
        const targetOrderNumbers = await recallPage.readTargetOrderNumbers();
        expect(targetOrderNumbers).toHaveLength(2);
      });
    },
  );

  test(
    '[POS-36156] 折扣原因必填时单菜百分比折扣应展示并保存所选原因',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-36156')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          DISCOUNT_REASON: 'Waited Too Long, Improperly Prepared',
          DISCOUNT_REASON_REQUIRED: 'REQUIRED',
        },
        { verify: true },
      );
      const discount = await apiSetup.discount.create({ rate: 10, rateType: 2 });

      try {
        const readyHomePage = await test.step('进入 POS 主页并刷新折扣原因必填配置', async () => {
          const page = await enterReadyHome({ employeeLoginPage, homePage });
          await page.clickRefresh();
          await page.confirmDelayedConfigurationRefresh();
          return page;
        });
        const orderDishesPage = await test.step('创建 To Go 订单并添加普通菜1', async () => {
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

        await test.step('为普通菜1应用百分之十折扣并完成授权', async () => {
          await new OrderDishesFlow().applyPresetItemDiscount(orderDishesPage, {
            authorizationPasscode: '11',
            discountName: discount.name,
            dishName: orderServiceDishes.regular.name,
          });
        });

        const savedOrder = await test.step('保存订单并读取精确订单号', async () => {
          return await orderDishesPage.saveOrderWithReference();
        });
        const employeeHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
          savedOrder.homePage,
          employeeLoginPage,
        );
        const recallPage = await new RecallFlow().openRecallFromHome(employeeHomePage);

        await test.step('在 Recall 校验普通菜1保留 Waited Too Long 折扣原因', async () => {
          const details = await new RecallFlow().viewOrderDetails(
            recallPage,
            savedOrder.orderNumber,
          );
          const item = details.items.find((orderItem) => orderItem.name === orderServiceDishes.regular.name);
          expect(item, 'Recall 应展示普通菜1').toBeTruthy();
          expect(item?.additions.map((addition) => addition.name).join(' ')).toContain(
            'Waited Too Long',
          );
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-42631] 打单后自动送厨时套餐新增子菜调味应展示为已送厨',
    {
      annotation: [jiraIssueAnnotation('POS-42631')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      test.info().annotations.push({
        type: '已知产品问题',
        description:
          'Recall 打单请求返回 HTTP 200，但订单状态实际仍为 SUBMITTED，未按配置进入 PRINTED，无法继续满足打单后自动送厨结果。',
      });
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        'AUTO_SEND_TO_KITCHEN_AFTER_PRINTED',
        true,
        { verify: true },
      );
      await test.step('停用订单类型为空且会中断套餐同步的脏自动加收配置', async () => {
        await apiSetup.charge.deactivateInvalidAutomaticCharges();
      });
      const comboCase = orderServiceSavedComboSubItemModifyCase;

      try {
        const readyHomePage = await test.step('进入 POS 主页并刷新打单后自动送厨配置', async () => {
          const page = await enterReadyHome({ employeeLoginPage, homePage });
          await page.clickRefresh();
          await page.confirmDelayedConfigurationRefresh();
          return page;
        });
        const orderDishesPage = await test.step('创建堂食无桌订单并添加目标套餐', async () => {
          const page = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
          await new OrderDishesFlow().addComboDishWithItemOptions(page, {
            comboName: comboCase.comboName,
            itemIndex: orderServiceComboOptionRemovalCase.itemIndex,
            menuSelection: orderServiceDishes.regular.menu,
            saleItemId: orderServiceComboOptionRemovalCase.saleItemId,
            sectionId: comboCase.sectionId,
            selections: [],
          });
          return page;
        });
        const sentOrder = await test.step('整单送厨并读取精确订单号', async () => {
          return await orderDishesPage.sendOrderWithReference();
        });

        const recallFlow = new RecallFlow();
        const recallPage = await recallFlow.openRecallFromHome(sentOrder.homePage);
        const updatedOrder = await test.step('从 Recall 编辑套餐子菜并追加调味后保存', async () => {
          await recallFlow.clearSearchConditions(recallPage);
          const editingPage = await recallFlow.editOrder(recallPage, sentOrder.orderNumber);
          await editingPage.openComboEditorForOrderedCombo(comboCase.comboName);
          await editingPage.selectComboItem(
            comboCase.sectionId,
            comboCase.targetSaleItemId,
            comboCase.targetItemIndex,
          );
          await editingPage.expectItemOptionVisible(comboCase.parentOption);
          await editingPage.selectCategoryOption(comboCase.parentOption);
          await editingPage.confirmComboDialog();
          const result = await editingPage.saveOrderWithReference();
          const updatedComboSubItem = result.orderItems
            .flatMap((item) => item.comboSubItems)
            .find(
              (item) => String(item.saleItemId) === String(comboCase.targetSaleItemId),
            );

          expect(updatedComboSubItem, '保存请求应包含 Recall 编辑时新增的套餐子菜').toBeTruthy();
          expect(
            updatedComboSubItem?.options.map((option) => option.name),
            '新增套餐子菜应保存所选调味',
          ).toContain(comboCase.parentOption);
          return result;
        });
        const updatedRecallPage = await recallFlow.openRecallFromHome(updatedOrder.homePage);

        await test.step('从 Recall 打单并确认订单进入 Printed 状态', async () => {
          await recallFlow.clearSearchConditions(updatedRecallPage);
          const kitchenTicketResult = await recallFlow.printOrderAndReadKitchenTicketResult(
            updatedRecallPage,
            updatedOrder.orderNumber,
          );
          expect(kitchenTicketResult.httpStatus).toBe(200);
          expect(kitchenTicketResult.orderStatus).toBe('PRINTED');
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-42086] 多数量菜品和折扣菜共存时建议小费百分比应保持配置值',
    {
      tag: ['@小费', '@加收'],
      annotation: [jiraIssueAnnotation('POS-42086')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          TIPS_SUGGESTIONS_CALCULATION: '1',
          TIPS_SUGGESTIONS_PERCENTAGE: '15|18|20',
        },
        { verify: true },
      );
      const discount = await apiSetup.discount.create({ rate: 10, rateType: 2 });

      try {
        const readyHomePage = await test.step('进入 POS 主页并刷新建议小费配置', async () => {
          const page = await enterReadyHome({ employeeLoginPage, homePage });
          await page.clickRefresh();
          await page.confirmDelayedConfigurationRefresh();
          return page;
        });
        const orderDishesPage = await test.step('创建多份普通菜1和一份普通菜2的堂食无桌订单', async () => {
          const page = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
          const orderFlow = new OrderDishesFlow();
          await orderFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
            3,
          );
          await orderFlow.addRegularDish(
            page,
            orderServiceDishes.test.name,
            orderServiceDishes.test.menu,
          );
          return page;
        });

        await test.step('为普通菜2应用百分之十单菜折扣', async () => {
          await new OrderDishesFlow().applyPresetItemDiscount(orderDishesPage, {
            authorizationPasscode: '11',
            discountName: discount.name,
            dishName: orderServiceDishes.test.name,
          });
        });

        await test.step('进入支付页并确认建议小费百分比列表', async () => {
          const paymentPage = await orderDishesPage.openPayment();
          expect(await paymentPage.readSuggestedTipPercentages()).toEqual([15, 18, 20]);
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-43825] 添加全局调味后点击返回按钮应退出 Modify 面板',
    {
      annotation: [jiraIssueAnnotation('POS-43825')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const orderDishesPage = await test.step('创建堂食无桌订单并添加普通菜1', async () => {
        const page = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return page;
      });

      await test.step('进入 Modify、添加全局调味并点击返回按钮', async () => {
        await new OrderDishesFlow().addGlobalOptionAndCloseModify(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceModifyGlobalOptionCase.optionName,
        );
      });

      await test.step('确认 Modify 面板已退出', async () => {
        expect(await orderDishesPage.isModifyPanelVisible()).toBe(false);
      });
    },
  );

  test(
    '[POS-42085] 多份菜品应用并清除单菜折扣后继续加菜应能正常支付',
    {
      tag: ['@现金支付', '@加收'],
      annotation: [jiraIssueAnnotation('POS-42085')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      const discount = await test.step('通过 API 创建本次测试使用的百分之十单菜折扣', async () => {
        return await apiSetup.discount.create({ rate: 10, rateType: 2 });
      });
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const orderDishesPage = await test.step('创建堂食无桌订单并添加两份普通菜1', async () => {
        const page = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await page.changeDishCount(2);
        return page;
      });

      await test.step('应用单菜折扣后清空全部菜品折扣', async () => {
        const orderFlow = new OrderDishesFlow();
        await orderFlow.applyPresetItemDiscount(orderDishesPage, {
          authorizationPasscode: '11',
          discountName: discount.name,
          dishName: orderServiceDishes.regular.name,
        });
        await orderFlow.clearAllCharges(orderDishesPage, {
          dishNames: [orderServiceDishes.regular.name],
          scope: 'item',
        });
      });

      await test.step('继续添加普通菜2', async () => {
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.test.name,
          orderServiceDishes.test.menu,
        );
      });
      const savedOrder = await orderDishesPage.saveOrderWithReference();
      const employeeHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
        savedOrder.homePage,
        employeeLoginPage,
      );
      const recallPage = await new RecallFlow().openRecallFromHome(employeeHomePage);
      const paymentPage = await new RecallFlow().openPayment(
        recallPage,
        savedOrder.orderNumber,
      );

      await test.step('现金全额支付并在 Recall 确认状态为 Paid', async () => {
        await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
        await recallPage.openOrderDetails(savedOrder.orderNumber);
        const details = await recallPage.readOrderDetailsSnapshot();
        expect(details.paymentStatus).toBe('Paid');
      });
    },
  );

  test(
    '[POS-35307] 应能按菜退款套餐主菜、子菜与税额合计',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-35307')],
    },
    async ({ apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      await test.step('停用订单类型为空且会中断套餐同步的脏自动加收配置', async () => {
        await apiSetup.charge.deactivateInvalidAutomaticCharges();
      });
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const paidOrder = await test.step('创建只包含套餐菜的现金已支付 To Go 订单', async () => {
        return await createCashPaidToGoOrder(readyHomePage, employeeLoginPage, {
          firstItem: 'combo',
        });
      });

      const refundAmount = await test.step('按菜退款套餐并读取退款流水', async () => {
        return await refundDishAndReadLatestRefund(
          paidOrder,
          orderServiceComboOptionRemovalCase.comboName,
        );
      });

      expect(refundAmount).toBeCloseTo(-paidOrder.firstDishTotal, 2);
      expect(paidOrder.firstDishTotal).toBeCloseTo(paidOrder.total, 2);
    },
  );
});

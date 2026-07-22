import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { test } from '../../fixtures/test.fixture';
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
import type { OrderDishesPage } from '../../pages/order-dishes.page';
import type { RecallPage } from '../../pages/recall.page';
import { orderServiceDishes } from '../../test-data/order-service';
import {
  orderSettleAmounts,
  orderSettleConfiguration,
} from '../../test-data/order-settle';
import {
  RecallManualSearchTags,
  RecallOrderPaymentSuccessStatus,
  RecallPaymentStatuses,
} from '../../test-data/recall-search-options';
import { jiraIssueAnnotation } from '../../utils/jira';

type ReadyPages = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
};

type SavedOrder = {
  orderNumber: string;
  orderTotal: number;
  recallPage: RecallPage;
};

async function enterReadyHome({ employeeLoginPage, homePage }: ReadyPages): Promise<HomePage> {
  const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(
    homePage,
    employeeLoginPage,
  );
  await readyHomePage.expectPrimaryFunctionCardsVisible();
  return readyHomePage;
}

async function createSavedDineInOrder(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  options: {
    dishPrice?: number;
    taxExempt?: boolean;
  } = {},
): Promise<SavedOrder> {
  const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
  await addRegularDish(orderDishesPage);

  if (options.dishPrice !== undefined) {
    await orderDishesPage.changeOrderedDishPrice(
      orderServiceDishes.regular.name,
      options.dishPrice,
    );
  }

  if (options.taxExempt) {
    await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
  }

  await new OrderDishesFlow().clearAllCharges(orderDishesPage, { scope: 'whole' });

  const orderTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
  const savedOrder = await orderDishesPage.saveOrderWithReference();
  const readyHomePageAfterSave = await new EmployeeLoginFlow().enterEmployeeContext(
    savedOrder.homePage,
    employeeLoginPage,
  );
  const recallPage = await new RecallFlow().openRecallFromHome(readyHomePageAfterSave);
  await new RecallFlow().clearSearchConditions(recallPage);

  return {
    orderNumber: savedOrder.orderNumber,
    orderTotal,
    recallPage,
  };
}

async function addRegularDish(orderDishesPage: OrderDishesPage): Promise<void> {
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
}

async function paySavedOrderByCash(savedOrder: SavedOrder): Promise<void> {
  await savedOrder.recallPage.openOrderDetails(savedOrder.orderNumber);
  const paymentPage = await savedOrder.recallPage.openPayment();
  await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
  await savedOrder.recallPage.closeOrderDetailsDialog();
  await searchPaidOrder(savedOrder);
}

async function searchPaidOrder(savedOrder: SavedOrder): Promise<void> {
  await new RecallFlow().searchOrders(savedOrder.recallPage, {
    paymentStatus: RecallPaymentStatuses.paid,
    manualSearch: {
      tag: RecallManualSearchTags.orderNumber,
      keyword: savedOrder.orderNumber.replace(/^#/, ''),
    },
  });
}

test.describe('订单结账与现金支付', () => {
  test.describe.configure({ mode: 'serial' });

  test(
    '[POS-16479] 应能在 No Rounding 配置下保持现金支付金额不变',
    {
      tag: ['@点单', '@现金支付'],
      annotation: [jiraIssueAnnotation('POS-16479')],
    },
    async ({ apiSetup, employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);

      const restoreRoundingConfiguration = await apiSetup.systemConfiguration.updateByName(
        orderSettleConfiguration.roundingName,
        orderSettleConfiguration.noRounding,
        { verify: true },
      );

      try {
        const readyHomePage = await new HomeFlow().openHomeAfterConfigurationRefreshWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const savedOrder = await createSavedDineInOrder(readyHomePage, employeeLoginPage, {
          dishPrice: orderSettleAmounts.noRoundingDishPrice,
          taxExempt: true,
        });

        expect(savedOrder.orderTotal).toBeCloseTo(orderSettleAmounts.noRoundingDishPrice, 2);

        await paySavedOrderByCash(savedOrder);
        await savedOrder.recallPage.openOrderDetails(savedOrder.orderNumber);
        const orderDetails = await savedOrder.recallPage.readOrderDetailsSnapshot();
        const finalTotal = orderDetails.priceSummary.Total ?? orderDetails.priceSummary['Total(Cash)'];
        const cashPaymentAmounts = (await savedOrder.recallPage.readOrderPaymentAmounts()).filter(
          (amount) => amount > 0,
        );

        expect(finalTotal).toBeCloseTo(orderSettleAmounts.noRoundingDishPrice, 2);
        expect(cashPaymentAmounts).toHaveLength(1);
        expect(cashPaymentAmounts[0]).toBeCloseTo(orderSettleAmounts.noRoundingDishPrice, 2);
        expect(orderDetails.paymentStatus).toBe(RecallOrderPaymentSuccessStatus);
      } finally {
        await restoreRoundingConfiguration();
      }
    },
  );

  test(
    '[POS-19046] 应能在同一笔现金支付流水中以第二次小费覆盖第一次小费',
    {
      tag: ['@现金支付', '@小费'],
      annotation: [jiraIssueAnnotation('POS-19046')],
    },
    async ({ employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);
      const readyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
      const savedOrder = await createSavedDineInOrder(readyHomePage, employeeLoginPage);
      await paySavedOrderByCash(savedOrder);
      await savedOrder.recallPage.openOrderDetails(savedOrder.orderNumber);

      await savedOrder.recallPage.addPaymentRecordTip(0, orderSettleAmounts.firstTipInCents);
      expect(await savedOrder.recallPage.readPaymentRecordTipAmount(0)).toBeCloseTo(1, 2);
      expect((await savedOrder.recallPage.readDisplayedOrderPriceSummary()).Tips).toBeCloseTo(1, 2);

      await savedOrder.recallPage.addPaymentRecordTip(0, orderSettleAmounts.secondTipInCents);
      expect(await savedOrder.recallPage.readPaymentRecordTipAmount(0)).toBeCloseTo(2, 2);
      expect((await savedOrder.recallPage.readDisplayedOrderPriceSummary()).Tips).toBeCloseTo(2, 2);
    },
  );

  test(
    '[POS-19049] 应能分别为两笔现金支付流水添加小费并按合计展示',
    {
      tag: ['@现金支付', '@小费'],
      annotation: [jiraIssueAnnotation('POS-19049')],
    },
    async ({ employeeLoginPage, homePage }) => {
      test.setTimeout(120_000);
      const readyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
      const savedOrder = await createSavedDineInOrder(readyHomePage, employeeLoginPage);

      await savedOrder.recallPage.openOrderDetails(savedOrder.orderNumber);
      const paymentPage = await savedOrder.recallPage.openPayment();
      const paymentFlow = new PaymentFlow();
      await paymentFlow.payPartialByCashKeepingPaymentOpen(paymentPage, {
        amountInCents: orderSettleAmounts.firstPartialPaymentInCents,
        printReceipt: false,
      });
      await paymentFlow.payByCash(paymentPage, { printReceipt: false });
      await savedOrder.recallPage.closeOrderDetailsDialog();
      await searchPaidOrder(savedOrder);
      await savedOrder.recallPage.openOrderDetails(savedOrder.orderNumber);

      const paymentAmounts = (await savedOrder.recallPage.readOrderPaymentAmounts()).filter(
        (amount) => amount > 0,
      );
      expect(paymentAmounts).toHaveLength(2);

      await savedOrder.recallPage.addPaymentRecordTip(0, orderSettleAmounts.firstTipInCents);
      await savedOrder.recallPage.addPaymentRecordTip(1, orderSettleAmounts.secondTipInCents);

      expect(await savedOrder.recallPage.readPaymentRecordTipAmount(0)).toBeCloseTo(1, 2);
      expect(await savedOrder.recallPage.readPaymentRecordTipAmount(1)).toBeCloseTo(2, 2);
      expect((await savedOrder.recallPage.readDisplayedOrderPriceSummary()).Tips).toBeCloseTo(3, 2);
    },
  );

});

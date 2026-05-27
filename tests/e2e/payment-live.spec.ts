import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { HomeFlow } from '../../flows/home.flow';
import { LicenseSelectionFlow } from '../../flows/license-selection.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import { orderServiceDishes } from '../../test-data/order-service';
import { waitUntil } from '../../utils/wait';

async function enterReadyHomePage(
  homePage: Parameters<typeof test>[0] extends never ? never : any,
  licenseSelectionPage: any,
  employeeLoginPage: any,
) {
  await new HomeFlow().openHome(homePage);

  if (await licenseSelectionPage.isVisible(10_000)) {
    await new LicenseSelectionFlow().enterWithAvailableLicense(licenseSelectionPage, homePage);
  }

  const readyHomePage = await new EmployeeLoginFlow().enterEmployeeContext(homePage, employeeLoginPage);
  await readyHomePage.expectPrimaryFunctionCardsVisible();
  return readyHomePage;
}

async function expectPaymentPanelClosed(page: Parameters<typeof test>[0] extends never ? never : any): Promise<void> {
  const closedState = await waitUntil(
    async () => ({
      paymentPanelVisible: await page.locator('#paymentPanelContainer iframe').isVisible().catch(() => false),
      printReceiptVisible: await page.locator('#print-customer-dialog').isVisible().catch(() => false),
    }),
    (state) => !state.paymentPanelVisible && !state.printReceiptVisible,
    {
      timeout: 20_000,
      message: 'Payment panel did not close in time after confirming the receipt choice.',
    },
  );

  expect(closedState.paymentPanelVisible).toBe(false);
  expect(closedState.printReceiptVisible).toBe(false);
}

test.describe('支付功能验证', () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '应能从 To Go 进入点单页后完成现金支付',
    {},
    async ({ page, homePage, licenseSelectionPage, employeeLoginPage }) => {
      const readyHomePage = await enterReadyHomePage(
        homePage,
        licenseSelectionPage,
        employeeLoginPage,
      );
      const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
      await new OrderDishesFlow().addRegularDish(
        orderDishesPage,
        orderServiceDishes.test.name,
        orderServiceDishes.test.menu,
      );

      const paymentPage = await orderDishesPage.openPayment();
      const paymentFlow = new PaymentFlow();

      await test.step('读取支付页左侧详情并确认已进入支付面板', async () => {
        const summary = await paymentPage.readSummaryContent();
        expect(summary.text).toContain('$');
      });

      await test.step('执行现金支付并选择不打印小票', async () => {
        await paymentFlow.payByCash(paymentPage, { printReceipt: false });
      });

      await test.step('确认支付面板已关闭', async () => {
        await expectPaymentPanelClosed(page);
      });
    },
  );

  test(
    '应能从 To Go 进入点单页后完成信用卡支付',
    {},
    async ({ page, homePage, licenseSelectionPage, employeeLoginPage }) => {
      const readyHomePage = await enterReadyHomePage(
        homePage,
        licenseSelectionPage,
        employeeLoginPage,
      );
      const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
      await new OrderDishesFlow().addRegularDish(
        orderDishesPage,
        orderServiceDishes.test.name,
        orderServiceDishes.test.menu,
      );

      const paymentPage = await orderDishesPage.openPayment();
      const paymentFlow = new PaymentFlow();

      await test.step('读取支付页左侧详情并确认已进入支付面板', async () => {
        const summary = await paymentPage.readSummaryContent();
        expect(summary.text).toContain('$');
      });

      await test.step('执行信用卡支付并选择不打印小票', async () => {
        await paymentFlow.payByCreditCard(paymentPage, { printReceipt: false });
      });

      await test.step('确认支付面板已关闭', async () => {
        await expectPaymentPanelClosed(page);
      });
    },
  );
});

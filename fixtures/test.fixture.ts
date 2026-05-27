import { test as base } from '@playwright/test';
import { EmployeeLoginPage } from '../pages/employee-login.page';
import { HomePage } from '../pages/home.page';
import { LicenseSelectionPage } from '../pages/license-selection.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
import { RecallPage } from '../pages/recall.page';
import { PaymentPage } from '../pages/payment.page';
import { SplitOrderPage } from '../pages/split-order.page';

type AppFixtures = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
  licenseSelectionPage: LicenseSelectionPage;
  orderDishesPage: OrderDishesPage;
  recallPage: RecallPage;
  paymentPage: PaymentPage;
  splitOrderPage: SplitOrderPage;
};

export const test = base.extend<AppFixtures>({
  employeeLoginPage: async ({ page }, use) => {
    await use(new EmployeeLoginPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  licenseSelectionPage: async ({ page }, use) => {
    await use(new LicenseSelectionPage(page));
  },
  orderDishesPage: async ({ page }, use) => {
    await use(new OrderDishesPage(page));
  },
  recallPage: async ({ page }, use) => {
    await use(new RecallPage(page));
  },
  paymentPage: async ({ page }, use) => {
    await use(new PaymentPage(page));
  },
  splitOrderPage: async ({ page }, use) => {
    await use(new SplitOrderPage(page));
  },
});

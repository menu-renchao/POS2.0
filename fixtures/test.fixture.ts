import { test as base } from '@playwright/test';
import { EmployeeLoginPage } from '../pages/employee-login.page';
import { HomePage } from '../pages/home.page';
import { LicenseSelectionPage } from '../pages/license-selection.page';

type AppFixtures = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
  licenseSelectionPage: LicenseSelectionPage;
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
});

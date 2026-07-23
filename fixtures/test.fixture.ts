import { test as base } from '@playwright/test';
import { AdminConfigApiClient } from '../api/clients/admin-config-api.client';
import { GiftCardApiClient } from '../api/clients/gift-card-api.client';
import { MenuApiClient } from '../api/clients/menu-api.client';
import { KitchenApiClient } from '../api/clients/kitchen-api.client';
import { LayoutConfigApiClient } from '../api/clients/layout-config-api.client';
import { OrderApiClient } from '../api/clients/order-api.client';
import { OrderTypeApiClient } from '../api/clients/order-type-api.client';
import { SaleItemApiClient } from '../api/clients/sale-item-api.client';
import { SystemConfigurationApiClient } from '../api/clients/system-configuration-api.client';
import { PrintConfigApiClient } from '../api/clients/print-config-api.client';
import { loadApiConfig, type ApiConfig } from '../api/core/api-config';
import { createApiRequestContext } from '../api/core/api-context';
import { ResourceRegistry } from '../api/core/resource-registry';
import { createApiSetup, type ApiSetup } from '../api/setup/api-setup';
import { EmployeeLoginPage } from '../pages/employee-login.page';
import { HomePage } from '../pages/home.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
import { RecallPage } from '../pages/recall.page';
import { PaymentPage } from '../pages/payment.page';
import { SplitOrderPage } from '../pages/split-order.page';

type AppFixtures = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
  orderDishesPage: OrderDishesPage;
  recallPage: RecallPage;
  paymentPage: PaymentPage;
  splitOrderPage: SplitOrderPage;
  apiConfig: ApiConfig;
  orderApi: OrderApiClient;
  giftCardApi: GiftCardApiClient;
  systemConfigurationApi: SystemConfigurationApiClient;
  resourceRegistry: ResourceRegistry;
  apiSetup: ApiSetup;
};

export const test = base.extend<AppFixtures>({
  apiConfig: async ({}, use) => {
    await use(loadApiConfig());
  },
  resourceRegistry: async ({}, use) => {
    const resourceRegistry = new ResourceRegistry();

    try {
      await use(resourceRegistry);
    } finally {
      const cleanupResult = await resourceRegistry.cleanupAll();

      if (cleanupResult.errors.length > 0) {
        const errorSummary = cleanupResult.errors
          .map(({ resource, error }) => `${resource.type}:${String(resource.id)} ${error.message}`)
          .join('; ');

        console.warn(
          `UI API setup cleanup finished with ${cleanupResult.errors.length} error(s): ${errorSummary}`,
        );
      }
    }
  },
  apiSetup: async ({ apiConfig, resourceRegistry }, use, testInfo) => {
    const apiRequest = await createApiRequestContext(apiConfig);

    try {
      const systemConfigurationApi = new SystemConfigurationApiClient(apiRequest);
      const setup = createApiSetup({
        adminConfigApi: new AdminConfigApiClient(apiRequest),
        kitchenApi: new KitchenApiClient(apiRequest),
        layoutConfigApi: new LayoutConfigApiClient(apiRequest),
        menuApi: new MenuApiClient(apiRequest),
        saleItemApi: new SaleItemApiClient(apiRequest),
        orderTypeApi: new OrderTypeApiClient(apiRequest),
        systemConfigurationApi,
        printConfigApi: new PrintConfigApiClient(apiRequest),
        resourceRegistry,
      });

      if (testInfo.tags.includes('@加收')) {
        await setup.charge.deleteAll();
      }

      await use(setup);
    } finally {
      const cleanupResult = await resourceRegistry.cleanupAll();

      if (cleanupResult.errors.length > 0) {
        const errorSummary = cleanupResult.errors
          .map(({ resource, error }) => `${resource.type}:${String(resource.id)} ${error.message}`)
          .join('; ');

        console.warn(
          `UI API setup cleanup finished with ${cleanupResult.errors.length} error(s): ${errorSummary}`,
        );
      }

      await apiRequest.dispose();
    }
  },
  systemConfigurationApi: async ({ apiConfig }, use) => {
    const apiRequest = await createApiRequestContext(apiConfig);

    try {
      await use(new SystemConfigurationApiClient(apiRequest));
    } finally {
      await apiRequest.dispose();
    }
  },
  orderApi: async ({ apiConfig }, use) => {
    const apiRequest = await createApiRequestContext(apiConfig);

    try {
      await use(new OrderApiClient(apiRequest));
    } finally {
      await apiRequest.dispose();
    }
  },
  giftCardApi: async ({ apiConfig }, use) => {
    const apiRequest = await createApiRequestContext(apiConfig);

    try {
      await use(new GiftCardApiClient(apiRequest));
    } finally {
      await apiRequest.dispose();
    }
  },
  employeeLoginPage: async ({ page }, use) => {
    await use(new EmployeeLoginPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
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

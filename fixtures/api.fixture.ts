import { test as base, type APIRequestContext } from '@playwright/test';
import { AdminConfigApiClient } from '../api/clients/admin-config-api.client';
import { MenuApiClient } from '../api/clients/menu-api.client';
import { KitchenApiClient } from '../api/clients/kitchen-api.client';
import { LayoutConfigApiClient } from '../api/clients/layout-config-api.client';
import { OrderApiClient } from '../api/clients/order-api.client';
import { OrderTypeApiClient } from '../api/clients/order-type-api.client';
import { PaymentApiClient } from '../api/clients/payment-api.client';
import { SaleItemApiClient } from '../api/clients/sale-item-api.client';
import { SpuApiClient } from '../api/clients/spu-api.client';
import { SystemConfigurationApiClient } from '../api/clients/system-configuration-api.client';
import { loadApiConfig, type ApiConfig } from '../api/core/api-config';
import { createApiRequestContext } from '../api/core/api-context';
import { ResourceRegistry } from '../api/core/resource-registry';
import { createApiSetup, type ApiSetup } from '../api/setup/api-setup';

type ApiFixtures = {
  apiConfig: ApiConfig;
  apiRequest: APIRequestContext;
  resourceRegistry: ResourceRegistry;
  menuApi: MenuApiClient;
  kitchenApi: KitchenApiClient;
  layoutConfigApi: LayoutConfigApiClient;
  saleItemApi: SaleItemApiClient;
  spuApi: SpuApiClient;
  orderApi: OrderApiClient;
  orderTypeApi: OrderTypeApiClient;
  paymentApi: PaymentApiClient;
  adminConfigApi: AdminConfigApiClient;
  systemConfigurationApi: SystemConfigurationApiClient;
  apiSetup: ApiSetup;
};

export const test = base.extend<ApiFixtures>({
  apiConfig: async ({}, use) => {
    await use(loadApiConfig());
  },
  apiRequest: async ({ apiConfig }, use, testInfo) => {
    const apiRequest = await createApiRequestContext(apiConfig, testInfo);

    try {
      await use(apiRequest);
    } finally {
      try {
        await apiRequest.dispose();
      } catch (error) {
        console.warn('API request dispose failed.', error);
      }
    }
  },
  resourceRegistry: async ({}, use) => {
    const resourceRegistry = new ResourceRegistry();

    try {
      await use(resourceRegistry);
    } finally {
      const cleanupResult = await resourceRegistry.cleanupAll();

      if (cleanupResult.errors.length > 0) {
        const errorSummary = cleanupResult.errors
          .map(
            ({ resource, error }) => `${resource.type}:${String(resource.id)} ${error.message}`,
          )
          .join('; ');

        console.warn(
          `API resource cleanup finished with ${cleanupResult.errors.length} error(s): ${errorSummary}`,
        );
      }
    }
  },
  menuApi: async ({ apiRequest }, use) => {
    await use(new MenuApiClient(apiRequest));
  },
  kitchenApi: async ({ apiRequest }, use) => {
    await use(new KitchenApiClient(apiRequest));
  },
  layoutConfigApi: async ({ apiRequest }, use) => {
    await use(new LayoutConfigApiClient(apiRequest));
  },
  saleItemApi: async ({ apiRequest }, use) => {
    await use(new SaleItemApiClient(apiRequest));
  },
  spuApi: async ({ apiRequest }, use) => {
    await use(new SpuApiClient(apiRequest));
  },
  orderApi: async ({ apiRequest }, use) => {
    await use(new OrderApiClient(apiRequest));
  },
  orderTypeApi: async ({ apiRequest }, use) => {
    await use(new OrderTypeApiClient(apiRequest));
  },
  paymentApi: async ({ apiRequest }, use) => {
    await use(new PaymentApiClient(apiRequest));
  },
  adminConfigApi: async ({ apiRequest }, use) => {
    await use(new AdminConfigApiClient(apiRequest));
  },
  systemConfigurationApi: async ({ apiRequest }, use) => {
    await use(new SystemConfigurationApiClient(apiRequest));
  },
  apiSetup: async (
    {
      adminConfigApi,
      kitchenApi,
      layoutConfigApi,
      orderTypeApi,
      systemConfigurationApi,
      menuApi,
      saleItemApi,
      resourceRegistry,
    },
    use,
  ) => {
    try {
      await use(
        createApiSetup({
          adminConfigApi,
          kitchenApi,
          layoutConfigApi,
          orderTypeApi,
          systemConfigurationApi,
          menuApi,
          saleItemApi,
          resourceRegistry,
        }),
      );
    } finally {
      const cleanupResult = await resourceRegistry.cleanupAll();

      if (cleanupResult.errors.length > 0) {
        const errorSummary = cleanupResult.errors
          .map(
            ({ resource, error }) => `${resource.type}:${String(resource.id)} ${error.message}`,
          )
          .join('; ');

        console.warn(
          `API setup cleanup finished with ${cleanupResult.errors.length} error(s): ${errorSummary}`,
        );
      }
    }
  },
});

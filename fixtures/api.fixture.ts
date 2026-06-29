import { test as base, type APIRequestContext } from '@playwright/test';
import { AdminConfigApiClient } from '../api/clients/admin-config-api.client';
import { MenuApiClient } from '../api/clients/menu-api.client';
import { OrderApiClient } from '../api/clients/order-api.client';
import { PaymentApiClient } from '../api/clients/payment-api.client';
import { SaleItemApiClient } from '../api/clients/sale-item-api.client';
import { SpuApiClient } from '../api/clients/spu-api.client';
import { loadApiConfig, type ApiConfig } from '../api/core/api-config';
import { createApiRequestContext } from '../api/core/api-context';
import { ResourceRegistry } from '../api/core/resource-registry';

type ApiFixtures = {
  apiConfig: ApiConfig;
  apiRequest: APIRequestContext;
  resourceRegistry: ResourceRegistry;
  menuApi: MenuApiClient;
  saleItemApi: SaleItemApiClient;
  spuApi: SpuApiClient;
  orderApi: OrderApiClient;
  paymentApi: PaymentApiClient;
  adminConfigApi: AdminConfigApiClient;
};

export const test = base.extend<ApiFixtures>({
  apiConfig: async ({}, use) => {
    await use(loadApiConfig());
  },
  apiRequest: async ({ apiConfig }, use) => {
    const apiRequest = await createApiRequestContext(apiConfig);

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
  saleItemApi: async ({ apiRequest }, use) => {
    await use(new SaleItemApiClient(apiRequest));
  },
  spuApi: async ({ apiRequest }, use) => {
    await use(new SpuApiClient(apiRequest));
  },
  orderApi: async ({ apiRequest }, use) => {
    await use(new OrderApiClient(apiRequest));
  },
  paymentApi: async ({ apiRequest }, use) => {
    await use(new PaymentApiClient(apiRequest));
  },
  adminConfigApi: async ({ apiRequest }, use) => {
    await use(new AdminConfigApiClient(apiRequest));
  },
});

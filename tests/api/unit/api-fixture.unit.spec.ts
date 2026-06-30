import { expect } from '@playwright/test';
import { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import { MenuApiClient } from '../../../api/clients/menu-api.client';
import { OrderApiClient } from '../../../api/clients/order-api.client';
import { PaymentApiClient } from '../../../api/clients/payment-api.client';
import { SaleItemApiClient } from '../../../api/clients/sale-item-api.client';
import { SpuApiClient } from '../../../api/clients/spu-api.client';
import { loadApiConfig } from '../../../api/core/api-config';
import { test as apiTest } from '../../../fixtures/api.fixture';

const test = apiTest.extend({
  apiConfig: async ({}, use) => {
    await use(
      loadApiConfig({
        API_BASE_URL: 'http://127.0.0.1:22080/kpos',
        API_AUTH_MODE: 'apiKey',
        API_KEY: 'test-key',
      }),
    );
  },
});

test.describe('API 测试夹具', () => {
  test('应注入 API 配置、请求上下文、资源登记器和 API 客户端', async ({
    apiConfig,
    apiRequest,
    resourceRegistry,
    menuApi,
    saleItemApi,
    spuApi,
    orderApi,
    paymentApi,
    adminConfigApi,
  }) => {
    await test.step('应注入 API 配置、请求上下文和资源登记器', async () => {
      expect(apiConfig.baseURL).toContain('/kpos');
      await expect(apiRequest.storageState()).resolves.toEqual(
        expect.objectContaining({
          cookies: expect.any(Array),
          origins: expect.any(Array),
        }),
      );
      expect(resourceRegistry.has('missing', 1)).toBe(false);
    });

    await test.step('应注入基于同一请求上下文的 API 客户端', async () => {
      const clients = [
        [menuApi, MenuApiClient],
        [saleItemApi, SaleItemApiClient],
        [spuApi, SpuApiClient],
        [orderApi, OrderApiClient],
        [paymentApi, PaymentApiClient],
        [adminConfigApi, AdminConfigApiClient],
      ] as const;

      for (const [client, ClientClass] of clients) {
        expect(client).toBeInstanceOf(ClientClass);
      }
    });
  });
});

import { expect } from '@playwright/test';
import { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import { MenuApiClient } from '../../../api/clients/menu-api.client';
import { OrderApiClient } from '../../../api/clients/order-api.client';
import { PaymentApiClient } from '../../../api/clients/payment-api.client';
import { SaleItemApiClient } from '../../../api/clients/sale-item-api.client';
import { SpuApiClient } from '../../../api/clients/spu-api.client';
import { loadApiConfig } from '../../../api/core/api-config';
import { test as apiTest } from '../../../fixtures/api.fixture';
import { createLocalHttpServer } from './local-http-server';

type LocalApiFixtures = {
  apiServerBaseURL: string;
};

const test = apiTest.extend<LocalApiFixtures>({
  apiServerBaseURL: async ({}, use) => {
    const server = createLocalHttpServer((request, response) => {
      if (request.url === '/kpos/api/client/session/login') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            code: 0,
            msg: 'success',
            data: {
              sessionKey: 'device001',
            },
          }),
        );
        return;
      }

      if (request.url?.startsWith('/kpos/api/login')) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            code: 0,
            msg: 'success',
            data: {
              userId: 1,
              staffId: 1,
              userName: 'Boss',
            },
          }),
        );
        return;
      }

      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ code: 0, msg: 'success' }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('测试服务启动失败，无法获取监听端口。');
    }

    try {
      await use(`http://127.0.0.1:${address.port}/kpos`);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  },
  apiConfig: async ({ apiServerBaseURL }, use) => {
    await use(
      loadApiConfig({
        API_BASE_URL: apiServerBaseURL,
        API_AUTH_MODE: 'apiLogin',
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

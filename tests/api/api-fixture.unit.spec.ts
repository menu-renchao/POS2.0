import { expect } from '@playwright/test';
import { loadApiConfig } from '../../api/core/api-config';
import { test as apiTest } from '../../fixtures/api.fixture';

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
  test('应注入 API 配置、请求上下文和资源登记器', async ({
    apiConfig,
    apiRequest,
    resourceRegistry,
  }) => {
    expect(apiConfig.baseURL).toContain('/kpos');
    await expect(apiRequest.storageState()).resolves.toEqual(
      expect.objectContaining({
        cookies: expect.any(Array),
        origins: expect.any(Array),
      }),
    );
    expect(resourceRegistry.has('missing', 1)).toBe(false);
  });
});

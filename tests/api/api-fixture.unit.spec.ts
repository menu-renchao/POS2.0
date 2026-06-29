import { expect } from '@playwright/test';
import { test } from '../../fixtures/api.fixture';

test.describe('API fixture', () => {
  test('应注入 API 配置和资源登记器', async ({ apiConfig, resourceRegistry }) => {
    expect(apiConfig.baseURL).toContain('/kpos');
    expect(resourceRegistry.has('missing', 1)).toBe(false);
  });
});

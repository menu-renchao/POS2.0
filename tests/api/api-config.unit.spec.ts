import { expect, test } from '@playwright/test';
import { loadApiConfig } from '../../api/core/api-config';

test.describe('API 配置', () => {
  test('应能从显式 API_BASE_URL 和 API Key 读取接口配置', () => {
    const config = loadApiConfig({
      API_BASE_URL: 'http://127.0.0.1:22080/kpos',
      API_AUTH_MODE: 'apiKey',
      API_KEY: 'test-key',
      API_ENABLE_DESTRUCTIVE: 'true',
    });

    expect(config.baseURL).toBe('http://127.0.0.1:22080/kpos');
    expect(config.auth.mode).toBe('apiKey');
    expect(config.auth.apiKey).toBe('test-key');
    expect(config.enableDestructive).toBe(true);
  });

  test('应能从 PLAYWRIGHT_BASE_URL 推导 API_BASE_URL', () => {
    const config = loadApiConfig({
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:22080',
      API_AUTH_MODE: 'cookie',
      API_COOKIE_LICENSE_AUTH_KEY: 'license-cookie',
    });

    expect(config.baseURL).toBe('http://127.0.0.1:22080/kpos');
    expect(config.auth.mode).toBe('cookie');
    expect(config.auth.licenseAuthKey).toBe('license-cookie');
  });

  test('API Key 模式缺少 API_KEY 时应抛出明确错误', () => {
    expect(() =>
      loadApiConfig({
        API_BASE_URL: 'http://127.0.0.1:22080/kpos',
        API_AUTH_MODE: 'apiKey',
      }),
    ).toThrow('API_AUTH_MODE=apiKey requires API_KEY.');
  });
});

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

  test('应能规范化 API_AUTH_MODE 的大小写空白和别名', () => {
    for (const authMode of [' APIKEY ', 'api_key', 'ApiKey']) {
      const config = loadApiConfig({
        API_BASE_URL: 'http://127.0.0.1:22080/kpos',
        API_AUTH_MODE: authMode,
        API_KEY: 'test-key',
      });

      expect(config.auth.mode).toBe('apiKey');
      expect(config.auth.apiKey).toBe('test-key');
    }

    const cookieConfig = loadApiConfig({
      API_BASE_URL: 'http://127.0.0.1:22080/kpos',
      API_AUTH_MODE: ' Cookie ',
      API_COOKIE_LICENSE_AUTH_KEY: 'license-cookie',
    });

    expect(cookieConfig.auth.mode).toBe('cookie');
    expect(cookieConfig.auth.licenseAuthKey).toBe('license-cookie');
  });

  test('应能规范化 API_ENABLE_DESTRUCTIVE 的大小写和空白', () => {
    const config = loadApiConfig({
      API_BASE_URL: 'http://127.0.0.1:22080/kpos',
      API_AUTH_MODE: 'apiKey',
      API_KEY: 'test-key',
      API_ENABLE_DESTRUCTIVE: ' TRUE ',
    });

    expect(config.enableDestructive).toBe(true);
  });

  test('PLAYWRIGHT_BASE_URL 已包含 kpos 时不应重复拼接', () => {
    const config = loadApiConfig({
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:22080/kpos',
      API_AUTH_MODE: 'cookie',
      API_COOKIE_LICENSE_AUTH_KEY: 'license-cookie',
    });

    expect(config.baseURL).toBe('http://127.0.0.1:22080/kpos');
  });

  test('非法 API_AUTH_MODE 应抛出明确错误', () => {
    expect(() =>
      loadApiConfig({
        API_BASE_URL: 'http://127.0.0.1:22080/kpos',
        API_AUTH_MODE: ' bearer ',
        API_KEY: 'test-key',
      }),
    ).toThrow('Unsupported API_AUTH_MODE: bearer. Expected apiKey, apikey, api_key, or cookie.');
  });

  test('API_TEST_PREFIX 空白时应回退 AT', () => {
    const config = loadApiConfig({
      API_BASE_URL: 'http://127.0.0.1:22080/kpos',
      API_AUTH_MODE: 'apiKey',
      API_KEY: 'test-key',
      API_TEST_PREFIX: '   ',
    });

    expect(config.testPrefix).toBe('AT');
  });
});

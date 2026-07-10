import { expect, test } from '@playwright/test';
import { loadApiConfig } from '../../../api/core/api-config';

test.describe('API 配置', () => {
  test('应默认使用 API 登录模式并读取固定测试后门请求头配置', () => {
    const config = loadApiConfig({
      API_BASE_URL: 'http://127.0.0.1:22080/kpos',
    });

    expect(config.baseURL).toBe('http://127.0.0.1:22080/kpos');
    expect(config.auth.mode).toBe('apiLogin');
    expect(config.auth.clientSn).toBe('mansuper');
    expect(config.auth.clientType).toBe('0');
    expect(config.auth.staffPasscode).toBe('11');
  });

  test('应能从 PLAYWRIGHT_BASE_URL 推导 API_BASE_URL', () => {
    const config = loadApiConfig({
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:22080',
      API_AUTH_MODE: 'apiLogin',
    });

    expect(config.baseURL).toBe('http://127.0.0.1:22080/kpos');
    expect(config.auth.mode).toBe('apiLogin');
  });

  test('旧鉴权模式应被拒绝', () => {
    expect(() =>
      loadApiConfig({
        API_BASE_URL: 'http://127.0.0.1:22080/kpos',
        API_AUTH_MODE: 'apiKey',
      }),
    ).toThrow('Unsupported API_AUTH_MODE: apikey. Expected apiLogin.');

    expect(() =>
      loadApiConfig({
        API_BASE_URL: 'http://127.0.0.1:22080/kpos',
        API_AUTH_MODE: 'cookie',
      }),
    ).toThrow('Unsupported API_AUTH_MODE: cookie. Expected apiLogin.');

    expect(() =>
      loadApiConfig({
        API_BASE_URL: 'http://127.0.0.1:22080/kpos',
        API_AUTH_MODE: 'cookieHeader',
      }),
    ).toThrow('Unsupported API_AUTH_MODE: cookieheader. Expected apiLogin.');
  });

  test('应能规范化 API 登录模式的大小写空白和别名', () => {
    const config = loadApiConfig({
      API_BASE_URL: 'http://127.0.0.1:22080/kpos',
      API_AUTH_MODE: ' api_login ',
    });

    expect(config.auth.mode).toBe('apiLogin');
  });

  test('PLAYWRIGHT_BASE_URL 已包含 kpos 时不应重复拼接', () => {
    const config = loadApiConfig({
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:22080/kpos',
    });

    expect(config.baseURL).toBe('http://127.0.0.1:22080/kpos');
  });

  test('非法 API_AUTH_MODE 应抛出明确错误', () => {
    expect(() =>
      loadApiConfig({
        API_BASE_URL: 'http://127.0.0.1:22080/kpos',
        API_AUTH_MODE: ' bearer ',
      }),
    ).toThrow('Unsupported API_AUTH_MODE: bearer. Expected apiLogin.');
  });

  test('API_TEST_PREFIX 空白时应回退 AT', () => {
    const config = loadApiConfig({
      API_BASE_URL: 'http://127.0.0.1:22080/kpos',
      API_TEST_PREFIX: '   ',
    });

    expect(config.testPrefix).toBe('AT');
  });
});

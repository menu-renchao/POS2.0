import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { createLoggedApiRequestContext } from '../../../api/core/api-request-logger';

test.describe('API 请求日志附件', () => {
  test('应把请求参数、Cookie 和响应内容写入 Allure 附件', async ({}, testInfo) => {
    const response = createApiResponse({
      status: 201,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'JSESSIONID=response-cookie',
      },
      body: JSON.stringify({ code: 0, msg: 'ok', password: 'response-secret' }),
    });
    const context = {
      post: async () => response,
      storageState: async () => ({
        cookies: [
          {
            name: 'licenseAuthKey',
            value: 'cookie-secret',
            domain: '127.0.0.1',
            path: '/kpos',
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      }),
    } as unknown as APIRequestContext;
    const loggedContext = createLoggedApiRequestContext(context, testInfo, {
      baseURL: 'http://127.0.0.1:22080/kpos/',
      extraHTTPHeaders: {
        'X-Direct-Req': 'true',
        'x-client-sn': 'mansuper',
        'x-client-type': '0',
      },
      name: 'api-test-context',
    });
    const actualResponse = await loggedContext.post('api/example/save', {
      data: {
        user: 'root',
        password: 'request-secret',
      },
      headers: {
        Cookie: 'manual-cookie=visible',
      },
    });

    expect(actualResponse).toBe(response);
    const attachment = testInfo.attachments.find((item) => item.name.includes('POST api/example/save'));

    expect(attachment).toBeDefined();
    expect(attachment?.contentType).toBe('application/json');
    expect(attachment?.body).toBeInstanceOf(Buffer);

    const attachmentBody = JSON.parse(attachment?.body?.toString('utf8') ?? '{}');
    expect(attachmentBody).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: 'api/example/save',
        context: {
          baseURL: 'http://127.0.0.1:22080/kpos/',
          extraHTTPHeaders: {
            'X-Direct-Req': 'true',
            'x-client-sn': 'mansuper',
            'x-client-type': '0',
          },
          name: 'api-test-context',
        },
        request: expect.objectContaining({
          options: expect.objectContaining({
            data: {
              user: 'root',
              password: 'request-secret',
            },
            headers: {
              Cookie: 'manual-cookie=visible',
            },
          }),
          storageState: expect.objectContaining({
            cookies: [
              expect.objectContaining({
                name: 'licenseAuthKey',
                value: 'cookie-secret',
              }),
            ],
          }),
        }),
        response: expect.objectContaining({
          status: 201,
          headers: expect.objectContaining({
            'set-cookie': 'JSESSIONID=response-cookie',
          }),
          bodyText: '{"code":0,"msg":"ok","password":"response-secret"}',
          bodyJson: {
            code: 0,
            msg: 'ok',
            password: 'response-secret',
          },
        }),
      }),
    );
  });

  test('附件写入失败时应保留原始接口错误', async () => {
    const requestError = new Error('request failed');
    const context = {
      get: async () => {
        throw requestError;
      },
      storageState: async () => ({ cookies: [], origins: [] }),
    } as unknown as APIRequestContext;
    const attachTarget = {
      attach: async () => {
        throw new Error('attach failed');
      },
    };
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      const loggedContext = createLoggedApiRequestContext(context, attachTarget);

      await expect(loggedContext.get('api/fail')).rejects.toThrow('request failed');
      expect(warnings).toHaveLength(1);
      expect(warnings[0][0]).toBe('API request log attachment failed.');
    } finally {
      console.warn = originalWarn;
    }
  });
});

function createApiResponse(options: {
  status: number;
  headers: Record<string, string>;
  body: string;
}): APIResponse {
  return {
    status: () => options.status,
    headers: () => options.headers,
    text: async () => options.body,
  } as unknown as APIResponse;
}

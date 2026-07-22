import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { createLoggedApiRequestContext } from '../../../api/core/api-request-logger';

test.describe('API 请求日志附件', () => {
  test('应在 Allure 附件中记录请求响应摘要并脱敏凭据', async ({}, testInfo) => {
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
    const actualResponse = await loggedContext.post('api/example/save?passcode=url-secret', {
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

    const attachmentText = attachment?.body?.toString('utf8') ?? '{}';
    const attachmentBody = JSON.parse(attachmentText);
    expect(attachmentText).not.toContain('request-secret');
    expect(attachmentText).not.toContain('response-secret');
    expect(attachmentText).not.toContain('manual-cookie=visible');
    expect(attachmentText).not.toContain('response-cookie');
    expect(attachmentText).not.toContain('url-secret');
    expect(attachmentBody).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: 'api/example/save?passcode=[REDACTED]',
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
          truncated: false,
          content: expect.objectContaining({
            data: {
              user: 'root',
              password: '[REDACTED]',
            },
            headers: {
              Cookie: '[REDACTED]',
            },
          }),
        }),
        response: expect.objectContaining({
          status: 201,
          headers: expect.objectContaining({
            'set-cookie': '[REDACTED]',
          }),
          body: expect.objectContaining({
            truncated: false,
            format: 'json',
            content: {
              code: 0,
              msg: 'ok',
              password: '[REDACTED]',
            },
          }),
        }),
      }),
    );
    expect(attachmentBody.request).not.toHaveProperty('storageState');
    expect(attachmentBody.response).not.toHaveProperty('bodyJson');
    expect(attachmentBody.response).not.toHaveProperty('bodyText');
  });

  test('超限响应应按 UTF-8 字节安全截断并记录原始大小', async ({}, testInfo) => {
    const responseBody = JSON.stringify({
      password: 'response-secret',
      message: '中文内容'.repeat(100),
    });
    const response = createApiResponse({
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: responseBody,
    });
    const context = {
      get: async () => response,
    } as unknown as APIRequestContext;
    const loggedContext = createLoggedApiRequestContext(context, testInfo, {}, { maxResponseBytes: 80 });

    await loggedContext.get('api/large-response');

    const attachment = testInfo.attachments.find((item) => item.name.includes('GET api/large-response'));
    const attachmentBody = JSON.parse(attachment?.body?.toString('utf8') ?? '{}');
    const responseLog = attachmentBody.response.body;
    expect(responseLog.originalBytes).toBe(Buffer.byteLength(responseBody));
    expect(responseLog.previewBytes).toBeLessThanOrEqual(80);
    expect(responseLog.truncated).toBe(true);
    expect(responseLog.format).toBe('text');
    expect(responseLog.content).toContain('...[TRUNCATED]');
    expect(responseLog.content).not.toContain('\uFFFD');
    expect(responseLog.content).not.toContain('response-secret');
    expect(responseLog.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test('失败响应应使用独立的较大预览预算', async ({}, testInfo) => {
    const responseBody = '失败详情'.repeat(10);
    const response = createApiResponse({
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: responseBody,
    });
    const context = {
      get: async () => response,
    } as unknown as APIRequestContext;
    const loggedContext = createLoggedApiRequestContext(
      context,
      testInfo,
      {},
      {
        maxResponseBytes: 8,
        maxFailureResponseBytes: 256,
      },
    );

    await loggedContext.get('api/failed-response');

    const attachment = testInfo.attachments.find((item) => item.name.includes('GET api/failed-response'));
    const attachmentBody = JSON.parse(attachment?.body?.toString('utf8') ?? '{}');
    expect(attachmentBody.response.body).toEqual(
      expect.objectContaining({
        originalBytes: Buffer.byteLength(responseBody),
        previewBytes: Buffer.byteLength(responseBody),
        truncated: false,
        content: responseBody,
      }),
    );
  });

  test('二进制响应应只记录元数据而不内联正文', async ({}, testInfo) => {
    const response = createApiResponse({
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
      body: '\u0000\u0001binary-content',
    });
    const context = {
      get: async () => response,
    } as unknown as APIRequestContext;
    const loggedContext = createLoggedApiRequestContext(context, testInfo);

    await loggedContext.get('api/binary-response');

    const attachment = testInfo.attachments.find((item) => item.name.includes('GET api/binary-response'));
    const attachmentBody = JSON.parse(attachment?.body?.toString('utf8') ?? '{}');
    expect(attachmentBody.response.body).toEqual(
      expect.objectContaining({
        originalBytes: Buffer.byteLength('\u0000\u0001binary-content'),
        previewBytes: 0,
        truncated: true,
        format: 'binary',
        content: '[BINARY CONTENT OMITTED]',
      }),
    );
  });

  test('超限请求参数应脱敏后再截断', async ({}, testInfo) => {
    const response = createApiResponse({ status: 204, headers: {}, body: '' });
    const context = {
      post: async () => response,
    } as unknown as APIRequestContext;
    const loggedContext = createLoggedApiRequestContext(context, testInfo, {}, { maxRequestBytes: 64 });

    await loggedContext.post('api/large-request', {
      data: {
        password: 'request-secret',
        content: '请求内容'.repeat(100),
      },
    });

    const attachment = testInfo.attachments.find((item) => item.name.includes('POST api/large-request'));
    const attachmentText = attachment?.body?.toString('utf8') ?? '{}';
    const attachmentBody = JSON.parse(attachmentText);
    expect(attachmentBody.request.truncated).toBe(true);
    expect(attachmentBody.request.previewBytes).toBeLessThanOrEqual(64);
    expect(attachmentBody.request.content).toContain('...[TRUNCATED]');
    expect(attachmentBody.request.content).not.toContain('\uFFFD');
    expect(attachmentText).not.toContain('request-secret');
  });

  test('附件写入失败时应保留原始接口错误', async () => {
    const requestError = new Error('request failed');
    const context = {
      get: async () => {
        throw requestError;
      },
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
    body: async () => Buffer.from(options.body, 'utf8'),
  } as unknown as APIResponse;
}

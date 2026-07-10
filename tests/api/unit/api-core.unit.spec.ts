import { expect, test } from '@playwright/test';
import { createApiRequestContext } from '../../../api/core/api-context';
import type { ApiRequestLogAttachTarget } from '../../../api/core/api-request-logger';
import {
  buildApiFailureMessage,
  expectResponseEnvelope,
  summarizeJson,
} from '../../../api/core/api-response';
import { createLocalHttpServer } from './local-http-server';

test.describe('API 核心工具', () => {
  test('应能校验 Response 包装结构', () => {
    expect(() =>
      expectResponseEnvelope({
        code: 0,
        msg: 'OK',
        traceId: 'trace-1',
        data: { id: 1 },
      }),
    ).not.toThrow();
  });

  test('应允许成功 Response 包装结构省略 data 字段', () => {
    expect(() =>
      expectResponseEnvelope({
        code: 0,
        msg: 'success',
        traceId: 'trace-1',
      }),
    ).not.toThrow();
  });

  test('响应失败信息应包含方法、路径和状态码', () => {
    expect(
      buildApiFailureMessage({
        method: 'POST',
        path: '/api/menu/menuGroup',
        status: 500,
        requestSummary: '{"name":"AT_1_MG"}',
        responseSummary: '{"msg":"error"}',
      }),
    ).toContain('POST /api/menu/menuGroup -> 500');
  });

  test('应能按最大长度截断 JSON 摘要', () => {
    const summary = summarizeJson({ name: 'AT_1234567890' }, 12);

    expect(summary).toHaveLength(12);
    expect(summary.endsWith('...')).toBe(true);
  });

  test('应能为 API 登录模式固定注入测试后门请求头', async () => {
    const receivedHeaders = await withHeaderEchoServer(async (baseURL) => {
      const apiContext = await createApiRequestContext({
        baseURL: `${baseURL}/kpos`,
        auth: {
          mode: 'apiLogin',
          clientSn: 'mansuper',
          clientType: '0',
          staffPasscode: '11',
        },
        testPrefix: 'AT',
      });

      try {
        const response = await apiContext.get('api/check');

        return (await response.json()) as Record<string, string | undefined>;
      } finally {
        await apiContext.dispose();
      }
    });

    expect(receivedHeaders['x-client-sn']).toBe('mansuper');
    expect(receivedHeaders['x-client-type']).toBe('0');
    expect(receivedHeaders['x-direct-req']).toBe('true');
    expect(receivedHeaders.cookie).toContain('licenseAuthKey=mansuper');
  });

  test('应记录 API 登录阶段请求日志附件', async () => {
    const attachments = await withHeaderEchoServer(async (baseURL) => {
      const loggedAttachments: Array<{ name: string; body: string }> = [];
      const attachTarget: ApiRequestLogAttachTarget = {
        attach: async (name, options) => {
          const body = options && 'body' in options ? options.body : undefined;

          loggedAttachments.push({
            name,
            body: Buffer.isBuffer(body) ? body.toString('utf8') : String(body ?? ''),
          });
        },
      };
      const apiContext = await createApiRequestContext(
        {
          baseURL: `${baseURL}/kpos`,
          auth: {
            mode: 'apiLogin',
            clientSn: 'mansuper',
            clientType: '0',
            staffPasscode: '11',
          },
          testPrefix: 'AT',
        },
        attachTarget,
      );

      await apiContext.dispose();
      return loggedAttachments;
    });

    expect(attachments.map((item) => item.name)).toEqual(
      expect.arrayContaining(['API POST api/client/session/login', 'API POST api/login']),
    );
    expect(
      attachments.find((item) => item.name === 'API POST api/client/session/login')?.body,
    ).toContain('"x-client-sn": "mansuper"');
    expect(attachments.find((item) => item.name === 'API POST api/login')?.body).toContain(
      '"passcode": "11"',
    );
  });

  test('应能在 kpos baseURL 下把相对 API 路径请求到 kpos 目录', async () => {
    const receivedUrl = await withRequestUrlEchoServer(async (baseURL) => {
      const apiContext = await createApiRequestContext({
        baseURL: `${baseURL}/kpos`,
        auth: {
          mode: 'apiLogin',
          clientSn: 'mansuper',
          clientType: '0',
          staffPasscode: '11',
        },
        testPrefix: 'AT',
      });

      try {
        const response = await apiContext.get('api/check');
        const body = (await response.json()) as { url: string };

        return body.url;
      } finally {
        await apiContext.dispose();
      }
    });

    expect(receivedUrl).toBe('/kpos/api/check');
  });
});

async function withHeaderEchoServer<T>(callback: (baseURL: string) => Promise<T>): Promise<T> {
  const server = createLocalHttpServer((request, response) => {
    if (request.url === '/kpos/api/client/session/login') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          code: 0,
          msg: 'success',
          data: {
            sessionKey: 'mansuper',
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
    response.end(JSON.stringify(request.headers));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('测试服务启动失败，无法获取监听端口。');
  }

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
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
}

async function withRequestUrlEchoServer<T>(callback: (baseURL: string) => Promise<T>): Promise<T> {
  const server = createLocalHttpServer((request, response) => {
    if (request.url === '/kpos/api/client/session/login') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          code: 0,
          msg: 'success',
          data: {
            sessionKey: 'mansuper',
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
    response.end(JSON.stringify({ url: request.url }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('测试服务启动失败，无法获取监听端口。');
  }

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
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
}

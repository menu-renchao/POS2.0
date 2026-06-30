import { expect, test } from '@playwright/test';
import http from 'node:http';
import { buildApiAuthCookies, buildApiAuthHeaders } from '../../../api/core/api-auth';
import { createApiRequestContext } from '../../../api/core/api-context';
import {
  buildApiFailureMessage,
  expectResponseEnvelope,
  summarizeJson,
} from '../../../api/core/api-response';

test.describe('API 核心工具', () => {
  test('应能为 API Key 模式生成 Authorization header', () => {
    expect(
      buildApiAuthHeaders({
        baseURL: 'http://127.0.0.1:22080/kpos',
        auth: { mode: 'apiKey', apiKey: 'key-1' },
        enableDestructive: false,
        testPrefix: 'AT',
      }),
    ).toEqual({ Authorization: 'key-1' });
  });

  test('应能为 Cookie 模式生成 licenseAuthKey cookie', () => {
    expect(
      buildApiAuthCookies({
        baseURL: 'http://127.0.0.1:22080/kpos',
        auth: { mode: 'cookie', licenseAuthKey: 'cookie-1' },
        enableDestructive: false,
        testPrefix: 'AT',
      }),
    ).toEqual([
      { name: 'licenseAuthKey', value: 'cookie-1', url: 'http://127.0.0.1:22080/kpos' },
    ]);
  });

  test('应能为浏览器会话 Cookie Header 模式生成调试请求头', () => {
    expect(
      buildApiAuthHeaders({
        baseURL: 'http://127.0.0.1:22080/kpos',
        auth: {
          mode: 'cookieHeader',
          cookieHeader: 'KPOS_REMEMBER_USER=token; JSESSIONID=session-1',
        },
        enableDestructive: false,
        testPrefix: 'AT',
      }),
    ).toEqual({
      Cookie: 'KPOS_REMEMBER_USER=token; JSESSIONID=session-1',
      'X-Direct-Req': 'true',
    });
  });

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

  test('应能创建带认证信息的 API 请求上下文', async () => {
    const receivedHeaders = await withHeaderEchoServer(async (baseURL) => {
      const apiContext = await createApiRequestContext({
        baseURL,
        auth: { mode: 'apiKey', apiKey: 'key-1' },
        enableDestructive: false,
        testPrefix: 'AT',
      });

      try {
        const response = await apiContext.get('/headers');

        return (await response.json()) as Record<string, string | undefined>;
      } finally {
        await apiContext.dispose();
      }
    });

    expect(receivedHeaders.authorization).toBe('key-1');
  });

  test('应能通过 storageState 为 Cookie 模式创建请求上下文', async () => {
    const apiContext = await createApiRequestContext({
      baseURL: 'http://127.0.0.1:22080/kpos',
      auth: { mode: 'cookie', licenseAuthKey: 'cookie-1' },
      enableDestructive: false,
      testPrefix: 'AT',
    });

    try {
      const storageState = await apiContext.storageState();

      expect(storageState.cookies).toContainEqual(
        expect.objectContaining({
          name: 'licenseAuthKey',
          value: 'cookie-1',
          domain: '127.0.0.1',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        }),
      );
    } finally {
      await apiContext.dispose();
    }
  });

  test('应能在根路径 API 请求中发送 Cookie 模式认证信息', async () => {
    const receivedHeaders = await withHeaderEchoServer(async (baseURL) => {
      const apiContext = await createApiRequestContext({
        baseURL: `${baseURL}/kpos`,
        auth: { mode: 'cookie', licenseAuthKey: 'cookie-1' },
        enableDestructive: false,
        testPrefix: 'AT',
      });

      try {
        const response = await apiContext.get('/api/check');

        return (await response.json()) as Record<string, string | undefined>;
      } finally {
        await apiContext.dispose();
      }
    });

    expect(receivedHeaders.cookie).toContain('licenseAuthKey=cookie-1');
  });

  test('应能在 kpos baseURL 下把相对 API 路径请求到 kpos 目录', async () => {
    const receivedUrl = await withRequestUrlEchoServer(async (baseURL) => {
      const apiContext = await createApiRequestContext({
        baseURL: `${baseURL}/kpos`,
        auth: { mode: 'apiKey', apiKey: 'key-1' },
        enableDestructive: false,
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
  const server = http.createServer((request, response) => {
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
  const server = http.createServer((request, response) => {
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

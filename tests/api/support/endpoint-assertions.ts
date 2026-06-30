import { expect, type APIResponse } from '@playwright/test';
import {
  buildApiFailureMessage,
  expectResponseEnvelope,
  summarizeJson,
  type ApiEnvelope,
} from '../../../api/core/api-response';
import { toEndpointTitle, type EndpointIdentity } from './endpoint-case';
import { extractFirstResourceId } from './endpoint-read-model';

/**
 * API 断言 helper 的最小响应契约（helper 与 unit spec 共用的 mock 形状）。
 * 真实接口调用可直接传入 Playwright 的 APIResponse。
 */
type ApiResponseLike = Pick<APIResponse, 'status' | 'json'>;

export async function parseApiJson<T>(response: ApiResponseLike, identity: EndpointIdentity): Promise<ApiEnvelope<T>> {
  const title = toEndpointTitle(identity.method, identity.path, '响应体应为 JSON envelope');
  let body: unknown;

  try {
    body = await response.json();
  } catch (error) {
    throw new Error(
      [
        title,
        '响应体解析失败',
        error instanceof Error ? error.message : String(error),
      ].join('；'),
    );
  }

  try {
    expectResponseEnvelope(body);
  } catch (error) {
    throw new Error(
      buildApiFailureMessage({
        method: identity.method,
        path: identity.path,
        status: response.status(),
        responseSummary: summarizeJson({ body, error: error instanceof Error ? error.message : String(error) }),
      }),
    );
  }

  return body as ApiEnvelope<T>;
}

export async function expectHttpStatus(
  response: ApiResponseLike,
  identity: EndpointIdentity,
  expectedStatus = 200,
): Promise<void> {
  const actualStatus = response.status();
  const responseSummary =
    actualStatus === expectedStatus
      ? `期望值: ${expectedStatus}`
      : await summarizeStatusMismatchResponse(response, expectedStatus);

  expect(
    actualStatus,
    buildApiFailureMessage({
      method: identity.method,
      path: identity.path,
      status: actualStatus,
      responseSummary,
    }),
  ).toBe(expectedStatus);
}

export async function expectApiOk(response: ApiResponseLike, identity: EndpointIdentity): Promise<ApiEnvelope<unknown>> {
  await expectHttpStatus(response, identity);
  const body = await parseApiJson<unknown>(response, identity);
  expect(body.code, `${toEndpointTitle(identity.method, identity.path, '应返回业务成功 code=0')}`).toBe(0);

  return body;
}

export async function expectApiBusinessError(
  response: ApiResponseLike,
  identity: EndpointIdentity,
  expectedCode?: number,
): Promise<ApiEnvelope<unknown>> {
  await expectHttpStatus(response, identity);
  const body = await parseApiJson<unknown>(response, identity);

  if (expectedCode === undefined) {
    expect(body.code, `${toEndpointTitle(identity.method, identity.path, '应返回业务错误 code!=0')}`).not.toBe(0);
  } else {
    expect(body.code, `${toEndpointTitle(identity.method, identity.path, `应返回业务错误 code=${expectedCode}`)}`).toBe(
      expectedCode,
    );
  }

  return body;
}

export function expectArrayData(
  body: unknown,
  identity: EndpointIdentity,
): Record<string, unknown>[] {
  expectResponseEnvelope(body);
  expect(body.code, `${toEndpointTitle(identity.method, identity.path, '应返回业务成功 code=0')}`).toBe(0);

  const data = body.data;
  if (Array.isArray(data)) {
    return data as Array<Record<string, unknown>>;
  }

  if (
    isRecord(data) &&
    Array.isArray(data.records)
  ) {
    return data.records as Array<Record<string, unknown>>;
  }

  throw new Error(
    `${toEndpointTitle(identity.method, identity.path, '未能从响应中提取数组数据')}`,
  );
}

export function expectResourceId(body: unknown, identity: EndpointIdentity): string | number {
  const resourceId = extractFirstResourceId(body);
  if (resourceId === undefined) {
    throw new Error(
      toEndpointTitle(identity.method, identity.path, '未能从响应中提取资源 ID'),
    );
  }

  return resourceId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function summarizeStatusMismatchResponse(
  response: ApiResponseLike,
  expectedStatus: number,
): Promise<string> {
  try {
    return summarizeJson({
      expectedStatus,
      body: await response.json(),
    });
  } catch (error) {
    return summarizeJson({
      expectedStatus,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

import { request, type APIRequestContext } from '@playwright/test';
import type { ApiConfig } from './api-config';
import { expectResponseEnvelope } from './api-response';

export async function createApiRequestContext(config: ApiConfig): Promise<APIRequestContext> {
  const baseURL = toApiRequestBaseURL(config.baseURL);
  const directHeaders = toDirectRequestHeaders(config);
  const sessionKey = await fetchApiLoginSessionKey(baseURL, directHeaders);

  const apiContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: directHeaders,
    storageState: {
      cookies: [toLicenseAuthCookie(baseURL, sessionKey)],
      origins: [],
    },
  });

  try {
    await loginApiStaff(apiContext, config.auth.staffPasscode);
    return apiContext;
  } catch (error) {
    await apiContext.dispose();
    throw error;
  }
}

function toDirectRequestHeaders(config: ApiConfig): Record<string, string> {
  return {
    'X-Direct-Req': 'true',
    'x-client-sn': config.auth.clientSn,
    'x-client-type': config.auth.clientType,
  };
}

async function fetchApiLoginSessionKey(
  baseURL: string,
  extraHTTPHeaders: Record<string, string>,
): Promise<string> {
  const loginContext = await request.newContext({
    baseURL,
    extraHTTPHeaders,
  });

  try {
    const response = await loginContext.post('api/client/session/login', { data: {} });
    const body: unknown = await response.json();

    expectResponseEnvelope(body);
    if (body.code !== 0) {
      throw new Error(`API login failed: ${JSON.stringify(body)}`);
    }

    const sessionKey = extractSessionKey(body.data);
    if (!sessionKey) {
      throw new Error(`API login response does not contain sessionKey: ${JSON.stringify(body)}`);
    }

    return sessionKey;
  } finally {
    await loginContext.dispose();
  }
}

async function loginApiStaff(apiContext: APIRequestContext, passcode: string): Promise<void> {
  const response = await apiContext.post('api/login', {
    params: {
      passcode,
      fetchClockInOutStatus: true,
      fetchSettings: true,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const body: unknown = await response.json();

  expectResponseEnvelope(body);
  if (body.code !== 0) {
    throw new Error(`API staff login failed: ${JSON.stringify(body)}`);
  }

  const staffContext = extractStaffContext(body.data);
  if (!staffContext) {
    throw new Error(`API staff login response does not contain staff context: ${JSON.stringify(body)}`);
  }
}

function extractSessionKey(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const sessionKey = value.sessionKey;
  return typeof sessionKey === 'string' && sessionKey ? sessionKey : undefined;
}

function extractStaffContext(value: unknown): { userId: number; staffId: number } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { userId, staffId } = value;
  if (typeof userId !== 'number' || typeof staffId !== 'number') {
    return undefined;
  }

  return { userId, staffId };
}

function toApiRequestBaseURL(baseURL: string): string {
  return baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
}

function toLicenseAuthCookie(baseURL: string, sessionKey: string) {
  const parsedBaseURL = new URL(baseURL);

  return {
    name: 'licenseAuthKey',
    value: sessionKey,
    domain: parsedBaseURL.hostname,
    path: parsedBaseURL.pathname.replace(/\/+$/, '') || '/',
    expires: -1,
    httpOnly: false,
    secure: parsedBaseURL.protocol === 'https:',
    sameSite: 'Lax' as const,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { request, type APIRequestContext } from '@playwright/test';
import type { ApiConfig } from './api-config';
import { buildApiAuthCookies, buildApiAuthHeaders, type ApiAuthCookie } from './api-auth';

type ApiStorageStateCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
};

export async function createApiRequestContext(config: ApiConfig): Promise<APIRequestContext> {
  const extraHTTPHeaders = buildApiAuthHeaders(config);
  const cookies = buildApiAuthCookies(config);

  return request.newContext({
    baseURL: config.baseURL,
    extraHTTPHeaders,
    storageState:
      cookies.length > 0
        ? {
            cookies: cookies.map(toStorageStateCookie),
            origins: [],
          }
        : undefined,
  });
}

function toStorageStateCookie(cookie: ApiAuthCookie): ApiStorageStateCookie {
  const cookieUrl = new URL(cookie.url);

  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookieUrl.hostname,
    path: cookieUrl.pathname || '/',
    expires: -1,
    httpOnly: true,
    secure: cookieUrl.protocol === 'https:',
    sameSite: 'Lax',
  };
}

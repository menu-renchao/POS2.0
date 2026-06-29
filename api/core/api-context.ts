import { request, type APIRequestContext } from '@playwright/test';
import type { ApiConfig } from './api-config';
import { buildApiAuthCookies, buildApiAuthHeaders } from './api-auth';

export async function createApiRequestContext(config: ApiConfig): Promise<APIRequestContext> {
  const extraHTTPHeaders = buildApiAuthHeaders(config);
  const cookies = buildApiAuthCookies(config);

  if (cookies.length > 0) {
    extraHTTPHeaders.Cookie = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  return request.newContext({
    baseURL: config.baseURL,
    extraHTTPHeaders,
  });
}

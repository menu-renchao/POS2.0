import type { ApiConfig } from './api-config';

export type ApiAuthHeaders = Record<string, string>;

export type ApiAuthCookie = {
  name: string;
  value: string;
  url: string;
};

export function buildApiAuthHeaders(config: ApiConfig): ApiAuthHeaders {
  if (config.auth.mode === 'apiKey') {
    return { Authorization: config.auth.apiKey };
  }

  if (config.auth.mode === 'cookieHeader') {
    return {
      Cookie: config.auth.cookieHeader,
      'X-Direct-Req': 'true',
    };
  }

  return {};
}

export function buildApiAuthCookies(config: ApiConfig): ApiAuthCookie[] {
  if (config.auth.mode === 'cookie') {
    return [{ name: 'licenseAuthKey', value: config.auth.licenseAuthKey, url: config.baseURL }];
  }

  return [];
}

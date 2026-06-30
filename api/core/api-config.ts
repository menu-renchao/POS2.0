export type ApiAuthMode = 'apiLogin';

const API_LOGIN_CLIENT_SN = 'device001';
const API_LOGIN_CLIENT_TYPE = '0';
const API_LOGIN_STAFF_PASSCODE = '11';

export type ApiAuthConfig =
  | {
      mode: 'apiLogin';
      clientSn: typeof API_LOGIN_CLIENT_SN;
      clientType: typeof API_LOGIN_CLIENT_TYPE;
      staffPasscode: typeof API_LOGIN_STAFF_PASSCODE;
    };

export type ApiConfig = {
  baseURL: string;
  auth: ApiAuthConfig;
  testPrefix: string;
};

type EnvSource = Record<string, string | undefined>;

export function loadApiConfig(env: EnvSource = process.env): ApiConfig {
  const baseURL = resolveApiBaseURL(env);
  const mode = resolveAuthMode(env.API_AUTH_MODE);
  const testPrefix = env.API_TEST_PREFIX?.trim() || 'AT';

  return {
    baseURL,
    auth: {
      mode,
      clientSn: API_LOGIN_CLIENT_SN,
      clientType: API_LOGIN_CLIENT_TYPE,
      staffPasscode: API_LOGIN_STAFF_PASSCODE,
    },
    testPrefix,
  };
}

function resolveApiBaseURL(env: EnvSource): string {
  const explicitApiBaseURL = env.API_BASE_URL?.trim();
  if (explicitApiBaseURL) {
    return stripTrailingSlash(explicitApiBaseURL);
  }

  const playwrightBaseURL = env.PLAYWRIGHT_BASE_URL?.trim();
  if (playwrightBaseURL) {
    const normalizedPlaywrightBaseURL = stripTrailingSlash(playwrightBaseURL);
    if (normalizedPlaywrightBaseURL.endsWith('/kpos')) {
      return normalizedPlaywrightBaseURL;
    }

    return `${normalizedPlaywrightBaseURL}/kpos`;
  }

  return 'http://192.168.0.182:22080/kpos';
}

function resolveAuthMode(value: string | undefined): ApiAuthMode {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return 'apiLogin';
  }

  if (normalizedValue === 'apilogin' || normalizedValue === 'api_login') {
    return 'apiLogin';
  }

  throw new Error(`Unsupported API_AUTH_MODE: ${normalizedValue}. Expected apiLogin.`);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

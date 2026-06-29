export type ApiAuthMode = 'apiKey' | 'cookie';

export type ApiAuthConfig =
  | {
      mode: 'apiKey';
      apiKey: string;
      licenseAuthKey?: never;
    }
  | {
      mode: 'cookie';
      licenseAuthKey: string;
      apiKey?: never;
    };

export type ApiConfig = {
  baseURL: string;
  auth: ApiAuthConfig;
  enableDestructive: boolean;
  testPrefix: string;
};

type EnvSource = Record<string, string | undefined>;

export function loadApiConfig(env: EnvSource = process.env): ApiConfig {
  const baseURL = resolveApiBaseURL(env);
  const mode = resolveAuthMode(env.API_AUTH_MODE);
  const enableDestructive = env.API_ENABLE_DESTRUCTIVE?.trim().toLowerCase() === 'true';
  const testPrefix = env.API_TEST_PREFIX?.trim() || 'AT';

  if (mode === 'apiKey') {
    const apiKey = env.API_KEY?.trim();
    if (!apiKey) {
      throw new Error('API_AUTH_MODE=apiKey requires API_KEY.');
    }

    return {
      baseURL,
      auth: { mode, apiKey },
      enableDestructive,
      testPrefix,
    };
  }

  const licenseAuthKey = env.API_COOKIE_LICENSE_AUTH_KEY?.trim();
  if (!licenseAuthKey) {
    throw new Error('API_AUTH_MODE=cookie requires API_COOKIE_LICENSE_AUTH_KEY.');
  }

  return {
    baseURL,
    auth: { mode, licenseAuthKey },
    enableDestructive,
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
    return 'apiKey';
  }

  if (normalizedValue === 'apikey' || normalizedValue === 'api_key') {
    return 'apiKey';
  }

  if (normalizedValue === 'cookie') {
    return 'cookie';
  }

  throw new Error(
    `Unsupported API_AUTH_MODE: ${value.trim()}. Expected apiKey, apikey, api_key, or cookie.`,
  );
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

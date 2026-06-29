export type ApiAuthMode = 'apiKey' | 'cookie';

export type ApiConfig = {
  baseURL: string;
  auth: {
    mode: ApiAuthMode;
    apiKey?: string;
    licenseAuthKey?: string;
  };
  enableDestructive: boolean;
  testPrefix: string;
};

type EnvSource = Record<string, string | undefined>;

export function loadApiConfig(env: EnvSource = process.env): ApiConfig {
  const baseURL = resolveApiBaseURL(env);
  const mode = resolveAuthMode(env.API_AUTH_MODE);
  const enableDestructive = env.API_ENABLE_DESTRUCTIVE === 'true';
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
    return `${stripTrailingSlash(playwrightBaseURL)}/kpos`;
  }

  return 'http://192.168.0.182:22080/kpos';
}

function resolveAuthMode(value: string | undefined): ApiAuthMode {
  if (!value) {
    return 'apiKey';
  }

  if (value === 'apiKey' || value === 'cookie') {
    return value;
  }

  throw new Error(`Unsupported API_AUTH_MODE: ${value}. Expected apiKey or cookie.`);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

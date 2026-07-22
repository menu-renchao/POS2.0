import type { MysqlConfig } from './db';

type EnvSource = Record<string, string | undefined>;

const DEFAULT_DB_PORT = 22108;
const DEFAULT_DB_NAME = 'kpos';
const DEFAULT_DB_USER = 'shohoku';
const DEFAULT_DB_PASSWORD = 'N0mur@4$99!';

export function resolveKposMysqlConfig(
  apiBaseURL: string,
  env: EnvSource = process.env,
): MysqlConfig {
  return {
    host: env.API_DB_HOST?.trim() || new URL(apiBaseURL).hostname,
    port: parsePositiveInteger(env.API_DB_PORT, DEFAULT_DB_PORT, 'API_DB_PORT'),
    database: env.API_DB_NAME?.trim() || DEFAULT_DB_NAME,
    user: env.API_DB_USER?.trim() || DEFAULT_DB_USER,
    password: env.API_DB_PASSWORD ?? DEFAULT_DB_PASSWORD,
  };
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const normalized = value?.trim();

  if (!normalized) {
    return fallback;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

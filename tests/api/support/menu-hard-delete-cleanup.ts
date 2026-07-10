import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadApiConfig, type ApiConfig } from '../../../api/core/api-config';
import { MysqlDb, type MysqlConfig } from '../../../utils/db';

const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const DEFAULT_REQUEST_MARKER_FILE = resolve(
  PROJECT_ROOT,
  'test-results',
  'menu-hard-delete-requested',
);
const DEFAULT_DB_PORT = 22108;
const DEFAULT_DB_NAME = 'kpos';
const DEFAULT_DB_USER = 'root';
const DEFAULT_DB_PASSWORD = 'N0mur@4$99!';

type EnvSource = Record<string, string | undefined>;

export type MenuHardDeleteConfig = MysqlConfig;

export const MENU_HARD_DELETE_SQL = [
  'START TRANSACTION;',
  "DELETE FROM order_item WHERE item_id IN (SELECT id FROM menu_item WHERE (name LIKE 'AT\\_%' AND deleted = 1) OR category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)));",
  "DELETE FROM saleitem_rule_assoc WHERE sale_item_id IN (SELECT id FROM menu_item WHERE (name LIKE 'AT\\_%' AND deleted = 1) OR category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)));",
  "DELETE FROM menu_item WHERE (name LIKE 'AT\\_%' AND deleted = 1) OR category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1));",
  'DELETE FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1);',
  'DELETE FROM menu_group WHERE deleted = 1;',
  "DELETE FROM `menu` where `NAME` = 'AT_MENU_STEP';",
  "DELETE FROM `menu` where `NAME` = 'AT_MENU_SETUP';",
  'COMMIT;',
].join('\n');

export function resolveMenuHardDeleteConfig(env: EnvSource = process.env): MenuHardDeleteConfig {
  const explicitHost = env.API_DB_HOST?.trim();
  const baseURL = env.API_BASE_URL?.trim() || env.PLAYWRIGHT_BASE_URL?.trim();

  return {
    host: explicitHost || resolveHostFromBaseURL(baseURL),
    port: parsePositiveInteger(env.API_DB_PORT, DEFAULT_DB_PORT, 'API_DB_PORT'),
    database: env.API_DB_NAME?.trim() || DEFAULT_DB_NAME,
    user: env.API_DB_USER?.trim() || DEFAULT_DB_USER,
    password: env.API_DB_PASSWORD ?? DEFAULT_DB_PASSWORD,
  };
}

function resolveHostFromBaseURL(baseURL: string | undefined): string {
  if (!baseURL) {
    return new URL(loadApiConfig().baseURL).hostname;
  }

  return new URL(baseURL).hostname;
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

export function resolveMenuHardDeleteConfigFromApiConfig(
  apiConfig: ApiConfig,
  env: EnvSource = process.env,
): MenuHardDeleteConfig {
  return resolveMenuHardDeleteConfig({
    ...env,
    API_BASE_URL: apiConfig.baseURL,
  });
}

export async function hardDeleteSoftDeletedMenuData(
  apiConfig: ApiConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const config = resolveMenuHardDeleteConfigFromApiConfig(apiConfig, env);

  await new MysqlDb(config).execute(MENU_HARD_DELETE_SQL);
}

type ApiHookTest = {
  afterAll: (hook: () => Promise<void>) => void;
  step: <T>(title: string, body: () => T | Promise<T>) => Promise<T>;
};

type MenuHardDeleteRequestOptions = {
  markerFile?: string;
};

export function registerMenuHardDeleteAfterAll(
  testApi: ApiHookTest,
  options: MenuHardDeleteRequestOptions = {},
): void {
  void testApi;
  markMenuHardDeleteRequested(options.markerFile);
}

export async function cleanupMenuResourcesAfterFlow(
  apiConfig: ApiConfig,
  hardDelete: (apiConfig: ApiConfig) => Promise<void> = hardDeleteSoftDeletedMenuData,
): Promise<void> {
  await hardDelete(apiConfig);
}

type MenuHardDeleteSessionOptions = {
  markerFile?: string;
  hardDelete?: (apiConfig: ApiConfig) => Promise<void>;
  env?: EnvSource;
};

export function markMenuHardDeleteRequested(
  markerFile: string = DEFAULT_REQUEST_MARKER_FILE,
): void {
  mkdirSync(dirname(markerFile), { recursive: true });
  writeFileSync(markerFile, 'requested');
}

export async function cleanupMenuResourcesAfterSession(
  options: MenuHardDeleteSessionOptions = {},
): Promise<void> {
  const markerFile = options.markerFile ?? DEFAULT_REQUEST_MARKER_FILE;

  if (!existsSync(markerFile)) {
    return;
  }

  await cleanupMenuResourcesAfterFlow(
    loadApiConfig(options.env),
    options.hardDelete ?? hardDeleteSoftDeletedMenuData,
  );

  rmSync(markerFile, { force: true });
}

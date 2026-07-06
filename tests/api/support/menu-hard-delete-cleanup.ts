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
  'DELETE FROM order_item WHERE item_id IN (SELECT id FROM menu_item WHERE category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)));',
  'DELETE FROM saleitem_rule_assoc WHERE sale_item_id IN (SELECT id FROM menu_item WHERE category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)));',
  'DELETE FROM menu_item WHERE category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1));',
  'DELETE FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1);',
  'DELETE FROM menu_group WHERE deleted = 1;',
  "DELETE FROM `kpos`.`menu` where `name` = 'AT_MENU_MENU';",
  'COMMIT;',
].join('\n');

export function resolveMenuHardDeleteConfig(env: EnvSource = process.env): MenuHardDeleteConfig {
  const baseURL = env.API_BASE_URL?.trim() || env.PLAYWRIGHT_BASE_URL?.trim();
  if (!baseURL) {
    throw new Error('菜单硬删除清理需要 API_BASE_URL 或 PLAYWRIGHT_BASE_URL 用于解析数据库 IP。');
  }

  return {
    host: new URL(baseURL).hostname,
    port: DEFAULT_DB_PORT,
    database: DEFAULT_DB_NAME,
    user: DEFAULT_DB_USER,
    password: DEFAULT_DB_PASSWORD,
  };
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

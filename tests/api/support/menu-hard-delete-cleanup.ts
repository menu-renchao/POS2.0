import { loadApiConfig, type ApiConfig } from '../../../api/core/api-config';
import { MysqlCliDb, type MysqlCliConfig } from '../../../utils/db';

const DEFAULT_DB_PORT = 22108;
const DEFAULT_DB_NAME = 'kpos';
const DEFAULT_DB_USER = 'root';
const DEFAULT_DB_PASSWORD = 'N0mur@4$99!';
const DEFAULT_MYSQL_BIN = 'mysql';

type EnvSource = Record<string, string | undefined>;

export type MenuHardDeleteConfig = Required<MysqlCliConfig>;

export const MENU_HARD_DELETE_SQL = [
  'START TRANSACTION;',
  'DELETE FROM order_item WHERE item_id IN (SELECT id FROM menu_item WHERE category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)));',
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
    mysqlBin: env.API_DB_MYSQL_BIN?.trim() || DEFAULT_MYSQL_BIN,
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

  await new MysqlCliDb(config).execute(MENU_HARD_DELETE_SQL, env);
}

type ApiHookTest = {
  afterAll: (hook: () => Promise<void>) => void;
  step: <T>(title: string, body: () => T | Promise<T>) => Promise<T>;
};

export function registerMenuHardDeleteAfterAll(testApi: ApiHookTest): void {
  testApi.afterAll(async () => {
    await testApi.step('硬删除菜单软删除测试数据', async () => {
      await cleanupMenuResourcesAfterFlow(loadApiConfig());
    });
  });
}

export async function cleanupMenuResourcesAfterFlow(
  apiConfig: ApiConfig,
  hardDelete: (apiConfig: ApiConfig) => Promise<void> = hardDeleteSoftDeletedMenuData,
): Promise<void> {
  await hardDelete(apiConfig);
}

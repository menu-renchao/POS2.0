import { test } from '@playwright/test';
import { MysqlDb, type MysqlConfig } from '../../../utils/db';

const API_MENU_RESIDUE_CLEANUP_SQL = [
  "DELETE FROM order_item WHERE item_id IN (SELECT id FROM menu_item WHERE (name LIKE 'AT\\_%' AND deleted = 1) OR category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)))",
  "DELETE FROM menu_item WHERE (name LIKE 'AT\\_%' AND deleted = 1) OR category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1))",
  'DELETE FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)',
  'DELETE FROM menu_group WHERE deleted = 1',
  "DELETE FROM `menu` where `NAME` = 'AT_MENU_STEP'",
  "DELETE FROM `menu` where `NAME` = 'AT_MENU_SETUP'",
].join(';\n') + ';';

test.describe('API 测试数据维护清理', () => {
  test('应清理固定名称和软删除菜单残留数据', async () => {
    await test.step('清理 API 自动化菜单残留数据', async () => {
      await new MysqlDb(loadApiDbConfig()).execute(API_MENU_RESIDUE_CLEANUP_SQL);
    });
  });
});

function loadApiDbConfig(env: NodeJS.ProcessEnv = process.env): MysqlConfig {
  return {
    host: requireEnv(env, 'API_DB_HOST'),
    port: Number.parseInt(requireEnv(env, 'API_DB_PORT'), 10),
    database: requireEnv(env, 'API_DB_NAME'),
    user: requireEnv(env, 'API_DB_USER'),
    password: requireEnv(env, 'API_DB_PASSWORD'),
  };
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for API cleanup database maintenance.`);
  }

  return value;
}

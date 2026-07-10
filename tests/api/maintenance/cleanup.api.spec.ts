import { test } from '@playwright/test';
import {
  MENU_HARD_DELETE_SQL,
  resolveMenuHardDeleteConfig,
} from '../support/menu-hard-delete-cleanup';
import { MysqlDb } from '../../../utils/db';

const apiTestScope = process.env.API_TEST_SCOPE?.trim();

test.describe('API 测试数据维护清理', () => {
  test.skip(
    apiTestScope !== undefined && apiTestScope !== 'cleanup',
    '维护清理只在 API_TEST_SCOPE=cleanup 时执行。',
  );

  test('应清理固定名称和软删除菜单残留数据', async () => {
    await test.step('清理 API 自动化菜单残留数据', async () => {
      await new MysqlDb(resolveMenuHardDeleteConfig()).execute(MENU_HARD_DELETE_SQL);
    });
  });
});

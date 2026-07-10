import { test } from '@playwright/test';
import {
  MENU_HARD_DELETE_SQL,
  resolveMenuHardDeleteConfig,
} from '../support/menu-hard-delete-cleanup';
import { MysqlDb } from '../../../utils/db';

test.describe('API 测试数据维护清理', () => {
  test('应清理固定名称和软删除菜单残留数据', async () => {
    await test.step('清理 API 自动化菜单残留数据', async () => {
      const dbConfig = resolveMenuHardDeleteConfig();
      console.log(
        `API cleanup DB target: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}, user=${dbConfig.user}`,
      );

      await new MysqlDb(dbConfig).execute(MENU_HARD_DELETE_SQL);
    });
  });
});

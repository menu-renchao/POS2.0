import { expect, test } from '@playwright/test';
import { MysqlCliDb } from '../../../utils/db';
import {
  MENU_HARD_DELETE_SQL,
  cleanupMenuResourcesAfterFlow,
  resolveMenuHardDeleteConfig,
} from '../support/menu-hard-delete-cleanup';

test.describe('菜单硬删除清理配置', () => {
  test('应能从 API_BASE_URL 解析数据库地址并固定使用菜单清理端口和账号', () => {
    const config = resolveMenuHardDeleteConfig({
      API_BASE_URL: 'http://192.168.0.182:22080/kpos',
    });

    expect(config).toEqual({
      host: '192.168.0.182',
      port: 22108,
      database: 'kpos',
      user: 'root',
      password: 'N0mur@4$99!',
      mysqlBin: 'mysql',
    });
  });

  test('应能构造不暴露密码的 mysql 清理调用', () => {
    const invocation = new MysqlCliDb(
      resolveMenuHardDeleteConfig({
        API_BASE_URL: 'http://192.168.0.182:22080/kpos',
      }),
    ).buildInvocation(MENU_HARD_DELETE_SQL);

    expect(invocation.command).toBe('mysql');
    expect(invocation.args).toEqual([
      '--protocol=tcp',
      '-h',
      '192.168.0.182',
      '-P',
      '22108',
      '-u',
      'root',
      '--database',
      'kpos',
      '--batch',
      '--raw',
      '--skip-column-names',
      '-e',
      MENU_HARD_DELETE_SQL,
    ]);
    expect(invocation.args.join(' ')).not.toContain('N0mur@4$99!');
    expect(invocation.env.MYSQL_PWD).toBe('N0mur@4$99!');
  });

  test('硬删除 SQL 应按外键依赖顺序清理菜单相关数据', () => {
    const statements = MENU_HARD_DELETE_SQL.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('DELETE'));

    expect(statements).toEqual([
      'DELETE FROM order_item WHERE item_id IN (SELECT id FROM menu_item WHERE category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)));',
      'DELETE FROM menu_item WHERE category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1));',
      'DELETE FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1);',
      'DELETE FROM menu_group WHERE deleted = 1;',
      "DELETE FROM `kpos`.`menu` where `name` = 'AT_MENU_MENU';",
    ]);
  });

  test('菜单流程后置清理应只执行数据库硬删除一次', async () => {
    const calls: string[] = [];

    await cleanupMenuResourcesAfterFlow(
      {
        baseURL: 'http://192.168.0.182:22080/kpos',
        auth: {
          mode: 'apiLogin',
          clientSn: 'device001',
          clientType: '0',
          staffPasscode: '11',
        },
        testPrefix: 'AT',
      },
      async () => {
        calls.push('hard-delete');
      },
    );

    expect(calls).toEqual(['hard-delete']);
  });
});

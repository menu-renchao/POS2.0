import { expect, test } from '@playwright/test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MysqlDb } from '../../../utils/db';
import {
  MENU_HARD_DELETE_SQL,
  cleanupMenuResourcesAfterSession,
  cleanupMenuResourcesAfterFlow,
  registerMenuHardDeleteAfterAll,
  resolveMenuHardDeleteConfig,
} from '../support/menu-hard-delete-cleanup';

test.describe('菜单硬删除清理配置', () => {
  test('应能从 API_BASE_URL 解析数据库地址并固定使用菜单清理端口和账号', () => {
    const config = resolveMenuHardDeleteConfig({
      API_BASE_URL: 'http://192.168.0.247:22080/kpos',
    });

    expect(config).toEqual({
      host: '192.168.0.247',
      port: 22108,
      database: 'kpos',
      user: 'root',
      password: 'N0mur@4$99!',
    });
  });

  test('应允许通过 API_DB_HOST 覆盖数据库地址', () => {
    const config = resolveMenuHardDeleteConfig({
      API_DB_HOST: '192.168.0.247',
    });

    expect(config.host).toBe('192.168.0.247');
  });

  test('应能构造菜单硬删除数据库连接配置', () => {
    const options = new MysqlDb(
      resolveMenuHardDeleteConfig({
        API_BASE_URL: 'http://192.168.0.247:22080/kpos',
      }),
    ).connectionOptions();

    expect(options).toEqual({
      host: '192.168.0.247',
      port: 22108,
      database: 'kpos',
      user: 'root',
      password: 'N0mur@4$99!',
      multipleStatements: true,
    });
  });

  test('硬删除 SQL 应按外键依赖顺序清理菜单相关数据', () => {
    const statements = MENU_HARD_DELETE_SQL.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('DELETE'));

    expect(statements).toEqual([
      "DELETE FROM order_item WHERE item_id IN (SELECT id FROM menu_item WHERE (name LIKE 'AT\\_%' AND deleted = 1) OR category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)));",
      "DELETE FROM saleitem_rule_assoc WHERE sale_item_id IN (SELECT id FROM menu_item WHERE (name LIKE 'AT\\_%' AND deleted = 1) OR category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1)));",
      "DELETE FROM menu_item WHERE (name LIKE 'AT\\_%' AND deleted = 1) OR category_id IN (SELECT id FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1));",
      'DELETE FROM menu_category WHERE group_id IN (SELECT id FROM menu_group WHERE deleted = 1);',
      'DELETE FROM menu_group WHERE deleted = 1;',
      "DELETE FROM `menu` where `NAME` = 'AT_MENU_STEP';",
      "DELETE FROM `menu` where `NAME` = 'AT_MENU_SETUP';",
    ]);
  });

  test('菜单流程后置清理应只执行数据库硬删除一次', async () => {
    const calls: string[] = [];

    await cleanupMenuResourcesAfterFlow(
      {
        baseURL: 'http://192.168.0.247:22080/kpos',
        auth: {
          mode: 'apiLogin',
          clientSn: 'mansuper',
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

  test('菜单硬删除注册应只标记 session 清理请求且不注册文件级 afterAll', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'menu-hard-delete-'));
    const markerFile = join(tempDir, 'requested');
    let afterAllCalls = 0;

    try {
      registerMenuHardDeleteAfterAll(
        {
          afterAll: () => {
            afterAllCalls += 1;
          },
          step: async (_title, body) => await body(),
        },
        { markerFile },
      );

      expect(afterAllCalls).toBe(0);
      expect(existsSync(markerFile)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('session 结束清理应在存在请求标记时只执行一次硬删除', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'menu-hard-delete-'));
    const markerFile = join(tempDir, 'requested');
    const calls: string[] = [];
    writeFileSync(markerFile, 'requested');

    try {
      await cleanupMenuResourcesAfterSession({
        markerFile,
        hardDelete: async () => {
          calls.push('hard-delete');
        },
        env: {
          API_BASE_URL: 'http://192.168.0.247:22080/kpos',
        },
      });

      expect(calls).toEqual(['hard-delete']);
      expect(existsSync(markerFile)).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('session 结束清理在没有请求标记时不应连接数据库', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'menu-hard-delete-'));
    const markerFile = join(tempDir, 'requested');
    const calls: string[] = [];

    try {
      await cleanupMenuResourcesAfterSession({
        markerFile,
        hardDelete: async () => {
          calls.push('hard-delete');
        },
      });

      expect(calls).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

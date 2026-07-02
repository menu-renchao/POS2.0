import { expect, test } from '@playwright/test';
import { MysqlDb } from '../../../utils/db';

test.describe('DB 工具类', () => {
  test('MysqlDb 应能构造不依赖 mysql CLI 的连接配置', () => {
    const db = new MysqlDb({
      host: '192.168.0.182',
      port: 22108,
      database: 'kpos',
      user: 'root',
      password: 'N0mur@4$99!',
    });

    expect(db.connectionOptions()).toEqual({
      host: '192.168.0.182',
      port: 22108,
      database: 'kpos',
      user: 'root',
      password: 'N0mur@4$99!',
      multipleStatements: true,
    });
  });

  test('MysqlDb 应通过注入连接工厂执行 SQL 并关闭连接', async () => {
    const calls: string[] = [];
    const db = new MysqlDb(
      {
        host: '192.168.0.182',
        port: 22108,
        database: 'kpos',
        user: 'root',
        password: 'N0mur@4$99!',
      },
      async () => ({
        query: async (sql: string) => {
          calls.push(`query:${sql}`);
        },
        end: async () => {
          calls.push('end');
        },
      }),
    );

    await db.execute('SELECT 1;');

    expect(calls).toEqual(['query:SELECT 1;', 'end']);
  });

  test('MysqlDb 执行 SQL 失败时仍应关闭连接', async () => {
    const calls: string[] = [];
    const db = new MysqlDb(
      {
        host: '192.168.0.182',
        port: 22108,
        database: 'kpos',
        user: 'root',
        password: 'N0mur@4$99!',
      },
      async () => ({
        query: async () => {
          calls.push('query');
          throw new Error('sql failed');
        },
        end: async () => {
          calls.push('end');
        },
      }),
    );

    await expect(db.execute('SELECT 1;')).rejects.toThrow('sql failed');
    expect(calls).toEqual(['query', 'end']);
  });

  test('MysqlDb 默认连接工厂应来自 mysql2 驱动', () => {
    const db = new MysqlDb({
      host: '192.168.0.182',
      port: 22108,
      database: 'kpos',
      user: 'root',
      password: 'N0mur@4$99!',
    });

    expect(db.usesMysql2Driver()).toBe(true);
  });
});

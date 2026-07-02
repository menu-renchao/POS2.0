import { expect, test } from '@playwright/test';
import { MysqlCliDb } from '../../../utils/db';

test.describe('DB 工具类', () => {
  test('MysqlCliDb 应能构造 mysql CLI 调用并通过环境变量传递密码', () => {
    const db = new MysqlCliDb({
      host: '192.168.0.182',
      port: 22108,
      database: 'kpos',
      user: 'root',
      password: 'N0mur@4$99!',
      mysqlBin: 'C:\\mysql\\bin\\mysql.exe',
    });

    const invocation = db.buildInvocation('SELECT 1;');

    expect(invocation.command).toBe('C:\\mysql\\bin\\mysql.exe');
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
      'SELECT 1;',
    ]);
    expect(invocation.args.join(' ')).not.toContain('N0mur@4$99!');
    expect(invocation.env).toEqual({ MYSQL_PWD: 'N0mur@4$99!' });
  });

  test('MysqlCliDb 未指定 mysqlBin 时应使用系统 mysql 命令', () => {
    const db = new MysqlCliDb({
      host: '192.168.0.182',
      port: 22108,
      database: 'kpos',
      user: 'root',
      password: 'N0mur@4$99!',
    });

    expect(db.buildInvocation('SELECT 1;').command).toBe('mysql');
  });
});

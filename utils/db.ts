import { createConnection, type ConnectionOptions } from 'mysql2/promise';

export type MysqlConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export type MysqlConnectionLike = {
  query: (sql: string, values?: unknown[]) => Promise<unknown>;
  end: () => Promise<unknown>;
};

export type MysqlConnectionFactory = (
  options: ConnectionOptions,
) => Promise<MysqlConnectionLike>;

export class MysqlDb {
  constructor(
    private readonly config: MysqlConfig,
    private readonly connectionFactory: MysqlConnectionFactory = createConnection,
  ) {}

  connectionOptions(): ConnectionOptions {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      multipleStatements: true,
    };
  }

  usesMysql2Driver(): boolean {
    return this.connectionFactory === createConnection;
  }

  async execute(sql: string): Promise<void> {
    const connection = await this.connectionFactory(this.connectionOptions());

    try {
      await connection.query(sql);
    } finally {
      await connection.end();
    }
  }

  async queryRows<T>(sql: string, values: unknown[] = []): Promise<T[]> {
    const connection = await this.connectionFactory(this.connectionOptions());

    try {
      const result = await connection.query(sql, values);

      if (!Array.isArray(result) || !Array.isArray(result[0])) {
        throw new Error('MySQL query did not return a row collection.');
      }

      return result[0] as T[];
    } finally {
      await connection.end();
    }
  }
}

import { createConnection, type ConnectionOptions } from 'mysql2/promise';

export type MysqlConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export type MysqlConnectionLike = {
  query: (sql: string) => Promise<unknown>;
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
}

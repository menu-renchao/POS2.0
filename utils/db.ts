import { spawn } from 'node:child_process';

export type MysqlCliConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  mysqlBin?: string;
};

export type MysqlCliInvocation = {
  command: string;
  args: string[];
  env: Record<string, string>;
};

export type MysqlCliResult = {
  stdout: string;
  stderr: string;
};

export class MysqlCliDb {
  constructor(private readonly config: MysqlCliConfig) {}

  buildInvocation(sql: string): MysqlCliInvocation {
    return {
      command: this.config.mysqlBin?.trim() || 'mysql',
      args: [
        '--protocol=tcp',
        '-h',
        this.config.host,
        '-P',
        String(this.config.port),
        '-u',
        this.config.user,
        '--database',
        this.config.database,
        '--batch',
        '--raw',
        '--skip-column-names',
        '-e',
        sql,
      ],
      env: {
        MYSQL_PWD: this.config.password,
      },
    };
  }

  async execute(sql: string, env: NodeJS.ProcessEnv = process.env): Promise<MysqlCliResult> {
    const invocation = this.buildInvocation(sql);

    const output = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn(invocation.command, invocation.args, {
          env: {
            ...env,
            ...invocation.env,
          },
          windowsHide: true,
        });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8');
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8');
        });
        child.on('error', reject);
        child.on('close', (code) => {
          resolve({ code, stdout, stderr });
        });
      },
    );

    if (output.code !== 0) {
      throw new Error(formatMysqlCliError(output.code, output.stdout, output.stderr));
    }

    return {
      stdout: output.stdout,
      stderr: output.stderr,
    };
  }
}

function formatMysqlCliError(code: number | null, stdout: string, stderr: string): string {
  return [
    `MySQL SQL 执行失败，mysql 退出码: ${code}`,
    stdout.trim() ? `stdout: ${stdout.trim()}` : '',
    stderr.trim() ? `stderr: ${stderr.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

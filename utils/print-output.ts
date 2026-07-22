import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { step } from './step';
import { waitUntil } from './wait';

export type PrintTicketKind =
  | 'KITCHEN'
  | 'PACKAGE'
  | 'PRINTER'
  | 'RECEIPT'
  | 'RUNNER';

export type PrintTicket = {
  fileName: string;
  filePath: string;
  html: string;
  kind: PrintTicketKind | 'UNKNOWN';
  modifiedAt: number;
  text: string;
};

export type PrintOutputSnapshot = {
  files: ReadonlySet<string>;
  takenAt: number;
};

export type WaitForPrintTicketsOptions = {
  after?: PrintOutputSnapshot;
  kinds?: readonly PrintTicketKind[];
  minimum?: number;
  timeout?: number;
};

export const defaultPrintOutputDirectory =
  process.env.POS_PRINT_OUTPUT_DIR ??
  path.join(homedir(), '.menusifu', 'POS', 'data', 'temp');

export class PrintOutputReader {
  constructor(readonly directory = defaultPrintOutputDirectory) {}

  @step('打印文件：清空 POS 本地打印输出目录')
  async clear(): Promise<void> {
    const entries = await readdir(this.directory, { withFileTypes: true }).catch((error: unknown) => {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    });

    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(this.directory, entry.name);
        await waitUntil(
          async () => {
            try {
              await rm(entryPath, {
                force: true,
                recursive: entry.isDirectory(),
              });
              return true;
            } catch (error) {
              if (
                isNodeError(error) &&
                error.code !== undefined &&
                ['EBUSY', 'EPERM'].includes(error.code)
              ) {
                return false;
              }
              throw error;
            }
          },
          (removed) => removed,
          {
            timeout: 5_000,
            interval: 200,
            message: `打印输出文件持续被占用，无法清理：${entryPath}`,
          },
        );
      }),
    );
  }

  @step('打印文件：保存当前打印目录快照')
  async snapshot(): Promise<PrintOutputSnapshot> {
    return {
      files: new Set((await this.listHtmlFileNames()).map((fileName) => fileName.toLowerCase())),
      takenAt: Date.now(),
    };
  }

  @step('打印文件：等待并读取本次新生成的票据')
  async waitForTickets(options: WaitForPrintTicketsOptions = {}): Promise<PrintTicket[]> {
    const minimum = options.minimum ?? 1;
    const expectedKinds = new Set(options.kinds ?? []);
    const previousFiles = options.after?.files ?? new Set<string>();

    const fileNames = await waitUntil(
      async () => {
        const currentFiles = await this.listHtmlFileNames();
        return currentFiles.filter((fileName) => {
          if (previousFiles.has(fileName.toLowerCase())) {
            return false;
          }

          return expectedKinds.size === 0 || expectedKinds.has(readTicketKind(fileName) as PrintTicketKind);
        });
      },
      (files) => files.length >= minimum,
      {
        timeout: options.timeout ?? 30_000,
        interval: 200,
        message: `打印目录未生成至少 ${minimum} 个目标 HTML 票据：${this.directory}`,
      },
    );

    const tickets = await Promise.all(fileNames.map((fileName) => this.readTicket(fileName)));
    return tickets.sort((left, right) => left.modifiedAt - right.modifiedAt);
  }

  @step((kind: PrintTicketKind) => `打印文件：读取最新的 ${kind} 票据`)
  async readLatest(kind: PrintTicketKind): Promise<PrintTicket> {
    const tickets = await Promise.all(
      (await this.listHtmlFileNames())
        .filter((fileName) => readTicketKind(fileName) === kind)
        .map((fileName) => this.readTicket(fileName)),
    );
    const latest = tickets.sort((left, right) => right.modifiedAt - left.modifiedAt)[0];

    if (!latest) {
      throw new Error(`打印目录中不存在 ${kind} HTML 票据：${this.directory}`);
    }

    return latest;
  }

  private async listHtmlFileNames(): Promise<string[]> {
    const entries = await readdir(this.directory, { withFileTypes: true }).catch((error: unknown) => {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    });

    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
      .map((entry) => entry.name);
  }

  private async readTicket(fileName: string): Promise<PrintTicket> {
    const filePath = path.join(this.directory, fileName);
    const [html, fileStat] = await Promise.all([
      readFile(filePath, 'utf8'),
      stat(filePath),
    ]);

    return {
      fileName,
      filePath,
      html,
      kind: readTicketKind(fileName),
      modifiedAt: fileStat.mtimeMs,
      text: htmlToText(html),
    };
  }
}

export function readTicketKind(fileName: string): PrintTicket['kind'] {
  const match = fileName
    .toUpperCase()
    .match(/-(KITCHEN|PACKAGE|PRINTER|RECEIPT|RUNNER)(?:-\d+)?\.HTML$/);
  return (match?.[1] as PrintTicketKind | undefined) ?? 'UNKNOWN';
}

export function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/tr>|<\/td>|<\/li>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    }
    return namedEntities[body.toLowerCase()] ?? entity;
  });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

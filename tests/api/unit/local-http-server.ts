export type LocalHttpRequest = {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};

export type LocalHttpResponse = {
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(body?: string): void;
};

export type LocalHttpServer = {
  listen(port: number, hostname: string, callback: () => void): void;
  address(): string | { port: number } | null;
  close(callback: (error?: Error) => void): void;
};

type LocalHttp = {
  createServer(
    listener: (request: LocalHttpRequest, response: LocalHttpResponse) => void,
  ): LocalHttpServer;
};

const http = require('http') as LocalHttp;

export function createLocalHttpServer(
  listener: (request: LocalHttpRequest, response: LocalHttpResponse) => void,
): LocalHttpServer {
  return http.createServer(listener);
}

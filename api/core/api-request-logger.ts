import type { APIRequestContext, APIResponse, TestInfo } from '@playwright/test';

export type ApiRequestLogAttachTarget = Pick<TestInfo, 'attach'>;
export type ApiRequestLogContext = {
  baseURL?: string;
  extraHTTPHeaders?: Record<string, string>;
  name?: string;
};

type LoggedMethod = 'delete' | 'fetch' | 'get' | 'head' | 'patch' | 'post' | 'put';

const LOGGED_METHODS = new Set<string>(['delete', 'fetch', 'get', 'head', 'patch', 'post', 'put']);

export function createLoggedApiRequestContext(
  requestContext: APIRequestContext,
  testInfo: ApiRequestLogAttachTarget,
  logContext: ApiRequestLogContext = {},
): APIRequestContext {
  return new Proxy(requestContext, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof property === 'string' && LOGGED_METHODS.has(property) && typeof value === 'function') {
        return async (...args: unknown[]) => {
          const method = property as LoggedMethod;
          const startedAt = new Date().toISOString();
          let response: APIResponse | undefined;
          let thrownError: unknown;

          try {
            response = await value.apply(target, args);
            return response;
          } catch (error) {
            thrownError = error;
            throw error;
          } finally {
            try {
              await attachApiRequestLog({
                requestContext: target,
                testInfo,
                logContext,
                method,
                args,
                response,
                error: thrownError,
                startedAt,
                endedAt: new Date().toISOString(),
              });
            } catch (error) {
              console.warn('API request log attachment failed.', error);
            }
          }
        };
      }

      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as APIRequestContext;
}

type ApiRequestLogOptions = {
  requestContext: APIRequestContext;
  testInfo: ApiRequestLogAttachTarget;
  logContext: ApiRequestLogContext;
  method: LoggedMethod;
  args: unknown[];
  response?: APIResponse;
  error?: unknown;
  startedAt: string;
  endedAt: string;
};

async function attachApiRequestLog(options: ApiRequestLogOptions): Promise<void> {
  const url = String(options.args[0] ?? '');
  const requestOptions = options.args[1];
  const response = options.response;
  const bodyText = response ? await readResponseText(response) : undefined;

  const log = {
    method: options.method.toUpperCase(),
    url,
    startedAt: options.startedAt,
    endedAt: options.endedAt,
    context: options.logContext,
    request: {
      options: requestOptions ?? null,
      storageState: await readStorageState(options.requestContext),
    },
    response: response
      ? {
          status: response.status(),
          headers: response.headers(),
          bodyText,
          bodyJson: parseJsonBody(bodyText),
        }
      : null,
    error: options.error ? serializeError(options.error) : null,
  };

  await options.testInfo.attach(`API ${log.method} ${url}`, {
    body: stringifyForAttachment(log),
    contentType: 'application/json',
  });
}

async function readStorageState(requestContext: APIRequestContext): Promise<unknown> {
  try {
    return await requestContext.storageState();
  } catch (error) {
    return { error: serializeError(error) };
  }
}

async function readResponseText(response: APIResponse): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return stringifyForAttachment({ error: serializeError(error) });
  }
}

function parseJsonBody(bodyText: string | undefined): unknown {
  if (bodyText === undefined || bodyText === '') {
    return undefined;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return undefined;
  }
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

function stringifyForAttachment(value: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(
    value,
    (_key, nestedValue) => {
      if (typeof nestedValue === 'bigint') {
        return nestedValue.toString();
      }

      if (typeof nestedValue === 'object' && nestedValue !== null) {
        if (seen.has(nestedValue)) {
          return '[Circular]';
        }

        seen.add(nestedValue);
      }

      return nestedValue;
    },
    2,
  );
}

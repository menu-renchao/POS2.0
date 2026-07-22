import { createHash } from 'node:crypto';
import type { APIRequestContext, APIResponse, TestInfo } from '@playwright/test';

export type ApiRequestLogAttachTarget = Pick<TestInfo, 'attach'>;
export type ApiRequestLogContext = {
  baseURL?: string;
  extraHTTPHeaders?: Record<string, string>;
  name?: string;
};
export type ApiRequestLogPolicy = {
  maxRequestBytes: number;
  maxResponseBytes: number;
  maxFailureResponseBytes: number;
};

type LoggedMethod = 'delete' | 'fetch' | 'get' | 'head' | 'patch' | 'post' | 'put';
type ApiRequestLogPolicyOverrides = Partial<ApiRequestLogPolicy>;

const LOGGED_METHODS = new Set<string>(['delete', 'fetch', 'get', 'head', 'patch', 'post', 'put']);
const REDACTED = '[REDACTED]';
const DEFAULT_LOG_POLICY: ApiRequestLogPolicy = {
  maxRequestBytes: 32 * 1024,
  maxResponseBytes: 64 * 1024,
  maxFailureResponseBytes: 256 * 1024,
};
const SENSITIVE_KEYS = new Set([
  'authorization',
  'clientsecret',
  'cookie',
  'licenseauthkey',
  'password',
  'passcode',
  'refreshtoken',
  'secret',
  'sessionkey',
  'setcookie',
  'token',
  'accesstoken',
]);
const SENSITIVE_TEXT_KEY_PATTERN =
  '(?:authorization|client[-_]?secret|cookie|license[-_]?auth[-_]?key|password|passcode|refresh[-_]?token|secret|session[-_]?key|set[-_]?cookie|access[-_]?token|token)';

export function createLoggedApiRequestContext(
  requestContext: APIRequestContext,
  testInfo: ApiRequestLogAttachTarget,
  logContext: ApiRequestLogContext = {},
  policyOverrides: ApiRequestLogPolicyOverrides = {},
): APIRequestContext {
  const logPolicy = resolveLogPolicy(policyOverrides);

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
                testInfo,
                logContext,
                logPolicy,
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
  testInfo: ApiRequestLogAttachTarget;
  logContext: ApiRequestLogContext;
  logPolicy: ApiRequestLogPolicy;
  method: LoggedMethod;
  args: unknown[];
  response?: APIResponse;
  error?: unknown;
  startedAt: string;
  endedAt: string;
};

async function attachApiRequestLog(options: ApiRequestLogOptions): Promise<void> {
  const url = redactUrl(String(options.args[0] ?? ''));
  const requestOptions = options.args[1];
  const response = options.response;
  const isFailure = Boolean(options.error) || Boolean(response && response.status() >= 400);
  const responseBodyLimit = isFailure
    ? options.logPolicy.maxFailureResponseBytes
    : options.logPolicy.maxResponseBytes;

  const log = {
    method: options.method.toUpperCase(),
    url,
    startedAt: options.startedAt,
    endedAt: options.endedAt,
    durationMs: calculateDurationMs(options.startedAt, options.endedAt),
    context: redactSensitiveValue(options.logContext),
    request: toBoundedLogValue(requestOptions ?? null, options.logPolicy.maxRequestBytes),
    response: response
      ? {
          status: response.status(),
          headers: redactSensitiveValue(response.headers()),
          body: await readBoundedResponseBody(response, responseBodyLimit),
        }
      : null,
    error: options.error ? redactSensitiveValue(serializeError(options.error)) : null,
  };

  await options.testInfo.attach(`API ${log.method} ${url}`, {
    body: stringifyForAttachment(log),
    contentType: 'application/json',
  });
}

async function readBoundedResponseBody(response: APIResponse, maxBytes: number): Promise<unknown> {
  let body: Buffer;

  try {
    body = await response.body();
  } catch (error) {
    return {
      readError: redactSensitiveValue(serializeError(error)),
    };
  }

  const originalBytes = body.byteLength;
  const contentType = findHeader(response.headers(), 'content-type');

  if (!shouldRenderBodyAsText(contentType)) {
    return {
      contentType: contentType ?? null,
      originalBytes,
      previewBytes: 0,
      truncated: originalBytes > 0,
      sha256: createHash('sha256').update(body).digest('hex'),
      format: 'binary',
      content: originalBytes === 0 ? '' : '[BINARY CONTENT OMITTED]',
    };
  }

  const previewBuffer = truncateUtf8Buffer(body, maxBytes);
  const previewText = previewBuffer.toString('utf8');
  const truncated = previewBuffer.byteLength < originalBytes;
  const parsedJson = !truncated && isJsonContentType(contentType) ? parseJsonBody(previewText) : undefined;

  return {
    contentType: contentType ?? null,
    originalBytes,
    previewBytes: previewBuffer.byteLength,
    truncated,
    sha256: createHash('sha256').update(body).digest('hex'),
    format: parsedJson === undefined ? 'text' : 'json',
    content:
      parsedJson === undefined
        ? redactSensitiveText(previewText) + (truncated ? '\n...[TRUNCATED]' : '')
        : redactSensitiveValue(parsedJson),
  };
}

function toBoundedLogValue(value: unknown, maxBytes: number): unknown {
  const redactedValue = redactSensitiveValue(value);
  const serializedValue = stringifyForAttachment(redactedValue);
  const serializedBuffer = Buffer.from(serializedValue, 'utf8');
  const previewBuffer = truncateUtf8Buffer(serializedBuffer, maxBytes);
  const truncated = previewBuffer.byteLength < serializedBuffer.byteLength;

  return {
    originalBytes: serializedBuffer.byteLength,
    previewBytes: previewBuffer.byteLength,
    truncated,
    content: truncated ? `${previewBuffer.toString('utf8')}\n...[TRUNCATED]` : redactedValue,
  };
}

function truncateUtf8Buffer(value: Buffer, maxBytes: number): Buffer {
  if (value.byteLength <= maxBytes) {
    return value;
  }

  let safeEnd = Math.max(0, Math.min(maxBytes, value.byteLength));
  while (safeEnd > 0 && (value[safeEnd] & 0xc0) === 0x80) {
    safeEnd -= 1;
  }

  return value.subarray(0, safeEnd);
}

function redactSensitiveValue(value: unknown, seen = new WeakSet<object>(), key?: string): unknown {
  if (key && isSensitiveKey(key)) {
    return REDACTED;
  }

  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' ? redactSensitiveText(value) : value;
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.byteLength} bytes]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item, seen));
  }

  const record = value as Record<string, unknown>;
  const storesNamedSecret = typeof record.name === 'string' && isSensitiveKey(record.name);

  return Object.fromEntries(
    Object.entries(record).map(([nestedKey, nestedValue]) => [
      nestedKey,
      storesNamedSecret && nestedKey === 'value'
        ? REDACTED
        : redactSensitiveValue(nestedValue, seen, nestedKey),
    ]),
  );
}

function redactSensitiveText(value: string): string {
  const jsonStyleSecret = new RegExp(
    `(["']${SENSITIVE_TEXT_KEY_PATTERN}["']\\s*:\\s*)("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^,}\\s]+)`,
    'gi',
  );
  const queryStyleSecret = new RegExp(`([?&]${SENSITIVE_TEXT_KEY_PATTERN}=)[^&#\\s]*`, 'gi');
  const assignmentStyleSecret = new RegExp(`(\\b${SENSITIVE_TEXT_KEY_PATTERN}\\s*=\\s*)[^&;,\\s]+`, 'gi');

  return value
    .replace(jsonStyleSecret, `$1"${REDACTED}"`)
    .replace(queryStyleSecret, `$1${REDACTED}`)
    .replace(assignmentStyleSecret, `$1${REDACTED}`);
}

function redactUrl(value: string): string {
  return redactSensitiveText(value);
}

function isSensitiveKey(value: string): boolean {
  return SENSITIVE_KEYS.has(value.replace(/[-_\s]/g, '').toLowerCase());
}

function findHeader(headers: Record<string, string>, expectedName: string): string | undefined {
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === expectedName);
  return entry?.[1];
}

function isJsonContentType(contentType: string | undefined): boolean {
  return Boolean(contentType && /(?:^|\/)json(?:;|$)|\+json(?:;|$)/i.test(contentType));
}

function shouldRenderBodyAsText(contentType: string | undefined): boolean {
  if (!contentType) {
    return true;
  }

  return (
    contentType.toLowerCase().startsWith('text/') ||
    /(?:json|xml|javascript|x-www-form-urlencoded|graphql|yaml)/i.test(contentType)
  );
}

function parseJsonBody(bodyText: string): unknown {
  if (bodyText === '') {
    return undefined;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return undefined;
  }
}

function calculateDurationMs(startedAt: string, endedAt: string): number {
  return Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
}

function resolveLogPolicy(overrides: ApiRequestLogPolicyOverrides): ApiRequestLogPolicy {
  return {
    maxRequestBytes: resolveByteLimit(
      overrides.maxRequestBytes,
      process.env.API_LOG_REQUEST_PREVIEW_BYTES,
      DEFAULT_LOG_POLICY.maxRequestBytes,
    ),
    maxResponseBytes: resolveByteLimit(
      overrides.maxResponseBytes,
      process.env.API_LOG_RESPONSE_PREVIEW_BYTES,
      DEFAULT_LOG_POLICY.maxResponseBytes,
    ),
    maxFailureResponseBytes: resolveByteLimit(
      overrides.maxFailureResponseBytes,
      process.env.API_LOG_FAILURE_PREVIEW_BYTES,
      DEFAULT_LOG_POLICY.maxFailureResponseBytes,
    ),
  };
}

function resolveByteLimit(overrideValue: number | undefined, environmentValue: string | undefined, fallback: number): number {
  const candidate = overrideValue ?? (environmentValue === undefined ? undefined : Number(environmentValue));
  return candidate !== undefined && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : fallback;
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

  return (
    JSON.stringify(
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
    ) ?? String(value)
  );
}

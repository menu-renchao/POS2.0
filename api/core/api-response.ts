export type ApiEnvelope<T> = {
  code: number;
  msg: string;
  traceId?: string;
  data?: T;
};

export type ApiFailureInfo = {
  method: string;
  path: string;
  status: number;
  requestSummary?: string;
  responseSummary?: string;
};

export function expectResponseEnvelope(value: unknown): asserts value is ApiEnvelope<unknown> {
  if (!isRecord(value)) {
    throw new Error('API response must be a JSON object envelope.');
  }

  if (typeof value.code !== 'number') {
    throw new Error('API response envelope requires numeric code.');
  }

  if (typeof value.msg !== 'string') {
    throw new Error('API response envelope requires string msg.');
  }

  if ('traceId' in value && typeof value.traceId !== 'string') {
    throw new Error('API response envelope traceId must be a string when present.');
  }
}

export function buildApiFailureMessage(info: ApiFailureInfo): string {
  const lines = [`${info.method.toUpperCase()} ${info.path} -> ${info.status}`];

  if (info.requestSummary) {
    lines.push(`Request: ${info.requestSummary}`);
  }

  if (info.responseSummary) {
    lines.push(`Response: ${info.responseSummary}`);
  }

  return lines.join('\n');
}

export function summarizeJson(value: unknown, maxLength = 1000): string {
  const summary = stringifyJson(value);
  const safeMaxLength = Math.max(0, maxLength);

  if (summary.length <= safeMaxLength) {
    return summary;
  }

  if (safeMaxLength <= 3) {
    return '.'.repeat(safeMaxLength);
  }

  return `${summary.slice(0, safeMaxLength - 3)}...`;
}

function stringifyJson(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    const summary = JSON.stringify(value);
    return summary ?? String(value);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

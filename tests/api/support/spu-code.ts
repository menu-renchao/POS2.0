export function parseSpuCodeFromAssignResponse(body: unknown): string {
  const data = isRecord(body) ? body.data : undefined;
  const code = extractSpuCodeFromAssignData(data, new Set<object>(), true);

  if (code === undefined) {
    throw new Error(
      `POST /api/spu/menuSaleItem/assign 响应未返回可用于库存操作的 SPU code。响应摘要：${summarizeBody(body)}`,
    );
  }

  return code;
}

function extractSpuCodeFromAssignData(
  value: unknown,
  seen: Set<object>,
  allowDirectPrimitive: boolean,
): string | undefined {
  if (allowDirectPrimitive) {
    const directCode = normalizeAssignSpuCode(value);

    if (directCode !== undefined) {
      return directCode;
    }
  }

  if (!isRecord(value) && !Array.isArray(value)) {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const code = extractSpuCodeFromAssignData(item, seen, false);

      if (code !== undefined) {
        return code;
      }
    }

    return undefined;
  }

  for (const key of ['spuCode', 'code', 'data']) {
    const code = normalizeAssignSpuCode(value[key]);

    if (code !== undefined) {
      return code;
    }
  }

  for (const [key, item] of Object.entries(value)) {
    const code = isPositiveIntegerKey(key)
      ? normalizeAssignSpuCode(item)
      : extractSpuCodeFromAssignData(item, seen, false);

    if (code !== undefined) {
      return code;
    }
  }

  return undefined;
}

function normalizeAssignSpuCode(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return /^[1-9]\d*$/.test(normalized) || /^[sS]\d+$/.test(normalized) ? normalized : undefined;
}

function isPositiveIntegerKey(key: string): boolean {
  return /^[1-9]\d*$/.test(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function summarizeBody(body: unknown): string {
  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return '[unserializable]';
  }
}

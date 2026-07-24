export type OrderChargeReadModel = {
  amount: number;
  name: string;
};

export function extractSavedOrderNumber(value: unknown): string {
  const order = extractSavedOrderRecord(value);
  const orderNumber = order?.orderNumber;

  if (typeof orderNumber === 'string' && orderNumber.trim()) {
    return orderNumber;
  }

  if (typeof orderNumber === 'number') {
    return String(orderNumber);
  }

  throw new Error(`API 创建订单后未返回 orderNumber: ${JSON.stringify(value)}`);
}

export function extractSavedOrderId(value: unknown): number {
  const order = extractSavedOrderRecord(value);
  const id = order?.id;

  if (typeof id === 'number' && Number.isFinite(id)) {
    return id;
  }

  if (typeof id === 'string' && id.trim()) {
    const parsedId = Number(id);

    if (Number.isFinite(parsedId)) {
      return parsedId;
    }
  }

  throw new Error(`API 创建订单后未返回订单 ID: ${JSON.stringify(value)}`);
}

export function extractSavedOrderRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directOrder = record.order;

  if (
    directOrder &&
    typeof directOrder === 'object' &&
    !Array.isArray(directOrder)
  ) {
    return directOrder as Record<string, unknown>;
  }

  if ('orderNumber' in record) {
    return record;
  }

  return undefined;
}

export function extractOrderCharges(value: unknown): OrderChargeReadModel[] {
  const orderCharges = extractSavedOrderRecord(value)?.orderCharges;

  if (!Array.isArray(orderCharges)) {
    return [];
  }

  const charges: OrderChargeReadModel[] = [];
  for (const charge of orderCharges) {
    if (!charge || typeof charge !== 'object') {
      continue;
    }

    const record = charge as Record<string, unknown>;
    const name =
      typeof record.chargeName === 'string' ? record.chargeName : null;
    const amount = Number(record.charge);

    if (name && Number.isFinite(amount)) {
      charges.push({ amount, name });
    }
  }

  return charges;
}

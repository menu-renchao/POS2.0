import { createShortTestName } from '../../api/core/test-data-id';
import type { ApiEntityId } from './menu-api-data';

export type OrderItemApiRequest = Record<string, unknown> & {
  saleItemId: ApiEntityId;
  name: string;
  quantity: number;
  price: number;
  amount: number;
};

export type OrderApiRequest = Record<string, unknown> & {
  customerName: string;
  items: OrderItemApiRequest[];
};

export const ORDER_API_NAME_LIMITS = {
  customer: 20,
  item: 24,
} as const;

export function buildOrderRequest(saleItemId: ApiEntityId, seed?: string | number): OrderApiRequest {
  const customerName = buildApiTestName('CUSTOMER', ORDER_API_NAME_LIMITS.customer, seed);
  const itemName = buildApiTestName('ORDER_ITEM', ORDER_API_NAME_LIMITS.item, seed);
  const quantity = 1;
  const price = 10;

  return {
    customerName,
    orderType: 'TAKE_OUT',
    source: 'API_AUTOMATION',
    items: [
      {
        saleItemId,
        name: itemName,
        quantity,
        price,
        amount: quantity * price,
      },
    ],
  };
}

function buildApiTestName(domain: string, maxLength: number, seed?: string | number): string {
  return createShortTestName({
    prefix: 'AT',
    domain,
    maxLength,
    seed: toShortSeed(seed, domain),
  });
}

function toShortSeed(seed: string | number | undefined, fallback: string): string {
  const normalized = String(seed ?? fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);

  return normalized || '0';
}

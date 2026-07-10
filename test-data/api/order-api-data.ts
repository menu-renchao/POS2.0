import { createShortTestName } from '../../api/core/test-data-id';
import type { ApiQueryParams } from '../../api/clients/client-path';
import type { ApiEntityId } from './menu-api-data';

export type OrderItemApiRequest = Record<string, unknown> & {
  saleItemId: ApiEntityId;
  displayName: string;
  quantity: number;
  price: number;
  totalAmount: number;
};

export type OrderApiRequest = Record<string, unknown> & {
  order: Record<string, unknown> & {
    customerName: string;
    orderItems: OrderItemApiRequest[];
  };
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
    userAuth: {
      userId: 1,
      sessionKey: 'mansuper',
    },
    order: {
      point: 0,
      callerId: false,
      crmMemberId: null,
      type: 'DINE_IN',
      status: 'ORDERED',
      currentUserId: 1,
      exemptAutoCharges: null,
      userId: 1,
      taxExempt: true,
      numOfGuests: 1,
      totalPrice: quantity * price,
      totalTips: 0,
      totalTax: 0,
      orderTax: [],
      roundingAmount: 0,
      printTicketWhenVoid: true,
      discountName: null,
      discountID: -1,
      discountRate: 0,
      discountRateType: 0,
      discountReason: null,
      chargeName: null,
      chargeID: -1,
      discount: 0,
      charge: 0,
      rewardDiscount: 0,
      loyaltyDiscount: false,
      customerName,
      orderItems: [
        {
          saleItemId,
          seatId: 0,
          displayName: itemName,
          quantity,
          originalSalePrice: price,
          price,
          totalAmount: quantity * price,
          displayText: null,
          status: 'ORDERED',
          taxExempt: true,
          rewardItem: false,
          isGiftItem: false,
          discount: 0,
          discountRate: 0,
          discountRateType: 0,
          charge: 0,
          taxSnapshot: true,
          orderItemTaxes: [],
        },
      ],
      subOrders: [{ seatNum: '1' }],
    },
    sendToKitchen: false,
    printReceipt: false,
    fetchOrder: true,
    fetchPayments: true,
  };
}

export function buildDefaultOrderListQuery(
  referenceDate: Date = new Date(),
  overrides: ApiQueryParams = {},
): ApiQueryParams {
  const date = formatDateOnly(referenceDate);

  return {
    startTime: `${date} 00:00:00`,
    endTime: `${date} 23:59:59`,
    pageNum: 1,
    pageSize: 10,
    ...overrides,
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

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

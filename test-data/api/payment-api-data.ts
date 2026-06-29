import type { ApiEntityId } from './menu-api-data';

export type PaymentRecordApiRequest = Record<string, unknown> & {
  orderId: ApiEntityId;
  amount: number;
};

export type TipApiRequest = Record<string, unknown> & {
  amount: number;
};

export function buildPaymentRecordRequest(orderId: ApiEntityId): PaymentRecordApiRequest {
  return {
    orderId,
    paymentMethod: 'CASH',
    paymentType: 'CASH',
    amount: 10,
    paidAmount: 10,
  };
}

export function buildTipRequest(amount = 1): TipApiRequest {
  return {
    amount,
  };
}

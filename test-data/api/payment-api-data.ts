import type { ApiEntityId } from './menu-api-data';

export type PaymentRecordApiRequest = Record<string, unknown> & {
  orderId: ApiEntityId;
  paymentRecord: Record<string, unknown> & {
    orderId: ApiEntityId;
    amount: number;
  };
};

export type TipApiRequest = Record<string, unknown> & {
  amount: number;
};

export function buildPaymentRecordRequest(orderId: ApiEntityId): PaymentRecordApiRequest {
  return {
    orderId,
    paymentRecord: {
      orderId,
      paymentType: 'CASH',
      type: 'CASH',
      amount: 10,
      paidAmount: 10,
      changeAmount: 0,
      tipAmount: 0,
      cashTipAmount: 0,
      multiplePayments: false,
      onlinePayment: false,
      clientPayment: false,
      status: 'PAID',
      staffId: 1,
    },
    printPaymentReceipt: false,
    userAuth: {
      userId: 1,
      userPasscode: '11',
      sessionKey: 'mansuper',
    },
  };
}

export function buildTipRequest(amount = 1): TipApiRequest {
  return {
    amount,
  };
}

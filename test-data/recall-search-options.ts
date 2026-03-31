type ValueOf<T> = T[keyof T];

export const RecallPaymentStatuses = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  semiPaid: 'Semi-Paid',
  offlinePayment: 'Offline Payment',
  pending: 'Pending',
} as const;

export const RecallOrderStatuses = {
  unpaid: 'Unpaid',
  inKitchen: 'In Kitchen',
  printed: 'Printed',
  semiPaid: 'Semi-Paid',
  paidBeforeDelivered: 'Paid B4 Delivered',
  paid: 'Paid',
  voided: 'Void',
  pending: 'Pending',
} as const;

export const RecallOrderTypes = {
  dineIn: 'Dine-in',
  pickUp: 'Pickup',
  toGo: 'To-go',
  delivery: 'Delivery',
} as const;

export const RecallPaymentTypes = {
  cash: 'Cash',
  card: 'Card',
  other: 'Other Payment Types',
  offlinePayment: 'Offline Payment',
} as const;

export const RecallProductLines = {
  mealKeyway: 'MealKeyway',
} as const;

export const RecallManualSearchTags = {
  orderNumber: 'Order No.',
  linkedOrderNumber: 'Linked Order No.',
  phoneNumber: 'Phone No.',
  last4Digits: 'Last 4 Digits',
  paymentAmount: 'Payment Amount',
  cardHolder: 'Card Holder',
  itemName: 'Item Name',
  tableName: 'Table Name',
} as const;

export type RecallPaymentStatus = ValueOf<typeof RecallPaymentStatuses> | (string & {});
export type RecallOrderStatus = ValueOf<typeof RecallOrderStatuses> | (string & {});
export type RecallOrderType = ValueOf<typeof RecallOrderTypes> | (string & {});
export type RecallPaymentType = ValueOf<typeof RecallPaymentTypes> | (string & {});
export type RecallProductLine = ValueOf<typeof RecallProductLines> | (string & {});
export type RecallManualSearchTag = ValueOf<typeof RecallManualSearchTags>;

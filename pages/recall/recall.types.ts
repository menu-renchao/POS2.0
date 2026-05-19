export type RecallCustomerInfo = {
  name: string;
  phone: string;
  address: string | null;
  note: string | null;
};

export type RecallMemberInfo = {
  entries: string[];
};

export type RecallOrderContext = {
  orderType: string | null;
  tableName: string | null;
  guestCount: string | null;
  serverName: string | null;
};

export type RecallOrderPaymentRecord = {
  method: string;
  amount: string | null;
  details: Record<string, string>;
};

export type RecallOrderItemAddition = {
  name: string;
  price?: string;
  subAdditions?: RecallOrderItemAddition[];
};

export type RecallOrderItem = {
  seat: string | null;
  sentTime: string | null;
  quantity: string | null;
  name: string;
  price: string | null;
  additions: RecallOrderItemAddition[];
};

export type RecallOrderDetails = {
  orderNumber: string;
  paymentStatus: string | null;
  customerInfo: RecallCustomerInfo | null;
  memberInfo: RecallMemberInfo | null;
  orderContext: RecallOrderContext;
  payments: RecallOrderPaymentRecord[];
  items: RecallOrderItem[];
  priceSummary: Record<string, number>;
};

import { type DeliveryOrderParams, type PickUpOrderParams } from '../flows/takeout.flow';

export const orderServiceMenu = {
  category: '全类型类',
  group: '自动化菜单组',
} as const;

export const orderServiceDishes = {
  regular: {
    saleItemId: 698,
    name: '普通菜1',
    menu: orderServiceMenu,
  },
  test: {
    name: '普通菜2',
    menu: orderServiceMenu,
  },
  categoryOption: {
    name: '普通菜2',
    menu: orderServiceMenu,
  },
} as const;

export const orderServiceCategoryOptions = {
  priced: {
    name: 'option1',
    expectedSubtotalDelta: 2,
  },
  freeNested: {
    name: 'free option',
    suboptionName: 'free suboption',
  },
} as const;

export const orderServiceEditRecallTaxCase = {
  editedTestDishQuantity: '2',
} as const;

export const orderServiceMultiDishQuantityCase = {
  multiDishFirstQuantity: 3,
  multiDishFirstRecallQuantity: '3',
  multiDishSecondRecallQuantity: '1',
  multiDishTotalCount: 4,
} as const;

export const orderServiceSplitEvenlyCase = {
  splitSuborderCount: 2,
} as const;

/** 分单页初始仅一个子单时展示为母单 x 的 x-1；序号 1 对应该子单，平分后出现 x-2、x-3 等。 */
export const orderServiceSplitByDishCase = {
  evenSplitSuborderIndex: '1',
  evenSplitCount: 2,
  expectedProportion: '1/2',
  moveAfterEvenOrderCount: 3,
  moveSourceSuborderIndex: '1',
  moveTargetSuborderIndex: '3',
} as const satisfies {
  evenSplitSuborderIndex: '1';
  evenSplitCount: number;
  expectedProportion: string;
  moveAfterEvenOrderCount: number;
  moveSourceSuborderIndex: '1';
  moveTargetSuborderIndex: '3';
};

export const orderServiceSplitByAmountCase = {
  firstAmount: 2,
  expectedSuborderCount: 2,
} as const;

export const orderServiceCancelSplitCase = {
  splitSuborderCount: 2,
} as const;

export const orderServiceSplitTipsCase = {
  changedDishPrice: 5,
  expectedTipAmount: 3,
  tipAmountInCents: 300,
  voidReason: 'POS-19362 子单删除后保留其他子单 tips',
} as const;

export const orderServiceCustomers = {
  delivery: {
    address: 'menusifu-test',
    customerName: 'pos-test',
    note: '我的备注',
    phoneNumber: '01234567890',
    street: '55',
    zipCode: '10016',
  } satisfies DeliveryOrderParams,
  deliveryWithAmpersandAddress: {
    address: 'menusifu & test address',
    customerName: 'pos-32903',
    note: 'POS-32903 地址备注',
    phoneNumber: '0329030001',
    street: '55',
    zipCode: '10016',
  } satisfies DeliveryOrderParams,
  pickupPhoneNumber: '01234567890',
} as const;

export function buildOrderServicePickupCustomer(): PickUpOrderParams {
  return {
    customerName: `pos-${Date.now()}`,
    phoneNumber: orderServiceCustomers.pickupPhoneNumber,
  };
}

export const orderServiceSplitOperationCase = {
  amountSplitFirstAmount: 2,
  changedDishPrice: 5,
  evenSplitUnsplitExpectedTip: 5,
  expectedModifiedTipAmount: 6,
  itemDiscountAmount: 5,
  itemDiscountRate: 10,
  multiAmountExpectedTotal: 20,
  multiAmountFirstSplitAmount: 10,
  multiAmountSecondSplitAmount: 10,
  multiAmountSplitChangedDishPrice: 18.18,
  multiPaymentAmountInCents: 1000,
  multiPaymentChangedDishPrice: 20,
  orderChargeClearRate: 5,
  orderChargeMergeRate: 10,
  transferredServerName: 'man',
  orderDiscountClearRate: 20,
  partialPaymentAmountInCents: 1,
  postPaymentTipAmountInCents: 100,
  postPaymentTipAmount: 1,
  redistributedFirstTipBefore: 4,
  redistributedTipAfter: 3,
  redistributedTipAmountInCents: 600,
  sharedItemVoidBlockingMessage: 'The order has paid dishes and can not be voided!',
  splitHalfPaidBlockingMessage:
    'The operation cannot be done due to partial payment! Please revoke the payment before preceeding.',
  tipAmountInCents: 500,
  tipAmount: 5,
  updatedTipAmountInCents: 600,
  updatedTipAmount: 6,
  voidReasonCount: 7,
  voidReason: '分单操作回归子单作废',
} as const;

export const orderServiceSeatDisplayConfigurationUpdate = {
  systemConfiguration: [
    {
      id: 294,
      name: 'IS_SHOW_SEATS',
      value: '0',
      dataType: 'String',
    },
  ],
  userAuth: {
    userId: 1,
  },
} as const;

export const orderPageRegressionCases = {
  itemDiscount: { rate: 10 },
  modifier: { name: 'POS-42888', price: 0 },
  specialPriceDiscount: { price: 5.85, rate: 50, expectedSubtotal: 2.92 },
  splitTips: { tipAmountInCents: 200, splitTip: 1, mergedTip: 2 },
  splitEvenly: { count: 2 },
  splitBySeats: { guestCount: 2 },
  splitByAmount: { changedPrice: 10.6, amounts: [2, 8.6] },
  combineDecimal: { quantity: 2.55 },
  pricedDecimal: { price: 6.5, quantity: 1.5, expectedLineCents: 975 },
} as const;

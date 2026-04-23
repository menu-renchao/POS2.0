import { type DeliveryOrderParams, type PickUpOrderParams } from '../flows/takeout.flow';

export const orderServiceMenu = {
  category: '全类型类',
  group: '自动化菜单组',
} as const;

export const orderServiceDishes = {
  regular: {
    name: '普通菜1',
    menu: orderServiceMenu,
  },
  test: {
    name: 'test',
    menu: orderServiceMenu,
  },
  categoryOption: {
    name: 'test',
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

export const orderServiceCustomers = {
  delivery: {
    address: 'menusifu-test',
    customerName: 'pos-test',
    note: '我的备注',
    phoneNumber: '01234567890',
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

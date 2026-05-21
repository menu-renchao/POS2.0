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

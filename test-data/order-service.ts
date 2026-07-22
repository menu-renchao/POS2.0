import { type DeliveryOrderParams, type PickUpOrderParams } from '../flows/takeout.flow';
import { createShortTestName } from '../api/core/test-data-id';

export const orderServiceMenu = {
  alternateGroup: 'Group 001',
  category: '全类型类',
  group: '自动化菜单组',
} as const;

export const orderServiceDishes = {
  regular: {
    expectedBasePrice: 8.8,
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
  alternateCategory: {
    name: 'superman item4',
    menu: {
      category: 'Category 001',
      group: 'Group 001',
    },
  },
} as const;

export const orderServiceCustomDeliveryPrintCase = {
  customOrderType: {
    displayName: 'Custom Delivery',
    name: 'CUSTOM_ORDER_TYPE1',
    shortName: 'CD',
  },
  customer: {
    address: '100 Main St',
    customerName: 'pos-test',
    phoneNumber: '01234567890',
  },
  dishes: [orderServiceDishes.regular, orderServiceDishes.test],
} as const;

export const orderServiceSplitChildDiscountCase = {
  orderLines: [
    orderServiceDishes.regular,
    orderServiceDishes.regular,
    orderServiceDishes.test,
  ],
  movedDishName: orderServiceDishes.test.name,
  targetSuborderIndex: 1,
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
  paidNested: {
    name: 'A',
    suboptionName: 'a1',
    expectedDishPrice: 9.8,
  },
} as const;

export const orderServiceComboOptionRemovalCase = {
  comboName: '套餐1',
  itemName: '普通菜1',
  itemIndex: 0,
  saleItemId: 698,
  sectionId: 3,
  initialOptions: ['A', 'a1', 'option1', 'free option'],
  firstRemovalOptions: ['A', 'option1', 'free option'],
  finalOptions: ['option1', 'free option'],
  initialPrice: 31.6,
  finalPrice: 30.6,
} as const;

export const orderServiceSearchMenuConfigurationCase = {
  configurationName: 'SEARCH_MENU',
  hiddenValue: false,
  query: 'superman',
  resultName: 'superman item4',
  resultTestId: 'menu-item-card-dsh1_0_697',
  visibleValue: true,
} as const;

export const orderServiceComboSubItemPriceCase = {
  changedPrice: 5.5,
  comboName: orderServiceComboOptionRemovalCase.comboName,
  initialSubItemPrice: orderServiceDishes.regular.expectedBasePrice,
  itemIndex: orderServiceComboOptionRemovalCase.itemIndex,
  saleItemId: orderServiceComboOptionRemovalCase.saleItemId,
  sectionId: orderServiceComboOptionRemovalCase.sectionId,
} as const;

export const orderServiceComboSubItemNotePermissionCase = {
  authorizationPasscode: '11',
  comboName: orderServiceComboSubItemPriceCase.comboName,
  comboSaleItemId: 1173,
  itemIndex: orderServiceComboSubItemPriceCase.itemIndex,
  note: '备注信息',
  optionName: orderServiceCategoryOptions.priced.name,
  saleItemId: orderServiceComboSubItemPriceCase.saleItemId,
  sectionId: orderServiceComboSubItemPriceCase.sectionId,
} as const;

export const orderServiceComboParentOptionCase = {
  comboName: orderServiceComboOptionRemovalCase.comboName,
  comboSubItem: {
    itemIndex: 1,
    name: orderServiceDishes.test.name,
    saleItemId: 699,
    sectionId: orderServiceComboOptionRemovalCase.sectionId,
  },
  parentOption: orderServiceCategoryOptions.priced.name,
  ordinaryDish: orderServiceDishes.regular,
  ordinaryOption: orderServiceCategoryOptions.paidNested,
} as const;

export function buildOrderServiceMenuProductModeCase() {
  const seed = Math.random().toString(36).slice(2, 8);
  const emenuSearchQuery = 'All you can eat item';
  const posSearchQuery = 'Broccoli Garlic Sauce';

  return {
    configurationName: 'MENU_PRODUCT_MODE',
    emenuCategoryName: createShortTestName({
      prefix: 'EM',
      domain: 'CATEGORY',
      maxLength: 24,
      seed,
    }),
    emenuDishName: `${emenuSearchQuery}_${seed.slice(0, 3)}`,
    emenuGroupName: createShortTestName({
      prefix: 'EM',
      domain: 'MENU_GROUP',
      maxLength: 24,
      seed,
    }),
    emenuMenuId: 2,
    emenuMode: 'EMENU',
    emenuSearchQuery,
    posCategoryId: 68,
    posDishName: `${posSearchQuery}_${seed.slice(0, 2)}`,
    posMenuGroupId: 45,
    posMenuId: 1,
    posMode: 'POS',
    posSearchQuery,
    price: 1,
  } as const;
}

export const orderServiceChineseInitialSearchCase = {
  query: 'ptc',
  resultName: '普通菜1',
  resultTestId: 'menu-item-card-dsh0_0_698',
} as const;

export const orderServiceOpenFoodChineseKeyboardCase = {
  configurationName: 'DEFAULT_KEYBOARD_TYPE',
  configurationValue: '0',
  initialLanguage: 'EN',
  name: '你',
  pinyinKeys: ['n', 'i'],
  price: 1,
  switchedLanguage: '中',
} as const;

export function buildOrderServiceCategoryPosNameCase() {
  const seed = Math.random().toString(36).slice(2, 8);

  return {
    backendName: createShortTestName({
      prefix: 'AT',
      domain: 'CATEGORY_NAME_A',
      maxLength: 24,
      seed,
    }),
    dishName: createShortTestName({
      prefix: 'AT',
      domain: 'CATEGORY_DISH',
      maxLength: 24,
      seed,
    }),
    menuGroupId: 45,
    menuGroupName: orderServiceMenu.group,
    menuId: 1,
    posName: createShortTestName({
      prefix: 'POS',
      domain: 'CATEGORY_NAME_B',
      maxLength: 24,
      seed,
    }),
    price: 1,
  } as const;
}

export function buildOrderServiceRequiredCategoryCase() {
  const seed = Math.random().toString(36).slice(2, 8);

  return {
    backendName: createShortTestName({
      prefix: 'AT',
      domain: 'REQUIRED_CATEGORY',
      maxLength: 24,
      seed,
    }),
    dishName: createShortTestName({
      prefix: 'AT',
      domain: 'REQUIRED_DISH',
      maxLength: 24,
      seed,
    }),
    menuGroupId: 45,
    menuGroupName: orderServiceMenu.group,
    menuId: 1,
    posName: createShortTestName({
      prefix: 'REQ',
      domain: 'CATEGORY',
      maxLength: 24,
      seed,
    }),
    price: 1,
  } as const;
}

export function buildOrderServiceOrderChargeExcludedCategoryCase() {
  const seed = Math.random().toString(36).slice(2, 8);

  return {
    backendName: createShortTestName({
      prefix: 'AT',
      domain: 'NO_ORDER_CHARGE',
      maxLength: 24,
      seed,
    }),
    dishNames: [
      createShortTestName({
        prefix: 'AT',
        domain: 'NO_CHARGE_DISH_A',
        maxLength: 24,
        seed,
      }),
      createShortTestName({
        prefix: 'AT',
        domain: 'NO_CHARGE_DISH_B',
        maxLength: 24,
        seed,
      }),
    ],
    dishPrices: [4, 6],
    menuGroupId: 45,
    menuGroupName: orderServiceMenu.group,
    menuId: 1,
    percentageCharge: 10,
    posName: createShortTestName({
      prefix: 'NOCHG',
      domain: 'CATEGORY',
      maxLength: 24,
      seed,
    }),
  } as const;
}

export const orderServiceSameNameAndNumberSearchCase = {
  categoryId: 68,
  itemNumber: 'AA',
  menuGroupId: 45,
  menuId: 1,
  name: 'AA',
  price: 10,
} as const;

export const orderServiceModifyGlobalOptionCase = {
  addExpectedQuantities: [1, 2],
  countExpectedQuantities: [1, 5, 0],
  countQuantity: 5,
  optionName: '加柴',
  reduceExpectedQuantities: [1, 2, 1, 0],
  reduceStartQuantity: 2,
} as const;

export const orderServiceSavedComboSubItemModifyCase = {
  comboName: orderServiceComboOptionRemovalCase.comboName,
  displayAllItems: [
    { itemIndex: 0, name: orderServiceDishes.regular.name, saleItemId: 698 },
    { itemIndex: 1, name: orderServiceDishes.test.name, saleItemId: 699 },
  ],
  modifierName: orderServiceModifyGlobalOptionCase.optionName,
  parentOption: orderServiceCategoryOptions.priced.name,
  sectionId: orderServiceComboOptionRemovalCase.sectionId,
  targetItemIndex: 1,
  targetSaleItemId: 699,
  targetSubItemName: orderServiceDishes.test.name,
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

export const orderServiceDeliveryInformationCase = {
  input: {
    address: 'huashengdun',
    customerName: 'baga',
    note: 'POS-30575 客户信息预填',
    phoneNumber: '9322222222',
    street: '123',
  } satisfies DeliveryOrderParams,
  expected: {
    customerButtonLabel:
      'baga (932)222-2222 huashengdun, 123, Flushing, NY, 11355 POS-30575 客户信息预填',
    informationText: '(932)222-2222huashengdun, Flushing, NY 11355',
    orderSummaryText: 'huashengdun, 123, Flushing, NY, 11355',
  },
} as const;

export function buildOrderServicePickupCustomer(): PickUpOrderParams {
  return {
    customerName: `pos-${Date.now()}`,
    phoneNumber: orderServiceCustomers.pickupPhoneNumber,
  };
}

export function buildAnonymousPickupEditCustomer(): {
  customerButtonLabel: string;
  customerName: string;
  phoneNumber: string;
} {
  const customerName = `pos-pickup-${Date.now()}`;
  const phoneNumber = '9322222222';

  return {
    customerButtonLabel: `${customerName} (932)222-2222`,
    customerName,
    phoneNumber,
  };
}

export function buildOrderServiceDineInCustomer(): {
  customerButtonLabel: string;
  customerName: string;
  phoneNumber: string;
} {
  const customerName = `pos-dine-in-${Date.now()}`;
  const phoneNumber = '9322222222';

  return {
    customerButtonLabel: `${customerName} (932)222-2222`,
    customerName,
    phoneNumber,
  };
}

export function buildRequiredPaymentCustomer(): { name: string; phone: string } {
  return {
    name: `AT${Date.now().toString().slice(-10)}`,
    phone: '(934)221-9925',
  };
}

export function buildOpenFoodWithoutTaxCase(): { name: string; price: number } {
  return {
    name: `OF${Date.now().toString().slice(-10)}`,
    price: 1,
  };
}

export const orderServiceKitchenVoidPermissionCase = {
  authorizationPasscode: '11',
  delayInMillis: 3_600_000,
  expectedVoidMarker: 'VOIDED',
} as const;

export const orderServiceSameDishSeparateCase = {
  configuration: {
    BREAK_OR_COMBIN_SAME_DISHES: true,
    COMBINE_THE_SAME_DISHES: '0',
  },
  expectedLineCount: 3,
  expectedQuantityPerLine: '1',
} as const;

export const orderServiceSameDishStatusCombineCase = {
  configuration: {
    BREAK_OR_COMBIN_SAME_DISHES: false,
    COMBINE_THE_SAME_DISHES: '1',
  },
  expectedLineCount: 2,
  newDishAdds: 2,
  pendingQuantity: '2',
  sentQuantity: '1',
} as const;

export const orderServiceSameDishKitchenCombineCase = {
  configuration: {
    BREAK_OR_COMBIN_SAME_DISHES: false,
    COMBINE_THE_SAME_DISHES: '2',
  },
  expectedDishNameColor: 'rgb(130, 0, 20)',
  expectedKitchenQuantity: 1,
  expectedLineCount: 1,
  expectedTotalQuantity: '2',
  newDishAdds: 1,
} as const;

export const orderServiceReduceCategoryCase = {
  configuration: {
    AUTOMATICALLY_REDIRECT_AFTER_REDUCE_ITEMS: false,
  },
  expectedCategory: orderServiceDishes.alternateCategory.menu.category,
} as const;

export const orderServiceDecimalReduceCase = {
  configuration: {
    ORDER_COUNT_CAN_BE_DECIMAL: true,
  },
  expectedAfterFirstReduce: '0.25',
  initialQuantity: 1.25,
} as const;

export const orderServiceDecimalSplitCase = {
  configuration: {
    ORDER_COUNT_CAN_BE_DECIMAL: true,
  },
  expectedLinePrice: 22.44,
  quantity: 2.55,
} as const;

export const orderServicePresetItemDiscountCases = {
  regularPrice: {
    authorizationPasscode: '11',
    discountRate: 10,
    expectedSubtotal: 7.92,
  },
  specialPrice: {
    authorizationPasscode: '11',
    discountRate: 50,
    expectedSubtotal: 2.92,
    price: 5.85,
  },
} as const;

export function buildOrderServicePhysicalGiftCardCase(): {
  cardNumber: string;
  customerName: string;
  expectedPhoneNumber: string;
  phoneNumber: string;
} {
  const suffix = Date.now().toString().slice(-9);

  return {
    cardNumber: `990${suffix}`,
    customerName: `AT Gift ${suffix.slice(-6)}`,
    expectedPhoneNumber: '(254)429-6158',
    phoneNumber: '2544296158',
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
  modifier: { name: 'POS-42888', price: 0 },
  splitTips: { tipAmountInCents: 200, splitTip: 1, mergedTip: 2 },
  splitEvenly: { count: 2 },
  splitBySeats: { guestCount: 2 },
  splitByAmount: { changedPrice: 10.6, amounts: [2, 8.6] },
  combineDecimal: { quantity: 2.55 },
  pricedDecimal: { price: 6.5, quantity: 1.5, expectedLineCents: 975 },
  pricedDecimalWithTwoAdditions: {
    additionalDishCount: 2,
    configuration: { ORDER_COUNT_CAN_BE_DECIMAL: true },
    expectedLineCents: 1658,
    price: 6.5,
    quantity: 2.55,
  },
  decimalRecallPersistence: {
    configuration: { ORDER_COUNT_CAN_BE_DECIMAL: true },
    expectedLineCents: 2244,
    quantity: 2.55,
  },
  decimalModifierPersistence: {
    configuration: {
      BREAK_OR_COMBIN_SAME_DISHES: false,
      COMBINE_THE_SAME_DISHES: '1',
      ORDER_COUNT_CAN_BE_DECIMAL: true,
    },
    expectedLineCents: 1829,
    modifierQuantity: 2,
    price: 7.95,
    quantity: 2.3,
  },
} as const;

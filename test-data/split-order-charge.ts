import type { ChargeSetupOverrides } from './api/admin-config-api-data';
import { createShortTestName } from '../api/core/test-data-id';
import { orderServiceDishes } from './order-service';

export type ChargeExpectedAmount =
  | '5.00'
  | '10.00'
  | '20.00'
  | 'percent10'
  | 'percent20';

export type ChargeCopySource = 'auto' | 'manual' | 'delivery-auto';

export type ChargeCopyCase = {
  issue: `POS-${number}`;
  title: string;
  initialCharge: ChargeSetupOverrides;
  source: ChargeCopySource;
  updateCharge: ChargeSetupOverrides;
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
  expectedChargeAvailable: boolean;
};

export type ApiWholeChargeSeed = {
  charge: ChargeSetupOverrides;
  resource: { id: string | number; name: string };
};

export type CombineChargeScenario =
  | 'single-auto'
  | 'single-manual'
  | 'no-existing-charge'
  | 'three-charges';

export type CombineChargeRecalculationCase = {
  issue: `POS-${number}`;
  title: string;
  recalculate: boolean;
  scenario: CombineChargeScenario;
  charge: ChargeSetupOverrides;
  firstOrderType: 'dine-in' | 'delivery';
  targetOrderType?: 'dine-in' | 'to-go';
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
  expectedChargeAvailable: boolean;
  coversTip?: boolean;
  preservesSourceChargeAmount?: boolean;
};

export type ChargeEditCase = {
  confirmUpdatedCharge?: boolean;
  issue: `POS-${number}`;
  title: string;
  initialCharge: ChargeSetupOverrides;
  source?: 'manual' | 'auto';
  updateCharge?: ChargeSetupOverrides;
  deleteCharge?: boolean;
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
  expectedChargeAvailable: boolean;
  expectedTaxIncreases?: boolean;
};

export type ChargeFollowUpOperation =
  | 'detail-send'
  | 'edit-send'
  | 'edit-save'
  | 'detail-even-split'
  | 'edit-item-split'
  | 'edit-even-split';

export type ChargeFollowUpCase = {
  issue: `POS-${number}`;
  title: string;
  initialCharge: ChargeSetupOverrides;
  source: 'manual' | 'auto';
  operation: ChargeFollowUpOperation;
  updateCharge: ChargeSetupOverrides;
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
};

export type ChargeTransferOperation =
  | 'move-item-new-order'
  | 'move-item-existing-order'
  | 'move-whole-order-after-update'
  | 'move-whole-order-after-delete';

export type ChargeTransferCase = {
  issue: `POS-${number}`;
  title: string;
  initialCharge: ChargeSetupOverrides;
  source: 'manual' | 'auto';
  operation: ChargeTransferOperation;
  updateCharge?: ChargeSetupOverrides;
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
  expectedTargetChargeAvailable: boolean;
};

export function createIsolatedCombineChargeCase(
  chargeCase: CombineChargeRecalculationCase,
): CombineChargeRecalculationCase {
  const chargeName = createShortTestName({
    prefix: 'BC',
    domain: chargeCase.issue,
    maxLength: 16,
  });

  return {
    ...chargeCase,
    charge: {
      ...chargeCase.charge,
      name: chargeName,
    },
    expectedChargeName:
      chargeCase.expectedChargeName === chargeCase.charge.name
        ? chargeName
        : chargeCase.expectedChargeName,
  };
}

export function createIsolatedChargeEditCase(
  chargeCase: ChargeEditCase,
): ChargeEditCase {
  const initialName = createShortTestName({
    prefix: 'AC',
    domain: chargeCase.issue,
    maxLength: 16,
  });
  const renamesCharge =
    chargeCase.updateCharge?.name !== undefined &&
    chargeCase.updateCharge.name !== chargeCase.initialCharge.name;
  const updatedName = renamesCharge
    ? createShortTestName({
        prefix: 'AU',
        domain: chargeCase.issue,
        maxLength: 16,
      })
    : initialName;
  const expectedChargeName =
    chargeCase.expectedChargeName === chargeCase.initialCharge.name
      ? initialName
      : chargeCase.expectedChargeName === chargeCase.updateCharge?.name
        ? updatedName
        : chargeCase.expectedChargeName;

  return {
    ...chargeCase,
    initialCharge: {
      ...chargeCase.initialCharge,
      name: initialName,
    },
    expectedChargeName,
    ...(chargeCase.updateCharge
      ? {
          updateCharge: {
            ...chargeCase.updateCharge,
            name: updatedName,
          },
        }
      : {}),
  };
}

export function createIsolatedChargeFollowUpCase(
  chargeCase: ChargeFollowUpCase,
): ChargeFollowUpCase {
  const initialName = createShortTestName({
    prefix: 'FC',
    domain: chargeCase.issue,
    maxLength: 16,
  });
  const renamesCharge =
    chargeCase.updateCharge.name !== chargeCase.initialCharge.name;
  const updatedName = renamesCharge
    ? createShortTestName({
        prefix: 'FU',
        domain: chargeCase.issue,
        maxLength: 16,
      })
    : initialName;
  const expectedChargeName =
    chargeCase.expectedChargeName === chargeCase.initialCharge.name
      ? initialName
      : chargeCase.expectedChargeName === chargeCase.updateCharge.name
        ? updatedName
        : chargeCase.expectedChargeName;

  return {
    ...chargeCase,
    initialCharge: {
      ...chargeCase.initialCharge,
      name: initialName,
    },
    updateCharge: {
      ...chargeCase.updateCharge,
      name: updatedName,
    },
    expectedChargeName,
  };
}

export function createIsolatedChargeCopyCase(
  chargeCase: ChargeCopyCase,
): ChargeCopyCase {
  const initialName = createShortTestName({
    prefix: 'CC',
    domain: chargeCase.issue,
    maxLength: 16,
  });
  const renamesCharge =
    chargeCase.updateCharge.name !== chargeCase.initialCharge.name;
  const updatedName = renamesCharge
    ? createShortTestName({
        prefix: 'CU',
        domain: chargeCase.issue,
        maxLength: 16,
      })
    : initialName;
  const expectedChargeName =
    chargeCase.expectedChargeName === chargeCase.initialCharge.name
      ? initialName
      : chargeCase.expectedChargeName === chargeCase.updateCharge.name
        ? updatedName
        : chargeCase.expectedChargeName;

  return {
    ...chargeCase,
    initialCharge: {
      ...chargeCase.initialCharge,
      name: initialName,
    },
    updateCharge: {
      ...chargeCase.updateCharge,
      name: updatedName,
    },
    expectedChargeName,
  };
}

export function createIsolatedChargeTransferCase(
  chargeCase: ChargeTransferCase,
): ChargeTransferCase {
  const initialName = createShortTestName({
    prefix: 'TC',
    domain: chargeCase.issue,
    maxLength: 16,
  });
  const renamesCharge =
    chargeCase.updateCharge?.name !== undefined &&
    chargeCase.updateCharge.name !== chargeCase.initialCharge.name;
  const updatedName = renamesCharge
    ? createShortTestName({
        prefix: 'TU',
        domain: chargeCase.issue,
        maxLength: 16,
      })
    : initialName;
  const expectedChargeName =
    chargeCase.expectedChargeName === chargeCase.initialCharge.name
      ? initialName
      : chargeCase.expectedChargeName === chargeCase.updateCharge?.name
        ? updatedName
        : chargeCase.expectedChargeName;

  return {
    ...chargeCase,
    initialCharge: {
      ...chargeCase.initialCharge,
      name: initialName,
    },
    expectedChargeName,
    ...(chargeCase.updateCharge
      ? {
          updateCharge: {
            ...chargeCase.updateCharge,
            name: updatedName,
          },
        }
      : {}),
  };
}

export const manualFixedChargeName = 'manu_test_fixed';

export const manualPercentChargeName = 'manu_test_perc';

export const manualFixedCharge: ChargeSetupOverrides = {
  name: manualFixedChargeName,
  rate: 10,
  rateType: 1,
  triggerMode: 2,
  taxed: false,
  type: 'DEFAULT',
  orderType: 'dine in',
};

export const manualPercentCharge: ChargeSetupOverrides = {
  name: manualPercentChargeName,
  rate: 10,
  rateType: 2,
  triggerMode: 2,
  taxed: false,
  type: 'DEFAULT',
  orderType: 'dine in',
};

export const autoFixedChargeName = 'auto_test_fixed';

export const autoPercentChargeName = 'auto_test_perc';

export const autoFixedCharge: ChargeSetupOverrides = {
  name: autoFixedChargeName,
  rate: 10,
  rateType: 1,
  triggerMode: 1,
  taxed: false,
  type: 'DEFAULT',
  orderType: 'dine in',
};

export const autoPercentCharge: ChargeSetupOverrides = {
  name: autoPercentChargeName,
  rate: 10,
  rateType: 2,
  triggerMode: 1,
  taxed: false,
  type: 'DEFAULT',
  orderType: 'dine in',
};

export function buildDineInOrderWithWholeChargeRequest(
  chargeResource: { id: string | number; name: string },
  charge: ChargeSetupOverrides,
  dishCount = 1,
): Record<string, unknown> {
  const unitPrice = 8.8;
  const unitTax = 0.88;
  const subtotal = Number((unitPrice * dishCount).toFixed(2));
  const tax = Number((unitTax * dishCount).toFixed(2));
  const chargeRate = charge.rate ?? 10;
  const chargeRateType = charge.rateType ?? 1;
  const chargeAmount =
    chargeRateType === 2
      ? Number(((subtotal * chargeRate) / 100).toFixed(2))
      : Number(chargeRate.toFixed(2));
  const chargeId = Number(chargeResource.id);
  const chargeName = charge.name ?? chargeResource.name;

  return {
    userAuth: {
      userId: 1,
      sessionKey: 'mansuper',
    },
    order: {
      point: 0,
      needCommit: 0,
      createTime: Date.now(),
      callerId: false,
      crmMemberId: '',
      crmCustomerInfo: '{}',
      type: 'DINE_IN',
      status: 'ORDERED',
      currentUserId: 1,
      discountList: '[]',
      orderCharges: [
        {
          chargeID: chargeId,
          id: chargeId,
          chargeName,
          chargeRateType,
          chargeRate,
          taxed: charge.taxed ?? false,
          taxCharge: 0,
          charge: chargeAmount,
          chargeBeforeCd: chargeAmount,
          triggerMode: charge.triggerMode ?? 1,
          type: charge.type ?? 'DEFAULT',
        },
      ],
      exemptAutoCharges: '',
      userId: 1,
      taxExempt: false,
      numOfGuests: 1,
      totalPrice: subtotal,
      totalTips: 0,
      totalTax: tax.toFixed(2),
      orderTax: [{ taxId: 3, taxAmount: tax }],
      roundingAmount: 0,
      printTicketWhenVoid: true,
      discountName: '',
      discountID: -1,
      discountRate: 0,
      discountRateType: 0,
      discountReason: '',
      chargeName,
      chargeID: chargeId,
      discount: 0,
      charge: chargeAmount,
      inheritCharge: chargeAmount,
      rewardDiscount: 0,
      loyaltyDiscount: false,
      subOrders: [{ seatNum: 1 }],
      orderItems: Array.from({ length: dishCount }, () => ({
        saleItemId: orderServiceDishes.regular.saleItemId,
        seatId: 0,
        quantity: 1,
        courseNumber: '',
        originalSalePrice: unitPrice,
        originDualPrice: unitPrice,
        price: unitPrice,
        displayText: '',
        status: 'ORDERED',
        taxExempt: false,
        useBenefitPrice: false,
        discountList: '[]',
        rewardItem: false,
        isGiftItem: false,
        discount: 0,
        discountRate: 0,
        discountRateType: 0,
        charge: 0,
        chargeTaxed: false,
        chargeRateType: 0,
        chargeRate: 0,
        taxSnapshot: true,
        orderItemTaxes: [
          {
            taxId: 3,
            taxAmount: unitTax,
            taxName: '10',
            taxRate: 10,
            outTaxRate: 10,
            taxIncrease: 'DEFAULT',
            priceLimit: 0,
            taxIncreaseRate: 0,
          },
        ],
      })),
    },
    fetchOrder: true,
    fetchPayments: true,
  };
}

export function buildDineInOrderWithWholeChargesRequest(
  chargeSeeds: readonly ApiWholeChargeSeed[],
  dishCount = 1,
): Record<string, unknown> {
  const firstChargeSeed = chargeSeeds[0];

  if (!firstChargeSeed) {
    throw new Error('API 创建订单至少需要一条整单加收。');
  }

  const request = buildDineInOrderWithWholeChargeRequest(
    firstChargeSeed.resource,
    firstChargeSeed.charge,
    dishCount,
  );
  const order = request.order as Record<string, unknown>;
  const subtotal = Number((8.8 * dishCount).toFixed(2));
  const orderCharges = chargeSeeds.map(({ charge, resource }) => {
    const chargeRate = charge.rate ?? 10;
    const chargeRateType = charge.rateType ?? 1;
    const chargeAmount =
      chargeRateType === 2
        ? Number(((subtotal * chargeRate) / 100).toFixed(2))
        : Number(chargeRate.toFixed(2));
    const chargeId = Number(resource.id);

    return {
      chargeID: chargeId,
      id: chargeId,
      chargeName: charge.name ?? resource.name,
      chargeRateType,
      chargeRate,
      taxed: charge.taxed ?? false,
      taxCharge: 0,
      charge: chargeAmount,
      chargeBeforeCd: chargeAmount,
      triggerMode: charge.triggerMode ?? 1,
      type: charge.type ?? 'DEFAULT',
    };
  });
  const totalCharge = orderCharges.reduce(
    (sum, charge) => sum + charge.charge,
    0,
  );

  order.orderCharges = orderCharges;
  order.charge = Number(totalCharge.toFixed(2));
  order.inheritCharge = Number(totalCharge.toFixed(2));

  return request;
}

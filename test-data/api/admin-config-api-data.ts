import { createShortTestName } from '../../api/core/test-data-id';

export type TaxSetupOverrides = {
  name?: string;
  rate?: number;
  outRate?: number;
  taxIncrease?: string;
};

export type DiscountSetupOverrides = {
  name?: string;
  rate?: number;
  rateType?: number;
  description?: string;
};

export type ChargeSetupOverrides = {
  id?: string | number;
  chargeId?: string | number;
  name?: string;
  rate?: number;
  rateType?: number;
  type?: 'DEFAULT' | 'SERVICE' | 'DELIVERY' | 'ONLINE' | string;
  description?: string;
  minGuest?: number;
  minMileage?: number;
  minConsumption?: number;
  triggerMode?: number;
  taxed?: boolean;
  sharedTip?: boolean;
  orderType?: string;
  active?: boolean;
};

export function buildTaxSetupRequest(overrides: TaxSetupOverrides = {}) {
  const name = overrides.name ?? buildSetupName('TAX');
  const rate = overrides.rate ?? 1;

  return {
    tax: {
      name,
      rate,
      outRate: overrides.outRate ?? rate,
      taxIncrease: overrides.taxIncrease ?? 'DEFAULT',
    },
  };
}

export function buildDiscountSetupRequest(overrides: DiscountSetupOverrides = {}) {
  const name = overrides.name ?? buildSetupName('DSC');

  return {
    name,
    rate: overrides.rate ?? 10,
    rateType: overrides.rateType ?? 2,
    description: overrides.description ?? name,
  };
}

export function buildChargeSetupRequest(overrides: ChargeSetupOverrides = {}) {
  const name = overrides.name ?? buildSetupName('CHG');

  return {
    charge: {
      name,
      rate: overrides.rate ?? 1,
      rateType: overrides.rateType ?? 2,
      type: overrides.type ?? 'DEFAULT',
      description: overrides.description ?? name,
      triggerMode: overrides.triggerMode ?? 2,
      taxed: overrides.taxed ?? false,
      sharedTip: overrides.sharedTip ?? false,
      active: overrides.active ?? true,
      ...(overrides.id !== undefined ? { id: overrides.id } : {}),
      ...(overrides.chargeId !== undefined ? { chargeId: overrides.chargeId } : {}),
      ...(overrides.minGuest !== undefined ? { minGuest: overrides.minGuest } : {}),
      ...(overrides.minMileage !== undefined ? { minMileage: overrides.minMileage } : {}),
      ...(overrides.minConsumption !== undefined
        ? { minConsumption: overrides.minConsumption }
        : {}),
      ...(overrides.orderType !== undefined
        ? { orderType: normalizeChargeOrderTypes(overrides.orderType) }
        : {}),
    },
  };
}

function normalizeChargeOrderTypes(value: string): string {
  return value
    .split(',')
    .map((orderType) => orderType.trim().replace(/\s+/g, '_').toUpperCase())
    .filter(Boolean)
    .join(',');
}

function buildSetupName(domain: string): string {
  return createShortTestName({
    prefix: 'AT',
    domain,
    maxLength: 16,
  });
}

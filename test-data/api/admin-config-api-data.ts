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

function buildSetupName(domain: string): string {
  return createShortTestName({
    prefix: 'AT',
    domain,
    maxLength: 16,
  });
}

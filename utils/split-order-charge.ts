import type {
  OrderChargeSnapshot,
  OrderPriceSummary,
} from '../pages/order-dishes/order-dishes.types';
import type { ChargeExpectedAmount } from '../test-data/split-order-charge';
import { escapeRegExp } from './text';

export function readChargeAmountFromDetailsText(
  detailsText: string,
  chargeName: string,
): number | null {
  const normalizedText = detailsText.replace(/\s+/g, ' ').trim();
  const match = normalizedText.match(
    new RegExp(
      `${escapeRegExp(chargeName)}\\s+\\$([\\d,.]+)`,
      'i',
    ),
  );
  const amount = Number(match?.[1]?.replace(/,/g, '') ?? Number.NaN);

  return Number.isNaN(amount) ? null : amount;
}

export function readWholeChargeAmountText(
  chargeSnapshot: OrderChargeSnapshot,
  chargeName: string,
): string | null {
  return (
    [...chargeSnapshot.wholeOrderCharges]
      .reverse()
      .find((charge) => charge.name === chargeName)?.amountText ?? null
  );
}

export function resolveExpectedChargeAmount(
  expectedAmount: ChargeExpectedAmount,
  summary: Record<string, number>,
): number {
  if (expectedAmount === 'percent10') {
    return Number((summary.Subtotal * 0.1).toFixed(2));
  }

  if (expectedAmount === 'percent20') {
    return Number((summary.Subtotal * 0.2).toFixed(2));
  }

  return Number(expectedAmount);
}

export function parseChargeAmountText(
  amountText: string | null,
): number | null {
  if (!amountText) {
    return null;
  }

  const amount = Number(amountText.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

export type BeforeChargeSnapshotCarrier = {
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: OrderPriceSummary;
};

export function hasBeforeChargeSnapshot(
  value: object,
): value is BeforeChargeSnapshotCarrier {
  return (
    'beforeChargeSnapshot' in value &&
    typeof value.beforeChargeSnapshot === 'object' &&
    value.beforeChargeSnapshot !== null &&
    'beforeSummary' in value &&
    typeof value.beforeSummary === 'object' &&
    value.beforeSummary !== null
  );
}

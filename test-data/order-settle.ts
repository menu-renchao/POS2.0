export const orderSettleConfiguration = {
  roundingName: 'ORDER_TOTAL_ROUNDING_STRATEGY',
  noRounding: 'NO_ROUNDING',
} as const;

export const orderSettleAmounts = {
  noRoundingDishPrice: 10.01,
  firstPartialPaymentInCents: 500,
  firstTipInCents: 100,
  secondTipInCents: 200,
} as const;


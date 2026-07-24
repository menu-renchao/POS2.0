export function parseCurrencyAmount(
  value: string | null | undefined,
): number {
  if (!value) {
    throw new Error('货币金额为空，无法解析。');
  }

  const parsed = Number(value.replace(/[$,]/g, ''));

  if (Number.isNaN(parsed)) {
    throw new Error(`无法解析货币金额：${value}`);
  }

  return parsed;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeOrderNumber(
  value: string | null | undefined,
): string {
  return String(value ?? '')
    .trim()
    .replace(/^#\s*/, '')
    .replace(/\(\d+\)$/, '')
    .trim();
}

export function formatOrderNumber(
  value: string | null | undefined,
): string {
  return `#${normalizeOrderNumber(value)}`;
}

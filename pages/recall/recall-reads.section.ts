import type { Locator, Page } from '@playwright/test';
import type { RecallManualSearchTag } from '../../test-data/recall-search-options';

/** 页面同时暴露 data-testid 与 data-test-id 时的单一 locator 契约。 */
export function recallScopedTestId(scope: Locator | Page, testId: string): Locator {
  return scope.locator(`[data-testid="${testId}"], [data-test-id="${testId}"]`).first();
}

export function normalizeOrderNumber(orderNumber: string): string {
  const normalizedOrderNumber = orderNumber
    .trim()
    .replace(/^#/, '')
    .replace(/\(\d+\)$/, '');
  return `#${normalizedOrderNumber}`;
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveManualSearchTagTestId(tag: RecallManualSearchTag): string {
  switch (tag) {
    case 'Order No.':
      return 'recall2-search-type-option-orderNo';
    case 'Linked Order No.':
      return 'recall2-search-type-option-linkedNo';
    case 'Phone No.':
      return 'recall2-search-type-option-phoneNo';
    case 'Last 4 Digits':
      return 'recall2-search-type-option-last4Digts';
    case 'Payment Amount':
      return 'recall2-search-type-option-total';
    case 'Card Holder':
      return 'recall2-search-type-option-cardHolder';
    case 'Item Name':
      return 'recall2-search-type-option-itemName';
    case 'Table Name':
      return 'recall2-search-type-option-tableName';
    default:
      throw new Error(`Unsupported Recall manual search tag: ${tag}`);
  }
}

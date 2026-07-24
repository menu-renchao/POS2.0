import type { Locator, Page } from '@playwright/test';
import type { RecallManualSearchTag } from '../../test-data/recall-search-options';

/** Recall 共享组件统一使用 data-testid 作为稳定 DOM 契约。 */
export function recallScopedTestId(scope: Locator | Page, testId: string): Locator {
  return scope.getByTestId(testId);
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

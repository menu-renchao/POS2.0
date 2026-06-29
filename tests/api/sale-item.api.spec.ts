import { expect, test } from '@playwright/test';
import { API_SPEC_FILES, firstBatchApiCases } from '../../api/contracts/first-batch-api-cases';

test.describe('商品和 SPU 库存接口', () => {
  test('应已登记商品和 SPU 接口覆盖入口', () => {
    const cases = firstBatchApiCases.filter((apiCase) => apiCase.specFile === API_SPEC_FILES.saleItem);

    expect(cases.length).toBeGreaterThan(0);
  });
});

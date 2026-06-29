import { expect, test } from '@playwright/test';
import { API_SPEC_FILES, firstBatchApiCases } from '../../api/contracts/first-batch-api-cases';

test.describe('后台配置接口', () => {
  test('应已登记后台配置接口覆盖入口', () => {
    const cases = firstBatchApiCases.filter(
      (apiCase) => apiCase.specFile === API_SPEC_FILES.adminConfig,
    );

    expect(cases.length).toBeGreaterThan(0);
  });
});

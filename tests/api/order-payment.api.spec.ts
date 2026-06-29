import { expect, test } from '@playwright/test';
import { API_SPEC_FILES, firstBatchApiCases } from '../../api/contracts/first-batch-api-cases';

test.describe('订单和支付接口', () => {
  test('应已登记订单和支付接口覆盖入口', () => {
    const cases = firstBatchApiCases.filter(
      (apiCase) => apiCase.specFile === API_SPEC_FILES.orderPayment,
    );

    expect(cases.length).toBeGreaterThan(0);
  });
});

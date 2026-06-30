import { expect } from '@playwright/test';
import { shouldRunContractSmokeCase } from '../../../api/contracts/contract-smoke-coverage';
import { firstBatchApiCases } from '../../../api/contracts/first-batch-api-cases';
import { test } from '../../../fixtures/api.fixture';

test.describe('首批接口契约冒烟', () => {
  for (const apiCase of firstBatchApiCases.filter((entry) =>
    shouldRunContractSmokeCase(entry.coverage),
  )) {
    test(`${apiCase.group} ${apiCase.method} ${apiCase.path} 不应返回 500`, async ({ apiRequest }) => {
      const path = apiCase.path.replace(/\{[^}]+\}/g, '0').replace(/^\/+/, '');
      const response = await apiRequest.fetch(path, {
        method: apiCase.method,
        data: apiCase.method === 'POST' || apiCase.method === 'PUT' ? {} : undefined,
      });

      expect(response.status(), `${apiCase.method} ${apiCase.path} 不应返回 500`).not.toBe(500);
    });
  }
});

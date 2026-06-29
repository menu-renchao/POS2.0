import { expect } from '@playwright/test';
import { firstBatchApiCases } from '../../api/contracts/first-batch-api-cases';
import { test } from '../../fixtures/api.fixture';

const CONTRACT_COVERAGE_LEVELS = [
  'contract-only',
  'deferred-external',
  'blocked-missing-data',
] as const;

test.describe('首批接口契约冒烟', () => {
  for (const apiCase of firstBatchApiCases.filter((entry) => isContractCoverage(entry.coverage))) {
    test(`${apiCase.group} ${apiCase.method} ${apiCase.path} 不应返回 500`, async ({
      apiConfig,
      apiRequest,
    }) => {
      test.skip(
        apiCase.method !== 'GET' && !apiConfig.enableDestructive,
        '需要 API_ENABLE_DESTRUCTIVE=true 才能执行写接口契约冒烟。',
      );

      const path = apiCase.path.replace(/\{[^}]+\}/g, '0').replace(/^\/+/, '');
      const response = await apiRequest.fetch(path, {
        method: apiCase.method,
        data: apiCase.method === 'POST' || apiCase.method === 'PUT' ? {} : undefined,
      });

      expect(response.status(), `${apiCase.method} ${apiCase.path} 不应返回 500`).not.toBe(500);
    });
  }
});

function isContractCoverage(
  coverage: (typeof firstBatchApiCases)[number]['coverage'],
): coverage is (typeof CONTRACT_COVERAGE_LEVELS)[number] {
  return CONTRACT_COVERAGE_LEVELS.some((level) => level === coverage);
}

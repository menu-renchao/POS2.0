import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import {
  ALLOWED_API_GROUPS,
  API_SPEC_FILES,
  firstBatchApiCases,
  type ApiCoverageLevel,
} from '../../api/contracts/first-batch-api-cases';

const NON_POSITIVE_COVERAGE_LEVELS: readonly ApiCoverageLevel[] = [
  'contract-only',
  'deferred-external',
  'blocked-missing-data',
];

test.describe('首批接口覆盖矩阵', () => {
  test('应包含 112 个首批接口记录', () => {
    expect(firstBatchApiCases).toHaveLength(112);
  });

  test('每条接口记录都应声明覆盖等级和用例文件', () => {
    const allowedSpecFiles = Object.values(API_SPEC_FILES);

    for (const apiCase of firstBatchApiCases) {
      expect(apiCase.method).toMatch(/^(GET|POST|PUT|DELETE)$/);
      expect(apiCase.path.startsWith('/api/')).toBe(true);
      expect(ALLOWED_API_GROUPS).toContain(apiCase.group);
      expect(apiCase.coverage).toMatch(/^(positive-crud|positive-business|contract-only|deferred-external|blocked-missing-data)$/);
      expect(allowedSpecFiles).toContain(apiCase.specFile);

      if (NON_POSITIVE_COVERAGE_LEVELS.includes(apiCase.coverage)) {
        expect(apiCase.specFile).toBe(API_SPEC_FILES.contractSmoke);
      } else {
        expect(apiCase.specFile).not.toBe(API_SPEC_FILES.contractSmoke);
      }
    }
  });

  test('每个声明的用例文件都应存在', () => {
    for (const specFile of Object.values(API_SPEC_FILES)) {
      expect(existsSync(specFile), `${specFile} 应存在`).toBe(true);
    }
  });

  test('每条接口记录的方法和路径组合都应唯一', () => {
    const apiCaseKeys = firstBatchApiCases.map((apiCase) => `${apiCase.method} ${apiCase.path}`);

    expect(new Set(apiCaseKeys).size).toBe(firstBatchApiCases.length);
  });
});

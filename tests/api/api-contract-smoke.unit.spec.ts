import { expect, test } from '@playwright/test';
import { shouldRunContractSmokeCase } from '../../api/contracts/contract-smoke-coverage';

test.describe('首批接口契约冒烟策略', () => {
  test('缺少稳定测试数据的接口不应执行契约冒烟请求', () => {
    expect(shouldRunContractSmokeCase('blocked-missing-data')).toBe(false);
  });

  test('契约类和外部依赖类接口应保留契约冒烟请求', () => {
    expect(shouldRunContractSmokeCase('contract-only')).toBe(true);
    expect(shouldRunContractSmokeCase('deferred-external')).toBe(true);
  });
});

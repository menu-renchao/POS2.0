import { expect, test } from '@playwright/test';
import { createShortTestName } from '../../api/core/test-data-id';
import { ResourceRegistry } from '../../api/core/resource-registry';

test.describe('API 测试资源登记', () => {
  test('应生成保留 AT_ 前缀且不超过最大长度的测试名称', () => {
    const name = createShortTestName({ prefix: 'AT', domain: 'MENU_GROUP', maxLength: 12, seed: 'A7' });

    expect(name.startsWith('AT_')).toBe(true);
    expect(name.length).toBeLessThanOrEqual(12);
  });

  test('最大长度太短无法保留前缀时应抛出明确错误', () => {
    expect(() =>
      createShortTestName({ prefix: 'AT', domain: 'MENU_GROUP', maxLength: 2, seed: 'A7' }),
    ).toThrow('maxLength 2 is too short to preserve prefix "AT_".');
  });

  test('应按清理优先级倒序执行资源清理', async () => {
    const cleaned: string[] = [];
    const registry = new ResourceRegistry();

    registry.register({
      type: 'menu',
      id: 1,
      cleanupPriority: 10,
      cleanup: async () => cleaned.push('menu'),
    });
    registry.register({
      type: 'saleItem',
      id: 2,
      cleanupPriority: 30,
      cleanup: async () => cleaned.push('saleItem'),
    });

    await registry.cleanupAll();

    expect(cleaned).toEqual(['saleItem', 'menu']);
  });

  test('清理失败时应记录错误并继续清理其他资源', async () => {
    const cleaned: string[] = [];
    const registry = new ResourceRegistry();

    registry.register({
      type: 'menu',
      id: 1,
      cleanupPriority: 10,
      cleanup: async () => cleaned.push('menu'),
    });
    registry.register({
      type: 'saleItem',
      id: 2,
      cleanupPriority: 30,
      cleanup: async () => {
        cleaned.push('saleItem');
        throw new Error('sale item cleanup failed');
      },
    });

    const result = await registry.cleanupAll();

    expect(cleaned).toEqual(['saleItem', 'menu']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].resource).toEqual(
      expect.objectContaining({ type: 'saleItem', id: 2 }),
    );
    expect(result.errors[0].error).toBeInstanceOf(Error);
    expect(registry.has('menu', 1)).toBe(false);
    expect(registry.has('saleItem', 2)).toBe(false);
  });

  test('未登记资源断言应抛出明确错误', () => {
    const registry = new ResourceRegistry();

    expect(() => registry.assertRegistered('menu', 1)).toThrow(
      'API test resource is not registered: menu#1.',
    );
  });
});

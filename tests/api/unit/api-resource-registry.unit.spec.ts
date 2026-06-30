import { expect, test } from '@playwright/test';
import { createShortTestName } from '../../../api/core/test-data-id';
import { ResourceRegistry } from '../../../api/core/resource-registry';

test.describe('API 测试资源登记', () => {
  test('应生成保留 AT_ 前缀且不超过最大长度的测试名称', () => {
    const name = createShortTestName({
      prefix: 'AT',
      domain: 'MENU_GROUP',
      maxLength: 12,
      seed: 'A7',
    });

    expect(name.startsWith('AT_')).toBe(true);
    expect(name.length).toBeLessThanOrEqual(12);
    expect(name.endsWith('_A7')).toBe(true);
  });

  test('同一前缀和领域在短长度下也应按不同种子生成不同名称', () => {
    const firstName = createShortTestName({
      prefix: 'AT',
      domain: 'MENU_GROUP',
      maxLength: 12,
      seed: 'A7',
    });
    const secondName = createShortTestName({
      prefix: 'AT',
      domain: 'MENU_GROUP',
      maxLength: 12,
      seed: 'B8',
    });

    expect(firstName).not.toBe(secondName);
    expect(firstName.endsWith('_A7')).toBe(true);
    expect(secondName.endsWith('_B8')).toBe(true);
  });

  test('前缀全是非法字符时应回退 AT', () => {
    const name = createShortTestName({
      prefix: '$$',
      domain: 'MENU_GROUP',
      maxLength: 16,
      seed: 'A7',
    });

    expect(name.startsWith('AT_')).toBe(true);
  });

  test('最大长度不是正整数时应抛出明确错误', () => {
    expect(() =>
      createShortTestName({ prefix: 'AT', domain: 'MENU_GROUP', maxLength: 12.5, seed: 'A7' }),
    ).toThrow('maxLength must be a positive integer.');
    expect(() =>
      createShortTestName({ prefix: 'AT', domain: 'MENU_GROUP', maxLength: 0, seed: 'A7' }),
    ).toThrow('maxLength must be a positive integer.');
  });

  test('种子包含非法字符时应规范化并保留可用种子', () => {
    const name = createShortTestName({
      prefix: 'AT',
      domain: 'MENU_GROUP',
      maxLength: 20,
      seed: ' a-7! ',
    });

    expect(name.endsWith('_A_7')).toBe(true);
  });

  test('最大长度太短无法保留前缀和种子时应抛出明确错误', () => {
    expect(() =>
      createShortTestName({ prefix: 'AT', domain: 'MENU_GROUP', maxLength: 4, seed: 'A7' }),
    ).toThrow('maxLength 4 is too short to preserve prefix and seed "AT_A7".');
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
    expect(result.errors[0].resource).toEqual({ type: 'saleItem', id: 2 });
    expect(result.errors[0].resource).not.toHaveProperty('cleanup');
    expect(result.errors[0].error?.message).toBe('sale item cleanup failed');
    expect(registry.has('menu', 1)).toBe(false);
    expect(registry.has('saleItem', 2)).toBe(false);
  });

  test('手工标记清理后应跳过对应资源的后置清理', async () => {
    const cleaned: string[] = [];
    const registry = new ResourceRegistry();

    registry.register({
      type: 'discount',
      id: 3,
      cleanupPriority: 20,
      cleanup: async () => cleaned.push('discount'),
    });

    registry.markCleaned('discount', 3);
    const result = await registry.cleanupAll();

    expect(cleaned).toHaveLength(0);
    expect(result.cleaned).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(registry.has('discount', 3)).toBe(false);
  });

  test('未登记资源断言应抛出明确错误', () => {
    const registry = new ResourceRegistry();

    expect(() => registry.assertRegistered('menu', 1)).toThrow(
      'API test resource is not registered: menu#1.',
    );
  });
});

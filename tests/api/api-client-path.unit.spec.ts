import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { AdminConfigApiClient } from '../../api/clients/admin-config-api.client';
import { toApiClientPath, toRequestParams } from '../../api/clients/client-path';
import { MenuApiClient } from '../../api/clients/menu-api.client';
import { OrderApiClient } from '../../api/clients/order-api.client';
import { PaymentApiClient } from '../../api/clients/payment-api.client';
import { SaleItemApiClient } from '../../api/clients/sale-item-api.client';
import { SpuApiClient } from '../../api/clients/spu-api.client';

test.describe('API client 路径工具', () => {
  test('应将 Swagger 绝对路径转换为 Playwright baseURL 下的相对路径', () => {
    expect(toApiClientPath('/api/menu/menu')).toBe('api/menu/menu');
  });

  test('应替换路径参数并保持相对路径', () => {
    expect(toApiClientPath('/api/order/{id}/split', { id: 123 })).toBe('api/order/123/split');
  });

  test('应过滤未定义的查询参数', () => {
    expect(toRequestParams({ keyword: 'AT', page: undefined, active: true })).toEqual({
      keyword: 'AT',
      active: true,
    });
  });

  test('应能导入首批领域 API client', () => {
    expect([
      MenuApiClient,
      SaleItemApiClient,
      SpuApiClient,
      OrderApiClient,
      PaymentApiClient,
      AdminConfigApiClient,
    ]).toHaveLength(6);
  });

  test('领域 API client 不应绕过路径转换工具直接请求绝对 API 路径', () => {
    const clientDir = path.join(process.cwd(), 'api', 'clients');
    const clientFiles = readdirSync(clientDir).filter(
      (fileName) => fileName.endsWith('.ts') && fileName !== 'client-path.ts',
    );

    for (const clientFile of clientFiles) {
      const source = readFileSync(path.join(clientDir, clientFile), 'utf8');

      expect(
        source,
        `${clientFile} 不应直接调用 this.request.*('/api/...')，应先经过 toApiClientPath()。`,
      ).not.toMatch(/this\.request\.(?:get|post|put|delete|fetch)\(\s*['"`]\/api\//);
    }
  });
});

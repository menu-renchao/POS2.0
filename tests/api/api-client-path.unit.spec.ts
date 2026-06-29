import { expect, test } from '@playwright/test';
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
});

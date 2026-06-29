import { expect, type APIResponse } from '@playwright/test';
import { expectResponseEnvelope, type ApiEnvelope } from '../../api/core/api-response';
import { test } from '../../fixtures/api.fixture';

test.describe('API 测试数据清理', () => {
  test('应能扫描 AT_ 前缀测试数据入口并校验响应信封', async ({
    adminConfigApi,
    menuApi,
    saleItemApi,
  }) => {
    await test.step('扫描菜单测试数据入口', async () => {
      const responses = [
        ['GET /api/menu/menus', await menuApi.listMenus({ keyword: 'AT_' })],
        ['GET /api/menu/menuGroups', await menuApi.listMenuGroups({ keyword: 'AT_' })],
        ['GET /api/menu/menuSaleItems/search', await saleItemApi.searchSaleItems({ keyword: 'AT_' })],
      ] as const;

      for (const [label, response] of responses) {
        const body = await expectJsonEnvelope(response, label);

        expect(body.data, `${label} 响应应包含 data 字段`).toBeDefined();
      }
    });

    await test.step('扫描后台配置测试数据入口', async () => {
      const responses = [
        ['GET /api/tax/list', await adminConfigApi.listTaxes({ keyword: 'AT_' })],
        ['GET /api/discount/list', await adminConfigApi.listDiscounts({ keyword: 'AT_' })],
        ['GET /api/admin/role/list', await adminConfigApi.listRoles({ keyword: 'AT_' })],
      ] as const;

      for (const [label, response] of responses) {
        const body = await expectJsonEnvelope(response, label);

        expect(body.data, `${label} 响应应包含 data 字段`).toBeDefined();
      }
    });
  });
});

async function expectJsonEnvelope(
  response: APIResponse,
  label: string,
): Promise<ApiEnvelope<unknown>> {
  expect(response.status(), `${label} 不应返回 500`).not.toBe(500);

  const body: unknown = await response.json();
  expectResponseEnvelope(body);

  return body;
}

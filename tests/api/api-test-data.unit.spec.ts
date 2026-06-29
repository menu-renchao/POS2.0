import { expect, test } from '@playwright/test';
import {
  MENU_API_NAME_LIMITS,
  buildCategoryRequest,
  buildGlobalOptionCategoryRequest,
  buildGlobalOptionRequest,
  buildMenuGroupRequest,
  buildMenuRequest,
  buildSaleItemRequest,
} from '../../test-data/api/menu-api-data';
import { ORDER_API_NAME_LIMITS, buildOrderRequest } from '../../test-data/api/order-api-data';
import { buildPaymentRecordRequest, buildTipRequest } from '../../test-data/api/payment-api-data';

test.describe('API 测试数据工厂', () => {
  test('菜单数据工厂应生成短名称并保留自动化前缀', () => {
    const namedRequests = [
      { request: buildMenuRequest('menu-seed-001'), key: 'name', maxLength: MENU_API_NAME_LIMITS.menu },
      {
        request: buildMenuGroupRequest(101, 'group-seed-001'),
        key: 'name',
        maxLength: MENU_API_NAME_LIMITS.menuGroup,
      },
      {
        request: buildCategoryRequest(101, 202, 'category-seed-001'),
        key: 'name',
        maxLength: MENU_API_NAME_LIMITS.category,
      },
      {
        request: buildGlobalOptionCategoryRequest(101, 'option-category-seed-001'),
        key: 'name',
        maxLength: MENU_API_NAME_LIMITS.globalOptionCategory,
      },
      {
        request: buildGlobalOptionRequest(303, 'option-seed-001'),
        key: 'name',
        maxLength: MENU_API_NAME_LIMITS.globalOption,
      },
      {
        request: buildSaleItemRequest(404, 'sale-item-seed-001'),
        key: 'name',
        maxLength: MENU_API_NAME_LIMITS.saleItem,
      },
    ];

    for (const { request, key, maxLength } of namedRequests) {
      const name = request[key];

      expect(typeof name).toBe('string');
      expect(name).toMatch(/^AT_/);
      expect((name as string).length).toBeLessThanOrEqual(maxLength);
    }
  });

  test('菜单关联数据工厂应包含后续规格需要的核心 ID', () => {
    expect(buildMenuGroupRequest(101, 'group')).toMatchObject({
      menuId: 101,
    });
    expect(buildCategoryRequest(101, 202, 'category')).toMatchObject({
      menuId: 101,
      menuGroupId: 202,
    });
    expect(buildGlobalOptionCategoryRequest(101, 'option-category')).toMatchObject({
      menuId: 101,
    });
    expect(buildGlobalOptionRequest(303, 'option')).toMatchObject({
      globalOptionCategoryId: 303,
    });
    expect(buildSaleItemRequest(404, 'sale-item')).toMatchObject({
      menuCategoryId: 404,
    });
  });

  test('订单数据工厂应包含客户短名称和商品明细核心字段', () => {
    const request = buildOrderRequest(505, 'order-seed-001');
    const [item] = request.items;

    expect(request.customerName).toMatch(/^AT_/);
    expect(request.customerName.length).toBeLessThanOrEqual(ORDER_API_NAME_LIMITS.customer);
    expect(item.name).toMatch(/^AT_/);
    expect(item.name.length).toBeLessThanOrEqual(ORDER_API_NAME_LIMITS.item);
    expect(request.items).toEqual([
      expect.objectContaining({
        saleItemId: 505,
        quantity: 1,
        price: 10,
        amount: 10,
      }),
    ]);
  });

  test('支付数据工厂应包含订单 ID 和小费金额字段', () => {
    expect(buildPaymentRecordRequest(606)).toMatchObject({
      orderId: 606,
      amount: 10,
    });
    expect(buildTipRequest(3.5)).toMatchObject({
      amount: 3.5,
    });
  });
});

import { expect, type APIResponse } from '@playwright/test';
import type { ApiRequestData } from '../../api/clients/client-path';
import type { MenuApiClient } from '../../api/clients/menu-api.client';
import type { SaleItemApiClient } from '../../api/clients/sale-item-api.client';
import { expectResponseEnvelope, type ApiEnvelope } from '../../api/core/api-response';
import type { ResourceId, ResourceRegistry } from '../../api/core/resource-registry';
import { test } from '../../fixtures/api.fixture';
import {
  buildCategoryRequest,
  buildMenuGroupRequest,
  buildMenuRequest,
  buildSaleItemRequest,
} from '../../test-data/api/menu-api-data';
import { buildOrderRequest } from '../../test-data/api/order-api-data';
import { buildPaymentRecordRequest } from '../../test-data/api/payment-api-data';

type OrderPaymentResourceType = 'menu' | 'menuGroup' | 'menuCategory' | 'saleItem' | 'order' | 'payment';

test.describe('订单和支付接口', () => {
  test('应能查询订单管理只读入口并校验响应信封', async ({ orderApi }) => {
    await test.step('查询订单列表并校验响应信封', async () => {
      const response = await orderApi.listOrders();

      await expectJsonEnvelope(response, 'GET /api/order/list');
    });

    await test.step('查询订单明细列表并校验响应信封', async () => {
      const response = await orderApi.listOrderDetails();

      await expectJsonEnvelope(response, 'GET /api/order/detail/list');
    });

    await test.step('查询召回订单并校验响应信封', async () => {
      const response = await orderApi.recall();

      await expectJsonEnvelope(response, 'GET /api/order/recall');
    });

    await test.step('检查手机号会员订单存在性并校验响应信封', async () => {
      const response = await orderApi.checkOrderExistsByPhoneAndMember({
        phone: '0000000000',
        memberId: 'AT_MEMBER_NOT_EXISTS',
      });

      await expectJsonEnvelope(response, 'GET /api/order/checkOrderExistsByPhoneAndMember');
    });
  });

  test('应能保存查询支付并作废本次创建的订单', async ({
    apiConfig,
    menuApi,
    saleItemApi,
    orderApi,
    paymentApi,
    resourceRegistry,
  }) => {
    test.skip(!apiConfig.enableDestructive, '需要 API_ENABLE_DESTRUCTIVE=true 才能执行写接口测试。');

    const saleItemId = await createControlledSaleItem({
      menuApi,
      saleItemApi,
      resourceRegistry,
    });
    const orderRequest = buildOrderRequest(saleItemId, 'PAY');
    let orderVoided = false;
    let paymentDeleted = false;

    const orderBody = await test.step('保存测试订单并校验响应信封', async () => {
      const response = await orderApi.saveOrder(orderRequest);

      return await expectJsonEnvelope(response, 'POST /api/order/save');
    });

    const orderId = await resolveCreatedResourceId({
      name: orderRequest.customerName,
      saveBody: orderBody,
      listLabel: 'GET /api/order/list',
      listResource: async () => await orderApi.listOrders({ customerName: orderRequest.customerName }),
    });

    if (orderId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '保存订单响应和订单列表均未返回本次测试订单 id，跳过依赖订单 id 的支付和清理链路。',
      });
      return;
    }

    registerCleanup({
      resourceRegistry,
      type: 'order',
      id: orderId,
      name: orderRequest.customerName,
      cleanupPriority: 80,
      cleanup: async () => {
        if (!orderVoided) {
          await orderApi.voidOrder(buildOrderVoidRequest(orderId));
        }
      },
    });

    await test.step('读取测试订单详情并校验响应信封', async () => {
      const response = await orderApi.fetchOrder(toOrderQuery(orderId));

      await expectJsonEnvelope(response, 'GET /api/order/fetch');
    });

    await test.step('查询测试订单列表和明细入口并校验响应信封', async () => {
      const responses = [
        ['GET /api/order/list', await orderApi.listOrders({ orderId, customerName: orderRequest.customerName })],
        ['GET /api/order/detail/list', await orderApi.listOrderDetails(toOrderQuery(orderId))],
        ['GET /api/order/recall', await orderApi.recall(toOrderQuery(orderId))],
        [
          'POST /api/order/listOrdersByDateNumber',
          await orderApi.listOrdersByDateNumber(buildOrderDateNumberQuery(orderId)),
        ],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    const paymentRequest = buildPaymentRecordRequest(orderId);
    const paymentBody = await test.step('保存测试支付记录并校验响应信封', async () => {
      const response = await paymentApi.saveRecord(paymentRequest);

      return await expectJsonEnvelope(response, 'POST /api/payment/record/save');
    });

    const paymentId = extractResourceId(paymentBody);

    if (paymentId !== undefined) {
      registerCleanup({
        resourceRegistry,
        type: 'payment',
        id: paymentId,
        cleanupPriority: 90,
        cleanup: async () => {
          if (!paymentDeleted) {
            await paymentApi.deleteRecord(buildPaymentDeleteRequest(paymentId, orderId));
          }
        },
      });

      await test.step('删除本次创建的测试支付记录并校验响应信封', async () => {
        const response = await paymentApi.deleteRecord(buildPaymentDeleteRequest(paymentId, orderId));

        await expectJsonEnvelope(response, 'POST /api/payment/record/delete');
        paymentDeleted = true;
      });
    } else {
      test.info().annotations.push({
        type: '说明',
        description: '保存支付记录响应未返回支付记录 id，跳过支付记录删除接口调用。',
      });
    }

    await test.step('作废本次创建的测试订单并校验响应信封', async () => {
      const response = await orderApi.voidOrder(buildOrderVoidRequest(orderId));

      await expectJsonEnvelope(response, 'POST /api/order/void');
      orderVoided = true;
    });
  });

  test('应能对复杂订单状态接口执行轻量契约校验', async ({ apiConfig, orderApi }) => {
    test.skip(!apiConfig.enableDestructive, '需要 API_ENABLE_DESTRUCTIVE=true 才能执行写接口测试。');

    await test.step('清台接口使用无效测试订单参数不应返回 500', async () => {
      const response = await orderApi.clearTable({
        orderId: 'AT_ORDER_NOT_EXISTS',
        tableId: 'AT_TABLE_NOT_EXISTS',
      });

      await expectJsonEnvelope(response, 'POST /api/order/clearTable');
    });

    await test.step('合单接口使用无效测试订单参数不应返回 500', async () => {
      const response = await orderApi.combine({
        sourceOrderId: 'AT_SOURCE_ORDER_NOT_EXISTS',
        targetOrderId: 'AT_TARGET_ORDER_NOT_EXISTS',
      });

      await expectJsonEnvelope(response, 'POST /api/order/combine');
    });

    await test.step('移动订单商品接口使用无效测试订单参数不应返回 500', async () => {
      const response = await orderApi.moveOrderItem({
        sourceOrderId: 'AT_SOURCE_ORDER_NOT_EXISTS',
        targetOrderId: 'AT_TARGET_ORDER_NOT_EXISTS',
        orderItemId: 'AT_ORDER_ITEM_NOT_EXISTS',
      });

      await expectJsonEnvelope(response, 'POST /api/order/item/move');
    });

    await test.step('重开订单接口使用无效测试订单参数不应返回 500', async () => {
      const response = await orderApi.reopenOrder('AT_ORDER_NOT_EXISTS', {
        reason: 'API_AUTOMATION_CONTRACT',
      });

      await expectJsonEnvelope(response, 'POST /api/order/{id}/reopen');
    });

    await test.step('拆分订单接口使用无效测试订单参数不应返回 500', async () => {
      const response = await orderApi.splitOrder('AT_ORDER_NOT_EXISTS', {
        items: [],
        reason: 'API_AUTOMATION_CONTRACT',
      });

      await expectJsonEnvelope(response, 'POST /api/order/{id}/split');
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

async function createControlledSaleItem(options: {
  menuApi: MenuApiClient;
  saleItemApi: SaleItemApiClient;
  resourceRegistry: ResourceRegistry;
}): Promise<ResourceId> {
  const { menuApi, saleItemApi, resourceRegistry } = options;
  const menuRequest = buildMenuRequest('ORDER');
  const menuBody = await test.step('创建订单测试菜单并校验响应信封', async () => {
    const response = await menuApi.createMenu(menuRequest);

    return await expectJsonEnvelope(response, 'POST /api/menu/menu');
  });
  const menuId = await resolveCreatedResourceId({
    name: menuRequest.name,
    saveBody: menuBody,
    listLabel: 'GET /api/menu/menus',
    listResource: async () => await menuApi.listMenus({ name: menuRequest.name }),
  });

  expect(menuId, '应能解析订单测试菜单 id').toBeDefined();
  registerCleanup({
    resourceRegistry,
    type: 'menu',
    id: menuId!,
    name: menuRequest.name,
    cleanupPriority: 10,
    cleanup: async () => {
      await menuApi.updateMenu(toArchivedMenuRequest(menuRequest, menuId!));
    },
  });

  const menuGroupRequest = buildMenuGroupRequest(menuId!, 'ORDER');
  const menuGroupBody = await test.step('创建订单测试菜单组并校验响应信封', async () => {
    const response = await menuApi.createMenuGroup(menuGroupRequest);

    return await expectJsonEnvelope(response, 'POST /api/menu/menuGroup');
  });
  const menuGroupId = await resolveCreatedResourceId({
    name: menuGroupRequest.name,
    saveBody: menuGroupBody,
    listLabel: 'GET /api/menu/menuGroups',
    listResource: async () => await menuApi.listMenuGroups({ menuId, name: menuGroupRequest.name }),
  });

  expect(menuGroupId, '应能解析订单测试菜单组 id').toBeDefined();
  registerCleanup({
    resourceRegistry,
    type: 'menuGroup',
    id: menuGroupId!,
    name: menuGroupRequest.name,
    cleanupPriority: 30,
    cleanup: async () => {
      await menuApi.deleteMenuGroup(menuGroupId!);
    },
  });

  const categoryRequest = buildCategoryRequest(menuId!, menuGroupId!, 'ORDER');
  const categoryBody = await test.step('创建订单测试分类并校验响应信封', async () => {
    const response = await menuApi.createMenuCategory(categoryRequest);

    return await expectJsonEnvelope(response, 'POST /api/menu/menuCategory');
  });
  const categoryId = await resolveCreatedResourceId({
    name: categoryRequest.name,
    saveBody: categoryBody,
    listLabel: 'GET /api/menu/category/list',
    listResource: async () =>
      await menuApi.listCategories({ menuId, menuGroupId, name: categoryRequest.name }),
  });

  expect(categoryId, '应能解析订单测试分类 id').toBeDefined();
  registerCleanup({
    resourceRegistry,
    type: 'menuCategory',
    id: categoryId!,
    name: categoryRequest.name,
    cleanupPriority: 40,
    cleanup: async () => {
      await menuApi.deleteMenuCategory(categoryId!);
    },
  });

  const saleItemRequest = buildSaleItemRequest(categoryId!, 'ORDER');
  const saleItemBody = await test.step('创建订单测试商品并校验响应信封', async () => {
    const response = await saleItemApi.createSaleItem(saleItemRequest);

    return await expectJsonEnvelope(response, 'POST /api/menu/menuSaleItem');
  });
  const saleItemId = await resolveCreatedResourceId({
    name: saleItemRequest.name,
    saveBody: saleItemBody,
    listLabel: 'GET /api/menu/menuSaleItems/searchByName',
    listResource: async () => await saleItemApi.searchSaleItemsByName({ name: saleItemRequest.name }),
  });

  expect(saleItemId, '应能解析订单测试商品 id').toBeDefined();
  registerCleanup({
    resourceRegistry,
    type: 'saleItem',
    id: saleItemId!,
    name: saleItemRequest.name,
    cleanupPriority: 50,
    cleanup: async () => {
      await saleItemApi.deleteSaleItem(saleItemId!);
    },
  });

  return saleItemId!;
}

async function resolveCreatedResourceId(options: {
  name: string;
  saveBody: ApiEnvelope<unknown>;
  listLabel: string;
  listResource: () => Promise<APIResponse>;
}): Promise<ResourceId | undefined> {
  const savedId = extractResourceId(options.saveBody);

  if (savedId !== undefined) {
    return savedId;
  }

  return await test.step('从查询响应中定位本次创建记录 id', async () => {
    const listBody = await expectJsonEnvelope(await options.listResource(), options.listLabel);

    return findResourceIdByName(listBody.data, options.name);
  });
}

function registerCleanup(options: {
  resourceRegistry: ResourceRegistry;
  type: OrderPaymentResourceType;
  id: ResourceId;
  name?: string;
  cleanupPriority: number;
  cleanup: () => Promise<unknown>;
}): void {
  options.resourceRegistry.register({
    type: options.type,
    id: options.id,
    name: options.name,
    cleanupPriority: options.cleanupPriority,
    cleanup: options.cleanup,
  });
}

function toOrderQuery(orderId: ResourceId): Record<string, ResourceId> {
  return { id: orderId, orderId };
}

function buildOrderDateNumberQuery(orderId: ResourceId): ApiRequestData {
  return {
    id: orderId,
    orderId,
    dateNumber: 'AT',
  };
}

function buildOrderVoidRequest(orderId: ResourceId): ApiRequestData {
  return {
    id: orderId,
    orderId,
    reason: 'API_AUTOMATION_CLEANUP',
  };
}

function buildPaymentDeleteRequest(paymentId: ResourceId, orderId: ResourceId): ApiRequestData {
  return {
    id: paymentId,
    paymentRecordId: paymentId,
    orderId,
    reason: 'API_AUTOMATION_CLEANUP',
  };
}

function toArchivedMenuRequest(
  menuRequest: Record<string, unknown>,
  menuId: ResourceId,
): Record<string, unknown> {
  return {
    ...menuRequest,
    id: menuId,
    enabled: false,
    active: false,
    deleted: true,
  };
}

function extractResourceId(envelope: ApiEnvelope<unknown>): ResourceId | undefined {
  return extractIdFromValue(envelope.data) ?? extractIdFromValue(envelope);
}

function findResourceIdByName(value: unknown, name: string): ResourceId | undefined {
  return findResourceIdByNameValue(value, name, new Set<object>());
}

function findResourceIdByNameValue(
  value: unknown,
  name: string,
  seen: Set<object>,
): ResourceId | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = findResourceIdByNameValue(item, name, seen);

      if (id !== undefined) {
        return id;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (recordHasName(value, name)) {
    return extractIdFromRecord(value);
  }

  for (const item of Object.values(value)) {
    const id = findResourceIdByNameValue(item, name, seen);

    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function recordHasName(record: Record<string, unknown>, name: string): boolean {
  return [
    'name',
    'displayName',
    'customerName',
    'menuName',
    'menuGroupName',
    'categoryName',
    'menuCategoryName',
    'saleItemName',
  ].some((key) => record[key] === name);
}

function extractIdFromValue(value: unknown): ResourceId | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return extractIdFromRecord(value) ?? extractIdFromValue(value.data);
}

function extractIdFromRecord(record: Record<string, unknown>): ResourceId | undefined {
  for (const key of [
    'id',
    'orderId',
    'orderNo',
    'menuId',
    'menuGroupId',
    'categoryId',
    'menuCategoryId',
    'saleItemId',
    'menuSaleItemId',
    'paymentId',
    'paymentRecordId',
  ]) {
    const value = record[key];

    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

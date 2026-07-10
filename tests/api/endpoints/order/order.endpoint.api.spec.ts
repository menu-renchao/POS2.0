import { expect, test } from '../../support/endpoint-fixture';
import { buildDefaultOrderListQuery } from '../../../../test-data/api/order-api-data';
import { expectApiOk, expectApiRejected } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';
import { waitUntil } from '../../../../utils/wait';
import type { OrderApiClient } from '../../../../api/clients/order-api.client';
import type { ResourceId } from '../../../../api/core/resource-registry';

const ORDER_SAVE_IDENTITY = { method: 'POST', path: '/api/order/save' } as const;
const ORDER_FETCH_IDENTITY = { method: 'GET', path: '/api/order/fetch' } as const;
const ORDER_DETAIL_LIST_IDENTITY = { method: 'GET', path: '/api/order/detail/list' } as const;
const ORDER_LIST_IDENTITY = { method: 'GET', path: '/api/order/list' } as const;
const ORDER_DATE_NUMBER_LIST_IDENTITY = { method: 'POST', path: '/api/order/listOrdersByDateNumber' } as const;
const ORDER_RECALL_IDENTITY = { method: 'GET', path: '/api/order/recall' } as const;
const ORDER_VOID_IDENTITY = { method: 'POST', path: '/api/order/void' } as const;

test.describe('订单管理 endpoint', () => {
  test(
    toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '应能保存订单'),
    async ({ endpointResources }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '创建订单并登记清理'),
        async () => await endpointResources.createOrderResource(),
      );

      expect(order.id).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '缺少订单体应返回异常'),
    async ({ orderApi }) => {
      await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '提交空订单并校验拒绝响应'),
        async () => {
          await expectApiRejected(await orderApi.saveOrder({}), ORDER_SAVE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(ORDER_FETCH_IDENTITY.method, ORDER_FETCH_IDENTITY.path, '应能读取订单详情'),
    async ({ endpointResources, orderApi }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于读取'),
        async () => await endpointResources.createOrderResource(),
      );

      const body = await test.step(
        toEndpointTitle(ORDER_FETCH_IDENTITY.method, ORDER_FETCH_IDENTITY.path, '读取订单详情并校验响应'),
        async () =>
          await expectApiOk(
            await orderApi.fetchOrder({ id: order.id, orderId: order.id, fetchPayments: true }),
            ORDER_FETCH_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(ORDER_FETCH_IDENTITY.method, ORDER_FETCH_IDENTITY.path, '读取不存在订单应返回异常'),
    async ({ orderApi }) => {
      await test.step(
        toEndpointTitle(ORDER_FETCH_IDENTITY.method, ORDER_FETCH_IDENTITY.path, '读取不存在订单 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(await orderApi.fetchOrder({ id: 2147483647, orderId: 2147483647 }), ORDER_FETCH_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(ORDER_DETAIL_LIST_IDENTITY.method, ORDER_DETAIL_LIST_IDENTITY.path, '应能查询订单明细列表'),
    async ({ endpointResources, orderApi }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于明细列表查询'),
        async () => await endpointResources.createOrderResource(),
      );
      const body = await test.step(
        toEndpointTitle(ORDER_DETAIL_LIST_IDENTITY.method, ORDER_DETAIL_LIST_IDENTITY.path, '按订单 ID 查询明细列表并校验响应'),
        async () =>
          await expectApiOk(
            await orderApi.listOrderDetails(buildDefaultOrderListQuery(new Date(), { orderId: order.id })),
            ORDER_DETAIL_LIST_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(ORDER_LIST_IDENTITY.method, ORDER_LIST_IDENTITY.path, '应能查询订单列表'),
    async ({ endpointResources, orderApi }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于列表查询'),
        async () => await endpointResources.createOrderResource(),
      );
      const request = order.request as { order?: { customerName?: string } };

      const body = await test.step(
        toEndpointTitle(ORDER_LIST_IDENTITY.method, ORDER_LIST_IDENTITY.path, '查询订单列表并校验响应'),
        async () =>
          await expectApiOk(
            await orderApi.listOrders(
              buildDefaultOrderListQuery(new Date(), {
                orderId: order.id,
                customerName: request.order?.customerName,
              }),
            ),
            ORDER_LIST_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(ORDER_DATE_NUMBER_LIST_IDENTITY.method, ORDER_DATE_NUMBER_LIST_IDENTITY.path, '应能按日期编号查询订单'),
    async ({ endpointResources, orderApi }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于日期编号查询'),
        async () => await endpointResources.createOrderResource(),
      );
      const body = await test.step(
        toEndpointTitle(ORDER_DATE_NUMBER_LIST_IDENTITY.method, ORDER_DATE_NUMBER_LIST_IDENTITY.path, '按订单 ID 和日期编号查询并校验响应'),
        async () =>
          await expectApiOk(
            await orderApi.listOrdersByDateNumber(buildOrderDateNumberQuery(order.id)),
            ORDER_DATE_NUMBER_LIST_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(ORDER_RECALL_IDENTITY.method, ORDER_RECALL_IDENTITY.path, '应能查询召回订单列表'),
    async ({ endpointResources, orderApi }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于召回列表查询'),
        async () => await endpointResources.createOrderResource(),
      );
      const body = await test.step(
        toEndpointTitle(ORDER_RECALL_IDENTITY.method, ORDER_RECALL_IDENTITY.path, '按订单 ID 查询召回列表并校验响应'),
        async () =>
          await expectApiOk(
            await orderApi.recall(buildDefaultOrderListQuery(new Date(), { orderId: order.id })),
            ORDER_RECALL_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(ORDER_LIST_IDENTITY.method, ORDER_LIST_IDENTITY.path, '分页边界 pageSize=1 应返回稳定响应'),
    async ({ orderApi }) => {
      const body = await test.step(
        toEndpointTitle(ORDER_LIST_IDENTITY.method, ORDER_LIST_IDENTITY.path, '使用 pageSize=1 查询订单列表并校验响应'),
        async () =>
          await expectApiOk(
            await orderApi.listOrders(
              buildDefaultOrderListQuery(new Date(), {
                page: 1,
                pageSize: 1,
              }),
            ),
            ORDER_LIST_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(ORDER_VOID_IDENTITY.method, ORDER_VOID_IDENTITY.path, '应能作废本次创建的订单'),
    async ({ endpointResources, orderApi, resourceRegistry }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于作废'),
        async () => await endpointResources.createOrderResource(),
      );
      await test.step('等待订单详情可读取后再作废', async () => {
        await waitForOrderReadable(orderApi, order.id);
      });

      await test.step(
        toEndpointTitle(ORDER_VOID_IDENTITY.method, ORDER_VOID_IDENTITY.path, '作废订单并校验响应'),
        async () => {
          await expectApiOk(
            await orderApi.voidOrder(buildOrderVoidRequest(order.id, 'API_AUTOMATION_ENDPOINT')),
            ORDER_VOID_IDENTITY,
          );
        },
      );

      expect(resourceRegistry.markCleaned('order', order.id)).toBe(true);
    },
  );

  test(
    toEndpointTitle(ORDER_VOID_IDENTITY.method, ORDER_VOID_IDENTITY.path, '缺少订单 ID 应返回异常'),
    async ({ orderApi }) => {
      await test.step(
        toEndpointTitle(ORDER_VOID_IDENTITY.method, ORDER_VOID_IDENTITY.path, '提交空作废请求并校验拒绝响应'),
        async () => {
          await expectApiRejected(await orderApi.voidOrder({}), ORDER_VOID_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(ORDER_VOID_IDENTITY.method, ORDER_VOID_IDENTITY.path, '作废不存在订单应返回异常'),
    async ({ orderApi }) => {
      await test.step(
        toEndpointTitle(ORDER_VOID_IDENTITY.method, ORDER_VOID_IDENTITY.path, '提交不存在订单 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(
            await orderApi.voidOrder(buildOrderVoidRequest(2147483647, 'API_AUTOMATION_INVALID_ORDER')),
            ORDER_VOID_IDENTITY,
          );
        },
      );
    },
  );
});

function buildOrderDateNumberQuery(orderId: ResourceId): Record<string, unknown> {
  return {
    ...buildDefaultOrderListQuery(new Date()),
    id: orderId,
    orderId,
    dateNumber: 'AT',
  };
}

function buildOrderVoidRequest(orderId: ResourceId, reason: string): Record<string, unknown> {
  return {
    id: orderId,
    orderId,
    reason,
  };
}

async function waitForOrderReadable(orderApi: OrderApiClient, orderId: ResourceId): Promise<void> {
  await waitUntil(
    async () => {
      const response = await orderApi.fetchOrder({ id: orderId, orderId, fetchPayments: true });
      const body = await response.json().catch(() => undefined) as { code?: unknown } | undefined;

      return {
        status: response.status(),
        code: body?.code,
      };
    },
    (result) => result.status === 200 && result.code === 0,
    {
      timeout: 5_000,
      interval: 200,
      message: '订单创建后应能读取详情。',
    },
  );
}

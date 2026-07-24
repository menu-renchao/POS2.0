import { expect, test } from '@playwright/test';
import type { Page, Response } from '@playwright/test';
import type { OrderApiClient } from '../../../api/clients/order-api.client';
import { ResourceRegistry } from '../../../api/core/resource-registry';
import type { RecallDatabaseFlow } from '../../../flows/recall-database.flow';
import { UiResourceManager } from '../../../fixtures/ui-resource.manager';

type ResponseListener = (response: Response) => void;

function createPageListenerHarness(): {
  emitResponse: (response: Response) => void;
  page: Page;
} {
  let responseListener: ResponseListener | undefined;
  const page = {
    on: (event: string, listener: ResponseListener) => {
      if (event === 'response') {
        responseListener = listener;
      }
    },
    off: (event: string, listener: ResponseListener) => {
      if (event === 'response' && responseListener === listener) {
        responseListener = undefined;
      }
    },
  } as unknown as Page;

  return {
    emitResponse: (response) => {
      if (!responseListener) {
        throw new Error('响应监听器尚未注册。');
      }
      responseListener(response);
    },
    page,
  };
}

function createSaveResponse(body: unknown): Response {
  return {
    request: () => ({
      method: () => 'POST',
    }),
    url: () => 'http://pos.example/kpos/api/order/save',
    ok: () => true,
    json: async () => body,
  } as unknown as Response;
}

test.describe('UI 订单资源管理器', () => {
  test('应从保存响应登记订单并在清理阶段按精确 ID 清理', async () => {
    const clearedOrderIds: number[][] = [];
    const voidedOrderIds: number[] = [];
    const registry = new ResourceRegistry();
    const orderApi = {
      voidOrderById: async (orderId: number) => {
        voidedOrderIds.push(orderId);
      },
      clearTableOrders: async (orderIds: number[]) => {
        clearedOrderIds.push(orderIds);
      },
    } as Pick<OrderApiClient, 'clearTableOrders' | 'voidOrderById'>;
    const pageHarness = createPageListenerHarness();
    const manager = new UiResourceManager(
      registry,
      orderApi as OrderApiClient,
      {} as RecallDatabaseFlow,
      pageHarness.page,
    );

    pageHarness.emitResponse(
      createSaveResponse({
        code: 0,
        data: {
          order: {
            id: 7217,
            orderNumber: '41',
          },
        },
      }),
    );
    await manager.dispose();

    expect(registry.has('ui-order', 7217)).toBe(true);
    expect(await registry.cleanupAll()).toEqual({
      cleaned: [{ type: 'ui-order', id: 7217, name: '41' }],
      errors: [],
    });
    expect(voidedOrderIds).toEqual([7217]);
    expect(clearedOrderIds).toEqual([[7217]]);
  });

  test('保存响应缺少订单 ID 时应让资源管理 teardown 失败', async () => {
    const registry = new ResourceRegistry();
    const pageHarness = createPageListenerHarness();
    const manager = new UiResourceManager(
      registry,
      {
        voidOrderById: async () => undefined,
        clearTableOrders: async () => undefined,
      } as unknown as OrderApiClient,
      {} as RecallDatabaseFlow,
      pageHarness.page,
    );

    pageHarness.emitResponse(
      createSaveResponse({
        code: 0,
        data: {
          order: {
            orderNumber: '42',
          },
        },
      }),
    );

    await expect(manager.dispose()).rejects.toThrow('1 个 UI 订单未能登记清理');
    expect(await registry.cleanupAll()).toEqual({
      cleaned: [],
      errors: [],
    });
  });
});

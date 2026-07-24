import type { Page, Response } from '@playwright/test';
import type { OrderApiClient } from '../api/clients/order-api.client';
import type { ResourceRegistry } from '../api/core/resource-registry';
import type { RecallDatabaseFlow } from '../flows/recall-database.flow';

const ORDER_CLEANUP_PRIORITY = 100;
const ORDER_SAVE_PATH = '/kpos/api/order/save';

type SavedOrderResponse = {
  code?: unknown;
  data?: {
    order?: {
      id?: unknown;
      orderNumber?: unknown;
    };
  };
};

export class UiResourceManager {
  private readonly pendingRegistrations = new Set<Promise<void>>();
  private readonly registrationErrors: unknown[] = [];
  private readonly responseListener: (response: Response) => void;

  constructor(
    private readonly resources: ResourceRegistry,
    private readonly orderApi: OrderApiClient,
    private readonly recallDatabaseFlow: RecallDatabaseFlow,
    private readonly page: Page,
  ) {
    this.responseListener = (response) => {
      if (
        response.request().method() !== 'POST' ||
        new URL(response.url()).pathname !== ORDER_SAVE_PATH ||
        !response.ok()
      ) {
        return;
      }

      const registration = this.registerSavedOrderResponse(response)
        .catch((error: unknown) => {
          this.registrationErrors.push(error);
        })
        .finally(() => {
          this.pendingRegistrations.delete(registration);
        });
      this.pendingRegistrations.add(registration);
    };
    this.page.on('response', this.responseListener);
  }

  async registerTableOrder(orderNumber: string): Promise<number> {
    const orderId = await this.recallDatabaseFlow.readLatestOrderId(orderNumber);
    this.registerOrder(orderId, orderNumber);
    return orderId;
  }

  async dispose(): Promise<void> {
    this.page.off('response', this.responseListener);
    await Promise.all(this.pendingRegistrations);

    if (this.registrationErrors.length > 0) {
      throw new AggregateError(
        this.registrationErrors,
        `${this.registrationErrors.length} 个 UI 订单未能登记清理。`,
      );
    }
  }

  private registerOrder(orderId: number, orderNumber: string): void {
    if (!this.resources.has('ui-order', orderId)) {
      this.resources.register({
        type: 'ui-order',
        id: orderId,
        name: orderNumber,
        cleanupPriority: ORDER_CLEANUP_PRIORITY,
        cleanup: async () => {
          await this.orderApi.voidOrderById(orderId);
          await this.orderApi.clearTableOrders([orderId]);
        },
      });
    }
  }

  private async registerSavedOrderResponse(response: Response): Promise<void> {
    const body = (await response.json()) as SavedOrderResponse;
    const orderId = Number(body.data?.order?.id);
    const orderNumber = body.data?.order?.orderNumber;

    if (
      body.code !== 0 ||
      !Number.isInteger(orderId) ||
      orderId <= 0 ||
      typeof orderNumber !== 'string' ||
      orderNumber.trim().length === 0
    ) {
      throw new Error(
        `保存订单响应缺少可注册的订单 ID 或订单号：${response.url()}`,
      );
    }

    this.registerOrder(orderId, orderNumber.trim());
  }
}

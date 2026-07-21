import type { KitchenApiClient } from '../clients/kitchen-api.client';
import { expectOkEnvelope } from './setup-resource';

export type KitchenSetupService = {
  delayOrderItem: (orderItemId: number, delayInMillis: number) => Promise<void>;
  holdOrderItem: (orderItemId: number) => Promise<void>;
};

export type KitchenSetupOptions = {
  kitchenApi?: KitchenApiClient;
};

export function createKitchenSetupService(options: KitchenSetupOptions): KitchenSetupService {
  return {
    delayOrderItem: async (orderItemId, delayInMillis) => {
      if (!options.kitchenApi) {
        throw new Error('kitchenApi 未配置，无法设置订单菜 Delay 状态。');
      }
      if (!Number.isInteger(delayInMillis) || delayInMillis <= 0) {
        throw new Error(`Delay 毫秒数必须是正整数，实际为 ${delayInMillis}。`);
      }

      const body = await expectOkEnvelope(
        await options.kitchenApi.delayOrderItem(orderItemId, delayInMillis),
      );
      if (body.data !== true) {
        throw new Error(`订单菜 ${orderItemId} 设置 Delay 后未返回成功结果。`);
      }
    },
    holdOrderItem: async (orderItemId) => {
      if (!options.kitchenApi) {
        throw new Error('kitchenApi 未配置，无法设置订单菜 Hold 状态。');
      }

      const body = await expectOkEnvelope(await options.kitchenApi.holdOrderItem(orderItemId));
      if (body.data !== true) {
        throw new Error(`订单菜 ${orderItemId} 设置 Hold 后未返回成功结果。`);
      }
    },
  };
}

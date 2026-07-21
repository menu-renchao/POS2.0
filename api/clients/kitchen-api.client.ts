import type { APIRequestContext, APIResponse } from '@playwright/test';
import { toApiClientPath, toRequestParams, type ApiPathParamValue } from './client-path';

export class KitchenApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/v1/kitchen/items/{orderItemId}/hold`。
   * 用途：把指定订单菜设置为 Hold，供权限和送厨状态场景准备前置数据。
   */
  holdOrderItem(orderItemId: ApiPathParamValue): Promise<APIResponse> {
    return this.request.post(
      toApiClientPath('/api/v1/kitchen/items/{orderItemId}/hold', { orderItemId }),
      { data: {} },
    );
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/v1/kitchen/items/{orderItemId}/delay`。
   * 用途：把指定订单菜设置为延迟送厨，并使用毫秒数声明延迟时长。
   */
  delayOrderItem(orderItemId: ApiPathParamValue, delayInMillis: number): Promise<APIResponse> {
    return this.request.post(
      toApiClientPath('/api/v1/kitchen/items/{orderItemId}/delay', { orderItemId }),
      { params: toRequestParams({ delayInMillis }) },
    );
  }
}

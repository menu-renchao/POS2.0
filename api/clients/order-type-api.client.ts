import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  toApiClientPath,
  toRequestParams,
  type ApiQueryParams,
  type ApiRequestData,
} from './client-path';

export class OrderTypeApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * HTTP method: GET；Swagger path：`/api/order/type/list`。
   * 用途：读取固定及自定义订单类型设置。
   */
  listOrderTypes(params?: ApiQueryParams): Promise<APIResponse> {
    return this.request.get(toApiClientPath('/api/order/type/list'), {
      params: toRequestParams(params),
    });
  }

  /**
   * HTTP method: POST；Swagger path：`/api/order/type/save`。
   * 用途：更新自定义订单类型的名称、简称、基础订单类型映射及默认区域。
   */
  saveOrderType(data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/order/type/save'), { data });
  }
}

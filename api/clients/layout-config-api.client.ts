import type { APIRequestContext, APIResponse } from '@playwright/test';
import { toApiClientPath, type ApiRequestData } from './client-path';

export class LayoutConfigApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * HTTP method: POST；Swagger path：`/api/layout/config/list`。
   * 用途：读取 POS 首页或订单面板的按钮布局。
   */
  listLayoutConfigs(data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/layout/config/list'), { data });
  }

  /**
   * HTTP method: POST；Swagger path：`/api/layout/config/save`。
   * 用途：按布局 ID 局部更新 POS 首页或订单面板按钮布局。
   */
  saveLayoutConfigs(data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/layout/config/save'), { data });
  }
}

import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  toApiClientPath,
  toRequestParams,
  type ApiQueryParams,
  type ApiRequestData,
} from './client-path';

export class SystemConfigurationApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * HTTP method: GET; Swagger path: `/api/system/configuration/list`.
   * 用途：读取系统配置列表，可通过 fetchDetails/adminRequest 返回后台可见详情。
   */
  listSystemConfigurations(params?: ApiQueryParams): Promise<APIResponse> {
    return this.request.get(toApiClientPath('/api/system/configuration/list'), {
      params: toRequestParams(params),
    });
  }

  /**
   * HTTP method: GET; Swagger path: `/api/system/configuration/fetch`.
   * 用途：按 ID 读取单条系统配置详情。
   */
  fetchSystemConfiguration(params: ApiQueryParams): Promise<APIResponse> {
    return this.request.get(toApiClientPath('/api/system/configuration/fetch'), {
      params: toRequestParams(params),
    });
  }

  /**
   * HTTP method: POST; Swagger path: `/api/system/configuration/update`.
   * 用途：批量更新系统配置。
   */
  updateSystemConfigurations(data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/system/configuration/update'), { data });
  }
}

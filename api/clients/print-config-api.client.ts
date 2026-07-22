import type { APIRequestContext, APIResponse } from '@playwright/test';
import { toApiClientPath, type ApiRequestData } from './client-path';

export class PrintConfigApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /** 读取当前票据模板和脚注选择。 */
  fetch(): Promise<APIResponse> {
    return this.request.get(toApiClientPath('/api/print/config/fetch'));
  }

  /** 保存票据模板和脚注选择。 */
  save(data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/print/config/save'), { data });
  }
}

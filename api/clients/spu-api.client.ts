import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  toApiClientPath,
  toRequestParams,
  type ApiPathParamValue,
  type ApiQueryParams,
  type ApiRequestData,
} from './client-path';

export class SpuApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/spu/hack/renumber`。
   * 用途：触发 SPU 重编号维护操作。
   * 关键参数：`data` 传递重编号范围或维护参数。
   */
  renumber(data: ApiRequestData = {}): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/spu/hack/renumber'), { data });
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/spu/menuSaleItem/assign`。
   * 用途：为 SPU 分配菜单商品。
   * 关键参数：`data` 传递 SPU 编码、菜单商品 ID 和分配配置。
   */
  assignSaleItem(data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/spu/menuSaleItem/assign'), { data });
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/spu/menuSaleItem/link`。
   * 用途：链接 SPU 与菜单商品。
   * 关键参数：`data` 传递 SPU 编码、菜单商品 ID 和链接配置。
   */
  linkSaleItem(data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/spu/menuSaleItem/link'), { data });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/spu/menuSaleItem/list/{code}`。
   * 用途：按 SPU 编码查询已链接的菜单商品。
   * 关键参数：`code` 为 SPU 编码，`params` 传递分页或过滤条件。
   */
  listByCode(code: ApiPathParamValue, params?: ApiQueryParams): Promise<APIResponse> {
    return this.request.get(toApiClientPath('/api/spu/menuSaleItem/list/{code}', { code }), {
      params: toRequestParams(params),
    });
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/spu/stockOperation`。
   * 用途：提交单笔 SPU 库存操作。
   * 关键参数：`data` 传递 SPU 编码、操作类型和数量。
   */
  stockOperation(data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/spu/stockOperation'), { data });
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/spu/stockOperations`。
   * 用途：批量提交 SPU 库存操作。
   * 关键参数：`data` 传递多笔 SPU 库存操作记录。
   */
  stockOperations(data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath('/api/spu/stockOperations'), { data });
  }
}

import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  toApiClientPath,
  toRequestParams,
  type ApiPathParamValue,
  type ApiQueryParams,
  type ApiRequestData,
} from './client-path';

export class SaleItemApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/item/fetchItemOption`。
   * 用途：读取商品选项配置。
   * 关键参数：`params` 传递菜单商品 ID、菜单 ID 或选项过滤条件。
   */
  fetchItemOption(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/item/fetchItemOption', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/item/fetchSaleItem`。
   * 用途：读取商品详情。
   * 关键参数：`params` 传递菜单商品 ID、菜单 ID 或查询过滤条件。
   */
  fetchSaleItem(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/item/fetchSaleItem', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/item/listByCategory`。
   * 用途：按分类查询商品列表。
   * 关键参数：`params` 传递分类 ID、菜单 ID、分页或过滤条件。
   */
  listByCategory(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/item/listByCategory', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/item/listComboSaleItem`。
   * 用途：查询套餐可选商品列表。
   * 关键参数：`params` 传递菜单、分类、商品类型或分页条件。
   */
  listComboSaleItem(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/item/listComboSaleItem', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/item/listItemOptions`。
   * 用途：查询商品选项列表。
   * 关键参数：`params` 传递菜单商品 ID、菜单 ID 或选项分类过滤条件。
   */
  listItemOptions(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/item/listItemOptions', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/item/listKTVItems`。
   * 用途：查询 KTV 商品列表。
   * 关键参数：`params` 传递门店、菜单、分类或分页条件。
   */
  listKTVItems(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/item/listKTVItems', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuComponentItemAssoc`。
   * 用途：保存组件商品关联。
   * 关键参数：`data` 传递组件商品、被关联商品和关联配置。
   */
  saveComponentItemAssoc(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuComponentItemAssoc', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuSaleItem`。
   * 用途：创建菜单商品。
   * 关键参数：`data` 传递分类 ID、商品名称、价格和展示配置。
   */
  createSaleItem(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuSaleItem', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuSaleItem`。
   * 用途：更新菜单商品。
   * 关键参数：`data` 传递菜单商品 ID 和需要更新的字段。
   */
  updateSaleItem(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuSaleItem', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuSaleItem/batch/copy`。
   * 用途：批量复制菜单商品。
   * 关键参数：`data` 传递源商品、目标分类或复制选项。
   */
  copySaleItems(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuSaleItem/batch/copy', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuSaleItem/batch/customizeMenuItemPriceAndMemberPrices`。
   * 用途：批量自定义商品价格和会员价。
   * 关键参数：`data` 传递菜单商品 ID 集合和价格配置。
   */
  customizeMenuItemPriceAndMemberPrices(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuSaleItem/batch/customizeMenuItemPriceAndMemberPrices', data);
  }

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/menu/menuSaleItem/batch/delete`。
   * 用途：批量删除菜单商品。
   * 关键参数：`data` 传递菜单商品 ID 集合。
   */
  deleteSaleItems(data: ApiRequestData): Promise<APIResponse> {
    return this.delete('/api/menu/menuSaleItem/batch/delete', undefined, data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuSaleItem/batch/sequence`。
   * 用途：批量调整菜单商品排序。
   * 关键参数：`data` 传递菜单商品 ID 和目标顺序。
   */
  sequenceSaleItems(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuSaleItem/batch/sequence', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuSaleItem/batch/update`。
   * 用途：批量更新菜单商品。
   * 关键参数：`data` 传递菜单商品 ID 集合和批量更新字段。
   */
  updateSaleItems(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuSaleItem/batch/update', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuSaleItem/batch/updateOutOfStock`。
   * 用途：批量更新商品售罄状态。
   * 关键参数：`data` 传递菜单商品 ID 集合和售罄状态字段。
   */
  updateOutOfStock(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuSaleItem/batch/updateOutOfStock', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuSaleItem/link`。
   * 用途：保存菜单商品链接关系。
   * 关键参数：`data` 传递源商品、目标商品或 SPU 映射字段。
   */
  linkSaleItem(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuSaleItem/link', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuSaleItem/quickEdit`。
   * 用途：快速编辑菜单商品。
   * 关键参数：`data` 传递菜单商品 ID 和快速编辑字段。
   */
  quickEditSaleItem(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuSaleItem/quickEdit', data);
  }

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/menu/menuSaleItem/{id}`。
   * 用途：删除菜单商品。
   * 关键参数：`id` 为菜单商品 ID。
   */
  deleteSaleItem(id: ApiPathParamValue): Promise<APIResponse> {
    return this.delete('/api/menu/menuSaleItem/{id}', undefined, undefined, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menuSaleItem/{id}`。
   * 用途：读取菜单商品详情。
   * 关键参数：`id` 为菜单商品 ID，`params` 传递展开或过滤条件。
   */
  getSaleItem(id: ApiPathParamValue, params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menuSaleItem/{id}', params, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menuSaleItems/search`。
   * 用途：搜索菜单商品。
   * 关键参数：`params` 传递关键字、分类、菜单或分页条件。
   */
  searchSaleItems(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menuSaleItems/search', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menuSaleItems/searchByName`。
   * 用途：按名称搜索菜单商品。
   * 关键参数：`params` 传递商品名称、菜单、分类或分页条件。
   */
  searchSaleItemsByName(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menuSaleItems/searchByName', params);
  }

  private get(
    swaggerPath: string,
    params?: ApiQueryParams,
    pathParams?: Record<string, ApiPathParamValue>,
  ): Promise<APIResponse> {
    return this.request.get(toApiClientPath(swaggerPath, pathParams), {
      params: toRequestParams(params),
    });
  }

  private post(swaggerPath: string, data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath(swaggerPath), { data });
  }

  private put(swaggerPath: string, data: ApiRequestData): Promise<APIResponse> {
    return this.request.put(toApiClientPath(swaggerPath), { data });
  }

  private delete(
    swaggerPath: string,
    params?: ApiQueryParams,
    data?: ApiRequestData,
    pathParams?: Record<string, ApiPathParamValue>,
  ): Promise<APIResponse> {
    return this.request.delete(toApiClientPath(swaggerPath, pathParams), {
      params: toRequestParams(params),
      data,
    });
  }
}

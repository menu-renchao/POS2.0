import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  toApiClientPath,
  toRequestParams,
  type ApiPathParamValue,
  type ApiQueryParams,
  type ApiRequestData,
} from './client-path';

export class MenuApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/checkMenuLastUpdateTime`。
   * 用途：检查菜单最后更新时间，用于缓存刷新契约校验。
   * 关键参数：`params` 传递门店、菜单或缓存相关查询条件。
   */
  checkMenuLastUpdateTime(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/checkMenuLastUpdateTime', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/clearCache`。
   * 用途：清理菜单缓存。
   * 关键参数：`data` 传递清理范围或空对象。
   */
  clearCache(data: ApiRequestData = {}): Promise<APIResponse> {
    return this.post('/api/menu/clearCache', data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/fetchGlobalOption`。
   * 用途：读取全局选项详情或树形配置。
   * 关键参数：`params` 传递菜单、选项或展开层级查询条件。
   */
  fetchGlobalOption(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/fetchGlobalOption', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/listGlobalOption`。
   * 用途：查询全局选项列表。
   * 关键参数：`params` 传递菜单、选项分类或分页查询条件。
   */
  listGlobalOption(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/listGlobalOption', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/liteMenu/{id}`。
   * 用途：读取轻量菜单信息。
   * 关键参数：`id` 为菜单 ID，`params` 传递展开层级等查询条件。
   */
  getLiteMenu(id: ApiPathParamValue, params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/liteMenu/{id}', params, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menu`。
   * 用途：查询当前菜单。
   * 关键参数：`params` 传递当前菜单查询和展开层级条件。
   */
  getCurrentMenu(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menu', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menu`。
   * 用途：创建菜单。
   * 关键参数：`data` 传递菜单名称、营业配置和展示配置字段。
   */
  createMenu(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menu', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menu`。
   * 用途：更新菜单。
   * 关键参数：`data` 传递菜单 ID 和需要更新的菜单字段。
   */
  updateMenu(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menu', data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menu/{id}`。
   * 用途：读取菜单详情。
   * 关键参数：`id` 为菜单 ID，`params` 传递展开层级、是否显示删除数据等查询条件。
   */
  getMenu(id: ApiPathParamValue, params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menu/{id}', params, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menus`。
   * 用途：查询菜单列表。
   * 关键参数：`params` 传递分页、展开层级和过滤条件。
   */
  listMenus(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menus', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/search/menu`。
   * 用途：菜单全局搜索。
   * 关键参数：`params` 传递关键字、分页和过滤条件。
   */
  searchMenu(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/search/menu', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/group/list`。
   * 用途：查询菜单组基础列表。
   * 关键参数：`params` 传递菜单 ID 或过滤条件。
   */
  listMenuGroupEntries(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/group/list', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/group/listGroupCategoryItems`。
   * 用途：查询菜单组、分类和商品聚合数据。
   * 关键参数：`params` 传递菜单组、分类或展开层级查询条件。
   */
  listGroupCategoryItems(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/group/listGroupCategoryItems', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/group/saleItem/all`。
   * 用途：查询菜单组下可选商品全集。
   * 关键参数：`params` 传递菜单组、菜单或商品过滤条件。
   */
  listMenuGroupSaleItems(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/group/saleItem/all', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuGroup`。
   * 用途：创建菜单组。
   * 关键参数：`data` 传递菜单 ID、菜单组名称和排序配置。
   */
  createMenuGroup(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuGroup', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuGroup`。
   * 用途：更新菜单组。
   * 关键参数：`data` 传递菜单组 ID 和需要更新的字段。
   */
  updateMenuGroup(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuGroup', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuGroup/batch/copy`。
   * 用途：批量复制菜单组。
   * 关键参数：`data` 传递源菜单组、目标菜单和复制选项。
   */
  copyMenuGroups(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuGroup/batch/copy', data);
  }

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/menu/menuGroup/batch/delete`。
   * 用途：批量删除菜单组。
   * 关键参数：`data` 传递要删除的菜单组 ID 集合。
   */
  deleteMenuGroups(data: ApiRequestData): Promise<APIResponse> {
    return this.delete('/api/menu/menuGroup/batch/delete', undefined, data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuGroup/batch/sequence`。
   * 用途：批量调整菜单组排序。
   * 关键参数：`data` 传递菜单组 ID 和目标顺序。
   */
  sequenceMenuGroups(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuGroup/batch/sequence', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuGroup/batch/update`。
   * 用途：批量更新菜单组。
   * 关键参数：`data` 传递菜单组 ID 集合和批量更新字段。
   */
  updateMenuGroups(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuGroup/batch/update', data);
  }

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/menu/menuGroup/{id}`。
   * 用途：删除单个菜单组。
   * 关键参数：`id` 为菜单组 ID。
   */
  deleteMenuGroup(id: ApiPathParamValue): Promise<APIResponse> {
    return this.delete('/api/menu/menuGroup/{id}', undefined, undefined, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menuGroup/{id}`。
   * 用途：读取菜单组详情。
   * 关键参数：`id` 为菜单组 ID，`params` 传递展开层级等查询条件。
   */
  getMenuGroup(id: ApiPathParamValue, params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menuGroup/{id}', params, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menuGroups`。
   * 用途：分页查询菜单组。
   * 关键参数：`params` 传递分页、菜单 ID 和过滤条件。
   */
  listMenuGroups(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menuGroups', params);
  }

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/menu/abstractCategory/batch/delete`。
   * 用途：批量删除抽象分类。
   * 关键参数：`data` 传递抽象分类 ID 集合。
   */
  deleteAbstractCategories(data: ApiRequestData): Promise<APIResponse> {
    return this.delete('/api/menu/abstractCategory/batch/delete', undefined, data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/abstractCategorys`。
   * 用途：查询抽象分类列表。
   * 关键参数：`params` 传递分页、菜单或过滤条件。
   */
  listAbstractCategories(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/abstractCategorys', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/abstractCategorys/search`。
   * 用途：搜索抽象分类。
   * 关键参数：`params` 传递关键字和分页条件。
   */
  searchAbstractCategories(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/abstractCategorys/search', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/category/list`。
   * 用途：查询分类列表。
   * 关键参数：`params` 传递菜单、菜单组或过滤条件。
   */
  listCategories(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/category/list', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menu/{menuId}/menuCategories`。
   * 用途：按菜单查询分类。
   * 关键参数：`menuId` 为菜单 ID，`params` 传递展开层级或过滤条件。
   */
  listMenuCategories(menuId: ApiPathParamValue, params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menu/{menuId}/menuCategories', params, { menuId });
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuCategory`。
   * 用途：创建菜单分类。
   * 关键参数：`data` 传递菜单组 ID、分类名称和排序配置。
   */
  createMenuCategory(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuCategory', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuCategory`。
   * 用途：更新菜单分类。
   * 关键参数：`data` 传递分类 ID 和需要更新的字段。
   */
  updateMenuCategory(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuCategory', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuCategory/batch/copy`。
   * 用途：批量复制菜单分类。
   * 关键参数：`data` 传递源分类、目标菜单组和复制选项。
   */
  copyMenuCategories(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuCategory/batch/copy', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuCategory/batch/update`。
   * 用途：批量更新菜单分类。
   * 关键参数：`data` 传递分类 ID 集合和批量更新字段。
   */
  updateMenuCategories(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuCategory/batch/update', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuCategory/quickEdit`。
   * 用途：快速编辑菜单分类。
   * 关键参数：`data` 传递分类 ID 和快速编辑字段。
   */
  quickEditMenuCategory(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuCategory/quickEdit', data);
  }

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/menu/menuCategory/{id}`。
   * 用途：删除菜单分类。
   * 关键参数：`id` 为菜单分类 ID。
   */
  deleteMenuCategory(id: ApiPathParamValue): Promise<APIResponse> {
    return this.delete('/api/menu/menuCategory/{id}', undefined, undefined, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menuCategory/{id}`。
   * 用途：读取菜单分类详情。
   * 关键参数：`id` 为菜单分类 ID，`params` 传递展开层级或过滤条件。
   */
  getMenuCategory(id: ApiPathParamValue, params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menuCategory/{id}', params, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menuCategorys/searchByName`。
   * 用途：按名称搜索菜单分类。
   * 关键参数：`params` 传递分类名称、菜单或分页条件。
   */
  searchMenuCategoriesByName(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menuCategorys/searchByName', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/globalOptionCategory`。
   * 用途：创建全局选项分类。
   * 关键参数：`data` 传递菜单、分类名称和展示配置。
   */
  createGlobalOptionCategory(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/globalOptionCategory', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/globalOptionCategory`。
   * 用途：更新全局选项分类。
   * 关键参数：`data` 传递全局选项分类 ID 和更新字段。
   */
  updateGlobalOptionCategory(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/globalOptionCategory', data);
  }

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/menu/globalOptionCategory/{id}`。
   * 用途：删除全局选项分类。
   * 关键参数：`id` 为全局选项分类 ID。
   */
  deleteGlobalOptionCategory(id: ApiPathParamValue): Promise<APIResponse> {
    return this.delete('/api/menu/globalOptionCategory/{id}', undefined, undefined, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/globalOptionCategory/{id}`。
   * 用途：读取全局选项分类详情。
   * 关键参数：`id` 为全局选项分类 ID，`params` 传递展开或过滤条件。
   */
  getGlobalOptionCategory(id: ApiPathParamValue, params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/globalOptionCategory/{id}', params, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menu/{menuId}/globalOptionCategories`。
   * 用途：按菜单查询全局选项分类。
   * 关键参数：`menuId` 为菜单 ID，`params` 传递展开层级或过滤条件。
   */
  listGlobalOptionCategories(
    menuId: ApiPathParamValue,
    params?: ApiQueryParams,
  ): Promise<APIResponse> {
    return this.get('/api/menu/menu/{menuId}/globalOptionCategories', params, { menuId });
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/batchCustomizeGlobalOptionPriceAndMemberPrices`。
   * 用途：批量自定义全局选项价格和会员价。
   * 关键参数：`data` 传递全局选项 ID 集合和价格配置。
   */
  customizeGlobalOptionPrices(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/batchCustomizeGlobalOptionPriceAndMemberPrices', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuGlobalOption`。
   * 用途：创建菜单全局选项。
   * 关键参数：`data` 传递全局选项分类、名称和价格字段。
   */
  createMenuGlobalOption(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuGlobalOption', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuGlobalOption`。
   * 用途：更新菜单全局选项。
   * 关键参数：`data` 传递全局选项 ID 和更新字段。
   */
  updateMenuGlobalOption(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuGlobalOption', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/menu/menuGlobalOption/batch/copy`。
   * 用途：批量复制菜单全局选项。
   * 关键参数：`data` 传递源全局选项、目标分类和复制选项。
   */
  copyMenuGlobalOptions(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/menu/menuGlobalOption/batch/copy', data);
  }

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/menu/menuGlobalOption/batch/delete`。
   * 用途：批量删除菜单全局选项。
   * 关键参数：`data` 传递全局选项 ID 集合。
   */
  deleteMenuGlobalOptions(data: ApiRequestData): Promise<APIResponse> {
    return this.delete('/api/menu/menuGlobalOption/batch/delete', undefined, data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuGlobalOption/batch/sequence`。
   * 用途：批量调整菜单全局选项排序。
   * 关键参数：`data` 传递全局选项 ID 和目标顺序。
   */
  sequenceMenuGlobalOptions(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuGlobalOption/batch/sequence', data);
  }

  /**
   * HTTP method: PUT；Swagger 原始 path：`/api/menu/menuGlobalOption/batch/update`。
   * 用途：批量更新菜单全局选项。
   * 关键参数：`data` 传递全局选项 ID 集合和批量更新字段。
   */
  updateMenuGlobalOptions(data: ApiRequestData): Promise<APIResponse> {
    return this.put('/api/menu/menuGlobalOption/batch/update', data);
  }

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/menu/menuGlobalOption/{id}`。
   * 用途：删除菜单全局选项。
   * 关键参数：`id` 为菜单全局选项 ID。
   */
  deleteMenuGlobalOption(id: ApiPathParamValue): Promise<APIResponse> {
    return this.delete('/api/menu/menuGlobalOption/{id}', undefined, undefined, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menuGlobalOption/{id}`。
   * 用途：读取菜单全局选项详情。
   * 关键参数：`id` 为菜单全局选项 ID，`params` 传递展开或过滤条件。
   */
  getMenuGlobalOption(id: ApiPathParamValue, params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menuGlobalOption/{id}', params, { id });
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/menu/menuGlobalOptions/search`。
   * 用途：搜索菜单全局选项。
   * 关键参数：`params` 传递关键字、分类、菜单或分页条件。
   */
  searchMenuGlobalOptions(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/menu/menuGlobalOptions/search', params);
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

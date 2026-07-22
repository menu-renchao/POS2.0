import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  toApiClientPath,
  toRequestParams,
  type ApiQueryParams,
  type ApiRequestData,
} from './client-path';

export class AdminConfigApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /** 查询员工列表。 */
  listStaff(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/staff/member/list', params);
  }

  /** 创建或更新员工。 */
  saveStaff(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/staff/member/save', data);
  }

  /** 软删除测试员工。 */
  deleteStaff(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/staff/member/delete', data);
  }

  /** 根据员工口令和功能 ID 实时校验权限。 */
  checkPrivilege(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/admin/privilege/check', data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/admin/role/list`。
   * 用途：查询角色列表。
   * 关键参数：`params` 传递分页、关键字或角色状态过滤条件。
   */
  listRoles(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/admin/role/list', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/admin/role/save`。
   * 用途：保存角色。
   * 关键参数：`data` 传递角色名称、权限配置和角色 ID。
   */
  saveRole(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/admin/role/save', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/admin/role/delete`。
   * 用途：删除角色。
   * 关键参数：`data` 传递角色 ID 或角色删除条件。
   */
  deleteRole(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/admin/role/delete', data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/tax/list`。
   * 用途：查询税费列表。
   * 关键参数：`params` 传递分页、关键字或税费状态过滤条件。
   */
  listTaxes(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/tax/list', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/tax/save`。
   * 用途：保存税费配置。
   * 关键参数：`data` 传递税费名称、税率、适用范围和税费 ID。
   */
  saveTax(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/tax/save', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/tax/delete`。
   * 用途：删除税费配置。
   * 关键参数：`data` 传递税费 ID 或删除条件。
   */
  deleteTax(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/tax/delete', data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/discount/list`。
   * 用途：查询折扣列表。
   * 关键参数：`params` 传递分页、关键字或折扣状态过滤条件。
   */
  listDiscounts(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/discount/list', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/discount/save`。
   * 用途：保存折扣配置。
   * 关键参数：`data` 传递折扣名称、折扣值、适用范围和折扣 ID。
   */
  saveDiscount(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/discount/save', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/discount/delete`。
   * 用途：删除折扣配置。
   * 关键参数：`data` 传递折扣 ID 或删除条件。
   */
  deleteDiscount(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/discount/delete', data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/charge/list`。
   * 用途：查询附加费列表。
   * 关键参数：`params` 传递关键字或附加费过滤条件。
   */
  listCharges(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/charge/list', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/charge/save`。
   * 用途：保存附加费配置。
   * 关键参数：`data.charge` 传递附加费名称、费率、类型、触发方式和附加费 ID。
   */
  saveCharge(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/charge/save', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/charge/delete`。
   * 用途：删除附加费配置。
   * 关键参数：`data.chargeId` 传递附加费 ID。
   */
  deleteCharge(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/charge/delete', data);
  }

  private get(swaggerPath: string, params?: ApiQueryParams): Promise<APIResponse> {
    return this.request.get(toApiClientPath(swaggerPath), { params: toRequestParams(params) });
  }

  private post(swaggerPath: string, data: ApiRequestData): Promise<APIResponse> {
    return this.request.post(toApiClientPath(swaggerPath), { data });
  }
}

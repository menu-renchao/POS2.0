import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  toApiClientPath,
  toRequestParams,
  type ApiPathParamValue,
  type ApiQueryParams,
  type ApiRequestData,
} from './client-path';
import { expectResponseEnvelope } from '../core/api-response';
import {
  extractOrderCharges,
  type OrderChargeReadModel,
} from '../read-models/order.read-model';

export class OrderApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/order/checkOrderExistsByPhoneAndMember`。
   * 用途：按手机号和会员信息检查订单是否存在。
   * 关键参数：`params` 传递手机号、会员 ID 或订单过滤条件。
   */
  checkOrderExistsByPhoneAndMember(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/order/checkOrderExistsByPhoneAndMember', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/clearTable`。
   * 用途：清理桌台订单状态。
   * 关键参数：`data` 传递桌台 ID、订单 ID 或清台原因。
   */
  clearTable(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/order/clearTable', data);
  }

  async clearTableOrders(orderIds: number[]): Promise<void> {
    if (
      orderIds.length === 0 ||
      orderIds.some((orderId) => !Number.isInteger(orderId) || orderId <= 0)
    ) {
      throw new Error('清理桌台时必须提供至少一个有效的订单 ID。');
    }

    const response = await this.clearTable({ orderIds });
    const body: unknown = await response.json();
    expectResponseEnvelope(body);

    if (!response.ok() || body.code !== 0) {
      throw new Error(
        `清理桌台订单失败：HTTP ${response.status()}，code=${body.code}，msg=${body.msg}`,
      );
    }
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/combine`。
   * 用途：合并多个订单。
   * 关键参数：`data` 传递源订单 ID、目标订单 ID 和合单配置。
   */
  combine(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/order/combine', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/dailyClose`。
   * 用途：触发订单日结。
   * 关键参数：`data` 传递营业日或日结参数。
   */
  dailyClose(data: ApiRequestData = {}): Promise<APIResponse> {
    return this.post('/api/order/dailyClose', data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/order/detail/list`。
   * 用途：查询订单明细列表。
   * 关键参数：`params` 传递订单 ID、日期、分页或过滤条件。
   */
  listOrderDetails(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/order/detail/list', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/order/fetch`。
   * 用途：读取订单详情。
   * 关键参数：`params` 传递订单 ID、订单号或读取选项。
   */
  fetchOrder(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/order/fetch', params);
  }

  async readOrderCharges(orderId: number): Promise<OrderChargeReadModel[]> {
    const response = await this.fetchOrder({ orderId, fetchPayments: true });
    const body: unknown = await response.json();
    expectResponseEnvelope(body);

    if (!response.ok() || body.code !== 0) {
      throw new Error(
        `读取订单 ${orderId} 加收失败：HTTP ${response.status()}，code=${body.code}，msg=${body.msg}`,
      );
    }

    return extractOrderCharges(body.data);
  }

  async readOrderChargeAmount(
    orderId: number,
    chargeName: string,
  ): Promise<number | null> {
    const charges = await this.readOrderCharges(orderId);
    return charges.find((charge) => charge.name === chargeName)?.amount ?? null;
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/item/move`。
   * 用途：移动订单商品到目标订单或目标桌台。
   * 关键参数：`data` 传递订单商品 ID、源订单 ID 和目标订单信息。
   */
  moveOrderItem(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/order/item/move', data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/order/list`。
   * 用途：查询订单列表。
   * 关键参数：`params` 传递日期、状态、分页或订单类型过滤条件。
   */
  listOrders(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/order/list', params);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/order/listDeliveryTrack`。
   * 用途：查询订单配送跟踪列表。
   * 关键参数：`params` 传递订单 ID、配送状态或分页条件。
   */
  listDeliveryTrack(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/order/listDeliveryTrack', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/listOrdersByDateNumber`。
   * 用途：按日期编号查询订单。
   * 关键参数：`data` 传递营业日期、订单编号或查询范围。
   */
  listOrdersByDateNumber(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/order/listOrdersByDateNumber', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/notice/send`。
   * 用途：发送订单通知。
   * 关键参数：`data` 传递订单 ID、通知类型和接收方信息。
   */
  sendNotice(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/order/notice/send', data);
  }

  /**
   * HTTP method: GET；Swagger 原始 path：`/api/order/recall`。
   * 用途：查询可召回订单。
   * 关键参数：`params` 传递日期、订单状态、订单类型或分页条件。
   */
  recall(params?: ApiQueryParams): Promise<APIResponse> {
    return this.get('/api/order/recall', params);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/save`。
   * 用途：保存订单。
   * 关键参数：`data` 传递订单头、商品明细、桌台和顾客信息。
   */
  saveOrder(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/order/save', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/save/batch`。
   * 用途：批量保存订单。
   * 关键参数：`data` 传递多笔订单保存请求。
   */
  saveOrdersBatch(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/order/save/batch', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/void`。
   * 用途：作废订单。
   * 关键参数：`data` 传递订单 ID、作废原因和员工上下文。
   */
  voidOrder(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/order/void', data);
  }

  async voidOrderById(orderId: number): Promise<void> {
    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new Error('作废订单时必须提供有效的订单 ID。');
    }

    const response = await this.voidOrder({
      id: orderId,
      orderId,
      reason: 'UI_AUTOMATION_CLEANUP',
    });
    const body: unknown = await response.json();
    expectResponseEnvelope(body);

    if (!response.ok() || body.code !== 0) {
      throw new Error(
        `作废 UI 测试订单失败：orderId=${orderId}，HTTP ${response.status()}，code=${body.code}，msg=${body.msg}`,
      );
    }
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/{id}/reopen`。
   * 用途：重开指定订单。
   * 关键参数：`id` 为订单 ID，`data` 传递重开原因或员工上下文。
   */
  reopenOrder(id: ApiPathParamValue, data: ApiRequestData = {}): Promise<APIResponse> {
    return this.post('/api/order/{id}/reopen', data, { id });
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/order/{id}/split`。
   * 用途：拆分指定订单。
   * 关键参数：`id` 为订单 ID，`data` 传递拆分后的商品、数量和目标订单信息。
   */
  splitOrder(id: ApiPathParamValue, data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/order/{id}/split', data, { id });
  }

  private get(swaggerPath: string, params?: ApiQueryParams): Promise<APIResponse> {
    return this.request.get(toApiClientPath(swaggerPath), { params: toRequestParams(params) });
  }

  private post(
    swaggerPath: string,
    data: ApiRequestData,
    pathParams?: Record<string, ApiPathParamValue>,
  ): Promise<APIResponse> {
    return this.request.post(toApiClientPath(swaggerPath, pathParams), { data });
  }
}

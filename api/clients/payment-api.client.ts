import type { APIRequestContext, APIResponse } from '@playwright/test';
import {
  toApiClientPath,
  toRequestParams,
  type ApiPathParamValue,
  type ApiQueryParams,
  type ApiRequestData,
} from './client-path';

export class PaymentApiClient {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * HTTP method: DELETE；Swagger 原始 path：`/api/payment/deletePaymentRecord`。
   * 用途：删除支付记录。
   * 关键参数：`params` 传递支付记录 ID 或订单 ID 查询参数，`data` 可传递删除上下文。
   */
  deletePaymentRecord(
    params?: ApiQueryParams,
    data?: ApiRequestData,
  ): Promise<APIResponse> {
    return this.request.delete(toApiClientPath('/api/payment/deletePaymentRecord'), {
      params: toRequestParams(params),
      data,
    });
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/payment/record/delete`。
   * 用途：通过兼容接口删除支付记录。
   * 关键参数：`data` 传递支付记录 ID、订单 ID 或删除原因。
   */
  deleteRecord(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/payment/record/delete', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/payment/record/save`。
   * 用途：保存支付记录。
   * 关键参数：`data` 传递订单 ID、支付方式、金额和员工上下文。
   */
  saveRecord(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/payment/record/save', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/payment/record/save/batch`。
   * 用途：批量保存支付记录。
   * 关键参数：`data` 传递多笔支付记录。
   */
  saveRecordsBatch(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/payment/record/save/batch', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/payment/refund`。
   * 用途：发起支付退款。
   * 关键参数：`data` 传递支付记录 ID、退款金额和退款原因。
   */
  refund(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/payment/refund', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/payment/savePaymentRecord`。
   * 用途：通过旧版接口保存支付记录。
   * 关键参数：`data` 传递订单 ID、支付方式、金额和支付上下文。
   */
  savePaymentRecord(data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/payment/savePaymentRecord', data);
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/payment/{id}/tip`。
   * 用途：调整指定支付记录的小费。
   * 关键参数：`id` 为支付记录 ID，`data` 传递小费金额和调整原因。
   */
  updateTip(id: ApiPathParamValue, data: ApiRequestData): Promise<APIResponse> {
    return this.post('/api/payment/{id}/tip', data, { id });
  }

  /**
   * HTTP method: POST；Swagger 原始 path：`/api/payment/{id}/void`。
   * 用途：撤销指定支付记录。
   * 关键参数：`id` 为支付记录 ID，`data` 传递撤销原因和员工上下文。
   */
  voidPayment(id: ApiPathParamValue, data: ApiRequestData = {}): Promise<APIResponse> {
    return this.post('/api/payment/{id}/void', data, { id });
  }

  private post(
    swaggerPath: string,
    data: ApiRequestData,
    pathParams?: Record<string, ApiPathParamValue>,
  ): Promise<APIResponse> {
    return this.request.post(toApiClientPath(swaggerPath, pathParams), { data });
  }
}

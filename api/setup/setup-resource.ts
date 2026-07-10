import type { APIResponse } from '@playwright/test';
import type { ApiRequestData } from '../clients/client-path';
import { expectResponseEnvelope, type ApiEnvelope } from '../core/api-response';
import type { ResourceId, ResourceRegistry } from '../core/resource-registry';

export type SetupResource<TRequest extends ApiRequestData = ApiRequestData> = {
  id: ResourceId;
  name: string;
  request: TRequest;
  body: ApiEnvelope<unknown>;
};

export type SetupResourceOptions<TRequest extends ApiRequestData = ApiRequestData> = {
  type: string;
  name: string;
  request: TRequest;
  resourceRegistry: ResourceRegistry;
  cleanupPriority?: number;
  save: () => Promise<APIResponse>;
  list?: () => Promise<APIResponse>;
  cleanup: (id: ResourceId) => Promise<unknown>;
};

export async function createSetupResource<TRequest extends ApiRequestData>(
  options: SetupResourceOptions<TRequest>,
): Promise<SetupResource<TRequest>> {
  const body = await expectOkEnvelope(await options.save());
  let id = extractResourceId(body);

  if (id === undefined && options.list !== undefined) {
    const listBody = await expectOkEnvelope(await options.list());
    id = findResourceIdByName(listBody.data, options.name);
  }

  if (id === undefined) {
    throw new Error(`${options.type} 创建后未能通过响应或列表解析到资源 ID。`);
  }

  options.resourceRegistry.register({
    type: options.type,
    id,
    name: options.name,
    cleanupPriority: options.cleanupPriority ?? 30,
    cleanup: () => options.cleanup(id),
  });

  return {
    id,
    name: options.name,
    request: options.request,
    body,
  };
}

export async function expectOkEnvelope(response: APIResponse): Promise<ApiEnvelope<unknown>> {
  if (response.status() >= 500) {
    throw new Error(`API setup request failed with status ${response.status()}。`);
  }

  const body: unknown = await response.json();
  expectResponseEnvelope(body);

  if (body.code !== 0) {
    throw new Error(`API setup request returned code=${body.code}, msg=${body.msg}。`);
  }

  return body;
}

export function extractResourceId(value: unknown): ResourceId | undefined {
  return extractResourceIdValue(value, new Set<object>());
}

export function findResourceIdByName(value: unknown, name: string): ResourceId | undefined {
  return findResourceIdByNameValue(value, name, new Set<object>());
}

function findResourceIdByNameValue(
  value: unknown,
  name: string,
  seen: Set<object>,
): ResourceId | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = findResourceIdByNameValue(item, name, seen);

      if (id !== undefined) {
        return id;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (recordHasName(value, name)) {
    return extractIdFromRecord(value);
  }

  for (const item of Object.values(value)) {
    const id = findResourceIdByNameValue(item, name, seen);

    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function recordHasName(record: Record<string, unknown>, name: string): boolean {
  return [
    'name',
    'displayName',
    'posName',
    'menuName',
    'menuGroupName',
    'categoryName',
    'menuCategoryName',
    'saleItemName',
    'taxName',
    'discountName',
    'chargeName',
  ].some((key) => record[key] === name);
}

function extractIdFromRecord(record: Record<string, unknown>): ResourceId | undefined {
  for (const key of [
    'id',
    'taxId',
    'discountId',
    'chargeId',
    'menuId',
    'menuGroupId',
    'categoryId',
    'menuCategoryId',
    'menuSaleItemId',
    'saleItemId',
    'itemId',
  ]) {
    const value = record[key];

    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

function extractResourceIdValue(value: unknown, seen: Set<object>): ResourceId | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return undefined;
    }
    seen.add(value);

    for (const item of value) {
      const id = extractResourceIdValue(item, seen);

      if (id !== undefined) {
        return id;
      }
    }

    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  const record = value as Record<string, unknown>;
  const directId = extractIdFromRecord(record);
  if (directId !== undefined) {
    return directId;
  }

  for (const item of Object.values(record)) {
    const id = extractResourceIdValue(item, seen);

    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

const DISCOUNT_LIST_IDENTITY = { method: 'GET', path: '/api/discount/list' } as const;
const DISCOUNT_SAVE_IDENTITY = { method: 'POST', path: '/api/discount/save' } as const;
const DISCOUNT_DELETE_IDENTITY = { method: 'POST', path: '/api/discount/delete' } as const;

test.describe('折扣 endpoint', () => {
  test(
    toEndpointTitle(DISCOUNT_LIST_IDENTITY.method, DISCOUNT_LIST_IDENTITY.path, '应能查询折扣列表'),
    async ({ adminConfigApi }) => {
      const data = await test.step(
        toEndpointTitle(DISCOUNT_LIST_IDENTITY.method, DISCOUNT_LIST_IDENTITY.path, '请求折扣列表并校验响应'),
        async () => {
          const body = await expectApiOk(await adminConfigApi.listDiscounts(), DISCOUNT_LIST_IDENTITY);
          const listData = resolveListData(body.data, DISCOUNT_LIST_IDENTITY);
          return expectArrayData({ ...body, data: listData }, DISCOUNT_LIST_IDENTITY);
        },
      );

      expect(data.length).toBeGreaterThanOrEqual(0);
    },
  );

  test(
    toEndpointTitle(DISCOUNT_SAVE_IDENTITY.method, DISCOUNT_SAVE_IDENTITY.path, '应能保存折扣'),
    async ({ endpointResources }) => {
      const resource = await test.step(
        toEndpointTitle(DISCOUNT_SAVE_IDENTITY.method, DISCOUNT_SAVE_IDENTITY.path, '通过 endpointResources 保存折扣'),
        async () => await endpointResources.createDiscountResource(),
      );
      const request = resource.request as { name?: string; rate?: number };

      expect(resource.id).not.toBeUndefined();
      expect(resource.name).toBe(request.name);
    },
  );

  test(
    toEndpointTitle(DISCOUNT_DELETE_IDENTITY.method, DISCOUNT_DELETE_IDENTITY.path, '应能删除本次创建的折扣'),
    async ({ adminConfigApi, endpointResources, resourceRegistry }) => {
      const resource = await test.step(
        toEndpointTitle(DISCOUNT_SAVE_IDENTITY.method, DISCOUNT_SAVE_IDENTITY.path, '创建待删除折扣'),
        async () => await endpointResources.createDiscountResource(),
      );
      await test.step(
        toEndpointTitle(DISCOUNT_DELETE_IDENTITY.method, DISCOUNT_DELETE_IDENTITY.path, '调用折扣删除接口并校验响应'),
        async () => {
          await expectApiOk(await adminConfigApi.deleteDiscount({ discountId: resource.id }), DISCOUNT_DELETE_IDENTITY);
        },
      );

      resourceRegistry.markCleaned('discount', resource.id);
    },
  );
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveListData(
  value: unknown,
  identity: typeof DISCOUNT_LIST_IDENTITY,
): Record<string, unknown>[] {
  const listData = findListData(value, new Set<object>());

  if (listData === undefined) {
    throw new Error(toEndpointTitle(identity.method, identity.path, '未能从响应中解析 list 数组'));
  }

  if (!isRecordArray(listData)) {
    throw new Error(toEndpointTitle(identity.method, identity.path, '列表数组应为对象数组'));
  }

  return listData;
}

function isRecordArray(value: unknown[]): value is Record<string, unknown>[] {
  return value.every(isRecord);
}

function findListData(value: unknown, seen: Set<object>): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }

  const valueRecord = value;
  seen.add(valueRecord);

  const directListKeys = ['records', 'rows', 'list', 'items', 'data'];
  for (const key of directListKeys) {
    const candidate = valueRecord[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  for (const nestedValue of Object.values(valueRecord)) {
    const nestedList = findListData(nestedValue, seen);
    if (nestedList !== undefined) {
      return nestedList;
    }
  }

  return undefined;
}

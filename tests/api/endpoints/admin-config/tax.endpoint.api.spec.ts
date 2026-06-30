import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

const TAX_LIST_IDENTITY = { method: 'GET', path: '/api/tax/list' } as const;
const TAX_SAVE_IDENTITY = { method: 'POST', path: '/api/tax/save' } as const;
const TAX_DELETE_IDENTITY = { method: 'POST', path: '/api/tax/delete' } as const;

test.describe('税费 endpoint', () => {
  test(
    toEndpointTitle(TAX_LIST_IDENTITY.method, TAX_LIST_IDENTITY.path, '应能查询税费列表'),
    async ({ adminConfigApi }) => {
      const data = await test.step(
        toEndpointTitle(TAX_LIST_IDENTITY.method, TAX_LIST_IDENTITY.path, '请求税费列表并校验响应'),
        async () => {
          const body = await expectApiOk(await adminConfigApi.listTaxes(), TAX_LIST_IDENTITY);
          const listData = resolveListData(body.data, TAX_LIST_IDENTITY);
          return expectArrayData({ ...body, data: listData }, TAX_LIST_IDENTITY);
        },
      );

      expect(data.length).toBeGreaterThanOrEqual(0);
    },
  );

  test(
    toEndpointTitle(TAX_SAVE_IDENTITY.method, TAX_SAVE_IDENTITY.path, '应能保存税费'),
    async ({ endpointResources }) => {
      const resource = await test.step(
        toEndpointTitle(TAX_SAVE_IDENTITY.method, TAX_SAVE_IDENTITY.path, '通过 endpointResources 保存税费'),
        async () => await endpointResources.createTaxResource(),
      );
      const request = resource.request as { tax?: { name?: string } };

      expect(resource.id).not.toBeUndefined();
      expect(resource.name).toBe(request.tax?.name);
    },
  );

  test(
    toEndpointTitle(TAX_DELETE_IDENTITY.method, TAX_DELETE_IDENTITY.path, '应能删除本次创建的税费'),
    async ({ adminConfigApi, endpointResources, resourceRegistry }) => {
      const resource = await test.step(
        toEndpointTitle(TAX_SAVE_IDENTITY.method, TAX_SAVE_IDENTITY.path, '创建待删除税费'),
        async () => await endpointResources.createTaxResource(),
      );
      await test.step(
        toEndpointTitle(TAX_DELETE_IDENTITY.method, TAX_DELETE_IDENTITY.path, '调用税费删除接口并校验响应'),
        async () => {
          await expectApiOk(await adminConfigApi.deleteTax({ taxId: resource.id }), TAX_DELETE_IDENTITY);
        },
      );

      resourceRegistry.markCleaned('tax', resource.id);
    },
  );
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveListData(value: unknown, identity: typeof TAX_LIST_IDENTITY): Record<string, unknown>[] {
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

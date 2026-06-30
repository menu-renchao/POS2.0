import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

const ROLE_LIST_IDENTITY = { method: 'GET', path: '/api/admin/role/list' } as const;
const ROLE_SAVE_IDENTITY = { method: 'POST', path: '/api/admin/role/save' } as const;
const ROLE_DELETE_IDENTITY = { method: 'POST', path: '/api/admin/role/delete' } as const;

test.describe('角色 endpoint', () => {
  test(
    toEndpointTitle(ROLE_LIST_IDENTITY.method, ROLE_LIST_IDENTITY.path, '应能查询角色列表'),
    async ({ adminConfigApi }) => {
      const data = await test.step(
        toEndpointTitle(ROLE_LIST_IDENTITY.method, ROLE_LIST_IDENTITY.path, '请求角色列表并校验响应'),
        async () => {
          const body = await expectApiOk(await adminConfigApi.listRoles(), ROLE_LIST_IDENTITY);
          const listData = resolveListData(body.data, ROLE_LIST_IDENTITY);
          return expectArrayData({ ...body, data: listData }, ROLE_LIST_IDENTITY);
        },
      );

      expect(data.length).toBeGreaterThanOrEqual(0);
    },
  );

  test(
    toEndpointTitle(ROLE_SAVE_IDENTITY.method, ROLE_SAVE_IDENTITY.path, '应能保存角色'),
    async ({ endpointResources }) => {
      const resource = await test.step(
        toEndpointTitle(ROLE_SAVE_IDENTITY.method, ROLE_SAVE_IDENTITY.path, '通过 endpointResources 保存角色'),
        async () => await endpointResources.createRoleResource(),
      );
      const request = resource.request as { role?: { name?: string } };

      expect(resource.id).not.toBeUndefined();
      expect(resource.name).toBe(request.role?.name);
    },
  );

  test(
    toEndpointTitle(ROLE_DELETE_IDENTITY.method, ROLE_DELETE_IDENTITY.path, '应能删除本次创建的角色'),
    async ({ adminConfigApi, endpointResources, resourceRegistry }) => {
      const resource = await test.step(
        toEndpointTitle(ROLE_SAVE_IDENTITY.method, ROLE_SAVE_IDENTITY.path, '创建待删除角色'),
        async () => await endpointResources.createRoleResource(),
      );
      await test.step(
        toEndpointTitle(ROLE_DELETE_IDENTITY.method, ROLE_DELETE_IDENTITY.path, '调用角色删除接口并校验响应'),
        async () => {
          await expectApiOk(await adminConfigApi.deleteRole({ roleId: resource.id }), ROLE_DELETE_IDENTITY);
        },
      );

      resourceRegistry.markCleaned('role', resource.id);
    },
  );
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveListData(value: unknown, identity: typeof ROLE_LIST_IDENTITY): Record<string, unknown>[] {
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

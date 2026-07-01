import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectApiRejected, expectArrayData } from '../../support/endpoint-assertions';
import { extractEndpointListData } from '../../support/endpoint-list-data';
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
          const listData = extractEndpointListData(body.data, ROLE_LIST_IDENTITY);
          return expectArrayData({ ...body, data: listData }, ROLE_LIST_IDENTITY);
        },
      );

      expect(data.length === 0 || data.some((item) => 'id' in item || 'name' in item || 'displayName' in item)).toBe(true);
    },
  );

  test(
    toEndpointTitle(ROLE_LIST_IDENTITY.method, ROLE_LIST_IDENTITY.path, '分页边界 pageSize=1 应返回可解析列表'),
    async ({ adminConfigApi }) => {
      const data = await test.step(
        toEndpointTitle(ROLE_LIST_IDENTITY.method, ROLE_LIST_IDENTITY.path, '使用 pageSize=1 查询角色列表并校验响应'),
        async () => {
          const body = await expectApiOk(
            await adminConfigApi.listRoles({ page: 1, pageSize: 1 }),
            ROLE_LIST_IDENTITY,
          );
          const listData = extractEndpointListData(body.data, ROLE_LIST_IDENTITY);

          return expectArrayData({ ...body, data: listData }, ROLE_LIST_IDENTITY);
        },
      );

      expect(Array.isArray(data)).toBe(true);
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
    toEndpointTitle(ROLE_SAVE_IDENTITY.method, ROLE_SAVE_IDENTITY.path, '缺少必填字段应返回异常'),
    async ({ adminConfigApi }) => {
      await test.step(
        toEndpointTitle(ROLE_SAVE_IDENTITY.method, ROLE_SAVE_IDENTITY.path, '提交空角色配置并校验拒绝响应'),
        async () => {
          await expectApiRejected(await adminConfigApi.saveRole({}), ROLE_SAVE_IDENTITY);
        },
      );
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

      expect(resourceRegistry.markCleaned('role', resource.id)).toBe(true);
    },
  );

  test(
    toEndpointTitle(ROLE_DELETE_IDENTITY.method, ROLE_DELETE_IDENTITY.path, '删除不存在角色应返回异常'),
    async ({ adminConfigApi }) => {
      await test.step(
        toEndpointTitle(ROLE_DELETE_IDENTITY.method, ROLE_DELETE_IDENTITY.path, '提交不存在角色 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(await adminConfigApi.deleteRole({ roleId: 2147483647 }), ROLE_DELETE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(ROLE_DELETE_IDENTITY.method, ROLE_DELETE_IDENTITY.path, '缺少角色 ID 应返回异常'),
    async ({ adminConfigApi }) => {
      await test.step(
        toEndpointTitle(ROLE_DELETE_IDENTITY.method, ROLE_DELETE_IDENTITY.path, '提交空角色删除请求并校验拒绝响应'),
        async () => {
          await expectApiRejected(await adminConfigApi.deleteRole({}), ROLE_DELETE_IDENTITY);
        },
      );
    },
  );
});

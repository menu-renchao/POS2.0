import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectApiRejected, expectArrayData } from '../../support/endpoint-assertions';
import { extractEndpointListData } from '../../support/endpoint-list-data';
import { toEndpointTitle } from '../../support/endpoint-case';
import taxListResponseSchema from '../../schemas/admin-config/tax-list-response.schema.json';
import { expectJsonSchema } from '../../support/json-schema';

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
          expectJsonSchema(body, taxListResponseSchema, `${TAX_LIST_IDENTITY.method} ${TAX_LIST_IDENTITY.path}`);
          const listData = extractEndpointListData(body.data, TAX_LIST_IDENTITY);
          return expectArrayData({ ...body, data: listData }, TAX_LIST_IDENTITY);
        },
      );

      expect(data.length === 0 || data.some((item) => 'id' in item || 'name' in item || 'displayName' in item)).toBe(true);
    },
  );

  test(
    toEndpointTitle(TAX_LIST_IDENTITY.method, TAX_LIST_IDENTITY.path, '分页边界 pageSize=1 应返回可解析列表'),
    async ({ adminConfigApi }) => {
      const data = await test.step(
        toEndpointTitle(TAX_LIST_IDENTITY.method, TAX_LIST_IDENTITY.path, '使用 pageSize=1 查询税费列表并校验响应'),
        async () => {
          const body = await expectApiOk(
            await adminConfigApi.listTaxes({ page: 1, pageSize: 1 }),
            TAX_LIST_IDENTITY,
          );
          expectJsonSchema(body, taxListResponseSchema, `${TAX_LIST_IDENTITY.method} ${TAX_LIST_IDENTITY.path}`);
          const listData = extractEndpointListData(body.data, TAX_LIST_IDENTITY);

          return expectArrayData({ ...body, data: listData }, TAX_LIST_IDENTITY);
        },
      );

      expect(Array.isArray(data)).toBe(true);
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
    toEndpointTitle(TAX_SAVE_IDENTITY.method, TAX_SAVE_IDENTITY.path, '缺少必填字段应返回异常'),
    async ({ adminConfigApi }) => {
      await test.step(
        toEndpointTitle(TAX_SAVE_IDENTITY.method, TAX_SAVE_IDENTITY.path, '提交空税费配置并校验拒绝响应'),
        async () => {
          await expectApiRejected(await adminConfigApi.saveTax({}), TAX_SAVE_IDENTITY);
        },
      );
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

      expect(resourceRegistry.markCleaned('tax', resource.id)).toBe(true);
    },
  );

  test(
    toEndpointTitle(TAX_DELETE_IDENTITY.method, TAX_DELETE_IDENTITY.path, '删除不存在税费应返回异常'),
    async ({ adminConfigApi }) => {
      await test.step(
        toEndpointTitle(TAX_DELETE_IDENTITY.method, TAX_DELETE_IDENTITY.path, '提交不存在税费 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(await adminConfigApi.deleteTax({ taxId: 2147483647 }), TAX_DELETE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(TAX_DELETE_IDENTITY.method, TAX_DELETE_IDENTITY.path, '缺少税费 ID 应返回异常'),
    async ({ adminConfigApi }) => {
      await test.step(
        toEndpointTitle(TAX_DELETE_IDENTITY.method, TAX_DELETE_IDENTITY.path, '提交空税费删除请求并校验拒绝响应'),
        async () => {
          await expectApiRejected(await adminConfigApi.deleteTax({}), TAX_DELETE_IDENTITY);
        },
      );
    },
  );
});

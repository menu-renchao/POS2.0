import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { extractEndpointListData } from '../../support/endpoint-list-data';
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
          const listData = extractEndpointListData(body.data, DISCOUNT_LIST_IDENTITY);
          return expectArrayData({ ...body, data: listData }, DISCOUNT_LIST_IDENTITY);
        },
      );

      expect(data.length).toBeGreaterThanOrEqual(0);
      expect(
        data.length === 0 ||
          data.some((item) => 'id' in item || 'name' in item || 'displayName' in item),
      ).toBe(true);
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

import { expect, test } from '../../support/endpoint-fixture';
import { buildSaleItemRequest } from '../../../../test-data/api/menu-api-data';
import { expectApiOk, expectApiRejected } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';
import type { EndpointResources } from '../../support/endpoint-resources';

const SALE_ITEM_CREATE_IDENTITY = { method: 'POST', path: '/api/menu/menuSaleItem' } as const;
const SALE_ITEM_UPDATE_IDENTITY = { method: 'PUT', path: '/api/menu/menuSaleItem' } as const;
const SALE_ITEM_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/menuSaleItem/{id}' } as const;
const SALE_ITEM_DELETE_IDENTITY = { method: 'DELETE', path: '/api/menu/menuSaleItem/{id}' } as const;
const SALE_ITEM_FETCH_IDENTITY = { method: 'GET', path: '/api/menu/item/fetchSaleItem' } as const;
const SALE_ITEM_SEARCH_IDENTITY = { method: 'GET', path: '/api/menu/menuSaleItems/search' } as const;
const SALE_ITEM_SEARCH_BY_NAME_IDENTITY = { method: 'GET', path: '/api/menu/menuSaleItems/searchByName' } as const;

test.describe('商品 endpoint', () => {
  test(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '应能创建商品'),
    async ({ endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '先创建菜单用于商品创建'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '先创建菜单组用于商品创建'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const categoryResource = await test.step(
        toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '先创建分类用于商品创建'),
        async () =>
          await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );
      const resource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '通过 endpointResources 创建商品',
        ),
        async () =>
          await endpointResources.createSaleItemResource(
            menuResource.id,
            menuGroupResource.id,
            categoryResource.id,
          ),
      );

      const request = resource.request as { name?: string };

      expect(resource.id).not.toBeUndefined();
      expect(resource.name).toBe(request.name);
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_FETCH_IDENTITY.method, SALE_ITEM_FETCH_IDENTITY.path, '应能读取商品业务详情'),
    async ({ endpointResources, saleItemApi }) => {
      const { menuResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品业务详情读取',
      );
      const body = await test.step(
        toEndpointTitle(SALE_ITEM_FETCH_IDENTITY.method, SALE_ITEM_FETCH_IDENTITY.path, '按商品 ID 读取业务详情并校验响应'),
        async () =>
          await expectApiOk(
            await saleItemApi.fetchSaleItem({
              itemId: saleItemResource.id,
              menuId: menuResource.id,
              menuSaleItemId: saleItemResource.id,
              fetchOptions: true,
              includeCategoryAttributesAndOptions: true,
            }),
            SALE_ITEM_FETCH_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_SEARCH_BY_NAME_IDENTITY.method, SALE_ITEM_SEARCH_BY_NAME_IDENTITY.path, '应能按名称搜索商品'),
    async ({ endpointResources, saleItemApi }) => {
      const { menuResource, categoryResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品名称搜索',
      );
      const body = await test.step(
        toEndpointTitle(SALE_ITEM_SEARCH_BY_NAME_IDENTITY.method, SALE_ITEM_SEARCH_BY_NAME_IDENTITY.path, '按商品名称搜索并校验响应'),
        async () =>
          await expectApiOk(
            await saleItemApi.searchSaleItemsByName({
              menuId: menuResource.id,
              menuCategoryId: categoryResource.id,
              categoryId: categoryResource.id,
              name: saleItemResource.name,
              keyword: saleItemResource.name,
              pageNo: 1,
              pageSize: 10,
            }),
            SALE_ITEM_SEARCH_BY_NAME_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_UPDATE_IDENTITY.method, SALE_ITEM_UPDATE_IDENTITY.path, '应能更新商品'),
    async ({ endpointResources, saleItemApi }) => {
      const menuResource = await test.step(
        toEndpointTitle(
          SALE_ITEM_UPDATE_IDENTITY.method,
          SALE_ITEM_UPDATE_IDENTITY.path,
          '先创建菜单用于商品更新',
        ),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(SALE_ITEM_UPDATE_IDENTITY.method, SALE_ITEM_UPDATE_IDENTITY.path, '先创建菜单组用于商品更新'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const categoryResource = await test.step(
        toEndpointTitle(
          SALE_ITEM_UPDATE_IDENTITY.method,
          SALE_ITEM_UPDATE_IDENTITY.path,
          '先创建分类用于商品更新',
        ),
        async () =>
          await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );
      const resource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '先创建商品用于更新',
        ),
        async () =>
          await endpointResources.createSaleItemResource(
            menuResource.id,
            menuGroupResource.id,
            categoryResource.id,
          ),
      );
      const request = resource.request as {
        name?: string;
      };
      const updateRequest = {
        ...request,
        ...buildSaleItemRequest(categoryResource.id, 'UPDATE'),
        id: resource.id,
        menuId: menuResource.id,
        menuGroupId: menuGroupResource.id,
        menuCategoryId: categoryResource.id,
        categoryId: categoryResource.id,
        menuSaleItemId: resource.id,
      } as Record<string, unknown>;

      await test.step(
        toEndpointTitle(SALE_ITEM_UPDATE_IDENTITY.method, SALE_ITEM_UPDATE_IDENTITY.path, '更新商品并校验响应'),
        async () => {
          await expectApiOk(await saleItemApi.updateSaleItem(updateRequest), SALE_ITEM_UPDATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '缺少必填字段应返回异常'),
    async ({ saleItemApi }) => {
      await test.step(
        toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '提交空商品配置并校验拒绝响应'),
        async () => {
          await expectApiRejected(await saleItemApi.createSaleItem({}), SALE_ITEM_CREATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_UPDATE_IDENTITY.method, SALE_ITEM_UPDATE_IDENTITY.path, '缺少商品 ID 应返回异常'),
    async ({ saleItemApi }) => {
      await test.step(
        toEndpointTitle(SALE_ITEM_UPDATE_IDENTITY.method, SALE_ITEM_UPDATE_IDENTITY.path, '提交缺少 ID 的商品更新并校验拒绝响应'),
        async () => {
          await expectApiRejected(
            await saleItemApi.updateSaleItem(buildSaleItemRequest(2147483647, 'INVALID')),
            SALE_ITEM_UPDATE_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_DETAIL_IDENTITY.method, SALE_ITEM_DETAIL_IDENTITY.path, '应能读取商品详情'),
    async ({ endpointResources, saleItemApi }) => {
      const menuResource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '先创建菜单用于商品读取',
        ),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '先创建菜单组用于商品读取',
        ),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const categoryResource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '先创建分类用于商品读取',
        ),
        async () =>
          await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );
      const resource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '先创建商品用于读取',
        ),
        async () =>
          await endpointResources.createSaleItemResource(
            menuResource.id,
            menuGroupResource.id,
            categoryResource.id,
          ),
      );
      const body = await test.step(
        toEndpointTitle(
          SALE_ITEM_DETAIL_IDENTITY.method,
          SALE_ITEM_DETAIL_IDENTITY.path,
          '读取商品详情并校验响应',
        ),
        async () => await expectApiOk(await saleItemApi.getSaleItem(resource.id), SALE_ITEM_DETAIL_IDENTITY),
      );

      expect(body.code).toBe(0);
      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_DETAIL_IDENTITY.method, SALE_ITEM_DETAIL_IDENTITY.path, '读取不存在商品应返回异常'),
    async ({ saleItemApi }) => {
      await test.step(
        toEndpointTitle(SALE_ITEM_DETAIL_IDENTITY.method, SALE_ITEM_DETAIL_IDENTITY.path, '读取不存在商品 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(await saleItemApi.getSaleItem(2147483647), SALE_ITEM_DETAIL_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_DELETE_IDENTITY.method, SALE_ITEM_DELETE_IDENTITY.path, '应能删除商品'),
    async ({ endpointResources, saleItemApi, resourceRegistry }) => {
      const menuResource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '先创建菜单用于商品删除',
        ),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '先创建菜单组用于商品删除',
        ),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const categoryResource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '先创建分类用于商品删除',
        ),
        async () =>
          await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );
      const resource = await test.step(
        toEndpointTitle(
          SALE_ITEM_CREATE_IDENTITY.method,
          SALE_ITEM_CREATE_IDENTITY.path,
          '先创建商品用于删除',
        ),
        async () =>
          await endpointResources.createSaleItemResource(
            menuResource.id,
            menuGroupResource.id,
            categoryResource.id,
          ),
      );

      await test.step(
        toEndpointTitle(SALE_ITEM_DELETE_IDENTITY.method, SALE_ITEM_DELETE_IDENTITY.path, '删除商品并校验响应'),
        async () => {
          await expectApiOk(await saleItemApi.deleteSaleItem(resource.id), SALE_ITEM_DELETE_IDENTITY);
        },
      );

      expect(resourceRegistry.markCleaned('saleItem', resource.id)).toBe(true);
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_SEARCH_IDENTITY.method, SALE_ITEM_SEARCH_IDENTITY.path, '空关键字分页边界应返回稳定响应'),
    async ({ saleItemApi }) => {
      const body = await test.step(
        toEndpointTitle(SALE_ITEM_SEARCH_IDENTITY.method, SALE_ITEM_SEARCH_IDENTITY.path, '使用空关键字和 pageSize=1 搜索商品并校验响应'),
        async () =>
          await expectApiOk(
            await saleItemApi.searchSaleItems({ keyword: '', page: 1, pageSize: 1 }),
            SALE_ITEM_SEARCH_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );
});

async function createSaleItemEndpointScenario(
  endpointResources: EndpointResources,
  purpose: string,
) {
  const menuResource = await test.step(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, `先创建菜单用于${purpose}`),
    async () => await endpointResources.createMenuResource(),
  );
  const menuGroupResource = await test.step(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, `先创建菜单组用于${purpose}`),
    async () => await endpointResources.createMenuGroupResource(menuResource.id),
  );
  const categoryResource = await test.step(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, `先创建分类用于${purpose}`),
    async () => await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
  );
  const saleItemResource = await test.step(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, `先创建商品用于${purpose}`),
    async () =>
      await endpointResources.createSaleItemResource(
        menuResource.id,
        menuGroupResource.id,
        categoryResource.id,
      ),
  );

  return {
    menuResource,
    menuGroupResource,
    categoryResource,
    saleItemResource,
  };
}

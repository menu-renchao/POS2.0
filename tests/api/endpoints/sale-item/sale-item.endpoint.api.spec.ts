import { expect, test } from '../../support/endpoint-fixture';
import { buildSaleItemRequest } from '../../../../test-data/api/menu-api-data';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

const SALE_ITEM_CREATE_IDENTITY = { method: 'POST', path: '/api/menu/menuSaleItem' } as const;
const SALE_ITEM_UPDATE_IDENTITY = { method: 'PUT', path: '/api/menu/menuSaleItem' } as const;
const SALE_ITEM_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/menuSaleItem/{id}' } as const;
const SALE_ITEM_DELETE_IDENTITY = { method: 'DELETE', path: '/api/menu/menuSaleItem/{id}' } as const;

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
});

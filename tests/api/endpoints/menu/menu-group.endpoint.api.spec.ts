import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectApiRejected } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

const MENU_GROUP_LIST_IDENTITY = { method: 'GET', path: '/api/menu/group/list' } as const;
const MENU_GROUP_SALE_ITEM_LIST_IDENTITY = { method: 'GET', path: '/api/menu/group/saleItem/all' } as const;
const MENU_GROUP_CREATE_IDENTITY = { method: 'POST', path: '/api/menu/menuGroup' } as const;
const MENU_GROUP_UPDATE_IDENTITY = { method: 'PUT', path: '/api/menu/menuGroup' } as const;
const MENU_GROUP_BATCH_COPY_IDENTITY = { method: 'POST', path: '/api/menu/menuGroup/batch/copy' } as const;
const MENU_GROUP_BATCH_DELETE_IDENTITY = { method: 'DELETE', path: '/api/menu/menuGroup/batch/delete' } as const;
const MENU_GROUP_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/menuGroup/{id}' } as const;
const MENU_GROUP_DELETE_IDENTITY = { method: 'DELETE', path: '/api/menu/menuGroup/{id}' } as const;
const MENU_GROUP_PAGE_LIST_IDENTITY = { method: 'GET', path: '/api/menu/menuGroups' } as const;

test.describe('菜单组 endpoint', () => {
  test(
    toEndpointTitle(MENU_GROUP_LIST_IDENTITY.method, MENU_GROUP_LIST_IDENTITY.path, '应能查询菜单组基础列表'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单用于菜单组列表查询'),
        async () => await endpointResources.createMenuResource(),
      );
      await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单组用于列表查询'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const body = await test.step(
        toEndpointTitle(MENU_GROUP_LIST_IDENTITY.method, MENU_GROUP_LIST_IDENTITY.path, '按菜单 ID 查询菜单组基础列表并校验响应'),
        async () => await expectApiOk(await menuApi.listMenuGroupEntries({ menuId: menuResource.id }), MENU_GROUP_LIST_IDENTITY),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_SALE_ITEM_LIST_IDENTITY.method, MENU_GROUP_SALE_ITEM_LIST_IDENTITY.path, '应能查询菜单组商品全集'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单用于菜单组商品全集查询'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单组用于商品全集查询'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const categoryResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建分类用于商品全集查询'),
        async () => await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );
      await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建商品用于菜单组商品全集查询'),
        async () =>
          await endpointResources.createSaleItemResource(
            menuResource.id,
            menuGroupResource.id,
            categoryResource.id,
          ),
      );
      const body = await test.step(
        toEndpointTitle(MENU_GROUP_SALE_ITEM_LIST_IDENTITY.method, MENU_GROUP_SALE_ITEM_LIST_IDENTITY.path, '按菜单组查询商品全集并校验响应'),
        async () =>
          await expectApiOk(
            await menuApi.listMenuGroupSaleItems({
              menuId: menuResource.id,
              menuGroupId: menuGroupResource.id,
            }),
            MENU_GROUP_SALE_ITEM_LIST_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_PAGE_LIST_IDENTITY.method, MENU_GROUP_PAGE_LIST_IDENTITY.path, '应能分页查询菜单组列表'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单用于菜单组分页查询'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单组用于分页查询'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const body = await test.step(
        toEndpointTitle(MENU_GROUP_PAGE_LIST_IDENTITY.method, MENU_GROUP_PAGE_LIST_IDENTITY.path, '按菜单 ID 查询菜单组分页列表并校验响应'),
        async () =>
          await expectApiOk(
            await menuApi.listMenuGroups({
              menuId: menuResource.id,
              name: menuGroupResource.name,
            }),
            MENU_GROUP_PAGE_LIST_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_BATCH_COPY_IDENTITY.method, MENU_GROUP_BATCH_COPY_IDENTITY.path, '应能批量复制菜单组'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单用于菜单组批量复制'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单组用于批量复制'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );

      await test.step(
        toEndpointTitle(MENU_GROUP_BATCH_COPY_IDENTITY.method, MENU_GROUP_BATCH_COPY_IDENTITY.path, '批量复制菜单组并校验响应'),
        async () => {
          await expectApiOk(
            await menuApi.copyMenuGroups({
              menuId: menuResource.id,
              groupIds: [menuGroupResource.id],
            }),
            MENU_GROUP_BATCH_COPY_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_BATCH_DELETE_IDENTITY.method, MENU_GROUP_BATCH_DELETE_IDENTITY.path, '应能批量删除菜单组'),
    async ({ menuApi, endpointResources, resourceRegistry }) => {
      const menuResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单用于菜单组批量删除'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单组用于批量删除'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );

      await test.step(
        toEndpointTitle(MENU_GROUP_BATCH_DELETE_IDENTITY.method, MENU_GROUP_BATCH_DELETE_IDENTITY.path, '批量删除菜单组并校验响应'),
        async () => {
          await expectApiOk(
            await menuApi.deleteMenuGroups({
              groupIds: [menuGroupResource.id],
            }),
            MENU_GROUP_BATCH_DELETE_IDENTITY,
          );
        },
      );

      expect(resourceRegistry.markCleaned('menuGroup', menuGroupResource.id)).toBe(true);
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '应能创建菜单组'),
    async ({ endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单用于菜单组创建'),
        async () => await endpointResources.createMenuResource(),
      );
      const resource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '通过 endpointResources 创建菜单组'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const request = resource.request as { name?: string };

      expect(resource.id).not.toBeUndefined();
      expect(resource.name).toBe(request.name);
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '缺少必填字段应返回异常'),
    async ({ menuApi }) => {
      await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '提交空菜单组配置并校验拒绝响应'),
        async () => {
          await expectApiRejected(await menuApi.createMenuGroup({}), MENU_GROUP_CREATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_UPDATE_IDENTITY.method, MENU_GROUP_UPDATE_IDENTITY.path, '应能更新菜单组'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单用于菜单组更新'),
        async () => await endpointResources.createMenuResource(),
      );
      const resource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单组用于更新'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );

      await test.step(
        toEndpointTitle(MENU_GROUP_UPDATE_IDENTITY.method, MENU_GROUP_UPDATE_IDENTITY.path, '更新菜单组并校验响应'),
        async () => {
          const updateRequest = {
            ...resource.request,
            id: resource.id,
          };

          await expectApiOk(await menuApi.updateMenuGroup(updateRequest), MENU_GROUP_UPDATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_UPDATE_IDENTITY.method, MENU_GROUP_UPDATE_IDENTITY.path, '缺少菜单组 ID 应返回异常'),
    async ({ menuApi }) => {
      await test.step(
        toEndpointTitle(MENU_GROUP_UPDATE_IDENTITY.method, MENU_GROUP_UPDATE_IDENTITY.path, '提交缺少 ID 的菜单组更新并校验拒绝响应'),
        async () => {
          await expectApiRejected(await menuApi.updateMenuGroup({ name: 'AT_INVALID_MENU_GROUP' }), MENU_GROUP_UPDATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_DETAIL_IDENTITY.method, MENU_GROUP_DETAIL_IDENTITY.path, '应能读取菜单组详情'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单用于菜单组读取'),
        async () => await endpointResources.createMenuResource(),
      );
      const resource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单组用于读取'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const body = await test.step(
        toEndpointTitle(MENU_GROUP_DETAIL_IDENTITY.method, MENU_GROUP_DETAIL_IDENTITY.path, '读取菜单组详情并校验响应'),
        async () => await expectApiOk(await menuApi.getMenuGroup(resource.id), MENU_GROUP_DETAIL_IDENTITY),
      );

      expect(body.code).toBe(0);
      expect(body.data).toBeTruthy();
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_DETAIL_IDENTITY.method, MENU_GROUP_DETAIL_IDENTITY.path, '读取不存在菜单组应返回异常'),
    async ({ menuApi }) => {
      await test.step(
        toEndpointTitle(MENU_GROUP_DETAIL_IDENTITY.method, MENU_GROUP_DETAIL_IDENTITY.path, '读取不存在菜单组 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(await menuApi.getMenuGroup(2147483647), MENU_GROUP_DETAIL_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(MENU_GROUP_DELETE_IDENTITY.method, MENU_GROUP_DELETE_IDENTITY.path, '应能删除菜单组'),
    async ({ menuApi, endpointResources, resourceRegistry }) => {
      const menuResource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单用于菜单组删除'),
        async () => await endpointResources.createMenuResource(),
      );
      const resource = await test.step(
        toEndpointTitle(MENU_GROUP_CREATE_IDENTITY.method, MENU_GROUP_CREATE_IDENTITY.path, '先创建菜单组用于删除'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );

      await test.step(
        toEndpointTitle(MENU_GROUP_DELETE_IDENTITY.method, MENU_GROUP_DELETE_IDENTITY.path, '调用菜单组删除接口并校验响应'),
        async () => {
          await expectApiOk(await menuApi.deleteMenuGroup(resource.id), MENU_GROUP_DELETE_IDENTITY);
        },
      );

      expect(resourceRegistry.markCleaned('menuGroup', resource.id)).toBe(true);
    },
  );
});

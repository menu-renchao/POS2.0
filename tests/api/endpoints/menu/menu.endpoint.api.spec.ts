import { expect, test } from '../../support/endpoint-fixture';
import { DEFAULT_MENU_PRODUCT, buildMenuRequest } from '../../../../test-data/api/menu-api-data';
import { expectApiOk, expectApiRejected, expectArrayData } from '../../support/endpoint-assertions';
import { extractEndpointListData } from '../../support/endpoint-list-data';
import { toEndpointTitle } from '../../support/endpoint-case';
import { registerMenuHardDeleteAfterAll } from '../../support/menu-hard-delete-cleanup';

const GLOBAL_OPTION_FETCH_IDENTITY = { method: 'GET', path: '/api/menu/fetchGlobalOption' } as const;
const GLOBAL_OPTION_LIST_IDENTITY = { method: 'GET', path: '/api/menu/listGlobalOption' } as const;
const LITE_MENU_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/liteMenu/{id}' } as const;
const CURRENT_MENU_IDENTITY = { method: 'GET', path: '/api/menu/menu' } as const;
const MENU_LIST_IDENTITY = { method: 'GET', path: '/api/menu/menus' } as const;
const MENU_SEARCH_IDENTITY = { method: 'GET', path: '/api/search/menu' } as const;
const MENU_CREATE_IDENTITY = { method: 'POST', path: '/api/menu/menu' } as const;
const MENU_UPDATE_IDENTITY = { method: 'PUT', path: '/api/menu/menu' } as const;
const MENU_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/menu/{id}' } as const;

registerMenuHardDeleteAfterAll(test);

test.describe('菜单 endpoint', () => {
  test(
    toEndpointTitle(GLOBAL_OPTION_FETCH_IDENTITY.method, GLOBAL_OPTION_FETCH_IDENTITY.path, '应能读取全局选项'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(GLOBAL_OPTION_FETCH_IDENTITY.method, GLOBAL_OPTION_FETCH_IDENTITY.path, '先创建菜单用于全局选项读取'),
        async () => await endpointResources.createMenuResource(),
      );
      const optionCategoryResource = await test.step(
        toEndpointTitle(GLOBAL_OPTION_FETCH_IDENTITY.method, GLOBAL_OPTION_FETCH_IDENTITY.path, '先创建全局选项分类用于全局选项读取'),
        async () => await endpointResources.createGlobalOptionCategoryResource(menuResource.id),
      );
      const optionResource = await test.step(
        toEndpointTitle(GLOBAL_OPTION_FETCH_IDENTITY.method, GLOBAL_OPTION_FETCH_IDENTITY.path, '先创建全局选项用于读取'),
        async () =>
          await endpointResources.createMenuGlobalOptionResource(
            menuResource.id,
            optionCategoryResource.id,
          ),
      );
      const body = await test.step(
        toEndpointTitle(GLOBAL_OPTION_FETCH_IDENTITY.method, GLOBAL_OPTION_FETCH_IDENTITY.path, '按全局选项 ID 读取并校验响应'),
        async () => await expectApiOk(await menuApi.fetchGlobalOption({ id: optionResource.id }), GLOBAL_OPTION_FETCH_IDENTITY),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(GLOBAL_OPTION_LIST_IDENTITY.method, GLOBAL_OPTION_LIST_IDENTITY.path, '应能查询全局选项列表'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(GLOBAL_OPTION_LIST_IDENTITY.method, GLOBAL_OPTION_LIST_IDENTITY.path, '先创建菜单用于全局选项列表查询'),
        async () => await endpointResources.createMenuResource(),
      );
      const optionCategoryResource = await test.step(
        toEndpointTitle(GLOBAL_OPTION_LIST_IDENTITY.method, GLOBAL_OPTION_LIST_IDENTITY.path, '先创建全局选项分类用于全局选项列表查询'),
        async () => await endpointResources.createGlobalOptionCategoryResource(menuResource.id),
      );
      const optionResource = await test.step(
        toEndpointTitle(GLOBAL_OPTION_LIST_IDENTITY.method, GLOBAL_OPTION_LIST_IDENTITY.path, '先创建全局选项用于列表查询'),
        async () =>
          await endpointResources.createMenuGlobalOptionResource(
            menuResource.id,
            optionCategoryResource.id,
          ),
      );
      const body = await test.step(
        toEndpointTitle(GLOBAL_OPTION_LIST_IDENTITY.method, GLOBAL_OPTION_LIST_IDENTITY.path, '按菜单 ID 查询全局选项列表并校验响应'),
        async () => await expectApiOk(await menuApi.listGlobalOption({ menuId: menuResource.id }), GLOBAL_OPTION_LIST_IDENTITY),
      );

      expect(optionResource.id).not.toBeUndefined();
      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(LITE_MENU_DETAIL_IDENTITY.method, LITE_MENU_DETAIL_IDENTITY.path, '应能读取轻量菜单'),
    async ({ menuApi, endpointResources }) => {
      const resource = await test.step(
        toEndpointTitle(MENU_CREATE_IDENTITY.method, MENU_CREATE_IDENTITY.path, '先创建菜单用于轻量读取'),
        async () => await endpointResources.createMenuResource(),
      );
      const body = await test.step(
        toEndpointTitle(LITE_MENU_DETAIL_IDENTITY.method, LITE_MENU_DETAIL_IDENTITY.path, '读取轻量菜单并校验响应'),
        async () => await expectApiOk(await menuApi.getLiteMenu(resource.id), LITE_MENU_DETAIL_IDENTITY),
      );

      expect(body.data).toBeTruthy();
    },
  );

  test(
    toEndpointTitle(CURRENT_MENU_IDENTITY.method, CURRENT_MENU_IDENTITY.path, '应能读取当前菜单'),
    async ({ menuApi }) => {
      const body = await test.step(
        toEndpointTitle(CURRENT_MENU_IDENTITY.method, CURRENT_MENU_IDENTITY.path, '按 POS product 查询当前菜单并校验响应'),
        async () => await expectApiOk(await menuApi.getCurrentMenu({ product: DEFAULT_MENU_PRODUCT }), CURRENT_MENU_IDENTITY),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(MENU_LIST_IDENTITY.method, MENU_LIST_IDENTITY.path, '应能查询菜单列表'),
    async ({ menuApi }) => {
      const data = await test.step(
        toEndpointTitle(MENU_LIST_IDENTITY.method, MENU_LIST_IDENTITY.path, '请求菜单列表并校验响应'),
        async () => {
          const body = await expectApiOk(await menuApi.listMenus(), MENU_LIST_IDENTITY);
          const listData = extractEndpointListData(body.data, MENU_LIST_IDENTITY);

          return expectArrayData({ ...body, data: listData }, MENU_LIST_IDENTITY);
        },
      );

      expect(
        data.length === 0 ||
          data.some((item) => 'id' in item || 'name' in item || 'displayName' in item || 'menuName' in item),
      ).toBe(true);
    },
  );

  test(
    toEndpointTitle(MENU_LIST_IDENTITY.method, MENU_LIST_IDENTITY.path, '分页边界 pageSize=1 应返回可解析列表'),
    async ({ menuApi }) => {
      const data = await test.step(
        toEndpointTitle(MENU_LIST_IDENTITY.method, MENU_LIST_IDENTITY.path, '使用 pageSize=1 查询菜单列表并校验响应'),
        async () => {
          const body = await expectApiOk(
            await menuApi.listMenus({ page: 1, pageSize: 1 }),
            MENU_LIST_IDENTITY,
          );
          const listData = extractEndpointListData(body.data, MENU_LIST_IDENTITY);

          return expectArrayData({ ...body, data: listData }, MENU_LIST_IDENTITY);
        },
      );

      expect(Array.isArray(data)).toBe(true);
    },
  );

  test(
    toEndpointTitle(MENU_SEARCH_IDENTITY.method, MENU_SEARCH_IDENTITY.path, '应能执行菜单全局搜索'),
    async ({ menuApi }) => {
      const body = await test.step(
        toEndpointTitle(MENU_SEARCH_IDENTITY.method, MENU_SEARCH_IDENTITY.path, '使用稳定关键字搜索菜单并校验响应'),
        async () => await expectApiOk(await menuApi.searchMenu({ name: 'P', limit: 5 }), MENU_SEARCH_IDENTITY),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(MENU_CREATE_IDENTITY.method, MENU_CREATE_IDENTITY.path, '应能创建菜单'),
    async ({ endpointResources }) => {
      const resource = await test.step(
        toEndpointTitle(MENU_CREATE_IDENTITY.method, MENU_CREATE_IDENTITY.path, '通过 endpointResources 创建菜单'),
        async () => await endpointResources.createMenuResource(),
      );
      const request = resource.request as { name?: string };

      expect(resource.id).not.toBeUndefined();
      expect(resource.name).toBe(request.name);
    },
  );

  test(
    toEndpointTitle(MENU_CREATE_IDENTITY.method, MENU_CREATE_IDENTITY.path, '缺少必填字段应返回异常'),
    async ({ menuApi }) => {
      await test.step(
        toEndpointTitle(MENU_CREATE_IDENTITY.method, MENU_CREATE_IDENTITY.path, '提交空菜单配置并校验拒绝响应'),
        async () => {
          await expectApiRejected(await menuApi.createMenu({}), MENU_CREATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(MENU_UPDATE_IDENTITY.method, MENU_UPDATE_IDENTITY.path, '应能更新菜单'),
    async ({ menuApi, endpointResources }) => {
      const resource = await test.step(
        toEndpointTitle(MENU_CREATE_IDENTITY.method, MENU_CREATE_IDENTITY.path, '先创建菜单用于更新'),
        async () => await endpointResources.createMenuResource(),
      );

      await test.step(
        toEndpointTitle(MENU_UPDATE_IDENTITY.method, MENU_UPDATE_IDENTITY.path, '更新菜单并校验响应'),
        async () => {
          const request = {
            ...resource.request,
            ...buildMenuRequest(),
            id: resource.id,
          } as Record<string, unknown>;

          await expectApiOk(await menuApi.updateMenu(request), MENU_UPDATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(MENU_UPDATE_IDENTITY.method, MENU_UPDATE_IDENTITY.path, '缺少菜单 ID 应返回异常'),
    async ({ menuApi }) => {
      await test.step(
        toEndpointTitle(MENU_UPDATE_IDENTITY.method, MENU_UPDATE_IDENTITY.path, '提交缺少 ID 的菜单更新并校验拒绝响应'),
        async () => {
          await expectApiRejected(await menuApi.updateMenu(buildMenuRequest()), MENU_UPDATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(MENU_DETAIL_IDENTITY.method, MENU_DETAIL_IDENTITY.path, '应能读取菜单详情'),
    async ({ menuApi, endpointResources }) => {
      const resource = await test.step(
        toEndpointTitle(MENU_CREATE_IDENTITY.method, MENU_CREATE_IDENTITY.path, '先创建菜单用于读取'),
        async () => await endpointResources.createMenuResource(),
      );
      const body = await test.step(
        toEndpointTitle(MENU_DETAIL_IDENTITY.method, MENU_DETAIL_IDENTITY.path, '读取菜单详情并校验响应'),
        async () => await expectApiOk(await menuApi.getMenu(resource.id), MENU_DETAIL_IDENTITY),
      );

      expect(body.code).toBe(0);
    },
  );

  test(
    toEndpointTitle(MENU_DETAIL_IDENTITY.method, MENU_DETAIL_IDENTITY.path, '读取不存在菜单应返回异常'),
    async ({ menuApi }) => {
      await test.step(
        toEndpointTitle(MENU_DETAIL_IDENTITY.method, MENU_DETAIL_IDENTITY.path, '读取不存在菜单 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(await menuApi.getMenu(2147483647), MENU_DETAIL_IDENTITY);
        },
      );
    },
  );
});

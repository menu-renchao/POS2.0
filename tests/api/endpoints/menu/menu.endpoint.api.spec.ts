import { expect, test } from '../../support/endpoint-fixture';
import { buildMenuRequest } from '../../../../test-data/api/menu-api-data';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { extractEndpointListData } from '../../support/endpoint-list-data';
import { toEndpointTitle } from '../../support/endpoint-case';

const MENU_LIST_IDENTITY = { method: 'GET', path: '/api/menu/menus' } as const;
const MENU_CREATE_IDENTITY = { method: 'POST', path: '/api/menu/menu' } as const;
const MENU_UPDATE_IDENTITY = { method: 'PUT', path: '/api/menu/menu' } as const;
const MENU_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/menu/{id}' } as const;

test.describe('菜单 endpoint', () => {
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
});

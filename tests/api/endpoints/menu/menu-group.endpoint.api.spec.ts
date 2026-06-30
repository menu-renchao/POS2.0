import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

const MENU_GROUP_CREATE_IDENTITY = { method: 'POST', path: '/api/menu/menuGroup' } as const;
const MENU_GROUP_UPDATE_IDENTITY = { method: 'PUT', path: '/api/menu/menuGroup' } as const;
const MENU_GROUP_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/menuGroup/{id}' } as const;
const MENU_GROUP_DELETE_IDENTITY = { method: 'DELETE', path: '/api/menu/menuGroup/{id}' } as const;

test.describe('菜单组 endpoint', () => {
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

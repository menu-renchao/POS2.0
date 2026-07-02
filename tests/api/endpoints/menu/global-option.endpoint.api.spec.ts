import { expect, test } from '../../support/endpoint-fixture';
import { buildGlobalOptionRequest } from '../../../../test-data/api/menu-api-data';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';
import { registerMenuHardDeleteAfterAll } from '../../support/menu-hard-delete-cleanup';
import type { EndpointResources } from '../../support/endpoint-resources';

const GLOBAL_OPTION_CREATE_IDENTITY = {
  method: 'POST',
  path: '/api/menu/menuGlobalOption',
} as const;
const GLOBAL_OPTION_UPDATE_IDENTITY = {
  method: 'PUT',
  path: '/api/menu/menuGlobalOption',
} as const;
const GLOBAL_OPTION_DELETE_IDENTITY = {
  method: 'DELETE',
  path: '/api/menu/menuGlobalOption/{id}',
} as const;
const GLOBAL_OPTION_DETAIL_IDENTITY = {
  method: 'GET',
  path: '/api/menu/menuGlobalOption/{id}',
} as const;
const GLOBAL_OPTION_SEARCH_IDENTITY = {
  method: 'GET',
  path: '/api/menu/menuGlobalOptions/search',
} as const;

registerMenuHardDeleteAfterAll(test);

test.describe('全局选项 endpoint', () => {
  test(
    toEndpointTitle(GLOBAL_OPTION_CREATE_IDENTITY.method, GLOBAL_OPTION_CREATE_IDENTITY.path, '应能创建全局选项'),
    async ({ endpointResources }) => {
      const { optionResource } = await createGlobalOptionEndpointScenario(
        endpointResources,
        '全局选项创建',
      );

      expect(optionResource.id).not.toBeUndefined();
      expect(optionResource.name).toBe((optionResource.request as { name?: string }).name);
    },
  );

  test(
    toEndpointTitle(GLOBAL_OPTION_UPDATE_IDENTITY.method, GLOBAL_OPTION_UPDATE_IDENTITY.path, '应能更新全局选项'),
    async ({ menuApi, endpointResources }) => {
      const { menuResource, optionCategoryResource, optionResource } = await createGlobalOptionEndpointScenario(
        endpointResources,
        '全局选项更新',
      );

      await test.step(
        toEndpointTitle(GLOBAL_OPTION_UPDATE_IDENTITY.method, GLOBAL_OPTION_UPDATE_IDENTITY.path, '更新全局选项并校验响应'),
        async () => {
          await expectApiOk(
            await menuApi.updateMenuGlobalOption({
              ...optionResource.request,
              ...buildGlobalOptionRequest(optionCategoryResource.id),
              menuId: menuResource.id,
              id: optionResource.id,
            }),
            GLOBAL_OPTION_UPDATE_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(GLOBAL_OPTION_DELETE_IDENTITY.method, GLOBAL_OPTION_DELETE_IDENTITY.path, '应能删除全局选项'),
    async ({ menuApi, endpointResources, resourceRegistry }) => {
      const { optionResource } = await createGlobalOptionEndpointScenario(
        endpointResources,
        '全局选项删除',
      );

      await test.step(
        toEndpointTitle(GLOBAL_OPTION_DELETE_IDENTITY.method, GLOBAL_OPTION_DELETE_IDENTITY.path, '删除全局选项并校验响应'),
        async () => {
          await expectApiOk(
            await menuApi.deleteMenuGlobalOption(optionResource.id),
            GLOBAL_OPTION_DELETE_IDENTITY,
          );
        },
      );

      expect(resourceRegistry.markCleaned('menuGlobalOption', optionResource.id)).toBe(true);
    },
  );

  test(
    toEndpointTitle(GLOBAL_OPTION_DETAIL_IDENTITY.method, GLOBAL_OPTION_DETAIL_IDENTITY.path, '应能读取全局选项详情'),
    async ({ menuApi, endpointResources }) => {
      const { optionResource } = await createGlobalOptionEndpointScenario(
        endpointResources,
        '全局选项详情读取',
      );
      const body = await test.step(
        toEndpointTitle(GLOBAL_OPTION_DETAIL_IDENTITY.method, GLOBAL_OPTION_DETAIL_IDENTITY.path, '读取全局选项详情并校验响应'),
        async () => await expectApiOk(await menuApi.getMenuGlobalOption(optionResource.id), GLOBAL_OPTION_DETAIL_IDENTITY),
      );

      expect(body.data).toBeTruthy();
    },
  );

  test(
    toEndpointTitle(GLOBAL_OPTION_SEARCH_IDENTITY.method, GLOBAL_OPTION_SEARCH_IDENTITY.path, '应能搜索全局选项'),
    async ({ menuApi, endpointResources }) => {
      const { menuResource, optionCategoryResource, optionResource } = await createGlobalOptionEndpointScenario(
        endpointResources,
        '全局选项搜索',
      );
      const body = await test.step(
        toEndpointTitle(GLOBAL_OPTION_SEARCH_IDENTITY.method, GLOBAL_OPTION_SEARCH_IDENTITY.path, '按关键字搜索全局选项并校验响应'),
        async () =>
          await expectApiOk(
            await menuApi.searchMenuGlobalOptions({
              name: optionResource.name,
              menuIds: String(menuResource.id),
              categoryIds: String(optionCategoryResource.id),
            }),
            GLOBAL_OPTION_SEARCH_IDENTITY,
          ),
      );

      expect(optionResource.id).not.toBeUndefined();
      expect(body.data).not.toBeUndefined();
    },
  );
});

async function createGlobalOptionEndpointScenario(
  endpointResources: EndpointResources,
  purpose: string,
) {
  const menuResource = await test.step(
    toEndpointTitle(GLOBAL_OPTION_CREATE_IDENTITY.method, GLOBAL_OPTION_CREATE_IDENTITY.path, `先创建菜单用于${purpose}`),
    async () => await endpointResources.createMenuResource(),
  );
  const optionCategoryResource = await test.step(
    toEndpointTitle(GLOBAL_OPTION_CREATE_IDENTITY.method, GLOBAL_OPTION_CREATE_IDENTITY.path, `先创建全局选项分类用于${purpose}`),
    async () => await endpointResources.createGlobalOptionCategoryResource(menuResource.id),
  );
  const optionResource = await test.step(
    toEndpointTitle(GLOBAL_OPTION_CREATE_IDENTITY.method, GLOBAL_OPTION_CREATE_IDENTITY.path, `先创建全局选项用于${purpose}`),
    async () =>
      await endpointResources.createMenuGlobalOptionResource(
        menuResource.id,
        optionCategoryResource.id,
      ),
  );

  return {
    menuResource,
    optionCategoryResource,
    optionResource,
  };
}

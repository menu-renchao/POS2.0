import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectApiRejected } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';
import { registerMenuHardDeleteAfterAll } from '../../support/menu-hard-delete-cleanup';
import type { EndpointResources } from '../../support/endpoint-resources';

const CATEGORY_CREATE_IDENTITY = { method: 'POST', path: '/api/menu/menuCategory' } as const;
const CATEGORY_UPDATE_IDENTITY = { method: 'PUT', path: '/api/menu/menuCategory' } as const;
const CATEGORY_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/menuCategory/{id}' } as const;
const CATEGORY_DELETE_IDENTITY = { method: 'DELETE', path: '/api/menu/menuCategory/{id}' } as const;
const ABSTRACT_CATEGORY_LIST_IDENTITY = { method: 'GET', path: '/api/menu/abstractCategorys' } as const;
const ABSTRACT_CATEGORY_SEARCH_IDENTITY = { method: 'GET', path: '/api/menu/abstractCategorys/search' } as const;
const CATEGORY_LIST_IDENTITY = { method: 'GET', path: '/api/menu/category/list' } as const;
const MENU_CATEGORY_LIST_IDENTITY = { method: 'GET', path: '/api/menu/menu/{menuId}/menuCategories' } as const;
const CATEGORY_QUICK_EDIT_IDENTITY = { method: 'PUT', path: '/api/menu/menuCategory/quickEdit' } as const;
const CATEGORY_SEARCH_BY_NAME_IDENTITY = { method: 'GET', path: '/api/menu/menuCategorys/searchByName' } as const;

registerMenuHardDeleteAfterAll(test);

test.describe('分类 endpoint', () => {
  test(
    toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '应能创建菜单分类'),
    async ({ endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单用于分类创建'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单组用于分类创建'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const resource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '通过 endpointResources 创建分类'),
        async () => await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );

      expect(resource.id).not.toBeUndefined();
      expect(resource.name).toBe((resource.request as { name?: string }).name);
    },
  );

  test(
    toEndpointTitle(CATEGORY_LIST_IDENTITY.method, CATEGORY_LIST_IDENTITY.path, '应能查询分类列表'),
    async ({ menuApi, endpointResources }) => {
      const { menuResource, menuGroupResource, categoryResource } = await createCategoryEndpointScenario(
        endpointResources,
        '分类列表查询',
      );
      const body = await test.step(
        toEndpointTitle(CATEGORY_LIST_IDENTITY.method, CATEGORY_LIST_IDENTITY.path, '按菜单和菜单组查询分类列表并校验响应'),
        async () =>
          await expectApiOk(
            await menuApi.listCategories({
              menuId: menuResource.id,
              menuGroupId: menuGroupResource.id,
              name: categoryResource.name,
            }),
            CATEGORY_LIST_IDENTITY,
          ),
      );

      expect(categoryResource.id).not.toBeUndefined();
      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(MENU_CATEGORY_LIST_IDENTITY.method, MENU_CATEGORY_LIST_IDENTITY.path, '应能按菜单查询分类列表'),
    async ({ menuApi, endpointResources }) => {
      const { menuResource, categoryResource } = await createCategoryEndpointScenario(
        endpointResources,
        '按菜单查询分类',
      );
      const body = await test.step(
        toEndpointTitle(MENU_CATEGORY_LIST_IDENTITY.method, MENU_CATEGORY_LIST_IDENTITY.path, '按菜单 ID 查询分类并校验响应'),
        async () => await expectApiOk(await menuApi.listMenuCategories(menuResource.id), MENU_CATEGORY_LIST_IDENTITY),
      );

      expect(categoryResource.id).not.toBeUndefined();
      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(ABSTRACT_CATEGORY_LIST_IDENTITY.method, ABSTRACT_CATEGORY_LIST_IDENTITY.path, '应能查询抽象分类列表'),
    async ({ menuApi, endpointResources }) => {
      const { menuResource } = await createCategoryEndpointScenario(
        endpointResources,
        '抽象分类列表查询',
      );
      const body = await test.step(
        toEndpointTitle(ABSTRACT_CATEGORY_LIST_IDENTITY.method, ABSTRACT_CATEGORY_LIST_IDENTITY.path, '按菜单 ID 查询抽象分类并校验响应'),
        async () =>
          await expectApiOk(
            await menuApi.listAbstractCategories({
              menuId: menuResource.id,
            }),
            ABSTRACT_CATEGORY_LIST_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(ABSTRACT_CATEGORY_SEARCH_IDENTITY.method, ABSTRACT_CATEGORY_SEARCH_IDENTITY.path, '应能搜索抽象分类'),
    async ({ menuApi, endpointResources }) => {
      const { menuResource, categoryResource } = await createCategoryEndpointScenario(
        endpointResources,
        '抽象分类搜索',
      );
      const body = await test.step(
        toEndpointTitle(ABSTRACT_CATEGORY_SEARCH_IDENTITY.method, ABSTRACT_CATEGORY_SEARCH_IDENTITY.path, '按关键字搜索抽象分类并校验响应'),
        async () =>
          await expectApiOk(
            await menuApi.searchAbstractCategories({
              menuId: menuResource.id,
              keyword: categoryResource.name,
            }),
            ABSTRACT_CATEGORY_SEARCH_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(CATEGORY_QUICK_EDIT_IDENTITY.method, CATEGORY_QUICK_EDIT_IDENTITY.path, '应能快速编辑菜单分类'),
    async ({ menuApi, endpointResources }) => {
      const { categoryResource } = await createCategoryEndpointScenario(
        endpointResources,
        '分类快速编辑',
      );

      await test.step(
        toEndpointTitle(CATEGORY_QUICK_EDIT_IDENTITY.method, CATEGORY_QUICK_EDIT_IDENTITY.path, '快速编辑分类并校验响应'),
        async () => {
          await expectApiOk(
            await menuApi.quickEditMenuCategory({
              ...categoryResource.request,
              id: categoryResource.id,
              color: '#4488ff',
            }),
            CATEGORY_QUICK_EDIT_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(CATEGORY_SEARCH_BY_NAME_IDENTITY.method, CATEGORY_SEARCH_BY_NAME_IDENTITY.path, '应能按名称搜索菜单分类'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单用于分类搜索'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单组用于分类搜索'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const categoryResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建分类用于名称搜索'),
        async () => await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );
      const body = await test.step(
        toEndpointTitle(CATEGORY_SEARCH_BY_NAME_IDENTITY.method, CATEGORY_SEARCH_BY_NAME_IDENTITY.path, '按分类名称搜索并校验响应'),
        async () =>
          await expectApiOk(
            await menuApi.searchMenuCategoriesByName({
              menuId: menuResource.id,
              name: categoryResource.name,
            }),
            CATEGORY_SEARCH_BY_NAME_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '缺少必填字段应返回异常'),
    async ({ menuApi }) => {
      await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '提交空分类配置并校验拒绝响应'),
        async () => {
          await expectApiRejected(await menuApi.createMenuCategory({}), CATEGORY_CREATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(CATEGORY_UPDATE_IDENTITY.method, CATEGORY_UPDATE_IDENTITY.path, '应能更新菜单分类'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单用于分类更新'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单组用于分类更新'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const resource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建分类用于更新'),
        async () => await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );

      await test.step(
        toEndpointTitle(CATEGORY_UPDATE_IDENTITY.method, CATEGORY_UPDATE_IDENTITY.path, '更新菜单分类并校验响应'),
        async () => {
          const updateRequest = {
            ...resource.request,
            id: resource.id,
          };

          await expectApiOk(await menuApi.updateMenuCategory(updateRequest), CATEGORY_UPDATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(CATEGORY_UPDATE_IDENTITY.method, CATEGORY_UPDATE_IDENTITY.path, '缺少分类 ID 应返回异常'),
    async ({ menuApi }) => {
      await test.step(
        toEndpointTitle(CATEGORY_UPDATE_IDENTITY.method, CATEGORY_UPDATE_IDENTITY.path, '提交缺少 ID 的分类更新并校验拒绝响应'),
        async () => {
          await expectApiRejected(await menuApi.updateMenuCategory({ name: 'AT_INVALID_CATEGORY' }), CATEGORY_UPDATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(CATEGORY_DETAIL_IDENTITY.method, CATEGORY_DETAIL_IDENTITY.path, '应能读取菜单分类详情'),
    async ({ menuApi, endpointResources }) => {
      const menuResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单用于分类读取'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单组用于分类读取'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const resource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建分类用于读取'),
        async () => await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );
      const body = await test.step(
        toEndpointTitle(CATEGORY_DETAIL_IDENTITY.method, CATEGORY_DETAIL_IDENTITY.path, '读取菜单分类详情并校验响应'),
        async () => await expectApiOk(await menuApi.getMenuCategory(resource.id), CATEGORY_DETAIL_IDENTITY),
      );

      expect(body.data).toBeTruthy();
    },
  );

  test(
    toEndpointTitle(CATEGORY_DETAIL_IDENTITY.method, CATEGORY_DETAIL_IDENTITY.path, '读取不存在分类应返回异常'),
    async ({ menuApi }) => {
      await test.step(
        toEndpointTitle(CATEGORY_DETAIL_IDENTITY.method, CATEGORY_DETAIL_IDENTITY.path, '读取不存在分类 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(await menuApi.getMenuCategory(2147483647), CATEGORY_DETAIL_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(CATEGORY_DELETE_IDENTITY.method, CATEGORY_DELETE_IDENTITY.path, '应能删除菜单分类'),
    async ({ menuApi, endpointResources, resourceRegistry }) => {
      const menuResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单用于分类删除'),
        async () => await endpointResources.createMenuResource(),
      );
      const menuGroupResource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建菜单组用于分类删除'),
        async () => await endpointResources.createMenuGroupResource(menuResource.id),
      );
      const resource = await test.step(
        toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, '先创建分类用于删除'),
        async () => await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
      );

      await test.step(
        toEndpointTitle(CATEGORY_DELETE_IDENTITY.method, CATEGORY_DELETE_IDENTITY.path, '调用菜单分类删除接口并校验响应'),
        async () => {
          await expectApiOk(await menuApi.deleteMenuCategory(resource.id), CATEGORY_DELETE_IDENTITY);
        },
      );

      expect(resourceRegistry.markCleaned('menuCategory', resource.id)).toBe(true);
    },
  );
});

async function createCategoryEndpointScenario(
  endpointResources: EndpointResources,
  purpose: string,
) {
  const menuResource = await test.step(
    toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, `先创建菜单用于${purpose}`),
    async () => await endpointResources.createMenuResource(),
  );
  const menuGroupResource = await test.step(
    toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, `先创建菜单组用于${purpose}`),
    async () => await endpointResources.createMenuGroupResource(menuResource.id),
  );
  const categoryResource = await test.step(
    toEndpointTitle(CATEGORY_CREATE_IDENTITY.method, CATEGORY_CREATE_IDENTITY.path, `先创建分类用于${purpose}`),
    async () => await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
  );

  return {
    menuResource,
    menuGroupResource,
    categoryResource,
  };
}

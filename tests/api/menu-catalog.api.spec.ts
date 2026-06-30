import { expect, type APIResponse } from '@playwright/test';
import { expectResponseEnvelope, type ApiEnvelope } from '../../api/core/api-response';
import type { ResourceId, ResourceRegistry } from '../../api/core/resource-registry';
import { test } from '../../fixtures/api.fixture';
import {
  DEFAULT_MENU_PRODUCT,
  buildCategoryRequest,
  buildGlobalOptionCategoryRequest,
  buildGlobalOptionRequest,
  buildMenuGroupRequest,
  buildMenuRequest,
} from '../../test-data/api/menu-api-data';

type MenuCatalogResourceType =
  | 'menu'
  | 'menuGroup'
  | 'menuCategory'
  | 'globalOptionCategory'
  | 'menuGlobalOption';

test.describe('菜单目录接口', () => {
  test('应能查询菜单目录只读入口并校验响应信封', async ({ menuApi }) => {
    const menuListBody = await test.step('查询菜单列表并校验响应信封', async () => {
      const response = await menuApi.listMenus();

      return await expectJsonEnvelope(response, 'GET /api/menu/menus');
    });

    const currentMenuBody = await test.step('查询当前菜单并校验响应信封', async () => {
      const response = await menuApi.getCurrentMenu({ product: DEFAULT_MENU_PRODUCT });

      return await expectJsonEnvelope(response, 'GET /api/menu/menu');
    });

    const menuId =
      extractResourceId(currentMenuBody) ?? extractFirstResourceId(menuListBody.data);

    await test.step('查询菜单全局搜索并校验响应信封', async () => {
      const response = await menuApi.searchMenu({ name: 'P', limit: 5 });

      await expectJsonEnvelope(response, 'GET /api/search/menu');
    });

    const globalOptionListBody = await test.step('查询全局选项列表并校验响应信封', async () => {
      const response = await menuApi.listGlobalOption(toMenuQuery(menuId));

      return await expectJsonEnvelope(response, 'GET /api/menu/listGlobalOption');
    });

    await test.step('查询全局选项读取入口并校验响应信封', async () => {
      const globalOptionId = extractFirstResourceId(globalOptionListBody);
      test.skip(globalOptionId === undefined, '当前菜单未返回全局选项 id，需现场抓取带全局选项的请求。');

      const response = await menuApi.fetchGlobalOption({ id: globalOptionId });

      await expectJsonEnvelope(response, 'GET /api/menu/fetchGlobalOption');
    });

    await test.step('查询菜单组基础列表并校验响应信封', async () => {
      const response = await menuApi.listMenuGroupEntries(toMenuQuery(menuId));

      await expectJsonEnvelope(response, 'GET /api/menu/group/list');
    });

    await test.step('查询菜单组商品全集并校验响应信封', async () => {
      const response = await menuApi.listMenuGroupSaleItems(toMenuQuery(menuId));

      await expectJsonEnvelope(response, 'GET /api/menu/group/saleItem/all');
    });

    await test.step('查询菜单组分页列表并校验响应信封', async () => {
      const response = await menuApi.listMenuGroups(toMenuQuery(menuId));

      await expectJsonEnvelope(response, 'GET /api/menu/menuGroups');
    });

    await test.step('查询分类列表并校验响应信封', async () => {
      const response = await menuApi.listCategories(toMenuQuery(menuId));

      await expectJsonEnvelope(response, 'GET /api/menu/category/list');
    });

    await test.step('查询抽象分类列表并校验响应信封', async () => {
      const response = await menuApi.listAbstractCategories(toMenuQuery(menuId));

      await expectJsonEnvelope(response, 'GET /api/menu/abstractCategorys');
    });

    await test.step('搜索抽象分类并校验响应信封', async () => {
      const response = await menuApi.searchAbstractCategories(toSearchQuery());

      await expectJsonEnvelope(response, 'GET /api/menu/abstractCategorys/search');
    });

    if (menuId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '当前菜单和菜单列表响应均未返回菜单 id，跳过依赖菜单 id 的只读查询。',
      });
      return;
    }

    await test.step('查询轻量菜单并校验响应信封', async () => {
      const response = await menuApi.getLiteMenu(menuId);

      await expectJsonEnvelope(response, 'GET /api/menu/liteMenu/{id}');
    });

    await test.step('按菜单查询分类并校验响应信封', async () => {
      const response = await menuApi.listMenuCategories(menuId);

      await expectJsonEnvelope(response, 'GET /api/menu/menu/{menuId}/menuCategories');
    });

    await test.step('按菜单查询全局选项分类并校验响应信封', async () => {
      const response = await menuApi.listGlobalOptionCategories(menuId);

      await expectJsonEnvelope(response, 'GET /api/menu/menu/{menuId}/globalOptionCategories');
    });

    await test.step('按名称搜索菜单分类并校验响应信封', async () => {
      const response = await menuApi.searchMenuCategoriesByName({ menuId, name: 'L' });

      await expectJsonEnvelope(response, 'GET /api/menu/menuCategorys/searchByName');
    });

    await test.step('搜索菜单全局选项并校验响应信封', async () => {
      const response = await menuApi.searchMenuGlobalOptions({ menuId });

      await expectJsonEnvelope(response, 'GET /api/menu/menuGlobalOptions/search');
    });
  });

  test('应能创建更新查询并删除本次创建的菜单目录资源', async ({
    menuApi,
    apiConfig,
    resourceRegistry,
  }) => {
    test.skip(!apiConfig.enableDestructive, '需要 API_ENABLE_DESTRUCTIVE=true 才能执行写接口测试。');

    const menuRequest = buildMenuRequest();
    const menuBody = await test.step('创建测试菜单并校验响应信封', async () => {
      const response = await menuApi.createMenu(menuRequest);

      return await expectJsonEnvelope(response, 'POST /api/menu/menu');
    });

    const menuId = await resolveCreatedResourceId({
      name: menuRequest.name,
      saveBody: menuBody,
      listLabel: 'GET /api/menu/menus',
      listResource: async () => await menuApi.listMenus({ name: menuRequest.name }),
    });

    if (menuId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '创建菜单响应和菜单列表均未返回本次测试菜单 id，跳过依赖菜单 id 的写接口链路。',
      });
      return;
    }

    let menuArchived = false;
    registerCleanup({
      resourceRegistry,
      type: 'menu',
      id: menuId,
      name: menuRequest.name,
      cleanupPriority: 10,
      deleteResource: async () => {
        if (!menuArchived) {
          await menuApi.updateMenu(toArchivedMenuRequest(menuRequest, menuId));
        }
      },
    });

    await test.step('更新测试菜单并校验响应信封', async () => {
      const updatedMenu = buildMenuRequest();
      const response = await menuApi.updateMenu({ ...menuRequest, ...updatedMenu, id: menuId });

      await expectJsonEnvelope(response, 'PUT /api/menu/menu');
    });

    await test.step('读取测试菜单详情并校验响应信封', async () => {
      const response = await menuApi.getMenu(menuId);

      await expectJsonEnvelope(response, 'GET /api/menu/menu/{id}');
    });

    await test.step('读取测试轻量菜单并校验响应信封', async () => {
      const response = await menuApi.getLiteMenu(menuId);

      await expectJsonEnvelope(response, 'GET /api/menu/liteMenu/{id}');
    });

    await test.step('查询测试菜单相关入口并校验响应信封', async () => {
      const responses = [
        ['GET /api/menu/menu', await menuApi.getCurrentMenu({ product: DEFAULT_MENU_PRODUCT, menuId })],
        ['GET /api/menu/menus', await menuApi.listMenus({ name: menuRequest.name })],
        ['GET /api/search/menu', await menuApi.searchMenu({ name: menuRequest.name })],
        ['GET /api/menu/listGlobalOption', await menuApi.listGlobalOption({ menuId })],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    const menuGroupRequest = buildMenuGroupRequest(menuId);
    const menuGroupBody = await test.step('创建测试菜单组并校验响应信封', async () => {
      const response = await menuApi.createMenuGroup(menuGroupRequest);

      return await expectJsonEnvelope(response, 'POST /api/menu/menuGroup');
    });

    const menuGroupId = await resolveCreatedResourceId({
      name: menuGroupRequest.name,
      saveBody: menuGroupBody,
      listLabel: 'GET /api/menu/menuGroups',
      listResource: async () => await menuApi.listMenuGroups({ menuId, name: menuGroupRequest.name }),
    });

    if (menuGroupId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '创建菜单组响应和菜单组列表均未返回本次测试菜单组 id，跳过后续依赖链路。',
      });
      return;
    }

    let menuGroupDeleted = false;
    registerCleanup({
      resourceRegistry,
      type: 'menuGroup',
      id: menuGroupId,
      name: menuGroupRequest.name,
      cleanupPriority: 30,
      deleteResource: async () => {
        if (!menuGroupDeleted) {
          await menuApi.deleteMenuGroup(menuGroupId);
        }
      },
    });

    await test.step('POST /api/menu/menuGroup/batch/copy 应能复制运行时创建的菜单组', async () => {
      const response = await menuApi.copyMenuGroups({ menuId, groupIds: [menuGroupId] });

      await expectJsonEnvelope(response, 'POST /api/menu/menuGroup/batch/copy');

      const listBody = await expectJsonEnvelope(
        await menuApi.listMenuGroups({ menuId }),
        'GET /api/menu/menuGroups',
      );
      const copiedGroupIds = findResourceIdsByName(listBody.data, menuGroupRequest.name).filter(
        (id) => id !== menuGroupId,
      );
      if (copiedGroupIds.length === 0) {
        test.info().annotations.push({
          type: '说明',
          description: '批量复制响应未返回新菜单组 id，列表中也未定位到同名复制组，无法执行复制组清理。',
        });
        return;
      }

      await expectJsonEnvelope(
        await menuApi.deleteMenuGroups({ groupIds: copiedGroupIds }),
        'DELETE /api/menu/menuGroup/batch/delete',
      );
    });

    const batchDeleteGroupRequest = buildMenuGroupRequest(menuId, 'BATCH_DELETE');
    const batchDeleteGroupBody = await test.step('创建批量删除测试菜单组并校验响应信封', async () => {
      const response = await menuApi.createMenuGroup(batchDeleteGroupRequest);

      return await expectJsonEnvelope(response, 'POST /api/menu/menuGroup');
    });

    const batchDeleteGroupId = await resolveCreatedResourceId({
      name: batchDeleteGroupRequest.name,
      saveBody: batchDeleteGroupBody,
      listLabel: 'GET /api/menu/menuGroups',
      listResource: async () =>
        await menuApi.listMenuGroups({ menuId, name: batchDeleteGroupRequest.name }),
    });

    if (batchDeleteGroupId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '创建批量删除菜单组响应和菜单组列表均未返回 id，跳过批量删除接口。',
      });
    } else {
      let batchDeleteGroupDeleted = false;
      registerCleanup({
        resourceRegistry,
        type: 'menuGroup',
        id: batchDeleteGroupId,
        name: batchDeleteGroupRequest.name,
        cleanupPriority: 31,
        deleteResource: async () => {
          if (!batchDeleteGroupDeleted) {
            await menuApi.deleteMenuGroup(batchDeleteGroupId);
          }
        },
      });

      await test.step('DELETE /api/menu/menuGroup/batch/delete 应能删除运行时创建的菜单组', async () => {
        const response = await menuApi.deleteMenuGroups({ groupIds: [batchDeleteGroupId] });

        await expectJsonEnvelope(response, 'DELETE /api/menu/menuGroup/batch/delete');
        batchDeleteGroupDeleted = true;
      });
    }

    await test.step('更新并查询测试菜单组入口', async () => {
      const updatedGroup = buildMenuGroupRequest(menuId);
      const responses = [
        [
          'PUT /api/menu/menuGroup',
          await menuApi.updateMenuGroup({ ...menuGroupRequest, ...updatedGroup, id: menuGroupId }),
        ],
        ['GET /api/menu/menuGroup/{id}', await menuApi.getMenuGroup(menuGroupId)],
        ['GET /api/menu/menuGroups', await menuApi.listMenuGroups({ menuId })],
        ['GET /api/menu/group/list', await menuApi.listMenuGroupEntries({ menuId })],
        [
          'GET /api/menu/group/saleItem/all',
          await menuApi.listMenuGroupSaleItems({ menuId, menuGroupId }),
        ],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    const categoryRequest = buildCategoryRequest(menuId, menuGroupId);
    const categoryBody = await test.step('创建测试菜单分类并校验响应信封', async () => {
      const response = await menuApi.createMenuCategory(categoryRequest);

      return await expectJsonEnvelope(response, 'POST /api/menu/menuCategory');
    });

    const categoryId = await resolveCreatedResourceId({
      name: categoryRequest.name,
      saveBody: categoryBody,
      listLabel: 'GET /api/menu/category/list',
      listResource: async () =>
        await menuApi.listCategories({ menuId, menuGroupId, name: categoryRequest.name }),
    });

    if (categoryId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '创建分类响应和分类列表均未返回本次测试分类 id，跳过后续依赖链路。',
      });
      return;
    }

    let categoryDeleted = false;
    registerCleanup({
      resourceRegistry,
      type: 'menuCategory',
      id: categoryId,
      name: categoryRequest.name,
      cleanupPriority: 40,
      deleteResource: async () => {
        if (!categoryDeleted) {
          await menuApi.deleteMenuCategory(categoryId);
        }
      },
    });

    await test.step('更新并查询测试分类入口', async () => {
      const updatedCategory = buildCategoryRequest(menuId, menuGroupId);
      const responses = [
        [
          'PUT /api/menu/menuCategory',
          await menuApi.updateMenuCategory({ ...categoryRequest, ...updatedCategory, id: categoryId }),
        ],
        ['GET /api/menu/menuCategory/{id}', await menuApi.getMenuCategory(categoryId)],
        ['GET /api/menu/category/list', await menuApi.listCategories({ menuId, menuGroupId })],
        ['GET /api/menu/menu/{menuId}/menuCategories', await menuApi.listMenuCategories(menuId)],
        [
          'GET /api/menu/menuCategorys/searchByName',
          await menuApi.searchMenuCategoriesByName({ menuId, name: categoryRequest.name }),
        ],
        ['GET /api/menu/abstractCategorys', await menuApi.listAbstractCategories({ menuId })],
        [
          'GET /api/menu/abstractCategorys/search',
          await menuApi.searchAbstractCategories({ keyword: categoryRequest.name, menuId }),
        ],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    const optionCategoryRequest = buildGlobalOptionCategoryRequest(menuId);
    const optionCategoryBody = await test.step('创建测试全局选项分类并校验响应信封', async () => {
      const response = await menuApi.createGlobalOptionCategory(optionCategoryRequest);

      return await expectJsonEnvelope(response, 'POST /api/menu/globalOptionCategory');
    });

    const optionCategoryId = await resolveCreatedResourceId({
      name: optionCategoryRequest.name,
      saveBody: optionCategoryBody,
      listLabel: 'GET /api/menu/menu/{menuId}/globalOptionCategories',
      listResource: async () => await menuApi.listGlobalOptionCategories(menuId),
    });

    if (optionCategoryId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '创建全局选项分类响应和列表均未返回本次测试分类 id，跳过全局选项链路。',
      });
      return;
    }

    let optionCategoryDeleted = false;
    registerCleanup({
      resourceRegistry,
      type: 'globalOptionCategory',
      id: optionCategoryId,
      name: optionCategoryRequest.name,
      cleanupPriority: 20,
      deleteResource: async () => {
        if (!optionCategoryDeleted) {
          await menuApi.deleteGlobalOptionCategory(optionCategoryId);
        }
      },
    });

    await test.step('更新并查询测试全局选项分类入口', async () => {
      const updatedOptionCategory = buildGlobalOptionCategoryRequest(menuId);
      const responses = [
        [
          'PUT /api/menu/globalOptionCategory',
          await menuApi.updateGlobalOptionCategory({
            ...optionCategoryRequest,
            ...updatedOptionCategory,
            id: optionCategoryId,
          }),
        ],
        [
          'GET /api/menu/globalOptionCategory/{id}',
          await menuApi.getGlobalOptionCategory(optionCategoryId),
        ],
        [
          'GET /api/menu/menu/{menuId}/globalOptionCategories',
          await menuApi.listGlobalOptionCategories(menuId),
        ],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    const optionRequest = {
      ...buildGlobalOptionRequest(optionCategoryId),
      menuId,
    };
    const optionBody = await test.step('创建测试菜单全局选项并校验响应信封', async () => {
      const response = await menuApi.createMenuGlobalOption(optionRequest);

      return await expectJsonEnvelope(response, 'POST /api/menu/menuGlobalOption');
    });

    const optionId = await resolveCreatedResourceId({
      name: optionRequest.name,
      saveBody: optionBody,
      listLabel: 'GET /api/menu/menuGlobalOptions/search',
      listResource: async () =>
        await menuApi.searchMenuGlobalOptions({
          menuId,
          globalOptionCategoryId: optionCategoryId,
          keyword: optionRequest.name,
        }),
    });

    if (optionId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '创建菜单全局选项响应和搜索响应均未返回本次测试选项 id，跳过删除前回读。',
      });
      return;
    }

    let optionDeleted = false;
    registerCleanup({
      resourceRegistry,
      type: 'menuGlobalOption',
      id: optionId,
      name: optionRequest.name,
      cleanupPriority: 50,
      deleteResource: async () => {
        if (!optionDeleted) {
          await menuApi.deleteMenuGlobalOption(optionId);
        }
      },
    });

    await test.step('更新并查询测试菜单全局选项入口', async () => {
      const updatedOption = {
        ...buildGlobalOptionRequest(optionCategoryId),
        menuId,
      };
      const responses = [
        [
          'PUT /api/menu/menuGlobalOption',
          await menuApi.updateMenuGlobalOption({ ...optionRequest, ...updatedOption, id: optionId }),
        ],
        ['GET /api/menu/menuGlobalOption/{id}', await menuApi.getMenuGlobalOption(optionId)],
        [
          'GET /api/menu/menuGlobalOptions/search',
          await menuApi.searchMenuGlobalOptions({
            menuId,
            globalOptionCategoryId: optionCategoryId,
            keyword: optionRequest.name,
          }),
        ],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    await test.step('按依赖倒序删除本次创建的资源并校验响应信封', async () => {
      await expectJsonEnvelope(
        await menuApi.deleteMenuGlobalOption(optionId),
        'DELETE /api/menu/menuGlobalOption/{id}',
      );
      optionDeleted = true;

      await expectJsonEnvelope(
        await menuApi.deleteGlobalOptionCategory(optionCategoryId),
        'DELETE /api/menu/globalOptionCategory/{id}',
      );
      optionCategoryDeleted = true;

      await expectJsonEnvelope(
        await menuApi.deleteMenuCategory(categoryId),
        'DELETE /api/menu/menuCategory/{id}',
      );
      categoryDeleted = true;

      await expectJsonEnvelope(
        await menuApi.deleteMenuGroup(menuGroupId),
        'DELETE /api/menu/menuGroup/{id}',
      );
      menuGroupDeleted = true;

      await expectJsonEnvelope(
        await menuApi.updateMenu(toArchivedMenuRequest(menuRequest, menuId)),
        'PUT /api/menu/menu',
      );
      menuArchived = true;
    });
  });
});

async function expectJsonEnvelope(
  response: APIResponse,
  label: string,
): Promise<ApiEnvelope<unknown>> {
  expect(response.status(), `${label} 不应返回 500`).not.toBe(500);

  const body: unknown = await response.json();
  expectResponseEnvelope(body);

  return body;
}

async function resolveCreatedResourceId(options: {
  name: string;
  saveBody: ApiEnvelope<unknown>;
  listLabel: string;
  listResource: () => Promise<APIResponse>;
}): Promise<ResourceId | undefined> {
  const savedId = extractResourceId(options.saveBody);

  if (savedId !== undefined) {
    return savedId;
  }

  return await test.step('从查询响应中定位本次创建记录 id', async () => {
    const listBody = await expectJsonEnvelope(await options.listResource(), options.listLabel);

    return findResourceIdByName(listBody.data, options.name);
  });
}

function registerCleanup(options: {
  resourceRegistry: ResourceRegistry;
  type: MenuCatalogResourceType;
  id: ResourceId;
  name: string;
  cleanupPriority: number;
  deleteResource: () => Promise<unknown>;
}): void {
  options.resourceRegistry.register({
    type: options.type,
    id: options.id,
    name: options.name,
    cleanupPriority: options.cleanupPriority,
    cleanup: async () => {
      await options.deleteResource();
    },
  });
}

function toMenuQuery(menuId: ResourceId | undefined): Record<string, ResourceId> | undefined {
  return menuId === undefined ? undefined : { menuId };
}

function toSearchQuery(): Record<string, string> {
  return { keyword: 'AT' };
}

function toArchivedMenuRequest(
  menuRequest: Record<string, unknown>,
  menuId: ResourceId,
): Record<string, unknown> {
  return {
    ...menuRequest,
    id: menuId,
    enabled: false,
    active: false,
    deleted: true,
  };
}

function extractResourceId(envelope: ApiEnvelope<unknown>): ResourceId | undefined {
  return extractIdFromValue(envelope.data) ?? extractIdFromValue(envelope);
}

function extractFirstResourceId(value: unknown): ResourceId | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = extractFirstResourceId(item);

      if (id !== undefined) {
        return id;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const ownId = extractIdFromRecord(value);

  if (ownId !== undefined) {
    return ownId;
  }

  for (const item of Object.values(value)) {
    const id = extractFirstResourceId(item);

    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function findResourceIdByName(value: unknown, name: string): ResourceId | undefined {
  return findResourceIdByNameValue(value, name, new Set<object>());
}

function findResourceIdsByName(value: unknown, name: string): ResourceId[] {
  const ids: ResourceId[] = [];
  collectResourceIdsByNameValue(value, name, new Set<object>(), ids);

  return ids;
}

function findResourceIdByNameValue(
  value: unknown,
  name: string,
  seen: Set<object>,
): ResourceId | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = findResourceIdByNameValue(item, name, seen);

      if (id !== undefined) {
        return id;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (recordHasName(value, name)) {
    return extractIdFromRecord(value);
  }

  for (const item of Object.values(value)) {
    const id = findResourceIdByNameValue(item, name, seen);

    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function collectResourceIdsByNameValue(
  value: unknown,
  name: string,
  seen: Set<object>,
  ids: ResourceId[],
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectResourceIdsByNameValue(item, name, seen, ids);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (recordHasName(value, name)) {
    const id = extractIdFromRecord(value);

    if (id !== undefined) {
      ids.push(id);
    }
  }

  for (const item of Object.values(value)) {
    collectResourceIdsByNameValue(item, name, seen, ids);
  }
}

function recordHasName(record: Record<string, unknown>, name: string): boolean {
  return [
    'name',
    'displayName',
    'menuName',
    'menuGroupName',
    'categoryName',
    'menuCategoryName',
    'globalOptionCategoryName',
    'globalOptionName',
  ].some((key) => record[key] === name);
}

function extractIdFromValue(value: unknown): ResourceId | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return extractIdFromRecord(value) ?? extractIdFromValue(value.data);
}

function extractIdFromRecord(record: Record<string, unknown>): ResourceId | undefined {
  for (const key of [
    'id',
    'menuId',
    'menuGroupId',
    'categoryId',
    'menuCategoryId',
    'globalOptionCategoryId',
    'globalOptionId',
    'menuGlobalOptionId',
  ]) {
    const value = record[key];

    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

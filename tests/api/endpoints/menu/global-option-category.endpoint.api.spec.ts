import { expect, test } from '../../support/endpoint-fixture';
import { buildGlobalOptionCategoryRequest } from '../../../../test-data/api/menu-api-data';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';
import { registerMenuHardDeleteAfterAll } from '../../support/menu-hard-delete-cleanup';
import type { EndpointResources } from '../../support/endpoint-resources';
import type { MenuApiClient } from '../../../../api/clients/menu-api.client';
import type { ResourceId, ResourceRegistry } from '../../../../api/core/resource-registry';

const MENU_LIST_IDENTITY = { method: 'GET', path: '/api/menu/menus' } as const;
const MENU_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/menu/{id}' } as const;
const GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY = {
  method: 'POST',
  path: '/api/menu/globalOptionCategory',
} as const;
const GLOBAL_OPTION_CATEGORY_UPDATE_IDENTITY = {
  method: 'PUT',
  path: '/api/menu/globalOptionCategory',
} as const;
const GLOBAL_OPTION_CATEGORY_DELETE_IDENTITY = {
  method: 'DELETE',
  path: '/api/menu/globalOptionCategory/{id}',
} as const;
const GLOBAL_OPTION_CATEGORY_LIST_IDENTITY = {
  method: 'GET',
  path: '/api/menu/menu/{menuId}/globalOptionCategories',
} as const;
const GLOBAL_OPTION_CATEGORY_DETAIL_IDENTITY = {
  method: 'GET',
  path: '/api/menu/globalOptionCategory/{id}',
} as const;

registerMenuHardDeleteAfterAll(test);

test.describe('全局选项分类 endpoint', () => {
  test(
    toEndpointTitle(
      GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY.method,
      GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY.path,
      '应能创建全局选项分类',
    ),
    async ({ endpointResources }) => {
      const { optionCategoryResource } = await createGlobalOptionCategoryEndpointScenario(
        endpointResources,
        '全局选项分类创建',
      );

      expect(optionCategoryResource.id).not.toBeUndefined();
      expect(optionCategoryResource.name).toBe((optionCategoryResource.request as { name?: string }).name);
    },
  );

  test(
    toEndpointTitle(
      GLOBAL_OPTION_CATEGORY_UPDATE_IDENTITY.method,
      GLOBAL_OPTION_CATEGORY_UPDATE_IDENTITY.path,
      '应能更新全局选项分类',
    ),
    async ({ menuApi, endpointResources }) => {
      const { menuResource, optionCategoryResource } = await createGlobalOptionCategoryEndpointScenario(
        endpointResources,
        '全局选项分类更新',
      );

      await test.step(
        toEndpointTitle(
          GLOBAL_OPTION_CATEGORY_UPDATE_IDENTITY.method,
          GLOBAL_OPTION_CATEGORY_UPDATE_IDENTITY.path,
          '更新全局选项分类并校验响应',
        ),
        async () => {
          await expectApiOk(
            await menuApi.updateGlobalOptionCategory({
              ...optionCategoryResource.request,
              ...buildGlobalOptionCategoryRequest(menuResource.id),
              id: optionCategoryResource.id,
            }),
            GLOBAL_OPTION_CATEGORY_UPDATE_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(
      GLOBAL_OPTION_CATEGORY_DELETE_IDENTITY.method,
      GLOBAL_OPTION_CATEGORY_DELETE_IDENTITY.path,
      '应能删除全局选项分类',
    ),
    async ({ menuApi, endpointResources, resourceRegistry }) => {
      const { optionCategoryResource } = await createGlobalOptionCategoryEndpointScenario(
        endpointResources,
        '全局选项分类删除',
      );

      await test.step(
        toEndpointTitle(
          GLOBAL_OPTION_CATEGORY_DELETE_IDENTITY.method,
          GLOBAL_OPTION_CATEGORY_DELETE_IDENTITY.path,
          '删除全局选项分类并校验响应',
        ),
        async () => {
          await expectApiOk(
            await menuApi.deleteGlobalOptionCategory(optionCategoryResource.id),
            GLOBAL_OPTION_CATEGORY_DELETE_IDENTITY,
          );
        },
      );

      expect(resourceRegistry.markCleaned('globalOptionCategory', optionCategoryResource.id)).toBe(true);
    },
  );

  test(
    toEndpointTitle(
      GLOBAL_OPTION_CATEGORY_DETAIL_IDENTITY.method,
      GLOBAL_OPTION_CATEGORY_DETAIL_IDENTITY.path,
      '应能读取本次创建的全局选项分类详情',
    ),
    async ({ menuApi, endpointResources, resourceRegistry }) => {
      const { menuId, optionCategoryResource } = await createGlobalOptionCategoryInGlobalGroup(
        menuApi,
        resourceRegistry,
        '详情读取',
      );
      await test.step(
        toEndpointTitle(
          GLOBAL_OPTION_CATEGORY_DETAIL_IDENTITY.method,
          GLOBAL_OPTION_CATEGORY_DETAIL_IDENTITY.path,
          '先创建全局选项用于详情读取',
        ),
        async () => await endpointResources.createMenuGlobalOptionResource(menuId, optionCategoryResource.id),
      );

      const detailBody = await test.step('读取全局选项分类详情并校验全局选项 ID', async () =>
        await expectApiOk(
          await menuApi.getGlobalOptionCategory(optionCategoryResource.id, {
            id: optionCategoryResource.id,
            showReportItem: false,
          }),
          GLOBAL_OPTION_CATEGORY_DETAIL_IDENTITY,
        ),
      );

      const globalOptionId = findRecordId(detailBody.data, (record) => 'price' in record && record.deleted === false);
      expect(globalOptionId, '全局选项分类详情应返回至少一个可用 globalOption ID').not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(
      GLOBAL_OPTION_CATEGORY_LIST_IDENTITY.method,
      GLOBAL_OPTION_CATEGORY_LIST_IDENTITY.path,
      '应能按菜单读取全局选项分类列表',
    ),
    async ({ menuApi, resourceRegistry }) => {
      const { menuId, optionCategoryResource } = await createGlobalOptionCategoryInGlobalGroup(
        menuApi,
        resourceRegistry,
        '列表读取',
      );

      const body = await test.step('按菜单 ID 查询全局选项分类列表并校验响应', async () =>
        await expectApiOk(
          await menuApi.listGlobalOptionCategories(menuId, {
            showInactive: true,
            showOption: false,
          }),
          GLOBAL_OPTION_CATEGORY_LIST_IDENTITY,
        ),
      );

      const categoryId = findRecordId(body.data, (record) => isSameId(record.id, optionCategoryResource.id));
      expect(categoryId, '按菜单读取全局选项分类应返回本次创建的分类 ID').not.toBeUndefined();
    },
  );
});

async function createGlobalOptionCategoryEndpointScenario(
  endpointResources: EndpointResources,
  purpose: string,
) {
  const menuResource = await test.step(
    toEndpointTitle(GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY.method, GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY.path, `先创建菜单用于${purpose}`),
    async () => await endpointResources.createMenuResource(),
  );
  const optionCategoryResource = await test.step(
    toEndpointTitle(GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY.method, GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY.path, `先创建全局选项分类用于${purpose}`),
    async () => await endpointResources.createGlobalOptionCategoryResource(menuResource.id),
  );

  return {
    menuResource,
    optionCategoryResource,
  };
}

async function createGlobalOptionCategoryInGlobalGroup(
  menuApi: MenuApiClient,
  resourceRegistry: ResourceRegistry,
  purpose: string,
): Promise<{
  menuId: ResourceId;
  optionCategoryResource: { id: ResourceId; name: string; request: Record<string, unknown> };
}> {
  const { menuId, menuGroupId } = await resolveGlobalOptionMenuContext(menuApi);
  const request = {
    ...buildGlobalOptionCategoryRequest(menuId),
    groupId: menuGroupId,
  };
  const body = await test.step(
    toEndpointTitle(
      GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY.method,
      GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY.path,
      `先创建全局选项分类用于${purpose}`,
    ),
    async () => await expectApiOk(await menuApi.createGlobalOptionCategory(request), GLOBAL_OPTION_CATEGORY_CREATE_IDENTITY),
  );
  const id = findRecordId(body.data, (record) => isSameId(record.menuId, menuId) || record.name === request.name);

  expect(id, '创建全局选项分类响应应返回分类 ID').not.toBeUndefined();

  resourceRegistry.register({
    type: 'globalOptionCategory',
    id: id!,
    name: request.name,
    cleanupPriority: 45,
    cleanup: () => menuApi.deleteGlobalOptionCategory(id!),
  });

  return {
    menuId,
    optionCategoryResource: {
      id: id!,
      name: request.name,
      request,
    },
  };
}

async function resolveGlobalOptionMenuContext(menuApi: MenuApiClient): Promise<{
  menuId: ResourceId;
  menuGroupId: ResourceId;
}> {
  const menuId = await test.step('从菜单列表定位 POS 菜单 ID', async () => {
    const body = await expectApiOk(
      await menuApi.listMenus({
        expandMenuLevel: 0,
        showInactive: true,
        showOption: false,
      }),
      MENU_LIST_IDENTITY,
    );

    return findRecordId(body.data, (record) => record.name === 'POS Menu' || record.productLine === 'POS');
  });

  expect(menuId, '菜单列表应返回 POS 菜单 ID').not.toBeUndefined();

  const menuGroupId = await test.step('从菜单详情定位全局选项菜单组 ID', async () => {
    const body = await expectApiOk(
      await menuApi.getMenu(menuId!, {
        expandMenuLevel: 1,
        showInactive: true,
        showOption: false,
      }),
      MENU_DETAIL_IDENTITY,
    );

    return findRecordId(body.data, (record) => record.name === 'Global Option Group' || record.global === true);
  });

  expect(menuGroupId, '菜单详情应返回 Global Option Group ID').not.toBeUndefined();

  return {
    menuId: menuId!,
    menuGroupId: menuGroupId!,
  };
}

function findRecordId(
  value: unknown,
  predicate: (record: Record<string, unknown>) => boolean,
): string | number | undefined {
  return findRecordIdValue(value, predicate, new Set<object>());
}

function findRecordIdValue(
  value: unknown,
  predicate: (record: Record<string, unknown>) => boolean,
  seen: Set<object>,
): string | number | undefined {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return undefined;
    }
    seen.add(value);

    for (const item of value) {
      const id = findRecordIdValue(item, predicate, seen);
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

  if (predicate(value)) {
    return extractId(value);
  }

  for (const item of Object.values(value)) {
    const id = findRecordIdValue(item, predicate, seen);
    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function extractId(record: Record<string, unknown>): string | number | undefined {
  const id = record.id;

  if (typeof id === 'number' || typeof id === 'string') {
    return id;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSameId(value: unknown, expected: string | number): boolean {
  return (typeof value === 'number' || typeof value === 'string') && String(value) === String(expected);
}

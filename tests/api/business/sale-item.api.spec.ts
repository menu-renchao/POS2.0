import { expect, type APIResponse } from '@playwright/test';
import type { ApiRequestData } from '../../../api/clients/client-path';
import { API_SPEC_FILES, firstBatchApiCases } from '../../../api/contracts/first-batch-api-cases';
import { expectResponseEnvelope, type ApiEnvelope } from '../../../api/core/api-response';
import type { ResourceId, ResourceRegistry } from '../../../api/core/resource-registry';
import { createShortTestName } from '../../../api/core/test-data-id';
import { test } from '../../../fixtures/api.fixture';
import {
  DEFAULT_MENU_PRODUCT,
  buildCategoryRequest,
  buildMenuGroupRequest,
  buildMenuRequest,
  buildSaleItemRequest,
} from '../../../test-data/api/menu-api-data';
import { registerMenuHardDeleteAfterAll } from '../support/menu-hard-delete-cleanup';

type SaleItemResourceType = 'menu' | 'menuGroup' | 'menuCategory' | 'saleItem';

registerMenuHardDeleteAfterAll(test);

test.describe('商品和 SPU 库存接口', () => {
  test('应已登记商品和 SPU 接口覆盖入口', () => {
    const cases = firstBatchApiCases.filter((apiCase) => apiCase.specFile === API_SPEC_FILES.saleItem);

    expect(cases.length).toBeGreaterThan(0);
  });

  test('应能查询商品管理只读入口并校验响应信封', async ({ menuApi, saleItemApi }) => {
    const menuListBody = await test.step('查询菜单列表作为商品查询前置', async () => {
      const response = await menuApi.listMenus();

      return await expectJsonEnvelope(response, 'GET /api/menu/menus');
    });

    const currentMenuBody = await test.step('查询当前菜单作为商品查询前置', async () => {
      const response = await menuApi.getCurrentMenu({ product: DEFAULT_MENU_PRODUCT });

      return await expectJsonEnvelope(response, 'GET /api/menu/menu');
    });

    const menuId =
      extractResourceId(currentMenuBody) ?? extractFirstResourceId(menuListBody.data);

    const categoryBody = await test.step('查询分类列表作为按分类查商品前置', async () => {
      const response = await menuApi.listCategories(toMenuQuery(menuId));

      return await expectJsonEnvelope(response, 'GET /api/menu/category/list');
    });

    const categoryId = extractFirstResourceId(categoryBody.data);

    const listByCategoryBody = await test.step('按分类查询商品列表并校验响应信封', async () => {
      const response = await saleItemApi.listByCategory({
        ...toOptionalQuery({ categoryId }),
        showOffMenuItems: true,
        nameIdOnly: false,
        fetchOptions: true,
        includeCategoryAttributesAndOptions: true,
        showNonCombo: false,
      });

      return await expectJsonEnvelope(response, 'GET /api/menu/item/listByCategory');
    });

    const searchBody = await test.step('搜索菜单商品并校验响应信封', async () => {
      const response = await saleItemApi.searchSaleItems({
        ...toOptionalQuery({
          menuIds: menuId,
          categoryIds: categoryId,
        }),
        name: 'P',
        pageNo: 1,
        pageSize: 10,
      });

      return await expectJsonEnvelope(response, 'GET /api/menu/menuSaleItems/search');
    });

    const saleItemId =
      extractFirstResourceId(listByCategoryBody.data) ?? extractFirstResourceId(searchBody.data);

    await test.step('查询商品详情读取入口并校验响应信封', async () => {
      const response = await saleItemApi.fetchSaleItem(
        {
          ...toOptionalQuery({ itemId: saleItemId }),
          fetchOptions: true,
          includeCategoryAttributesAndOptions: true,
        },
      );

      await expectJsonEnvelope(response, 'GET /api/menu/item/fetchSaleItem');
    });

    await test.step('查询商品选项读取入口并校验响应信封', async () => {
      const optionId = extractFirstResourceIdByCollectionKey(listByCategoryBody.data, 'options');
      test.skip(optionId === undefined, '当前商品样例未返回 optionId，需现场抓取带选项的商品请求。');

      const response = await saleItemApi.fetchItemOption(
        toOptionalQuery({
          optionId,
        }),
      );

      await expectJsonEnvelope(response, 'GET /api/menu/item/fetchItemOption');
    });

    await test.step('查询套餐可选商品列表并校验响应信封', async () => {
      const response = await saleItemApi.listComboSaleItem({
        ...toOptionalQuery({ menuId, menuCategoryId: categoryId, categoryId }),
        pageNo: 1,
        pageSize: 10,
      });

      await expectJsonEnvelope(response, 'GET /api/menu/item/listComboSaleItem');
    });

    await test.step('查询商品选项列表并校验响应信封', async () => {
      const response = await saleItemApi.listItemOptions(
        toOptionalQuery({
          menuId,
          menuSaleItemId: saleItemId,
          saleItemId,
        }),
      );

      await expectJsonEnvelope(response, 'GET /api/menu/item/listItemOptions');
    });

    await test.step('按名称搜索菜单商品并校验响应信封', async () => {
      const response = await saleItemApi.searchSaleItemsByName({
        ...toOptionalQuery({ menuId, menuCategoryId: categoryId, categoryId }),
        name: 'AT',
        keyword: 'AT',
        pageNo: 1,
        pageSize: 10,
      });

      await expectJsonEnvelope(response, 'GET /api/menu/menuSaleItems/searchByName');
    });
  });

  test('应能创建更新查询并删除本次创建的商品和 SPU 库存映射', async ({
    menuApi,
    resourceRegistry,
    saleItemApi,
    spuApi,
  }) => {
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
        description: '创建菜单响应和菜单列表均未返回本次测试菜单 id，跳过依赖菜单 id 的商品链路。',
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
      cleanupResource: async () => {
        if (!menuArchived) {
          await menuApi.updateMenu(toArchivedMenuRequest(menuRequest, menuId));
        }
      },
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
        description: '创建菜单组响应和菜单组列表均未返回本次测试菜单组 id，跳过后续商品链路。',
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
      cleanupResource: async () => {
        if (!menuGroupDeleted) {
          await menuApi.deleteMenuGroup(menuGroupId);
        }
      },
    });

    const categoryRequest = buildCategoryRequest(menuId, menuGroupId);
    const categoryBody = await test.step('创建测试分类并校验响应信封', async () => {
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
        description: '创建分类响应和分类列表均未返回本次测试分类 id，跳过后续商品链路。',
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
      cleanupResource: async () => {
        if (!categoryDeleted) {
          await menuApi.deleteMenuCategory(categoryId);
        }
      },
    });

    const saleItemRequest = {
      ...buildSaleItemRequest(categoryId),
      menuId,
      menuGroupId,
      categoryId,
    };
    const saleItemBody = await test.step('创建测试商品并校验响应信封', async () => {
      const response = await saleItemApi.createSaleItem(saleItemRequest);

      return await expectJsonEnvelope(response, 'POST /api/menu/menuSaleItem');
    });

    const saleItemId = await resolveCreatedResourceId({
      name: saleItemRequest.name,
      saveBody: saleItemBody,
      listLabel: 'GET /api/menu/menuSaleItems/search',
      listResource: async () =>
        await saleItemApi.searchSaleItems({
          menuId,
          menuCategoryId: categoryId,
          categoryId,
          keyword: saleItemRequest.name,
        }),
    });

    if (saleItemId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '创建商品响应和商品搜索响应均未返回本次测试商品 id，跳过依赖商品 id 的链路。',
      });
      return;
    }

    let saleItemDeleted = false;
    registerCleanup({
      resourceRegistry,
      type: 'saleItem',
      id: saleItemId,
      name: saleItemRequest.name,
      cleanupPriority: 50,
      cleanupResource: async () => {
        if (!saleItemDeleted) {
          await saleItemApi.deleteSaleItem(saleItemId);
        }
      },
    });

    const batchSaleItemRequest = {
      ...buildSaleItemRequest(categoryId, 'BATCH'),
      menuId,
      menuGroupId,
      categoryId,
    };
    const batchSaleItemBody = await test.step('创建批量操作测试商品并校验响应信封', async () => {
      const response = await saleItemApi.createSaleItem(batchSaleItemRequest);

      return await expectJsonEnvelope(response, 'POST /api/menu/menuSaleItem');
    });

    const batchSaleItemId = await resolveCreatedResourceId({
      name: batchSaleItemRequest.name,
      saveBody: batchSaleItemBody,
      listLabel: 'GET /api/menu/menuSaleItems/search',
      listResource: async () =>
        await saleItemApi.searchSaleItems({
          menuIds: menuId,
          categoryIds: categoryId,
          name: batchSaleItemRequest.name,
        }),
    });

    let batchSaleItemDeleted = false;
    if (batchSaleItemId === undefined) {
      test.info().annotations.push({
        type: '说明',
        description: '创建批量操作商品响应和商品搜索响应均未返回商品 id，跳过商品批量排序和批量更新接口。',
      });
    } else {
      registerCleanup({
        resourceRegistry,
        type: 'saleItem',
        id: batchSaleItemId,
        name: batchSaleItemRequest.name,
        cleanupPriority: 51,
        cleanupResource: async () => {
          if (!batchSaleItemDeleted) {
            await saleItemApi.deleteSaleItem(batchSaleItemId);
          }
        },
      });

      await test.step('PUT /api/menu/menuSaleItem/batch/sequence 应能排序运行时创建的商品', async () => {
        const response = await saleItemApi.sequenceSaleItems({
          saleItemIds: [batchSaleItemId, saleItemId],
        });

        await expectJsonEnvelope(response, 'PUT /api/menu/menuSaleItem/batch/sequence');
      });

      await test.step('PUT /api/menu/menuSaleItem/batch/update 应能批量更新运行时创建的商品', async () => {
        const response = await saleItemApi.updateSaleItems({
          saleItemIds: [saleItemId, batchSaleItemId],
          price: 8.88,
        });

        await expectJsonEnvelope(response, 'PUT /api/menu/menuSaleItem/batch/update');
      });
    }

    await test.step('更新并查询测试商品入口', async () => {
      const updatedSaleItem = {
        ...saleItemRequest,
        ...buildSaleItemRequest(categoryId),
        id: saleItemId,
        menuSaleItemId: saleItemId,
        menuId,
        menuGroupId,
        menuCategoryId: categoryId,
        categoryId,
        price: 11,
      };
      const responses = [
        ['PUT /api/menu/menuSaleItem', await saleItemApi.updateSaleItem(updatedSaleItem)],
        [
          'GET /api/menu/menuSaleItem/{id}',
          await saleItemApi.getSaleItem(saleItemId, { menuId, menuCategoryId: categoryId }),
        ],
        [
          'GET /api/menu/item/fetchSaleItem',
          await saleItemApi.fetchSaleItem({
            itemId: saleItemId,
            fetchOptions: true,
            includeCategoryAttributesAndOptions: true,
          }),
        ],
        [
          'GET /api/menu/item/listByCategory',
          await saleItemApi.listByCategory({
            categoryId,
            showOffMenuItems: true,
            nameIdOnly: false,
            fetchOptions: true,
            includeCategoryAttributesAndOptions: true,
            showNonCombo: false,
          }),
        ],
        [
          'GET /api/menu/item/listComboSaleItem',
          await saleItemApi.listComboSaleItem({ menuId, menuCategoryId: categoryId, categoryId }),
        ],
        [
          'GET /api/menu/menuSaleItems/search',
          await saleItemApi.searchSaleItems({
            menuIds: menuId,
            categoryIds: categoryId,
            name: saleItemRequest.name,
          }),
        ],
        [
          'GET /api/menu/menuSaleItems/searchByName',
          await saleItemApi.searchSaleItemsByName({
            menuId,
            menuCategoryId: categoryId,
            categoryId,
            name: saleItemRequest.name,
            keyword: saleItemRequest.name,
          }),
        ],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    await test.step('快速编辑测试商品并校验响应信封', async () => {
      const response = await saleItemApi.quickEditSaleItem({
        id: saleItemId,
        menuSaleItemId: saleItemId,
        menuId,
        menuCategoryId: categoryId,
        categoryId,
        name: saleItemRequest.name,
        displayName: saleItemRequest.name,
        price: 12,
        enabled: true,
      });

      await expectJsonEnvelope(response, 'PUT /api/menu/menuSaleItem/quickEdit');
    });

    await test.step('查询测试商品选项入口并校验响应信封', async () => {
      const optionListResponse = await saleItemApi.listItemOptions({ saleItemId });
      const optionListBody = await expectJsonEnvelope(
        optionListResponse,
        'GET /api/menu/item/listItemOptions',
      );
      const optionId = extractFirstResourceId(optionListBody.data);
      if (optionId === undefined) {
        test.info().annotations.push({
          type: '说明',
          description: '当前运行时商品未返回 optionId，需现场抓取带选项商品请求。',
        });
        return;
      }

      const responses = [
        [
          'GET /api/menu/item/fetchItemOption',
          await saleItemApi.fetchItemOption({
            optionId,
          }),
        ],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    const spuCode = buildSpuCode();
    await test.step('分配并链接测试商品 SPU 映射', async () => {
      const assignRequest = buildSpuSaleItemRequest({
        spuCode,
        saleItemId,
        menuId,
        categoryId,
        name: saleItemRequest.name,
      });
      const linkRequest = {
        ...assignRequest,
        linked: true,
      };
      const responses = [
        ['POST /api/spu/menuSaleItem/assign', await spuApi.assignSaleItem(assignRequest)],
        ['POST /api/spu/menuSaleItem/link', await spuApi.linkSaleItem(linkRequest)],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    await test.step('查询测试 SPU 商品映射并提交单笔库存操作', async () => {
      const responses = [
        ['GET /api/spu/menuSaleItem/list/{code}', await spuApi.listByCode(spuCode, { menuId })],
        [
          'POST /api/spu/stockOperation',
          await spuApi.stockOperation(
            buildSpuStockOperationRequest({
              spuCode,
              saleItemId,
              menuId,
              name: saleItemRequest.name,
            }),
          ),
        ],
      ] as const;

      for (const [label, response] of responses) {
        await expectJsonEnvelope(response, label);
      }
    });

    await test.step('按依赖倒序清理本次创建的商品和菜单前置数据', async () => {
      if (batchSaleItemId !== undefined) {
        await expectJsonEnvelope(
          await saleItemApi.deleteSaleItem(batchSaleItemId),
          'DELETE /api/menu/menuSaleItem/{id}',
        );
        batchSaleItemDeleted = true;
      }

      await expectJsonEnvelope(
        await saleItemApi.deleteSaleItem(saleItemId),
        'DELETE /api/menu/menuSaleItem/{id}',
      );
      saleItemDeleted = true;

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
  expect(body.code, `${label} 应返回业务成功 code=0`).toBe(0);

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
  type: SaleItemResourceType;
  id: ResourceId;
  name: string;
  cleanupPriority: number;
  cleanupResource: () => Promise<unknown>;
}): void {
  options.resourceRegistry.register({
    type: options.type,
    id: options.id,
    name: options.name,
    cleanupPriority: options.cleanupPriority,
    cleanup: async () => {
      await options.cleanupResource();
    },
  });
}

function buildSpuCode(): string {
  return createShortTestName({
    prefix: 'AT',
    domain: 'SPU',
    maxLength: 20,
  });
}

function buildSpuSaleItemRequest(options: {
  spuCode: string;
  saleItemId: ResourceId;
  menuId: ResourceId;
  categoryId: ResourceId;
  name: string;
}): ApiRequestData {
  return {
    code: options.spuCode,
    spuCode: options.spuCode,
    name: options.name,
    displayName: options.name,
    id: options.saleItemId,
    saleItemId: options.saleItemId,
    menuSaleItemId: options.saleItemId,
    menuItemId: options.saleItemId,
    menuId: options.menuId,
    categoryId: options.categoryId,
    menuCategoryId: options.categoryId,
    enabled: true,
  };
}

function buildSpuStockOperationRequest(options: {
  spuCode: string;
  saleItemId: ResourceId;
  menuId: ResourceId;
  name: string;
}): ApiRequestData {
  return {
    code: options.spuCode,
    spuCode: options.spuCode,
    name: options.name,
    saleItemId: options.saleItemId,
    menuSaleItemId: options.saleItemId,
    menuId: options.menuId,
    operationType: 'IN',
    type: 'IN',
    quantity: 1,
    amount: 1,
    stock: 1,
    remark: options.name,
  };
}

function toMenuQuery(menuId: ResourceId | undefined): Record<string, ResourceId> | undefined {
  return menuId === undefined ? undefined : { menuId };
}

function toOptionalQuery(
  query: Record<string, ResourceId | undefined>,
): Record<string, ResourceId> | undefined {
  const entries = Object.entries(query).filter((entry): entry is [string, ResourceId] => {
    const value = entry[1];

    return typeof value === 'number' || typeof value === 'string';
  });

  return entries.length === 0 ? undefined : Object.fromEntries(entries);
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

function extractFirstResourceIdByCollectionKey(
  value: unknown,
  collectionKey: string,
  seen = new WeakSet<object>(),
): ResourceId | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = extractFirstResourceIdByCollectionKey(item, collectionKey, seen);

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

  const collection = value[collectionKey];
  if (Array.isArray(collection)) {
    const id = extractFirstResourceId(collection);

    if (id !== undefined) {
      return id;
    }
  }

  for (const item of Object.values(value)) {
    const id = extractFirstResourceIdByCollectionKey(item, collectionKey, seen);

    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function findResourceIdByName(value: unknown, name: string): ResourceId | undefined {
  return findResourceIdByNameValue(value, name, new Set<object>());
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

function recordHasName(record: Record<string, unknown>, name: string): boolean {
  return [
    'name',
    'displayName',
    'menuName',
    'menuGroupName',
    'categoryName',
    'menuCategoryName',
    'saleItemName',
    'menuSaleItemName',
    'itemName',
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
    'saleItemId',
    'menuSaleItemId',
    'itemId',
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

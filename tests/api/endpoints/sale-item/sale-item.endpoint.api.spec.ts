import { expect, test } from '../../support/endpoint-fixture';
import { buildSaleItemRequest } from '../../../../test-data/api/menu-api-data';
import { expectApiOk, expectApiRejected } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';
import { findResourceIdByName } from '../../support/endpoint-read-model';
import { registerMenuHardDeleteAfterAll } from '../../support/menu-hard-delete-cleanup';
import type { EndpointResources } from '../../support/endpoint-resources';

const SALE_ITEM_CREATE_IDENTITY = { method: 'POST', path: '/api/menu/menuSaleItem' } as const;
const SALE_ITEM_UPDATE_IDENTITY = { method: 'PUT', path: '/api/menu/menuSaleItem' } as const;
const SALE_ITEM_DETAIL_IDENTITY = { method: 'GET', path: '/api/menu/menuSaleItem/{id}' } as const;
const SALE_ITEM_DELETE_IDENTITY = { method: 'DELETE', path: '/api/menu/menuSaleItem/{id}' } as const;
const SALE_ITEM_BATCH_COPY_IDENTITY = { method: 'POST', path: '/api/menu/menuSaleItem/batch/copy' } as const;
const SALE_ITEM_CUSTOMIZE_PRICE_IDENTITY = {
  method: 'POST',
  path: '/api/menu/menuSaleItem/batch/customizeMenuItemPriceAndMemberPrices',
} as const;
const SALE_ITEM_BATCH_DELETE_IDENTITY = { method: 'DELETE', path: '/api/menu/menuSaleItem/batch/delete' } as const;
const SALE_ITEM_SEQUENCE_IDENTITY = { method: 'PUT', path: '/api/menu/menuSaleItem/batch/sequence' } as const;
const SALE_ITEM_BATCH_UPDATE_IDENTITY = { method: 'PUT', path: '/api/menu/menuSaleItem/batch/update' } as const;
const SALE_ITEM_OUT_OF_STOCK_IDENTITY = { method: 'PUT', path: '/api/menu/menuSaleItem/batch/updateOutOfStock' } as const;
const SALE_ITEM_QUICK_EDIT_IDENTITY = { method: 'PUT', path: '/api/menu/menuSaleItem/quickEdit' } as const;
const SALE_ITEM_FETCH_IDENTITY = { method: 'GET', path: '/api/menu/item/fetchSaleItem' } as const;
const SALE_ITEM_LIST_BY_CATEGORY_IDENTITY = { method: 'GET', path: '/api/menu/item/listByCategory' } as const;
const COMBO_SALE_ITEM_LIST_IDENTITY = { method: 'GET', path: '/api/menu/item/listComboSaleItem' } as const;
const SALE_ITEM_OPTION_LIST_IDENTITY = { method: 'GET', path: '/api/menu/item/listItemOptions' } as const;
const SALE_ITEM_SEARCH_IDENTITY = { method: 'GET', path: '/api/menu/menuSaleItems/search' } as const;
const SALE_ITEM_SEARCH_BY_NAME_IDENTITY = { method: 'GET', path: '/api/menu/menuSaleItems/searchByName' } as const;

registerMenuHardDeleteAfterAll(test);

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
    toEndpointTitle(
      SALE_ITEM_CUSTOMIZE_PRICE_IDENTITY.method,
      SALE_ITEM_CUSTOMIZE_PRICE_IDENTITY.path,
      '应能批量自定义商品价格',
    ),
    async ({ endpointResources, saleItemApi }) => {
      const { categoryResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品批量自定义价格',
      );

      await test.step(
        toEndpointTitle(
          SALE_ITEM_CUSTOMIZE_PRICE_IDENTITY.method,
          SALE_ITEM_CUSTOMIZE_PRICE_IDENTITY.path,
          '提交商品价格 DTO 并校验响应',
        ),
        async () => {
          await expectApiOk(
            await saleItemApi.customizeMenuItemPriceAndMemberPrices([
              {
                id: saleItemResource.id,
                categoryId: categoryResource.id,
                price: 9.99,
                benefitPrice: 8.99,
              },
            ]),
            SALE_ITEM_CUSTOMIZE_PRICE_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_BATCH_COPY_IDENTITY.method, SALE_ITEM_BATCH_COPY_IDENTITY.path, '应能批量复制商品到目标分类'),
    async ({ endpointResources, saleItemApi, resourceRegistry }) => {
      const { menuResource, menuGroupResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品批量复制',
      );
      const targetCategoryResource = await test.step(
        toEndpointTitle(SALE_ITEM_BATCH_COPY_IDENTITY.method, SALE_ITEM_BATCH_COPY_IDENTITY.path, '先创建目标分类用于复制商品'),
        async () =>
          await endpointResources.createCategoryResource(
            menuResource.id,
            menuGroupResource.id,
          ),
      );

      await test.step(
        toEndpointTitle(SALE_ITEM_BATCH_COPY_IDENTITY.method, SALE_ITEM_BATCH_COPY_IDENTITY.path, '复制商品到目标分类并校验响应'),
        async () => {
          await expectApiOk(
            await saleItemApi.copySaleItems({
              saleItemIds: [saleItemResource.id],
              categoryId: targetCategoryResource.id,
            }),
            SALE_ITEM_BATCH_COPY_IDENTITY,
          );
        },
      );

      const copiedSaleItemId = await test.step(
        toEndpointTitle(SALE_ITEM_LIST_BY_CATEGORY_IDENTITY.method, SALE_ITEM_LIST_BY_CATEGORY_IDENTITY.path, '从目标分类查找复制出的商品'),
        async () => {
          const body = await expectApiOk(
            await saleItemApi.listByCategory({
              categoryId: targetCategoryResource.id,
              menuCategoryId: targetCategoryResource.id,
              name: saleItemResource.name,
              showOffMenuItems: true,
              nameIdOnly: false,
              pageNo: 1,
              pageSize: 10,
            }),
            SALE_ITEM_LIST_BY_CATEGORY_IDENTITY,
          );

          return findResourceIdByName(body.data, saleItemResource.name);
        },
      );

      expect(copiedSaleItemId, '目标分类应能查到复制出的商品 ID').not.toBeUndefined();

      resourceRegistry.register({
        type: 'saleItem',
        id: copiedSaleItemId!,
        name: `${saleItemResource.name}-copy`,
        cleanupPriority: 50,
        cleanup: () => saleItemApi.deleteSaleItem(copiedSaleItemId!),
      });

      await test.step(
        toEndpointTitle(SALE_ITEM_DELETE_IDENTITY.method, SALE_ITEM_DELETE_IDENTITY.path, '删除复制出的商品并标记清理'),
        async () => {
          await expectApiOk(await saleItemApi.deleteSaleItem(copiedSaleItemId!), SALE_ITEM_DELETE_IDENTITY);
        },
      );
      expect(resourceRegistry.markCleaned('saleItem', copiedSaleItemId!)).toBe(true);
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_OUT_OF_STOCK_IDENTITY.method, SALE_ITEM_OUT_OF_STOCK_IDENTITY.path, '应能批量更新商品售罄状态'),
    async ({ endpointResources, saleItemApi }) => {
      const { saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品批量售罄状态更新',
      );

      await test.step(
        toEndpointTitle(SALE_ITEM_OUT_OF_STOCK_IDENTITY.method, SALE_ITEM_OUT_OF_STOCK_IDENTITY.path, '提交售罄状态列表并校验响应'),
        async () => {
          await expectApiOk(
            await saleItemApi.updateOutOfStock({
              saleItemOutOfStockBatchDTOList: [
                {
                  saleItemId: saleItemResource.id,
                  outOfStock: true,
                  optionItem: false,
                },
              ],
            }),
            SALE_ITEM_OUT_OF_STOCK_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_BATCH_DELETE_IDENTITY.method, SALE_ITEM_BATCH_DELETE_IDENTITY.path, '应能批量删除商品'),
    async ({ endpointResources, saleItemApi, resourceRegistry }) => {
      const { saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品批量删除',
      );

      await test.step(
        toEndpointTitle(SALE_ITEM_BATCH_DELETE_IDENTITY.method, SALE_ITEM_BATCH_DELETE_IDENTITY.path, '提交商品 ID 集合并校验响应'),
        async () => {
          await expectApiOk(
            await saleItemApi.deleteSaleItems({
              saleItemIds: [saleItemResource.id],
            }),
            SALE_ITEM_BATCH_DELETE_IDENTITY,
          );
        },
      );

      expect(resourceRegistry.markCleaned('saleItem', saleItemResource.id)).toBe(true);
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_BATCH_UPDATE_IDENTITY.method, SALE_ITEM_BATCH_UPDATE_IDENTITY.path, '应能批量更新商品'),
    async ({ endpointResources, saleItemApi }) => {
      const { menuResource, menuGroupResource, categoryResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品批量更新',
      );
      const secondSaleItemResource = await test.step(
        toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '再创建一个商品用于批量更新'),
        async () =>
          await endpointResources.createSaleItemResource(
            menuResource.id,
            menuGroupResource.id,
            categoryResource.id,
          ),
      );

      await test.step(
        toEndpointTitle(SALE_ITEM_BATCH_UPDATE_IDENTITY.method, SALE_ITEM_BATCH_UPDATE_IDENTITY.path, '提交商品 ID 和价格并校验响应'),
        async () => {
          await expectApiOk(
            await saleItemApi.updateSaleItems({
              saleItemIds: [saleItemResource.id, secondSaleItemResource.id],
              price: 8.88,
            }),
            SALE_ITEM_BATCH_UPDATE_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_SEQUENCE_IDENTITY.method, SALE_ITEM_SEQUENCE_IDENTITY.path, '应能批量调整商品排序'),
    async ({ endpointResources, saleItemApi }) => {
      const { menuResource, menuGroupResource, categoryResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品批量排序',
      );
      const secondSaleItemResource = await test.step(
        toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '再创建一个商品用于批量排序'),
        async () =>
          await endpointResources.createSaleItemResource(
            menuResource.id,
            menuGroupResource.id,
            categoryResource.id,
          ),
      );

      await test.step(
        toEndpointTitle(SALE_ITEM_SEQUENCE_IDENTITY.method, SALE_ITEM_SEQUENCE_IDENTITY.path, '提交商品 ID 顺序并校验响应'),
        async () => {
          await expectApiOk(
            await saleItemApi.sequenceSaleItems({
              saleItemIds: [secondSaleItemResource.id, saleItemResource.id],
            }),
            SALE_ITEM_SEQUENCE_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_QUICK_EDIT_IDENTITY.method, SALE_ITEM_QUICK_EDIT_IDENTITY.path, '应能快速编辑商品'),
    async ({ endpointResources, saleItemApi }) => {
      const { menuResource, categoryResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品快速编辑',
      );
      const request = saleItemResource.request as { name?: string };
      const editedPrice = 12;

      await test.step(
        toEndpointTitle(SALE_ITEM_QUICK_EDIT_IDENTITY.method, SALE_ITEM_QUICK_EDIT_IDENTITY.path, '快速编辑商品并校验响应'),
        async () => {
          await expectApiOk(
            await saleItemApi.quickEditSaleItem({
              id: saleItemResource.id,
              menuSaleItemId: saleItemResource.id,
              menuId: menuResource.id,
              menuCategoryId: categoryResource.id,
              categoryId: categoryResource.id,
              name: request.name,
              displayName: request.name,
              price: editedPrice,
              enabled: true,
            }),
            SALE_ITEM_QUICK_EDIT_IDENTITY,
          );
        },
      );

      const body = await test.step(
        toEndpointTitle(SALE_ITEM_DETAIL_IDENTITY.method, SALE_ITEM_DETAIL_IDENTITY.path, '回读快速编辑后的商品详情'),
        async () =>
          await expectApiOk(
            await saleItemApi.getSaleItem(saleItemResource.id, {
              menuId: menuResource.id,
              menuCategoryId: categoryResource.id,
            }),
            SALE_ITEM_DETAIL_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_LIST_BY_CATEGORY_IDENTITY.method, SALE_ITEM_LIST_BY_CATEGORY_IDENTITY.path, '应能按分类查询商品'),
    async ({ endpointResources, saleItemApi }) => {
      const { categoryResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '按分类查询商品',
      );
      const body = await test.step(
        toEndpointTitle(
          SALE_ITEM_LIST_BY_CATEGORY_IDENTITY.method,
          SALE_ITEM_LIST_BY_CATEGORY_IDENTITY.path,
          '按分类 ID 查询商品并校验响应',
        ),
        async () =>
          await expectApiOk(
            await saleItemApi.listByCategory({
              categoryId: categoryResource.id,
              menuCategoryId: categoryResource.id,
              name: saleItemResource.name,
              showOffMenuItems: true,
              nameIdOnly: false,
              fetchOptions: true,
              includeCategoryAttributesAndOptions: true,
              pageNo: 1,
              pageSize: 10,
            }),
            SALE_ITEM_LIST_BY_CATEGORY_IDENTITY,
          ),
      );

      expect(
        findResourceIdByName(body.data, saleItemResource.name),
        '按分类查询应返回本次创建的商品',
      ).toBe(saleItemResource.id);
    },
  );

  test(
    toEndpointTitle(COMBO_SALE_ITEM_LIST_IDENTITY.method, COMBO_SALE_ITEM_LIST_IDENTITY.path, '应能按分类查询套餐可选商品列表'),
    async ({ endpointResources, saleItemApi }) => {
      const { menuResource, categoryResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '套餐可选商品列表查询',
      );
      const body = await test.step(
        toEndpointTitle(
          COMBO_SALE_ITEM_LIST_IDENTITY.method,
          COMBO_SALE_ITEM_LIST_IDENTITY.path,
          '按菜单和分类查询套餐可选商品列表并校验响应',
        ),
        async () =>
          await expectApiOk(
            await saleItemApi.listComboSaleItem({
              menuId: menuResource.id,
              menuCategoryId: categoryResource.id,
              categoryId: categoryResource.id,
              pageNo: 1,
              pageSize: 10,
            }),
            COMBO_SALE_ITEM_LIST_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_OPTION_LIST_IDENTITY.method, SALE_ITEM_OPTION_LIST_IDENTITY.path, '应能按商品查询选项列表'),
    async ({ endpointResources, saleItemApi }) => {
      const { menuResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品选项列表查询',
      );
      const body = await test.step(
        toEndpointTitle(
          SALE_ITEM_OPTION_LIST_IDENTITY.method,
          SALE_ITEM_OPTION_LIST_IDENTITY.path,
          '按商品 ID 查询选项列表并校验响应',
        ),
        async () =>
          await expectApiOk(
            await saleItemApi.listItemOptions({
              menuId: menuResource.id,
              menuSaleItemId: saleItemResource.id,
              saleItemId: saleItemResource.id,
            }),
            SALE_ITEM_OPTION_LIST_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_FETCH_IDENTITY.method, SALE_ITEM_FETCH_IDENTITY.path, '应能读取商品业务详情'),
    async ({ endpointResources, saleItemApi }) => {
      const { menuResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品业务详情读取',
      );
      const body = await test.step(
        toEndpointTitle(SALE_ITEM_FETCH_IDENTITY.method, SALE_ITEM_FETCH_IDENTITY.path, '按商品 ID 读取业务详情并校验响应'),
        async () =>
          await expectApiOk(
            await saleItemApi.fetchSaleItem({
              itemId: saleItemResource.id,
              menuId: menuResource.id,
              menuSaleItemId: saleItemResource.id,
              fetchOptions: true,
              includeCategoryAttributesAndOptions: true,
            }),
            SALE_ITEM_FETCH_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_SEARCH_BY_NAME_IDENTITY.method, SALE_ITEM_SEARCH_BY_NAME_IDENTITY.path, '应能按名称搜索商品'),
    async ({ endpointResources, saleItemApi }) => {
      const { menuResource, categoryResource, saleItemResource } = await createSaleItemEndpointScenario(
        endpointResources,
        '商品名称搜索',
      );
      const body = await test.step(
        toEndpointTitle(SALE_ITEM_SEARCH_BY_NAME_IDENTITY.method, SALE_ITEM_SEARCH_BY_NAME_IDENTITY.path, '按商品名称搜索并校验响应'),
        async () =>
          await expectApiOk(
            await saleItemApi.searchSaleItemsByName({
              menuId: menuResource.id,
              menuCategoryId: categoryResource.id,
              categoryId: categoryResource.id,
              name: saleItemResource.name,
              keyword: saleItemResource.name,
              pageNo: 1,
              pageSize: 10,
            }),
            SALE_ITEM_SEARCH_BY_NAME_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
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
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '缺少必填字段应返回异常'),
    async ({ saleItemApi }) => {
      await test.step(
        toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, '提交空商品配置并校验拒绝响应'),
        async () => {
          await expectApiRejected(await saleItemApi.createSaleItem({}), SALE_ITEM_CREATE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(SALE_ITEM_UPDATE_IDENTITY.method, SALE_ITEM_UPDATE_IDENTITY.path, '缺少商品 ID 应返回异常'),
    async ({ saleItemApi }) => {
      await test.step(
        toEndpointTitle(SALE_ITEM_UPDATE_IDENTITY.method, SALE_ITEM_UPDATE_IDENTITY.path, '提交缺少 ID 的商品更新并校验拒绝响应'),
        async () => {
          await expectApiRejected(
            await saleItemApi.updateSaleItem(buildSaleItemRequest(2147483647, 'INVALID')),
            SALE_ITEM_UPDATE_IDENTITY,
          );
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
    toEndpointTitle(SALE_ITEM_DETAIL_IDENTITY.method, SALE_ITEM_DETAIL_IDENTITY.path, '读取不存在商品应返回异常'),
    async ({ saleItemApi }) => {
      await test.step(
        toEndpointTitle(SALE_ITEM_DETAIL_IDENTITY.method, SALE_ITEM_DETAIL_IDENTITY.path, '读取不存在商品 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(await saleItemApi.getSaleItem(2147483647), SALE_ITEM_DETAIL_IDENTITY);
        },
      );
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

  test(
    toEndpointTitle(SALE_ITEM_SEARCH_IDENTITY.method, SALE_ITEM_SEARCH_IDENTITY.path, '空关键字分页边界应返回稳定响应'),
    async ({ saleItemApi }) => {
      const body = await test.step(
        toEndpointTitle(SALE_ITEM_SEARCH_IDENTITY.method, SALE_ITEM_SEARCH_IDENTITY.path, '使用空关键字和 pageSize=1 搜索商品并校验响应'),
        async () =>
          await expectApiOk(
            await saleItemApi.searchSaleItems({ keyword: '', page: 1, pageSize: 1 }),
            SALE_ITEM_SEARCH_IDENTITY,
          ),
      );

      expect(body.data).not.toBeUndefined();
    },
  );
});

async function createSaleItemEndpointScenario(
  endpointResources: EndpointResources,
  purpose: string,
) {
  const menuResource = await test.step(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, `先创建菜单用于${purpose}`),
    async () => await endpointResources.createMenuResource(),
  );
  const menuGroupResource = await test.step(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, `先创建菜单组用于${purpose}`),
    async () => await endpointResources.createMenuGroupResource(menuResource.id),
  );
  const categoryResource = await test.step(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, `先创建分类用于${purpose}`),
    async () => await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id),
  );
  const saleItemResource = await test.step(
    toEndpointTitle(SALE_ITEM_CREATE_IDENTITY.method, SALE_ITEM_CREATE_IDENTITY.path, `先创建商品用于${purpose}`),
    async () =>
      await endpointResources.createSaleItemResource(
        menuResource.id,
        menuGroupResource.id,
        categoryResource.id,
      ),
  );

  return {
    menuResource,
    menuGroupResource,
    categoryResource,
    saleItemResource,
  };
}

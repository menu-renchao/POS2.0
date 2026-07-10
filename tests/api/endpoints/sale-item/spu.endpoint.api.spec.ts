import type { ApiRequestData } from '../../../../api/clients/client-path';
import type { SpuApiClient } from '../../../../api/clients/spu-api.client';
import { createShortTestName } from '../../../../api/core/test-data-id';
import type { ResourceId } from '../../../../api/core/resource-registry';
import { expect, test } from '../../support/endpoint-fixture';
import type { EndpointResource, EndpointResources } from '../../support/endpoint-resources';
import { expectApiOk, expectApiRejected } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';
import { registerMenuHardDeleteAfterAll } from '../../support/menu-hard-delete-cleanup';
import { parseSpuCodeFromAssignResponse } from '../../support/spu-code';

const SPU_ASSIGN_IDENTITY = { method: 'POST', path: '/api/spu/menuSaleItem/assign' } as const;
const SPU_LINK_IDENTITY = { method: 'POST', path: '/api/spu/menuSaleItem/link' } as const;
const SPU_LIST_IDENTITY = {
  method: 'GET',
  path: '/api/spu/menuSaleItem/list/{code}',
} as const;
const SPU_STOCK_OPERATION_IDENTITY = {
  method: 'POST',
  path: '/api/spu/stockOperation',
} as const;

type ResourceIdPair = {
  menuResource: EndpointResource;
  menuGroupResource: EndpointResource;
  categoryResource: EndpointResource;
  saleItemResource: EndpointResource;
};

registerMenuHardDeleteAfterAll(test);

test.describe('SPU 商品 endpoint', () => {
  test(
    toEndpointTitle(SPU_ASSIGN_IDENTITY.method, SPU_ASSIGN_IDENTITY.path, '应能分配商品 SPU'),
    async ({ endpointResources, spuApi }) => {
      const resource = await test.step(
        toEndpointTitle(SPU_ASSIGN_IDENTITY.method, SPU_ASSIGN_IDENTITY.path, '先创建可分配商品'),
        async () => await createSaleItemEndpointResource(endpointResources),
      );

      const assignedCode = await test.step(
        toEndpointTitle(SPU_ASSIGN_IDENTITY.method, SPU_ASSIGN_IDENTITY.path, '分配 SPU 并校验响应'),
        async () =>
          assignSaleItem({
            spuApi,
            saleItemId: resource.saleItemResource.id,
          }),
      );

      expect(assignedCode).toBeTruthy();
    },
  );

  test(
    toEndpointTitle(SPU_ASSIGN_IDENTITY.method, SPU_ASSIGN_IDENTITY.path, '缺少商品 ID 应返回异常'),
    async ({ spuApi }) => {
      await test.step(
        toEndpointTitle(SPU_ASSIGN_IDENTITY.method, SPU_ASSIGN_IDENTITY.path, '提交空 SPU 分配请求并校验拒绝响应'),
        async () => {
          await expectApiRejected(await spuApi.assignSaleItem({}), SPU_ASSIGN_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(SPU_LINK_IDENTITY.method, SPU_LINK_IDENTITY.path, '应能链接商品 SPU'),
    async ({ endpointResources, spuApi }) => {
      const resource = await test.step(
        toEndpointTitle(SPU_LINK_IDENTITY.method, SPU_LINK_IDENTITY.path, '先创建可链接商品'),
        async () => await createSaleItemEndpointResource(endpointResources),
      );
      const spuCode = buildSpuCode();
      await test.step(
        toEndpointTitle(SPU_LINK_IDENTITY.method, SPU_LINK_IDENTITY.path, '链接 SPU 并校验响应'),
        async () => {
          await expectApiOk(
            await spuApi.linkSaleItem(buildSpuLinkRequest(spuCode, resource.saleItemResource.id)),
            SPU_LINK_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(SPU_LIST_IDENTITY.method, SPU_LIST_IDENTITY.path, '应能按 SPU code 查询商品'),
    async ({ endpointResources, spuApi }) => {
      const resource = await test.step(
        toEndpointTitle(SPU_LIST_IDENTITY.method, SPU_LIST_IDENTITY.path, '先创建可查询 SPU 商品'),
        async () => await createSaleItemEndpointResource(endpointResources),
      );
      const spuCode = buildSpuCode();
      await test.step(
        toEndpointTitle(SPU_LINK_IDENTITY.method, SPU_LINK_IDENTITY.path, '先链接 SPU'),
        async () => {
          await expectApiOk(
            await spuApi.linkSaleItem(buildSpuLinkRequest(spuCode, resource.saleItemResource.id)),
            SPU_LINK_IDENTITY,
          );
        },
      );

      await test.step(
        toEndpointTitle(SPU_LIST_IDENTITY.method, SPU_LIST_IDENTITY.path, '按 SPU code 查询商品并校验响应'),
        async () => {
          await expectApiOk(
            await spuApi.listByCode(spuCode, { menuId: resource.menuResource.id }),
            SPU_LIST_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(SPU_STOCK_OPERATION_IDENTITY.method, SPU_STOCK_OPERATION_IDENTITY.path, '应能记录单个库存操作'),
    async ({ endpointResources, spuApi }) => {
      const resource = await test.step(
        toEndpointTitle(
          SPU_STOCK_OPERATION_IDENTITY.method,
          SPU_STOCK_OPERATION_IDENTITY.path,
          '先创建可操作 SPU 商品',
        ),
        async () => await createSaleItemEndpointResource(endpointResources),
      );
      const assignedCode = await test.step(
        toEndpointTitle(SPU_ASSIGN_IDENTITY.method, SPU_ASSIGN_IDENTITY.path, '先分配 SPU 码'),
        async () =>
          assignSaleItem({
            spuApi,
            saleItemId: resource.saleItemResource.id,
          }),
      );

      await test.step(
        toEndpointTitle(
          SPU_STOCK_OPERATION_IDENTITY.method,
          SPU_STOCK_OPERATION_IDENTITY.path,
          '提交库存操作并校验响应',
        ),
        async () => {
          const stockRequest = buildSpuStockOperationRequest({
            spuCode: assignedCode,
            menuId: resource.menuResource.id,
          });
          await expectApiOk(await spuApi.stockOperation(stockRequest), SPU_STOCK_OPERATION_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(SPU_STOCK_OPERATION_IDENTITY.method, SPU_STOCK_OPERATION_IDENTITY.path, '缺少 SPU code 应返回异常'),
    async ({ spuApi }) => {
      await test.step(
        toEndpointTitle(SPU_STOCK_OPERATION_IDENTITY.method, SPU_STOCK_OPERATION_IDENTITY.path, '提交空库存操作并校验拒绝响应'),
        async () => {
          await expectApiRejected(await spuApi.stockOperation({}), SPU_STOCK_OPERATION_IDENTITY);
        },
      );
    },
  );
});

function buildSpuCode(): string {
  return createShortTestName({
    prefix: 'AT',
    domain: 'SPU',
    maxLength: 20,
  });
}

async function createSaleItemEndpointResource(
  endpointResources: EndpointResources,
): Promise<ResourceIdPair> {
  const menuResource = await endpointResources.createMenuResource();
  const menuGroupResource = await endpointResources.createMenuGroupResource(menuResource.id);
  const categoryResource = await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id);
  const saleItemResource = await endpointResources.createSaleItemResource(
    menuResource.id,
    menuGroupResource.id,
    categoryResource.id,
  );

  return {
    menuResource,
    menuGroupResource,
    categoryResource,
    saleItemResource,
  };
}

async function assignSaleItem(options: {
  spuApi: SpuApiClient;
  saleItemId: ResourceId;
}): Promise<string> {
  const body = await expectApiOk(
    await options.spuApi.assignSaleItem({
      itemIds: [options.saleItemId],
      upsert: true,
    }),
    SPU_ASSIGN_IDENTITY,
  );

  return parseSpuCodeFromAssignResponse(body);
}

function buildSpuLinkRequest(spuCode: string, saleItemId: ResourceId): ApiRequestData {
  return {
    itemIds: [saleItemId],
    spuCode,
  };
}

function buildSpuStockOperationRequest(options: {
  spuCode: string;
  menuId: ResourceId;
}): ApiRequestData {
  return {
    spuCode: options.spuCode,
    stockNum: 1,
    checked: true,
    stockOperationType: 2,
    applyToMenuDetails: [
      {
        menuId: options.menuId,
        stockOperationType: 2,
        followSpu: true,
      },
    ],
  };
}

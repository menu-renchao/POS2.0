import { type APIResponse, expect, test as unitTest } from '@playwright/test';
import type { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import { ResourceRegistry } from '../../../api/core/resource-registry';
import { createEndpointResources } from '../support/endpoint-resources';
import { test as endpointFixtureTest } from '../support/endpoint-fixture';

type AdminConfigApiClientLike = Pick<
  import('../../../api/clients/admin-config-api.client').AdminConfigApiClient,
  | 'listRoles'
  | 'saveRole'
  | 'deleteRole'
  | 'listTaxes'
  | 'saveTax'
  | 'deleteTax'
  | 'listDiscounts'
  | 'saveDiscount'
  | 'deleteDiscount'
>;

type AdminConfigApiMock = {
  api: AdminConfigApiClientLike;
  calls: {
    saveTax: number;
    listTaxes: number;
    deleteTax: number;
    saveDiscount: number;
    listDiscounts: number;
    deleteDiscount: number;
    saveRole: number;
    listRoles: number;
    deleteRole: number;
  };
  payload: {
    tax?: unknown;
    discount?: unknown;
    role?: unknown;
  };
};

const endpointTest = endpointFixtureTest.extend({
  adminConfigApi: async ({}, use) => {
    const mock = createAdminConfigApi();

    await use(mock.api as unknown as AdminConfigApiClient);
  },
  resourceRegistry: async ({}, use) => {
    await use(new ResourceRegistry());
  },
});

endpointTest.describe('Endpoint fixture 注入', () => {
  endpointTest(
    '应在测试参数中注入 endpointResources 且包含三类资源创建方法',
    async ({ endpointResources }) => {
      expect(endpointResources).toEqual(
        expect.objectContaining({
          createTaxResource: expect.any(Function),
          createDiscountResource: expect.any(Function),
          createRoleResource: expect.any(Function),
        }),
      );
    },
  );
});

unitTest.describe('Endpoint 资源创建', () => {
  unitTest('createTaxResource 应调用保存接口并在返回 id 时登记清理', async () => {
    const resourceRegistry = new ResourceRegistry();
    const mock = createAdminConfigApi({
      saveTax: async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 1001 } }),
    });

    const endpointResources = createEndpointResources({
      adminConfigApi: mock.api as AdminConfigApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createTaxResource();

    expect(mock.calls.saveTax).toBe(1);
    expect(mock.payload.tax, '保存税费请求应包含真实可通行样例字段').toEqual(
      expect.objectContaining({
        tax: {
          name: resource.name,
          rate: 1,
          outRate: 1,
          taxIncrease: 'DEFAULT',
        },
      }),
    );
    expect(resource.id).toBe(1001);
    expect(resourceRegistry.has('tax', 1001)).toBe(true);
  });

  unitTest('createTaxResource 在保存响应缺失 id 时应改从列表按名称定位 id', async () => {
    const resourceRegistry = new ResourceRegistry();
    let nameFilter: string | undefined;

    const mock = createAdminConfigApi({
      saveTax: async (payload) => {
        nameFilter = (payload as { tax?: { name?: string } }).tax?.name;

        return createApiResponse({
          code: 0,
          msg: 'ok',
          data: { code: 0 },
        });
      },
      listTaxes: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
          data: [{ taxName: nameFilter, taxId: 2002 }],
        }),
    });

    const endpointResources = createEndpointResources({
      adminConfigApi: mock.api as AdminConfigApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createTaxResource();

    expect(mock.calls.saveTax).toBe(1);
    expect(mock.calls.listTaxes).toBe(1);
    expect(resource.id).toBe(2002);
    expect(resourceRegistry.has('tax', 2002)).toBe(true);
  });

  unitTest('createDiscountResource 应调用保存接口并在返回 id 时登记清理', async () => {
    const resourceRegistry = new ResourceRegistry();
    const mock = createAdminConfigApi({
      saveDiscount: async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 3003 } }),
    });

    const endpointResources = createEndpointResources({
      adminConfigApi: mock.api as AdminConfigApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createDiscountResource();

    expect(mock.calls.saveDiscount).toBe(1);
    expect(mock.payload.discount, '保存折扣请求应为扁平结构').toEqual(
      expect.objectContaining({
        name: resource.name,
        rate: 10,
        rateType: 2,
        description: resource.name,
      }),
    );
    expect(resource.id).toBe(3003);
    expect(resourceRegistry.has('discount', 3003)).toBe(true);
  });

  unitTest('createRoleResource 应调用保存接口并在返回 id 时登记清理', async () => {
    const resourceRegistry = new ResourceRegistry();
    const mock = createAdminConfigApi({
      saveRole: async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 4004 } }),
    });

    const endpointResources = createEndpointResources({
      adminConfigApi: mock.api as AdminConfigApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createRoleResource();

    expect(mock.calls.saveRole).toBe(1);
    expect(mock.payload.role, '保存角色请求应包含真实可通行样例字段').toEqual(
      expect.objectContaining({
        role: {
          name: resource.name,
          discountCapRate: 0,
          function: [],
        },
      }),
    );
    expect(resource.id).toBe(4004);
    expect(resourceRegistry.has('role', 4004)).toBe(true);
  });

  unitTest('创建和解析失败时不应登记清理任务', async () => {
    const resourceRegistry = new ResourceRegistry();
    const mock = createAdminConfigApi({
      saveTax: async () => createApiResponse('not an envelope'),
      listTaxes: async () => createApiResponse({ code: 0, msg: 'ok', data: { total: 1 } }),
    });

    const endpointResources = createEndpointResources({
      adminConfigApi: mock.api as AdminConfigApiClient,
      resourceRegistry,
    });

    await expect(endpointResources.createTaxResource()).rejects.toThrow();

    const cleanupResult = await resourceRegistry.cleanupAll();

    expect(mock.calls.saveTax).toBe(1);
    expect(cleanupResult.cleaned).toHaveLength(0);
    expect(cleanupResult.errors).toHaveLength(0);
  });
});

function createApiResponse<T>(body: T, status = 200): APIResponse {
  return {
    status: () => status,
    json: async () => body,
  } as unknown as APIResponse;
}

function createAdminConfigApi(
  overrides: Partial<AdminConfigApiClientLike> = {},
): AdminConfigApiMock {
  const mock: AdminConfigApiMock = {
    api: {} as AdminConfigApiClientLike,
    calls: {
      saveTax: 0,
      listTaxes: 0,
      deleteTax: 0,
      saveDiscount: 0,
      listDiscounts: 0,
      deleteDiscount: 0,
      saveRole: 0,
      listRoles: 0,
      deleteRole: 0,
    },
    payload: {},
  };

  mock.api = {
    listRoles: async (...args: unknown[]) => {
      mock.calls.listRoles += 1;
      const impl = (overrides.listRoles ??
        (async () => createApiResponse({ code: 0, msg: 'ok', data: { records: [] } }))) as AdminConfigApiClientLike['listRoles'];
      return impl(args[0] as any);
    },
    saveRole: async (payload: unknown) => {
      mock.calls.saveRole += 1;
      mock.payload.role = payload;
      const impl = (overrides.saveRole ??
        (async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 1 } }))) as AdminConfigApiClientLike['saveRole'];
      return impl(payload as any);
    },
    deleteRole: async () => {
      mock.calls.deleteRole += 1;
      const impl = (overrides.deleteRole ??
        (async () => createApiResponse({ code: 0, msg: 'ok' }))) as AdminConfigApiClientLike['deleteRole'];
      return impl({ id: 0 } as any);
    },
    listTaxes: async (...args: unknown[]) => {
      mock.calls.listTaxes += 1;
      const impl = (overrides.listTaxes ??
        (async () => createApiResponse({ code: 0, msg: 'ok', data: { records: [] } }))) as AdminConfigApiClientLike['listTaxes'];
      return impl(args[0] as any);
    },
    saveTax: async (payload: unknown) => {
      mock.calls.saveTax += 1;
      mock.payload.tax = payload;
      const impl = (overrides.saveTax ??
        (async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 1 } }))) as AdminConfigApiClientLike['saveTax'];
      return impl(payload as any);
    },
    deleteTax: async () => {
      mock.calls.deleteTax += 1;
      const impl = (overrides.deleteTax ??
        (async () => createApiResponse({ code: 0, msg: 'ok' }))) as AdminConfigApiClientLike['deleteTax'];
      return impl({ id: 0 } as any);
    },
    listDiscounts: async (...args: unknown[]) => {
      mock.calls.listDiscounts += 1;
      const impl = (overrides.listDiscounts ??
        (async () => createApiResponse({ code: 0, msg: 'ok', data: { records: [] } }))) as AdminConfigApiClientLike['listDiscounts'];
      return impl(args[0] as any);
    },
    saveDiscount: async (payload: unknown) => {
      mock.calls.saveDiscount += 1;
      mock.payload.discount = payload;
      const impl = (overrides.saveDiscount ??
        (async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 1 } }))) as AdminConfigApiClientLike['saveDiscount'];
      return impl(payload as any);
    },
    deleteDiscount: async () => {
      mock.calls.deleteDiscount += 1;
      const impl = (overrides.deleteDiscount ??
        (async () => createApiResponse({ code: 0, msg: 'ok' }))) as AdminConfigApiClientLike['deleteDiscount'];
      return impl({ id: 0 } as any);
    },
  } as AdminConfigApiClientLike;

  return mock;
}

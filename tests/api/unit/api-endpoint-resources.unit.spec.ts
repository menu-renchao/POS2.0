import { type APIResponse, expect, test as unitTest } from '@playwright/test';
import type { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import type { MenuApiClient } from '../../../api/clients/menu-api.client';
import type { OrderApiClient } from '../../../api/clients/order-api.client';
import type { PaymentApiClient } from '../../../api/clients/payment-api.client';
import type { SaleItemApiClient } from '../../../api/clients/sale-item-api.client';
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

type MenuApiClientLike = Pick<
  import('../../../api/clients/menu-api.client').MenuApiClient,
  | 'createMenu'
  | 'listMenus'
  | 'updateMenu'
  | 'createMenuGroup'
  | 'listMenuGroups'
  | 'deleteMenuGroup'
  | 'createMenuCategory'
  | 'listCategories'
  | 'deleteMenuCategory'
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

type MenuApiMock = {
  api: MenuApiClientLike;
  calls: {
    createMenu: number;
    listMenus: number;
    updateMenu: number;
    createMenuGroup: number;
    listMenuGroups: number;
    deleteMenuGroup: number;
    createMenuCategory: number;
    listCategories: number;
    deleteMenuCategory: number;
  };
  payload: {
    menu?: unknown;
    menuGroup?: unknown;
    menuCategory?: unknown;
  };
};

type SaleItemApiClientLike = Pick<
  import('../../../api/clients/sale-item-api.client').SaleItemApiClient,
  | 'createSaleItem'
  | 'searchSaleItems'
  | 'deleteSaleItem'
>;

type SaleItemApiMock = {
  api: SaleItemApiClientLike;
  calls: {
    createSaleItem: number;
    searchSaleItems: number;
    deleteSaleItem: number;
  };
  payload: {
    saleItem?: unknown;
    searchParams?: unknown;
  };
};

type OrderApiClientLike = Pick<
  import('../../../api/clients/order-api.client').OrderApiClient,
  | 'saveOrder'
  | 'listOrders'
  | 'voidOrder'
>;

type OrderApiMock = {
  api: OrderApiClientLike;
  calls: {
    saveOrder: number;
    listOrders: number;
    voidOrder: number;
  };
  payload: {
    order?: unknown;
    listParams?: unknown;
    voidOrder?: unknown;
  };
};

type PaymentApiClientLike = Pick<
  import('../../../api/clients/payment-api.client').PaymentApiClient,
  | 'saveRecord'
  | 'deleteRecord'
>;

type PaymentApiMock = {
  api: PaymentApiClientLike;
  calls: {
    saveRecord: number;
    deleteRecord: number;
  };
  payload: {
    payment?: unknown;
    deletePayment?: unknown;
  };
};

const endpointTest = endpointFixtureTest.extend({
  adminConfigApi: async ({}, use) => {
    const mock = createAdminConfigApi();

    await use(mock.api as unknown as AdminConfigApiClient);
  },
  menuApi: async ({}, use) => {
    const mock = createMenuApi();

    await use(mock.api as unknown as MenuApiClient);
  },
  resourceRegistry: async ({}, use) => {
    await use(new ResourceRegistry());
  },
});

endpointTest.describe('Endpoint fixture 注入', () => {
  endpointTest(
    '应在测试参数中注入 endpointResources 且包含菜单与配置类资源创建方法',
    async ({ endpointResources }) => {
      expect(endpointResources).toEqual(
        expect.objectContaining({
          createTaxResource: expect.any(Function),
          createDiscountResource: expect.any(Function),
          createRoleResource: expect.any(Function),
          createMenuResource: expect.any(Function),
          createMenuGroupResource: expect.any(Function),
          createCategoryResource: expect.any(Function),
          createSaleItemResource: expect.any(Function),
          createOrderResource: expect.any(Function),
          createPaymentRecordResource: expect.any(Function),
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

  unitTest('createMenuResource 应调用菜单 API 创建并登记清理（归档）', async () => {
    const resourceRegistry = new ResourceRegistry();
    const menuMock = createMenuApi({
      createMenu: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
          data: { id: 5005 },
        }),
    });
    const configMock = createAdminConfigApi();

    const endpointResources = createEndpointResources({
      adminConfigApi: configMock.api as AdminConfigApiClient,
      menuApi: menuMock.api as unknown as MenuApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createMenuResource();

    expect(menuMock.calls.createMenu).toBe(1);
    expect(menuMock.calls.updateMenu).toBe(0);
    expect(menuMock.payload.menu).toEqual(expect.objectContaining({ name: resource.name }));
    expect(resource.id).toBe(5005);
    expect(resourceRegistry.has('menu', 5005)).toBe(true);
  });

  unitTest('createMenuResource 在保存响应缺失 id 时应改从列表按名称定位 id', async () => {
    const resourceRegistry = new ResourceRegistry();
    let createMenuName: string | undefined;

    const menuMock = createMenuApi({
      createMenu: async (payload) => {
        createMenuName = (payload as { name?: string }).name;

        return createApiResponse({ code: 0, msg: 'ok', data: { code: 0 } });
      },
      listMenus: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
          data: [{ menuId: 5006, menuName: createMenuName }],
        }),
    });
    const configMock = createAdminConfigApi();

    const endpointResources = createEndpointResources({
      adminConfigApi: configMock.api as AdminConfigApiClient,
      menuApi: menuMock.api as unknown as MenuApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createMenuResource();

    expect(menuMock.calls.createMenu).toBe(1);
    expect(menuMock.calls.listMenus).toBe(1);
    expect(resource.name).toBe(createMenuName);
    expect(resource.id).toBe(5006);
    expect(resourceRegistry.has('menu', 5006)).toBe(true);
  });

  unitTest('createMenuGroupResource 应调用菜单 API 创建菜单组并登记清理', async () => {
    const resourceRegistry = new ResourceRegistry();
    const menuMock = createMenuApi({
      createMenuGroup: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
          data: { id: 6006 },
        }),
    });
    const configMock = createAdminConfigApi();

    const endpointResources = createEndpointResources({
      adminConfigApi: configMock.api as AdminConfigApiClient,
      menuApi: menuMock.api as unknown as MenuApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createMenuGroupResource('menu-1');

    expect(menuMock.calls.createMenuGroup).toBe(1);
    expect(menuMock.payload.menuGroup, '菜单组入参应携带 menuId 和 name').toEqual(
      expect.objectContaining({ menuId: 'menu-1', name: resource.name }),
    );
    expect(resource.id).toBe(6006);
    expect(resourceRegistry.has('menuGroup', 6006)).toBe(true);
  });

  unitTest('createCategoryResource 应调用菜单 API 创建分类并登记清理', async () => {
    const resourceRegistry = new ResourceRegistry();
    const menuMock = createMenuApi({
      createMenuCategory: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
          data: { id: 7007 },
        }),
    });
    const configMock = createAdminConfigApi();

    const endpointResources = createEndpointResources({
      adminConfigApi: configMock.api as AdminConfigApiClient,
      menuApi: menuMock.api as unknown as MenuApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createCategoryResource('menu-1', 'group-1');

    expect(menuMock.calls.createMenuCategory).toBe(1);
    expect(menuMock.payload.menuCategory, '分类入参应携带 menuId 与 menuGroupId').toEqual(
      expect.objectContaining({ menuId: 'menu-1', menuGroupId: 'group-1', name: resource.name }),
    );
    expect(resource.id).toBe(7007);
    expect(resourceRegistry.has('menuCategory', 7007)).toBe(true);
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

  unitTest('createSaleItemResource 应调用销售商品接口并在返回 id 时登记清理', async () => {
    const resourceRegistry = new ResourceRegistry();
    const saleItemMock = createSaleItemApi({
      createSaleItem: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
          data: { id: 8008 },
        }),
    });
    const configMock = createAdminConfigApi();
    const menuMock = createMenuApi({
      listMenus: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
      data: [{ menuId: 1, menuName: 'AT' }],
    }),
    });

    const endpointResources = createEndpointResources({
      adminConfigApi: configMock.api as AdminConfigApiClient,
      menuApi: menuMock.api as unknown as MenuApiClient,
      saleItemApi: saleItemMock.api as unknown as SaleItemApiClient,
      resourceRegistry,
    });

    const menuResource = await endpointResources.createMenuResource();
    const menuGroupResource = await endpointResources.createMenuGroupResource(menuResource.id);
    const categoryResource = await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id);
    const resource = await endpointResources.createSaleItemResource(
      menuResource.id,
      menuGroupResource.id,
      categoryResource.id,
    );

    expect(saleItemMock.calls.createSaleItem).toBe(1);
    expect(saleItemMock.payload.saleItem).toEqual(
      expect.objectContaining({
        menuId: menuResource.id,
        menuGroupId: menuGroupResource.id,
        categoryId: categoryResource.id,
        menuCategoryId: categoryResource.id,
        posName: expect.any(String),
      }),
    );
    expect(resource.id).toBe(8008);
    expect(resourceRegistry.has('saleItem', 8008)).toBe(true);
  });

  unitTest('createSaleItemResource 在创建响应缺失 id 时应通过搜索按名称定位 id', async () => {
    const resourceRegistry = new ResourceRegistry();
    const categoryId = 9009;
    let createMenuName: string | undefined;
    const saleItemMock = createSaleItemApi({
      createSaleItem: async (payload) => {
        createMenuName = (payload as { name?: string }).name;

        return createApiResponse({
          code: 0,
          msg: 'ok',
          data: { code: 0 },
        });
      },
      searchSaleItems: async (params) => {
        const queryName = (params as { keyword?: string; name?: string })?.keyword;

        if (queryName === createMenuName) {
          return createApiResponse({
            code: 0,
            msg: 'ok',
            data: [{ id: categoryId, name: createMenuName }],
          });
        }

        return createApiResponse({
          code: 0,
          msg: 'ok',
          data: [{ id: 9010, name: 'OTHER' }],
        });
      },
    });
    const configMock = createAdminConfigApi();
    const menuMock = createMenuApi({
      listMenus: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
          data: [{ menuId: 11, menuName: 'AT' }],
        }),
      createMenuGroup: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
          data: { id: 12 },
        }),
      createMenuCategory: async () =>
        createApiResponse({
          code: 0,
          msg: 'ok',
          data: { id: categoryId },
        }),
    });

    const endpointResources = createEndpointResources({
      adminConfigApi: configMock.api as AdminConfigApiClient,
      menuApi: menuMock.api as unknown as MenuApiClient,
      saleItemApi: saleItemMock.api as unknown as SaleItemApiClient,
      resourceRegistry,
    });

    const menuResource = await endpointResources.createMenuResource();
    const menuGroupResource = await endpointResources.createMenuGroupResource(menuResource.id);
    const categoryResource = await endpointResources.createCategoryResource(menuResource.id, menuGroupResource.id);
    const resource = await endpointResources.createSaleItemResource(
      menuResource.id,
      menuGroupResource.id,
      categoryResource.id,
    );

    expect(saleItemMock.calls.createSaleItem).toBe(1);
    expect(saleItemMock.calls.searchSaleItems).toBe(1);
    expect(saleItemMock.payload.searchParams).toEqual(
      expect.objectContaining({
        menuId: menuResource.id,
        menuCategoryId: categoryResource.id,
      }),
    );
    expect(resource.id).toBe(categoryId);
    expect(resourceRegistry.has('saleItem', categoryId)).toBe(true);
  });

  unitTest('createOrderResource 应创建商品依赖并保存订单后登记作废清理', async () => {
    const resourceRegistry = new ResourceRegistry();
    const configMock = createAdminConfigApi();
    const menuMock = createMenuApi();
    const saleItemMock = createSaleItemApi({
      createSaleItem: async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 8801 } }),
    });
    const orderMock = createOrderApi({
      saveOrder: async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 8802 } }),
    });

    const endpointResources = createEndpointResources({
      adminConfigApi: configMock.api as AdminConfigApiClient,
      menuApi: menuMock.api as unknown as MenuApiClient,
      saleItemApi: saleItemMock.api as unknown as SaleItemApiClient,
      orderApi: orderMock.api as unknown as OrderApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createOrderResource();

    expect(menuMock.calls.createMenu).toBe(1);
    expect(saleItemMock.calls.createSaleItem).toBe(1);
    expect(orderMock.calls.saveOrder).toBe(1);
    expect(orderMock.payload.order).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({
          customerName: expect.any(String),
          orderItems: [
            expect.objectContaining({
              saleItemId: 8801,
            }),
          ],
        }),
      }),
    );
    expect(resource.id).toBe(8802);
    expect(resourceRegistry.has('order', 8802)).toBe(true);

    await resourceRegistry.cleanupAll();

    expect(orderMock.calls.voidOrder).toBe(1);
    expect(orderMock.payload.voidOrder).toEqual(
      expect.objectContaining({
        id: 8802,
        orderId: 8802,
      }),
    );
  });

  unitTest('createPaymentRecordResource 应保存支付记录并登记删除清理', async () => {
    const resourceRegistry = new ResourceRegistry();
    const configMock = createAdminConfigApi();
    const paymentMock = createPaymentApi({
      saveRecord: async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 9901 } }),
    });

    const endpointResources = createEndpointResources({
      adminConfigApi: configMock.api as AdminConfigApiClient,
      paymentApi: paymentMock.api as unknown as PaymentApiClient,
      resourceRegistry,
    });

    const resource = await endpointResources.createPaymentRecordResource(8802);

    expect(paymentMock.calls.saveRecord).toBe(1);
    expect(paymentMock.payload.payment).toEqual(
      expect.objectContaining({
        orderId: 8802,
        paymentRecord: expect.objectContaining({
          orderId: 8802,
          amount: 10,
        }),
      }),
    );
    expect(resource.id).toBe(9901);
    expect(resourceRegistry.has('payment', 9901)).toBe(true);

    await resourceRegistry.cleanupAll();

    expect(paymentMock.calls.deleteRecord).toBe(1);
    expect(paymentMock.payload.deletePayment).toEqual(
      expect.objectContaining({
        id: 9901,
        paymentRecordId: 9901,
        orderId: 8802,
      }),
    );
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

function createMenuApi(overrides: Partial<MenuApiClientLike> = {}): MenuApiMock {
  const mock: MenuApiMock = {
    api: {} as MenuApiClientLike,
    calls: {
      createMenu: 0,
      listMenus: 0,
      updateMenu: 0,
      createMenuGroup: 0,
      listMenuGroups: 0,
      deleteMenuGroup: 0,
      createMenuCategory: 0,
      listCategories: 0,
      deleteMenuCategory: 0,
    },
    payload: {},
  };

  mock.api = {
    createMenu: async (payload: unknown) => {
      mock.calls.createMenu += 1;
      mock.payload.menu = payload;
      const impl = (overrides.createMenu ?? (async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 1 } }))) as MenuApiClientLike['createMenu'];
      return impl(payload as any);
    },
    listMenus: async (...args: unknown[]) => {
      mock.calls.listMenus += 1;
      const impl = (overrides.listMenus ?? (async () => createApiResponse({ code: 0, msg: 'ok', data: { records: [] } }))) as MenuApiClientLike['listMenus'];
      return impl(args[0] as any);
    },
    updateMenu: async (payload: unknown) => {
      mock.calls.updateMenu += 1;
      const impl = (overrides.updateMenu ?? (async () => createApiResponse({ code: 0, msg: 'ok' }))) as MenuApiClientLike['updateMenu'];
      return impl(payload as any);
    },
    createMenuGroup: async (payload: unknown) => {
      mock.calls.createMenuGroup += 1;
      mock.payload.menuGroup = payload;
      const impl = (overrides.createMenuGroup ?? (async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 2 } }))) as MenuApiClientLike['createMenuGroup'];
      return impl(payload as any);
    },
    listMenuGroups: async (...args: unknown[]) => {
      mock.calls.listMenuGroups += 1;
      const impl = (overrides.listMenuGroups ?? (async () => createApiResponse({ code: 0, msg: 'ok', data: { records: [] } }))) as MenuApiClientLike['listMenuGroups'];
      return impl(args[0] as any);
    },
    deleteMenuGroup: async () => {
      mock.calls.deleteMenuGroup += 1;
      const impl = (overrides.deleteMenuGroup ?? (async () => createApiResponse({ code: 0, msg: 'ok' }))) as MenuApiClientLike['deleteMenuGroup'];
      return impl({ menuGroupId: 0 } as any);
    },
    createMenuCategory: async (payload: unknown) => {
      mock.calls.createMenuCategory += 1;
      mock.payload.menuCategory = payload;
      const impl = (overrides.createMenuCategory ?? (async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 3 } }))) as MenuApiClientLike['createMenuCategory'];
      return impl(payload as any);
    },
    listCategories: async (...args: unknown[]) => {
      mock.calls.listCategories += 1;
      const impl = (overrides.listCategories ?? (async () => createApiResponse({ code: 0, msg: 'ok', data: { records: [] } }))) as MenuApiClientLike['listCategories'];
      return impl(args[0] as any);
    },
    deleteMenuCategory: async () => {
      mock.calls.deleteMenuCategory += 1;
      const impl = (overrides.deleteMenuCategory ?? (async () => createApiResponse({ code: 0, msg: 'ok' }))) as MenuApiClientLike['deleteMenuCategory'];
      return impl({ menuCategoryId: 0 } as any);
    },
  } as MenuApiClientLike;

  return mock;
}

function createSaleItemApi(overrides: Partial<SaleItemApiClientLike> = {}): SaleItemApiMock {
  const mock: SaleItemApiMock = {
    api: {} as SaleItemApiClientLike,
    calls: {
      createSaleItem: 0,
      searchSaleItems: 0,
      deleteSaleItem: 0,
    },
    payload: {},
  };

  mock.api = {
    createSaleItem: async (payload: unknown) => {
      mock.calls.createSaleItem += 1;
      mock.payload.saleItem = payload;
      const impl = (overrides.createSaleItem ??
        (async () =>
          createApiResponse({
            code: 0,
            msg: 'ok',
            data: { id: 1 },
          }))) as SaleItemApiClientLike['createSaleItem'];

      return impl(payload as any);
    },
    searchSaleItems: async (params: unknown) => {
      mock.calls.searchSaleItems += 1;
      mock.payload.searchParams = params;
      const impl = (overrides.searchSaleItems ??
        (async () =>
          createApiResponse({
            code: 0,
            msg: 'ok',
            data: [{ id: 2 }],
          }))) as SaleItemApiClientLike['searchSaleItems'];

      return impl(params as any);
    },
    deleteSaleItem: async () => {
      mock.calls.deleteSaleItem += 1;
      const impl = (overrides.deleteSaleItem ??
        (async () =>
          createApiResponse({
            code: 0,
            msg: 'ok',
          }))) as SaleItemApiClientLike['deleteSaleItem'];

      return impl(0 as any);
    },
  };

  return mock;
}

function createOrderApi(overrides: Partial<OrderApiClientLike> = {}): OrderApiMock {
  const mock: OrderApiMock = {
    api: {} as OrderApiClientLike,
    calls: {
      saveOrder: 0,
      listOrders: 0,
      voidOrder: 0,
    },
    payload: {},
  };

  mock.api = {
    saveOrder: async (payload: unknown) => {
      mock.calls.saveOrder += 1;
      mock.payload.order = payload;
      const impl = (overrides.saveOrder ??
        (async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 1 } }))) as OrderApiClientLike['saveOrder'];

      return impl(payload as any);
    },
    listOrders: async (params: unknown) => {
      mock.calls.listOrders += 1;
      mock.payload.listParams = params;
      const impl = (overrides.listOrders ??
        (async () => createApiResponse({ code: 0, msg: 'ok', data: { records: [] } }))) as OrderApiClientLike['listOrders'];

      return impl(params as any);
    },
    voidOrder: async (payload: unknown) => {
      mock.calls.voidOrder += 1;
      mock.payload.voidOrder = payload;
      const impl = (overrides.voidOrder ??
        (async () => createApiResponse({ code: 0, msg: 'ok' }))) as OrderApiClientLike['voidOrder'];

      return impl(payload as any);
    },
  };

  return mock;
}

function createPaymentApi(overrides: Partial<PaymentApiClientLike> = {}): PaymentApiMock {
  const mock: PaymentApiMock = {
    api: {} as PaymentApiClientLike,
    calls: {
      saveRecord: 0,
      deleteRecord: 0,
    },
    payload: {},
  };

  mock.api = {
    saveRecord: async (payload: unknown) => {
      mock.calls.saveRecord += 1;
      mock.payload.payment = payload;
      const impl = (overrides.saveRecord ??
        (async () => createApiResponse({ code: 0, msg: 'ok', data: { id: 1 } }))) as PaymentApiClientLike['saveRecord'];

      return impl(payload as any);
    },
    deleteRecord: async (payload: unknown) => {
      mock.calls.deleteRecord += 1;
      mock.payload.deletePayment = payload;
      const impl = (overrides.deleteRecord ??
        (async () => createApiResponse({ code: 0, msg: 'ok' }))) as PaymentApiClientLike['deleteRecord'];

      return impl(payload as any);
    },
  };

  return mock;
}

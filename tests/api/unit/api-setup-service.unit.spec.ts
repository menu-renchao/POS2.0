import { expect, test } from '@playwright/test';
import { ResourceRegistry } from '../../../api/core/resource-registry';
import { createApiSetup } from '../../../api/setup/api-setup';
import type { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import type { MenuApiClient } from '../../../api/clients/menu-api.client';
import type { SaleItemApiClient } from '../../../api/clients/sale-item-api.client';
import { test as apiFixtureTest } from '../../../fixtures/api.fixture';

test.describe('API 数据预置服务', () => {
  test('应提供 UI 和 API 可复用的配置与菜单 CRUD 入口', () => {
    const apiSetup = createApiSetup({
      adminConfigApi: createAdminConfigApi().api as AdminConfigApiClient,
      menuApi: createMenuApi().api as unknown as MenuApiClient,
      saleItemApi: createSaleItemApi().api as unknown as SaleItemApiClient,
      resourceRegistry: new ResourceRegistry(),
    });

    expect(apiSetup).toEqual(
      expect.objectContaining({
        tax: expect.objectContaining({
          create: expect.any(Function),
          read: expect.any(Function),
          update: expect.any(Function),
          delete: expect.any(Function),
        }),
        discount: expect.objectContaining({
          create: expect.any(Function),
          read: expect.any(Function),
          update: expect.any(Function),
          delete: expect.any(Function),
        }),
        menu: expect.objectContaining({
          create: expect.any(Function),
          read: expect.any(Function),
          update: expect.any(Function),
          delete: expect.any(Function),
        }),
        menuGroup: expect.objectContaining({
          create: expect.any(Function),
          read: expect.any(Function),
          update: expect.any(Function),
          delete: expect.any(Function),
        }),
        category: expect.objectContaining({
          create: expect.any(Function),
          read: expect.any(Function),
          update: expect.any(Function),
          delete: expect.any(Function),
        }),
        saleItem: expect.objectContaining({
          create: expect.any(Function),
          read: expect.any(Function),
          update: expect.any(Function),
          delete: expect.any(Function),
        }),
      }),
    );
  });

  test('税费 create/update/delete 应调用后台配置接口并登记清理', async () => {
    const adminConfig = createAdminConfigApi();
    const resourceRegistry = new ResourceRegistry();
    const apiSetup = createApiSetup({
      adminConfigApi: adminConfig.api as AdminConfigApiClient,
      resourceRegistry,
    });

    const tax = await apiSetup.tax.create({ name: 'AT_TAX_A', rate: 7.25 });
    await apiSetup.tax.update(tax.id, { rate: 8.5 });
    await apiSetup.tax.delete(tax.id);

    expect(tax.id).toBe(1001);
    expect(adminConfig.calls.saveTax).toBe(2);
    expect(adminConfig.payloads.saveTax[0]).toEqual({
      tax: expect.objectContaining({
        name: 'AT_TAX_A',
        rate: 7.25,
        outRate: 7.25,
        taxIncrease: 'DEFAULT',
      }),
    });
    expect(adminConfig.payloads.saveTax[1]).toEqual({
      tax: expect.objectContaining({
        id: 1001,
        taxId: 1001,
        rate: 8.5,
      }),
    });
    expect(adminConfig.payloads.deleteTax[0]).toEqual({ taxId: 1001 });
    expect(resourceRegistry.has('tax', 1001)).toBe(false);
  });

  test('菜单 create/update/delete 应调用菜单接口并按软删除策略清理', async () => {
    const menuApi = createMenuApi();
    const resourceRegistry = new ResourceRegistry();
    const apiSetup = createApiSetup({
      adminConfigApi: createAdminConfigApi().api as AdminConfigApiClient,
      menuApi: menuApi.api as unknown as MenuApiClient,
      resourceRegistry,
    });

    const menu = await apiSetup.menu.create({ name: 'AT_MENU_A' });
    await apiSetup.menu.update(menu.id, { displayName: 'AT_MENU_B' });
    await apiSetup.menu.delete(menu.id);

    expect(menu.id).toBe(2001);
    expect(menuApi.calls.createMenu).toBe(1);
    expect(menuApi.calls.updateMenu).toBe(2);
    expect(menuApi.payloads.updateMenu[0]).toEqual(
      expect.objectContaining({
        id: 2001,
        displayName: 'AT_MENU_B',
      }),
    );
    expect(menuApi.payloads.updateMenu[1]).toEqual(
      expect.objectContaining({
        id: 2001,
        enabled: false,
        active: false,
        deleted: true,
      }),
    );
    expect(resourceRegistry.has('menu', 2001)).toBe(false);
  });

  test('商品 create/update/delete 应支持传入菜单链路 ID', async () => {
    const saleItemApi = createSaleItemApi();
    const resourceRegistry = new ResourceRegistry();
    const apiSetup = createApiSetup({
      adminConfigApi: createAdminConfigApi().api as AdminConfigApiClient,
      saleItemApi: saleItemApi.api as unknown as SaleItemApiClient,
      resourceRegistry,
    });

    const saleItem = await apiSetup.saleItem.create({
      menuId: 2001,
      menuGroupId: 3001,
      categoryId: 4001,
      name: 'AT_ITEM_A',
      price: 12.5,
    });
    await apiSetup.saleItem.update(saleItem.id, { price: 13.5 });
    await apiSetup.saleItem.delete(saleItem.id);

    expect(saleItem.id).toBe(5001);
    expect(saleItemApi.payloads.createSaleItem[0]).toEqual(
      expect.objectContaining({
        menuId: 2001,
        menuGroupId: 3001,
        categoryId: 4001,
        menuCategoryId: 4001,
        name: 'AT_ITEM_A',
        price: 12.5,
      }),
    );
    expect(saleItemApi.payloads.updateSaleItem[0]).toEqual(
      expect.objectContaining({
        id: 5001,
        price: 13.5,
      }),
    );
    expect(saleItemApi.payloads.deleteSaleItem[0]).toBe(5001);
    expect(resourceRegistry.has('saleItem', 5001)).toBe(false);
  });
});

apiFixtureTest.describe('API 数据预置 fixture', () => {
  apiFixtureTest('应向 API 测试注入 apiSetup', async ({ apiSetup }) => {
    expect(apiSetup.tax.create).toEqual(expect.any(Function));
    expect(apiSetup.menu.create).toEqual(expect.any(Function));
    expect(apiSetup.saleItem.create).toEqual(expect.any(Function));
  });
});

function createAdminConfigApi() {
  const calls = {
    saveTax: 0,
    listTaxes: 0,
    deleteTax: 0,
    saveDiscount: 0,
    listDiscounts: 0,
    deleteDiscount: 0,
  };
  const payloads = {
    saveTax: [] as unknown[],
    deleteTax: [] as unknown[],
    saveDiscount: [] as unknown[],
    deleteDiscount: [] as unknown[],
  };

  return {
    calls,
    payloads,
    api: {
      saveTax: async (payload: unknown) => {
        calls.saveTax += 1;
        payloads.saveTax.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 1001 } });
      },
      listTaxes: async () => {
        calls.listTaxes += 1;
        return createApiResponse({ code: 0, msg: 'ok', data: [{ id: 1001, name: 'AT_TAX_A' }] });
      },
      deleteTax: async (payload: unknown) => {
        calls.deleteTax += 1;
        payloads.deleteTax.push(payload);
        return createApiResponse({ code: 0, msg: 'ok' });
      },
      saveDiscount: async (payload: unknown) => {
        calls.saveDiscount += 1;
        payloads.saveDiscount.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 1101 } });
      },
      listDiscounts: async () => {
        calls.listDiscounts += 1;
        return createApiResponse({ code: 0, msg: 'ok', data: [{ id: 1101, name: 'AT_DSC_A' }] });
      },
      deleteDiscount: async (payload: unknown) => {
        calls.deleteDiscount += 1;
        payloads.deleteDiscount.push(payload);
        return createApiResponse({ code: 0, msg: 'ok' });
      },
    },
  };
}

function createMenuApi() {
  const calls = {
    createMenu: 0,
    listMenus: 0,
    updateMenu: 0,
    createMenuGroup: 0,
    listMenuGroups: 0,
    getMenuGroup: 0,
    updateMenuGroup: 0,
    deleteMenuGroup: 0,
    createMenuCategory: 0,
    listCategories: 0,
    getMenuCategory: 0,
    updateMenuCategory: 0,
    deleteMenuCategory: 0,
  };
  const payloads = {
    createMenu: [] as unknown[],
    updateMenu: [] as unknown[],
    createMenuGroup: [] as unknown[],
    updateMenuGroup: [] as unknown[],
    deleteMenuGroup: [] as unknown[],
    createMenuCategory: [] as unknown[],
    updateMenuCategory: [] as unknown[],
    deleteMenuCategory: [] as unknown[],
  };

  return {
    calls,
    payloads,
    api: {
      createMenu: async (payload: unknown) => {
        calls.createMenu += 1;
        payloads.createMenu.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 2001 } });
      },
      listMenus: async () => {
        calls.listMenus += 1;
        return createApiResponse({ code: 0, msg: 'ok', data: [{ id: 2001, name: 'AT_MENU_A' }] });
      },
      updateMenu: async (payload: unknown) => {
        calls.updateMenu += 1;
        payloads.updateMenu.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 2001 } });
      },
      createMenuGroup: async (payload: unknown) => {
        calls.createMenuGroup += 1;
        payloads.createMenuGroup.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 3001 } });
      },
      listMenuGroups: async () => {
        calls.listMenuGroups += 1;
        return createApiResponse({ code: 0, msg: 'ok', data: [{ id: 3001, name: 'AT_GROUP_A' }] });
      },
      getMenuGroup: async () => {
        calls.getMenuGroup += 1;
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 3001, name: 'AT_GROUP_A' } });
      },
      updateMenuGroup: async (payload: unknown) => {
        calls.updateMenuGroup += 1;
        payloads.updateMenuGroup.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 3001 } });
      },
      deleteMenuGroup: async (payload: unknown) => {
        calls.deleteMenuGroup += 1;
        payloads.deleteMenuGroup.push(payload);
        return createApiResponse({ code: 0, msg: 'ok' });
      },
      createMenuCategory: async (payload: unknown) => {
        calls.createMenuCategory += 1;
        payloads.createMenuCategory.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 4001 } });
      },
      listCategories: async () => {
        calls.listCategories += 1;
        return createApiResponse({ code: 0, msg: 'ok', data: [{ id: 4001, name: 'AT_CAT_A' }] });
      },
      getMenuCategory: async () => {
        calls.getMenuCategory += 1;
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 4001, name: 'AT_CAT_A' } });
      },
      updateMenuCategory: async (payload: unknown) => {
        calls.updateMenuCategory += 1;
        payloads.updateMenuCategory.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 4001 } });
      },
      deleteMenuCategory: async (payload: unknown) => {
        calls.deleteMenuCategory += 1;
        payloads.deleteMenuCategory.push(payload);
        return createApiResponse({ code: 0, msg: 'ok' });
      },
    },
  };
}

function createSaleItemApi() {
  const calls = {
    createSaleItem: 0,
    searchSaleItems: 0,
    getSaleItem: 0,
    updateSaleItem: 0,
    deleteSaleItem: 0,
  };
  const payloads = {
    createSaleItem: [] as unknown[],
    updateSaleItem: [] as unknown[],
    deleteSaleItem: [] as unknown[],
  };

  return {
    calls,
    payloads,
    api: {
      createSaleItem: async (payload: unknown) => {
        calls.createSaleItem += 1;
        payloads.createSaleItem.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 5001 } });
      },
      searchSaleItems: async () => {
        calls.searchSaleItems += 1;
        return createApiResponse({ code: 0, msg: 'ok', data: [{ id: 5001, name: 'AT_ITEM_A' }] });
      },
      getSaleItem: async () => {
        calls.getSaleItem += 1;
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 5001, name: 'AT_ITEM_A' } });
      },
      updateSaleItem: async (payload: unknown) => {
        calls.updateSaleItem += 1;
        payloads.updateSaleItem.push(payload);
        return createApiResponse({ code: 0, msg: 'ok', data: { id: 5001 } });
      },
      deleteSaleItem: async (payload: unknown) => {
        calls.deleteSaleItem += 1;
        payloads.deleteSaleItem.push(payload);
        return createApiResponse({ code: 0, msg: 'ok' });
      },
    },
  };
}

function createApiResponse(body: unknown) {
  return {
    status: () => 200,
    json: async () => body,
  };
}

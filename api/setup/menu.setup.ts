import type { MenuApiClient } from '../clients/menu-api.client';
import type { SaleItemApiClient } from '../clients/sale-item-api.client';
import type { ApiRequestData } from '../clients/client-path';
import type { ResourceId, ResourceRegistry } from '../core/resource-registry';
import {
  buildCategoryRequest,
  buildMenuGroupRequest,
  buildMenuRequest,
  buildSaleItemRequest,
  type CategoryApiRequest,
  type MenuApiRequest,
  type MenuGroupApiRequest,
  type SaleItemApiRequest,
} from '../../test-data/api/menu-api-data';
import { createSetupResource, expectOkEnvelope, type SetupResource } from './setup-resource';

export type MenuSetupOptions = {
  menuApi?: MenuApiClient;
  saleItemApi?: SaleItemApiClient;
  resourceRegistry: ResourceRegistry;
};

export type MenuSetupService = CrudSetupService<Partial<MenuApiRequest>>;
export type MenuGroupSetupService = CrudSetupService<Partial<MenuGroupApiRequest> & { menuId: ResourceId }>;
export type CategorySetupService = CrudSetupService<
  Partial<CategoryApiRequest> & { menuId: ResourceId; menuGroupId: ResourceId }
>;
export type SaleItemSetupService = CrudSetupService<
  Partial<SaleItemApiRequest> & {
    menuId: ResourceId;
    menuGroupId: ResourceId;
    categoryId: ResourceId;
  }
>;

export type CrudSetupService<TCreateOverrides extends ApiRequestData> = {
  create: (overrides: TCreateOverrides) => Promise<SetupResource>;
  read: (id: ResourceId) => Promise<unknown>;
  update: (id: ResourceId, overrides: ApiRequestData) => Promise<SetupResource>;
  delete: (id: ResourceId) => Promise<void>;
};

export function createMenuSetupService(options: MenuSetupOptions): MenuSetupService {
  return {
    create: async (overrides = {}) => {
      const menuApi = requireMenuApi(options);
      const request = { ...buildMenuRequest(), ...overrides };

      return await createSetupResource({
        type: 'menu',
        name: String(request.name),
        request,
        resourceRegistry: options.resourceRegistry,
        cleanupPriority: 10,
        save: () => menuApi.createMenu(request),
        list: () => menuApi.listMenus({ name: request.name }),
        cleanup: (id) => menuApi.updateMenu(archiveMenuRequest(request, id)),
      });
    },
    read: async (id) => {
      const menuApi = requireMenuApi(options);

      return (await expectOkEnvelope(await menuApi.getMenu(id))).data;
    },
    update: async (id, overrides) => {
      const menuApi = requireMenuApi(options);
      const request = { id, ...overrides };
      const body = await expectOkEnvelope(await menuApi.updateMenu(request));

      return { id, name: readRequestName(request, id), request, body };
    },
    delete: async (id) => {
      const menuApi = requireMenuApi(options);
      await expectOkEnvelope(await menuApi.updateMenu({ id, enabled: false, active: false, deleted: true }));
      options.resourceRegistry.markCleaned('menu', id);
    },
  };
}

export function createMenuGroupSetupService(options: MenuSetupOptions): MenuGroupSetupService {
  return {
    create: async (overrides) => {
      const menuApi = requireMenuApi(options);
      const request = { ...buildMenuGroupRequest(overrides.menuId), ...overrides };

      return await createSetupResource({
        type: 'menuGroup',
        name: String(request.name),
        request,
        resourceRegistry: options.resourceRegistry,
        cleanupPriority: 30,
        save: () => menuApi.createMenuGroup(request),
        list: () => menuApi.listMenuGroups({ menuId: request.menuId, name: request.name }),
        cleanup: (id) => menuApi.deleteMenuGroup(id),
      });
    },
    read: async (id) => {
      const menuApi = requireMenuApi(options);

      return (await expectOkEnvelope(await menuApi.getMenuGroup(id))).data;
    },
    update: async (id, overrides) => {
      const menuApi = requireMenuApi(options);
      const request = { id, ...overrides };
      const body = await expectOkEnvelope(await menuApi.updateMenuGroup(request));

      return { id, name: readRequestName(request, id), request, body };
    },
    delete: async (id) => {
      const menuApi = requireMenuApi(options);
      await expectOkEnvelope(await menuApi.deleteMenuGroup(id));
      options.resourceRegistry.markCleaned('menuGroup', id);
    },
  };
}

export function createCategorySetupService(options: MenuSetupOptions): CategorySetupService {
  return {
    create: async (overrides) => {
      const menuApi = requireMenuApi(options);
      const request = {
        ...buildCategoryRequest(overrides.menuId, overrides.menuGroupId),
        ...overrides,
      };

      return await createSetupResource({
        type: 'menuCategory',
        name: String(request.name),
        request,
        resourceRegistry: options.resourceRegistry,
        cleanupPriority: 40,
        save: () => menuApi.createMenuCategory(request),
        list: () =>
          menuApi.listCategories({
            menuId: request.menuId,
            menuGroupId: request.menuGroupId,
            name: request.name,
          }),
        cleanup: (id) => menuApi.deleteMenuCategory(id),
      });
    },
    read: async (id) => {
      const menuApi = requireMenuApi(options);

      return (await expectOkEnvelope(await menuApi.getMenuCategory(id))).data;
    },
    update: async (id, overrides) => {
      const menuApi = requireMenuApi(options);
      const request = { id, ...overrides };
      const body = await expectOkEnvelope(await menuApi.updateMenuCategory(request));

      return { id, name: readRequestName(request, id), request, body };
    },
    delete: async (id) => {
      const menuApi = requireMenuApi(options);
      await expectOkEnvelope(await menuApi.deleteMenuCategory(id));
      options.resourceRegistry.markCleaned('menuCategory', id);
    },
  };
}

export function createSaleItemSetupService(options: MenuSetupOptions): SaleItemSetupService {
  return {
    create: async (overrides) => {
      const saleItemApi = requireSaleItemApi(options);
      const request = {
        ...buildSaleItemRequest(overrides.categoryId),
        ...overrides,
        menuCategoryId: overrides.categoryId,
        categoryId: overrides.categoryId,
      };

      return await createSetupResource({
        type: 'saleItem',
        name: String(request.name),
        request,
        resourceRegistry: options.resourceRegistry,
        cleanupPriority: 50,
        save: () => saleItemApi.createSaleItem(request),
        list: () =>
          saleItemApi.searchSaleItems({
            menuId: request.menuId,
            menuCategoryId: request.categoryId,
            categoryId: request.categoryId,
            keyword: request.name,
          }),
        cleanup: (id) => saleItemApi.deleteSaleItem(id),
      });
    },
    read: async (id) => {
      const saleItemApi = requireSaleItemApi(options);

      return (await expectOkEnvelope(await saleItemApi.getSaleItem(id))).data;
    },
    update: async (id, overrides) => {
      const saleItemApi = requireSaleItemApi(options);
      const request = { id, ...overrides };
      const body = await expectOkEnvelope(await saleItemApi.updateSaleItem(request));

      return { id, name: readRequestName(request, id), request, body };
    },
    delete: async (id) => {
      const saleItemApi = requireSaleItemApi(options);
      await expectOkEnvelope(await saleItemApi.deleteSaleItem(id));
      options.resourceRegistry.markCleaned('saleItem', id);
    },
  };
}

function archiveMenuRequest(request: ApiRequestData, menuId: ResourceId): ApiRequestData {
  return {
    ...request,
    id: menuId,
    enabled: false,
    active: false,
    deleted: true,
  };
}

function requireMenuApi(options: MenuSetupOptions): MenuApiClient {
  if (!options.menuApi) {
    throw new Error('菜单数据预置需要 menuApi。');
  }

  return options.menuApi;
}

function requireSaleItemApi(options: MenuSetupOptions): SaleItemApiClient {
  if (!options.saleItemApi) {
    throw new Error('商品数据预置需要 saleItemApi。');
  }

  return options.saleItemApi;
}

function readRequestName(request: ApiRequestData, fallback: ResourceId): string {
  const name = isRecord(request) ? request.name : undefined;

  return typeof name === 'string' ? name : String(fallback);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import type { APIResponse } from '@playwright/test';
import type { ApiRequestData } from '../../../api/clients/client-path';
import { createShortTestName } from '../../../api/core/test-data-id';
import type { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import type { MenuApiClient } from '../../../api/clients/menu-api.client';
import type { OrderApiClient } from '../../../api/clients/order-api.client';
import type { PaymentApiClient } from '../../../api/clients/payment-api.client';
import type { SaleItemApiClient } from '../../../api/clients/sale-item-api.client';
import type { ResourceId, ResourceRegistry } from '../../../api/core/resource-registry';
import {
  buildCategoryRequest,
  buildGlobalOptionCategoryRequest,
  buildGlobalOptionRequest,
  buildMenuGroupRequest,
  buildMenuRequest,
  buildSaleItemRequest,
} from '../../../test-data/api/menu-api-data';
import { buildDefaultOrderListQuery, buildOrderRequest } from '../../../test-data/api/order-api-data';
import { buildPaymentRecordRequest } from '../../../test-data/api/payment-api-data';
import {
  expectApiOk,
} from './endpoint-assertions';
import { extractFirstResourceId, findResourceIdByName } from './endpoint-read-model';

export type EndpointResource = {
  id: ResourceId;
  name: string;
  request: ApiRequestData;
  body: unknown;
};

export type EndpointResourceFactoryOptions = {
  adminConfigApi: AdminConfigApiClient;
  menuApi?: MenuApiClient;
  orderApi?: OrderApiClient;
  paymentApi?: PaymentApiClient;
  saleItemApi?: SaleItemApiClient;
  resourceRegistry: ResourceRegistry;
};

export type EndpointResources = {
  createTaxResource: () => Promise<EndpointResource>;
  createDiscountResource: () => Promise<EndpointResource>;
  createRoleResource: () => Promise<EndpointResource>;
  createMenuResource: () => Promise<EndpointResource>;
  createMenuGroupResource: (menuId: ResourceId) => Promise<EndpointResource>;
  createCategoryResource: (menuId: ResourceId, menuGroupId: ResourceId) => Promise<EndpointResource>;
  createGlobalOptionCategoryResource: (menuId: ResourceId) => Promise<EndpointResource>;
  createMenuGlobalOptionResource: (
    menuId: ResourceId,
    globalOptionCategoryId: ResourceId,
  ) => Promise<EndpointResource>;
  createSaleItemResource: (
    menuId: ResourceId,
    menuGroupId: ResourceId,
    categoryId: ResourceId,
  ) => Promise<EndpointResource>;
  createOrderResource: () => Promise<EndpointResource>;
  createPaymentRecordResource: (orderId: ResourceId) => Promise<EndpointResource>;
};

const ENDPOINT_RESOURCE_CLEANUP_PRIORITY = 30;
const SHORT_NAME_MAX_LENGTH = 16;

export function createEndpointResources(
  options: EndpointResourceFactoryOptions,
): EndpointResources {
  const resources: EndpointResources = {
    createTaxResource: async () => {
      const name = buildShortName('TAX');
      const request: ApiRequestData = {
        tax: {
          name,
          rate: 1,
          outRate: 1,
          taxIncrease: 'DEFAULT',
        },
      };

      const resolvedResource = await createEndpointResource({
        name,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/tax/save',
        },
        saveResource: () => options.adminConfigApi.saveTax(request),
        listIdentity: {
          method: 'GET',
          path: '/api/tax/list',
        },
        listResource: () => options.adminConfigApi.listTaxes({ keyword: name }),
        resolveResourceType: 'tax',
        cleanup: (id) => options.adminConfigApi.deleteTax({ taxId: id }),
      });

      return resolvedResource;
    },
    createDiscountResource: async () => {
      const name = buildShortName('DSC');
      const request: ApiRequestData = {
        name,
        rate: 10,
        rateType: 2,
        description: name,
      };

      const resolvedResource = await createEndpointResource({
        name,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/discount/save',
        },
        saveResource: () => options.adminConfigApi.saveDiscount(request),
        listIdentity: {
          method: 'GET',
          path: '/api/discount/list',
        },
        listResource: () => options.adminConfigApi.listDiscounts({ keyword: name }),
        resolveResourceType: 'discount',
        cleanup: (id) => options.adminConfigApi.deleteDiscount({ discountId: id }),
      });

      return resolvedResource;
    },
    createRoleResource: async () => {
      const name = buildShortName('ROLE');
      const request: ApiRequestData = {
        role: {
          name,
          discountCapRate: 0,
          function: [],
        },
      };

      const resolvedResource = await createEndpointResource({
        name,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/admin/role/save',
        },
        saveResource: () => options.adminConfigApi.saveRole(request),
        listIdentity: {
          method: 'GET',
          path: '/api/admin/role/list',
        },
        listResource: () => options.adminConfigApi.listRoles({ keyword: name }),
        resolveResourceType: 'role',
        cleanup: (id) => options.adminConfigApi.deleteRole({ roleId: id }),
      });

      return resolvedResource;
    },
    createMenuResource: async () => {
      const menuApi = getMenuApi(options);
      const request = buildMenuRequest();
      const resolvedResource = await createEndpointResource({
        name: request.name,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/menu/menu',
        },
        saveResource: () => menuApi.createMenu(request),
        listIdentity: {
          method: 'GET',
          path: '/api/menu/menus',
        },
        listResource: () => menuApi.listMenus({ name: request.name }),
        resolveResourceType: 'menu',
        cleanupPriority: 10,
        cleanup: (id) => menuApi.updateMenu(archiveMenuRequest(request, id)),
      });

      return resolvedResource;
    },
    createMenuGroupResource: async (menuId: ResourceId) => {
      const menuApi = getMenuApi(options);
      const request = buildMenuGroupRequest(menuId);

      const resolvedResource = await createEndpointResource({
        name: request.name,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/menu/menuGroup',
        },
        saveResource: () => menuApi.createMenuGroup(request),
        listIdentity: {
          method: 'GET',
          path: '/api/menu/menuGroups',
        },
        listResource: () => menuApi.listMenuGroups({ menuId: menuId, name: request.name }),
        resolveResourceType: 'menuGroup',
        cleanupPriority: 30,
        cleanup: (id) => menuApi.deleteMenuGroup(id),
      });

      return resolvedResource;
    },
    createCategoryResource: async (menuId: ResourceId, menuGroupId: ResourceId) => {
      const menuApi = getMenuApi(options);
      const request = buildCategoryRequest(menuId, menuGroupId);

      const resolvedResource = await createEndpointResource({
        name: request.name,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/menu/menuCategory',
        },
        saveResource: () => menuApi.createMenuCategory(request),
        listIdentity: {
          method: 'GET',
          path: '/api/menu/category/list',
        },
        listResource: () =>
          menuApi.listCategories({
            menuId: menuId,
            menuGroupId: menuGroupId,
            name: request.name,
          }),
        resolveResourceType: 'menuCategory',
        cleanupPriority: 40,
        cleanup: (id) => menuApi.deleteMenuCategory(id),
      });

      return resolvedResource;
    },
    createGlobalOptionCategoryResource: async (menuId: ResourceId) => {
      const menuApi = getMenuApi(options);
      const request = buildGlobalOptionCategoryRequest(menuId);

      const resolvedResource = await createEndpointResource({
        name: request.name,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/menu/globalOptionCategory',
        },
        saveResource: () => menuApi.createGlobalOptionCategory(request),
        listIdentity: {
          method: 'GET',
          path: '/api/menu/menu/{menuId}/globalOptionCategories',
        },
        listResource: () => menuApi.listGlobalOptionCategories(menuId),
        resolveResourceType: 'globalOptionCategory',
        cleanupPriority: 45,
        cleanup: (id) => menuApi.deleteGlobalOptionCategory(id),
      });

      return resolvedResource;
    },
    createMenuGlobalOptionResource: async (
      menuId: ResourceId,
      globalOptionCategoryId: ResourceId,
    ) => {
      const menuApi = getMenuApi(options);
      const request = {
        ...buildGlobalOptionRequest(globalOptionCategoryId),
        menuId,
      };

      const resolvedResource = await createEndpointResource({
        name: request.name,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/menu/menuGlobalOption',
        },
        saveResource: () => menuApi.createMenuGlobalOption(request),
        listIdentity: {
          method: 'GET',
          path: '/api/menu/menuGlobalOptions/search',
        },
        listResource: () =>
          menuApi.searchMenuGlobalOptions({
            name: request.name,
            menuIds: String(menuId),
            categoryIds: String(globalOptionCategoryId),
          }),
        resolveResourceType: 'menuGlobalOption',
        cleanupPriority: 50,
        cleanup: (id) => menuApi.deleteMenuGlobalOption(id),
      });

      return resolvedResource;
    },
    createSaleItemResource: async (
      menuId: ResourceId,
      menuGroupId: ResourceId,
      categoryId: ResourceId,
    ) => {
      const saleItemApi = getSaleItemApi(options);
      const request = {
        ...buildSaleItemRequest(categoryId),
        menuId,
        menuGroupId,
        categoryId,
      };

      const resolvedResource = await createEndpointResource({
        name: request.name,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/menu/menuSaleItem',
        },
        saveResource: () => saleItemApi.createSaleItem(request),
        listIdentity: {
          method: 'GET',
          path: '/api/menu/menuSaleItems/search',
        },
        listResource: () =>
          saleItemApi.searchSaleItems({
            menuId,
            menuCategoryId: categoryId,
            categoryId,
            keyword: request.name,
          }),
        resolveResourceType: 'saleItem',
        cleanupPriority: 50,
        cleanup: (id) => saleItemApi.deleteSaleItem(id),
      });

      return resolvedResource;
    },
    createOrderResource: async () => {
      const orderApi = getOrderApi(options);
      const menuResource = await resources.createMenuResource();
      const menuGroupResource = await resources.createMenuGroupResource(menuResource.id);
      const categoryResource = await resources.createCategoryResource(
        menuResource.id,
        menuGroupResource.id,
      );
      const saleItemResource = await resources.createSaleItemResource(
        menuResource.id,
        menuGroupResource.id,
        categoryResource.id,
      );
      const request = buildOrderRequest(saleItemResource.id);
      const customerName = String(request.order.customerName);

      const resolvedResource = await createEndpointResource({
        name: customerName,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/order/save',
        },
        saveResource: () => orderApi.saveOrder(request),
        listIdentity: {
          method: 'GET',
          path: '/api/order/list',
        },
        listResource: () =>
          orderApi.listOrders(buildDefaultOrderListQuery(new Date(), { customerName })),
        resolveResourceType: 'order',
        cleanupPriority: 80,
        cleanup: (id) => orderApi.voidOrder(buildOrderVoidRequest(id)),
      });

      return resolvedResource;
    },
    createPaymentRecordResource: async (orderId: ResourceId) => {
      const paymentApi = getPaymentApi(options);
      const request = buildPaymentRecordRequest(orderId);

      const resolvedResource = await createEndpointResource({
        name: `payment-${String(orderId)}`,
        adminConfigApi: options.adminConfigApi,
        resourceRegistry: options.resourceRegistry,
        request,
        saveIdentity: {
          method: 'POST',
          path: '/api/payment/record/save',
        },
        saveResource: () => paymentApi.saveRecord(request),
        resolveResourceType: 'payment',
        cleanupPriority: 90,
        cleanup: (id) => paymentApi.deleteRecord(buildPaymentDeleteRequest(id, orderId)),
      });

      return resolvedResource;
    },
  };

  return resources;
}

function buildShortName(domain: string): string {
  return createShortTestName({
    prefix: 'AT',
    domain,
    maxLength: SHORT_NAME_MAX_LENGTH,
  });
}

async function createEndpointResource(options: {
  name: string;
  adminConfigApi: AdminConfigApiClient;
  resourceRegistry: ResourceRegistry;
  request: ApiRequestData;
  saveIdentity: { method: 'POST'; path: string };
  saveResource: () => Promise<APIResponse>;
  listIdentity?: { method: 'GET'; path: string };
  listResource?: () => Promise<APIResponse>;
  resolveResourceType: string;
  cleanupPriority?: number;
  cleanup: (id: ResourceId) => Promise<unknown>;
}): Promise<EndpointResource> {
  const saveBody = await expectApiOk(await options.saveResource(), options.saveIdentity);
  let id = extractFirstResourceId(saveBody);

  if (id === undefined && options.listResource !== undefined && options.listIdentity !== undefined) {
    const listBody = await expectApiOk(await options.listResource(), options.listIdentity);
    id = findResourceIdByName(listBody.data, options.name);
  }

  if (id === undefined) {
    throw new Error(
      `${options.saveIdentity.path} 创建后未能通过响应或列表解析到资源 ID。`,
    );
  }

  options.resourceRegistry.register({
    type: options.resolveResourceType,
    id,
    name: options.name,
    cleanupPriority: options.cleanupPriority ?? ENDPOINT_RESOURCE_CLEANUP_PRIORITY,
    cleanup: () => options.cleanup(id),
  });

  return {
    id,
    name: options.name,
    request: options.request,
    body: saveBody,
  };
}

function getMenuApi(options: EndpointResourceFactoryOptions): MenuApiClient {
  if (options.menuApi === undefined) {
    throw new Error('createMenuResource/createMenuGroupResource/createCategoryResource/createGlobalOptionCategoryResource/createMenuGlobalOptionResource 需要 menuApi 入参。');
  }

  return options.menuApi;
}

function getSaleItemApi(options: EndpointResourceFactoryOptions): SaleItemApiClient {
  if (options.saleItemApi === undefined) {
    throw new Error('createSaleItemResource 需要 saleItemApi 入参。');
  }

  return options.saleItemApi;
}

function getOrderApi(options: EndpointResourceFactoryOptions): OrderApiClient {
  if (options.orderApi === undefined) {
    throw new Error('createOrderResource 需要 orderApi 入参。');
  }

  return options.orderApi;
}

function getPaymentApi(options: EndpointResourceFactoryOptions): PaymentApiClient {
  if (options.paymentApi === undefined) {
    throw new Error('createPaymentRecordResource 需要 paymentApi 入参。');
  }

  return options.paymentApi;
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

function buildOrderVoidRequest(orderId: ResourceId): ApiRequestData {
  return {
    id: orderId,
    orderId,
    reason: 'API_AUTOMATION_CLEANUP',
  };
}

function buildPaymentDeleteRequest(paymentId: ResourceId, orderId: ResourceId): ApiRequestData {
  return {
    id: paymentId,
    paymentRecordId: paymentId,
    orderId,
    reason: 'API_AUTOMATION_CLEANUP',
  };
}

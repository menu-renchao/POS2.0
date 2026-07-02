import type { AdminConfigApiClient } from '../clients/admin-config-api.client';
import type { MenuApiClient } from '../clients/menu-api.client';
import type { SaleItemApiClient } from '../clients/sale-item-api.client';
import type { ResourceRegistry } from '../core/resource-registry';
import {
  createDiscountSetupService,
  createTaxSetupService,
  type DiscountSetupService,
  type TaxSetupService,
} from './admin-config.setup';
import {
  createCategorySetupService,
  createMenuGroupSetupService,
  createMenuSetupService,
  createSaleItemSetupService,
  type CategorySetupService,
  type MenuGroupSetupService,
  type MenuSetupService,
  type SaleItemSetupService,
} from './menu.setup';

export type ApiSetupFactoryOptions = {
  adminConfigApi: AdminConfigApiClient;
  menuApi?: MenuApiClient;
  saleItemApi?: SaleItemApiClient;
  resourceRegistry: ResourceRegistry;
};

export type ApiSetup = {
  tax: TaxSetupService;
  discount: DiscountSetupService;
  menu: MenuSetupService;
  menuGroup: MenuGroupSetupService;
  category: CategorySetupService;
  saleItem: SaleItemSetupService;
};

export function createApiSetup(options: ApiSetupFactoryOptions): ApiSetup {
  return {
    tax: createTaxSetupService(options),
    discount: createDiscountSetupService(options),
    menu: createMenuSetupService(options),
    menuGroup: createMenuGroupSetupService(options),
    category: createCategorySetupService(options),
    saleItem: createSaleItemSetupService(options),
  };
}

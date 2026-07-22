import type { AdminConfigApiClient } from '../clients/admin-config-api.client';
import type { KitchenApiClient } from '../clients/kitchen-api.client';
import type { LayoutConfigApiClient } from '../clients/layout-config-api.client';
import type { MenuApiClient } from '../clients/menu-api.client';
import type { OrderTypeApiClient } from '../clients/order-type-api.client';
import type { SaleItemApiClient } from '../clients/sale-item-api.client';
import type { SystemConfigurationApiClient } from '../clients/system-configuration-api.client';
import type { PrintConfigApiClient } from '../clients/print-config-api.client';
import type { ResourceRegistry } from '../core/resource-registry';
import {
  createChargeSetupService,
  createDiscountSetupService,
  createTaxSetupService,
  type ChargeSetupService,
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
import {
  createSystemConfigurationSetupService,
  type SystemConfigurationSetupService,
} from './system-configuration.setup';
import { createStaffSetupService, type StaffSetupService } from './staff.setup';
import { createKitchenSetupService, type KitchenSetupService } from './kitchen.setup';
import {
  createCustomOrderTypeSetupService,
  type CustomOrderTypeSetupService,
} from './custom-order-type.setup';
import {
  createPrintConfigurationSetupService,
  type PrintConfigurationSetupService,
} from './print-config.setup';

export type ApiSetupFactoryOptions = {
  adminConfigApi: AdminConfigApiClient;
  kitchenApi?: KitchenApiClient;
  layoutConfigApi?: LayoutConfigApiClient;
  systemConfigurationApi?: SystemConfigurationApiClient;
  printConfigApi?: PrintConfigApiClient;
  orderTypeApi?: OrderTypeApiClient;
  menuApi?: MenuApiClient;
  saleItemApi?: SaleItemApiClient;
  resourceRegistry: ResourceRegistry;
};

export type ApiSetup = {
  tax: TaxSetupService;
  discount: DiscountSetupService;
  charge: ChargeSetupService;
  menu: MenuSetupService;
  menuGroup: MenuGroupSetupService;
  category: CategorySetupService;
  saleItem: SaleItemSetupService;
  systemConfiguration: SystemConfigurationSetupService;
  staff: StaffSetupService;
  kitchen: KitchenSetupService;
  customOrderType: CustomOrderTypeSetupService;
  printConfiguration: PrintConfigurationSetupService;
};

export function createApiSetup(options: ApiSetupFactoryOptions): ApiSetup {
  return {
    tax: createTaxSetupService(options),
    discount: createDiscountSetupService(options),
    charge: createChargeSetupService(options),
    menu: createMenuSetupService(options),
    menuGroup: createMenuGroupSetupService(options),
    category: createCategorySetupService(options),
    saleItem: createSaleItemSetupService(options),
    systemConfiguration: createSystemConfigurationSetupService(options),
    staff: createStaffSetupService(options),
    kitchen: createKitchenSetupService(options),
    customOrderType: createCustomOrderTypeSetupService(options),
    printConfiguration: createPrintConfigurationSetupService(options.printConfigApi),
  };
}

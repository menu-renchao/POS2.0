import { test as base, type APIRequestContext } from '@playwright/test';
import { AdminConfigApiClient } from '../api/clients/admin-config-api.client';
import { GiftCardApiClient } from '../api/clients/gift-card-api.client';
import { MenuApiClient } from '../api/clients/menu-api.client';
import { KitchenApiClient } from '../api/clients/kitchen-api.client';
import { LayoutConfigApiClient } from '../api/clients/layout-config-api.client';
import { OrderApiClient } from '../api/clients/order-api.client';
import { OrderTypeApiClient } from '../api/clients/order-type-api.client';
import { SaleItemApiClient } from '../api/clients/sale-item-api.client';
import { SystemConfigurationApiClient } from '../api/clients/system-configuration-api.client';
import { PrintConfigApiClient } from '../api/clients/print-config-api.client';
import { loadApiConfig, type ApiConfig } from '../api/core/api-config';
import { createApiRequestContext } from '../api/core/api-context';
import {
  assertCleanupSucceeded,
  ResourceRegistry,
} from '../api/core/resource-registry';
import { createApiSetup, type ApiSetup } from '../api/setup/api-setup';
import { EmployeeLoginPage } from '../pages/employee-login.page';
import { HomePage } from '../pages/home.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
import { RecallPage } from '../pages/recall.page';
import { PaymentPage } from '../pages/payment.page';
import { SplitOrderPage } from '../pages/split-order.page';
import { EmployeeLoginFlow } from '../flows/employee-login.flow';
import { GiftCardFlow } from '../flows/gift-card.flow';
import { HomeFlow } from '../flows/home.flow';
import { InventoryFlow } from '../flows/inventory.flow';
import { LicenseSelectionFlow } from '../flows/license-selection.flow';
import { OrderCustomerFlow } from '../flows/order-customer.flow';
import { OrderDishesFlow } from '../flows/order-dishes.flow';
import { OrderKitchenFlow } from '../flows/order-kitchen.flow';
import { OrderOptionVerificationFlow } from '../flows/order-option-verification.flow';
import { OrderPermissionFlow } from '../flows/order-permission.flow';
import { OrderRegressionFlow } from '../flows/order-regression.flow';
import { PagingFlow } from '../flows/paging.flow';
import { PaymentFlow } from '../flows/payment.flow';
import { RecallFlow } from '../flows/recall.flow';
import { RecallDatabaseFlow } from '../flows/recall-database.flow';
import { SelectTableFlow } from '../flows/select-table.flow';
import { SplitOrderFlow } from '../flows/split-order.flow';
import { SplitOrderChargeCombineFlow } from '../flows/split-order-charge-combine.flow';
import { SplitOrderChargeEditFlow } from '../flows/split-order-charge-edit.flow';
import { SplitOrderChargeTransferFlow } from '../flows/split-order-charge-transfer.flow';
import { SplitOrderOperationFlow } from '../flows/split-order-operation.flow';
import { SplitOrderScenarioFlow } from '../flows/split-order-scenario.flow';
import { TakeoutFlow } from '../flows/takeout.flow';
import { TableOrderFlow } from '../flows/table-order.flow';
import { UiResourceManager } from './ui-resource.manager';
import { ConfigurationResourceManager } from './configuration-resource.manager';

export type FlowFixtures = {
  employeeLoginFlow: EmployeeLoginFlow;
  giftCardFlow: GiftCardFlow;
  homeFlow: HomeFlow;
  inventoryFlow: InventoryFlow;
  licenseSelectionFlow: LicenseSelectionFlow;
  orderCustomerFlow: OrderCustomerFlow;
  orderDishesFlow: OrderDishesFlow;
  orderKitchenFlow: OrderKitchenFlow;
  orderOptionVerificationFlow: OrderOptionVerificationFlow;
  orderPermissionFlow: OrderPermissionFlow;
  orderRegressionFlow: OrderRegressionFlow;
  pagingFlow: PagingFlow;
  paymentFlow: PaymentFlow;
  recallFlow: RecallFlow;
  recallDatabaseFlow: RecallDatabaseFlow;
  selectTableFlow: SelectTableFlow;
  splitOrderFlow: SplitOrderFlow;
  splitOrderChargeCombineFlow: SplitOrderChargeCombineFlow;
  splitOrderChargeEditFlow: SplitOrderChargeEditFlow;
  splitOrderChargeTransferFlow: SplitOrderChargeTransferFlow;
  splitOrderOperationFlow: SplitOrderOperationFlow;
  splitOrderScenarioFlow: SplitOrderScenarioFlow;
  tableOrderFlow: TableOrderFlow;
  takeoutFlow: TakeoutFlow;
};

type AppFixtures = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
  orderDishesPage: OrderDishesPage;
  recallPage: RecallPage;
  paymentPage: PaymentPage;
  splitOrderPage: SplitOrderPage;
  employeeLoginFlow: EmployeeLoginFlow;
  giftCardFlow: GiftCardFlow;
  homeFlow: HomeFlow;
  inventoryFlow: InventoryFlow;
  licenseSelectionFlow: LicenseSelectionFlow;
  orderCustomerFlow: OrderCustomerFlow;
  orderDishesFlow: OrderDishesFlow;
  orderKitchenFlow: OrderKitchenFlow;
  orderOptionVerificationFlow: OrderOptionVerificationFlow;
  orderPermissionFlow: OrderPermissionFlow;
  orderRegressionFlow: OrderRegressionFlow;
  pagingFlow: PagingFlow;
  paymentFlow: PaymentFlow;
  recallFlow: RecallFlow;
  recallDatabaseFlow: RecallDatabaseFlow;
  selectTableFlow: SelectTableFlow;
  splitOrderFlow: SplitOrderFlow;
  splitOrderChargeCombineFlow: SplitOrderChargeCombineFlow;
  splitOrderChargeEditFlow: SplitOrderChargeEditFlow;
  splitOrderChargeTransferFlow: SplitOrderChargeTransferFlow;
  splitOrderOperationFlow: SplitOrderOperationFlow;
  splitOrderScenarioFlow: SplitOrderScenarioFlow;
  tableOrderFlow: TableOrderFlow;
  takeoutFlow: TakeoutFlow;
  flows: Readonly<FlowFixtures>;
  apiConfig: ApiConfig;
  apiRequest: APIRequestContext;
  orderApi: OrderApiClient;
  giftCardApi: GiftCardApiClient;
  systemConfigurationApi: SystemConfigurationApiClient;
  resourceRegistry: ResourceRegistry;
  configurationResources: ConfigurationResourceManager;
  uiResources: UiResourceManager;
  apiSetup: ApiSetup;
};

export const test = base.extend<AppFixtures>({
  apiConfig: async ({}, use) => {
    await use(loadApiConfig());
  },
  apiRequest: async ({ apiConfig }, use, testInfo) => {
    const apiRequest = await createApiRequestContext(apiConfig, testInfo);
    try {
      await use(apiRequest);
    } finally {
      await apiRequest.dispose();
    }
  },
  resourceRegistry: async ({ apiRequest: _apiRequest }, use) => {
    const resourceRegistry = new ResourceRegistry();

    try {
      await use(resourceRegistry);
    } finally {
      assertCleanupSucceeded(
        await resourceRegistry.cleanupAll(),
        'UI resource',
      );
    }
  },
  apiSetup: async ({ apiRequest, resourceRegistry }, use) => {
    const systemConfigurationApi = new SystemConfigurationApiClient(apiRequest);
    await use(
      createApiSetup({
        adminConfigApi: new AdminConfigApiClient(apiRequest),
        kitchenApi: new KitchenApiClient(apiRequest),
        layoutConfigApi: new LayoutConfigApiClient(apiRequest),
        menuApi: new MenuApiClient(apiRequest),
        saleItemApi: new SaleItemApiClient(apiRequest),
        orderTypeApi: new OrderTypeApiClient(apiRequest),
        systemConfigurationApi,
        printConfigApi: new PrintConfigApiClient(apiRequest),
        resourceRegistry,
      }),
    );
  },
  configurationResources: async (
    { apiSetup, resourceRegistry },
    use,
  ) => {
    await use(
      new ConfigurationResourceManager(
        resourceRegistry,
        apiSetup.systemConfiguration,
      ),
    );
  },
  systemConfigurationApi: async ({ apiRequest }, use) => {
    await use(new SystemConfigurationApiClient(apiRequest));
  },
  orderApi: async ({ apiRequest }, use) => {
    await use(new OrderApiClient(apiRequest));
  },
  uiResources: [
    async (
      { page, resourceRegistry, orderApi, recallDatabaseFlow },
      use,
    ) => {
      const uiResources = new UiResourceManager(
        resourceRegistry,
        orderApi,
        recallDatabaseFlow,
        page,
      );
      try {
        await use(uiResources);
      } finally {
        await uiResources.dispose();
      }
    },
    { auto: true },
  ],
  giftCardApi: async ({ apiRequest }, use) => {
    await use(new GiftCardApiClient(apiRequest));
  },
  employeeLoginPage: async ({ page }, use) => {
    await use(new EmployeeLoginPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  orderDishesPage: async ({ page }, use) => {
    await use(new OrderDishesPage(page));
  },
  recallPage: async ({ page }, use) => {
    await use(new RecallPage(page));
  },
  paymentPage: async ({ page }, use) => {
    await use(new PaymentPage(page));
  },
  splitOrderPage: async ({ page }, use) => {
    await use(new SplitOrderPage(page));
  },
  employeeLoginFlow: async ({}, use) => {
    await use(new EmployeeLoginFlow());
  },
  giftCardFlow: async ({}, use) => {
    await use(new GiftCardFlow());
  },
  inventoryFlow: async ({}, use) => {
    await use(new InventoryFlow());
  },
  licenseSelectionFlow: async ({}, use) => {
    await use(new LicenseSelectionFlow());
  },
  orderCustomerFlow: async ({}, use) => {
    await use(new OrderCustomerFlow());
  },
  orderDishesFlow: async ({}, use) => {
    await use(new OrderDishesFlow());
  },
  orderKitchenFlow: async ({}, use) => {
    await use(new OrderKitchenFlow());
  },
  orderOptionVerificationFlow: async (
    { orderRegressionFlow, recallFlow },
    use,
  ) => {
    await use(
      new OrderOptionVerificationFlow(orderRegressionFlow, recallFlow),
    );
  },
  orderPermissionFlow: async ({}, use) => {
    await use(new OrderPermissionFlow());
  },
  orderRegressionFlow: async (
    { homeFlow, employeeLoginFlow, recallFlow },
    use,
  ) => {
    await use(
      new OrderRegressionFlow(homeFlow, employeeLoginFlow, recallFlow),
    );
  },
  paymentFlow: async ({}, use) => {
    await use(new PaymentFlow());
  },
  recallFlow: async ({}, use) => {
    await use(new RecallFlow());
  },
  recallDatabaseFlow: async ({ apiConfig }, use) => {
    await use(new RecallDatabaseFlow(apiConfig.baseURL));
  },
  splitOrderFlow: async ({}, use) => {
    await use(new SplitOrderFlow());
  },
  splitOrderChargeCombineFlow: async (
    {
      orderDishesFlow,
      recallFlow,
      splitOrderScenarioFlow,
      takeoutFlow,
    },
    use,
  ) => {
    await use(
      new SplitOrderChargeCombineFlow(
        orderDishesFlow,
        recallFlow,
        splitOrderScenarioFlow,
        takeoutFlow,
      ),
    );
  },
  splitOrderChargeEditFlow: async (
    {
      orderRegressionFlow,
      recallFlow,
      splitOrderFlow,
      splitOrderScenarioFlow,
    },
    use,
  ) => {
    await use(
      new SplitOrderChargeEditFlow(
        orderRegressionFlow,
        recallFlow,
        splitOrderFlow,
        splitOrderScenarioFlow,
      ),
    );
  },
  splitOrderChargeTransferFlow: async (
    { recallFlow, splitOrderScenarioFlow },
    use,
  ) => {
    await use(
      new SplitOrderChargeTransferFlow(
        recallFlow,
        splitOrderScenarioFlow,
      ),
    );
  },
  splitOrderOperationFlow: async (
    {
      employeeLoginFlow,
      orderDishesFlow,
      orderRegressionFlow,
      paymentFlow,
      recallFlow,
      selectTableFlow,
      splitOrderFlow,
      takeoutFlow,
      configurationResources,
    },
    use,
  ) => {
    await use(
      new SplitOrderOperationFlow(
        employeeLoginFlow,
        orderDishesFlow,
        orderRegressionFlow,
        paymentFlow,
        recallFlow,
        selectTableFlow,
        splitOrderFlow,
        takeoutFlow,
        configurationResources,
      ),
    );
  },
  splitOrderScenarioFlow: async (
    {
      configurationResources,
      employeeLoginFlow,
      orderDishesFlow,
      orderRegressionFlow,
      recallFlow,
      selectTableFlow,
      takeoutFlow,
    },
    use,
  ) => {
    await use(
      new SplitOrderScenarioFlow(
        configurationResources,
        employeeLoginFlow,
        orderDishesFlow,
        orderRegressionFlow,
        recallFlow,
        selectTableFlow,
        takeoutFlow,
      ),
    );
  },
  tableOrderFlow: async (
    {
      orderCustomerFlow,
      orderDishesFlow,
      recallFlow,
      selectTableFlow,
      uiResources,
    },
    use,
  ) => {
    await use(
      new TableOrderFlow(
        orderCustomerFlow,
        orderDishesFlow,
        recallFlow,
        selectTableFlow,
        uiResources,
      ),
    );
  },
  homeFlow: async ({ employeeLoginFlow }, use) => {
    await use(new HomeFlow(employeeLoginFlow));
  },
  selectTableFlow: async ({ employeeLoginFlow }, use) => {
    await use(new SelectTableFlow(employeeLoginFlow));
  },
  takeoutFlow: async ({ employeeLoginFlow }, use) => {
    await use(new TakeoutFlow(employeeLoginFlow));
  },
  pagingFlow: async (
    { orderDishesFlow, recallFlow, selectTableFlow },
    use,
  ) => {
    await use(new PagingFlow(selectTableFlow, orderDishesFlow, recallFlow));
  },
  flows: async (
    {
      employeeLoginFlow,
      giftCardFlow,
      homeFlow,
      inventoryFlow,
      licenseSelectionFlow,
      orderCustomerFlow,
      orderDishesFlow,
      orderKitchenFlow,
      orderOptionVerificationFlow,
      orderPermissionFlow,
      orderRegressionFlow,
      pagingFlow,
      paymentFlow,
      recallFlow,
      recallDatabaseFlow,
      selectTableFlow,
      splitOrderFlow,
      splitOrderChargeCombineFlow,
      splitOrderChargeEditFlow,
      splitOrderChargeTransferFlow,
      splitOrderOperationFlow,
      splitOrderScenarioFlow,
      tableOrderFlow,
      takeoutFlow,
    },
    use,
  ) => {
    await use(
      Object.freeze({
        employeeLoginFlow,
        giftCardFlow,
        homeFlow,
        inventoryFlow,
        licenseSelectionFlow,
        orderCustomerFlow,
        orderDishesFlow,
        orderKitchenFlow,
        orderOptionVerificationFlow,
        orderPermissionFlow,
        orderRegressionFlow,
        pagingFlow,
        paymentFlow,
        recallFlow,
        recallDatabaseFlow,
        selectTableFlow,
        splitOrderFlow,
        splitOrderChargeCombineFlow,
        splitOrderChargeEditFlow,
        splitOrderChargeTransferFlow,
        splitOrderOperationFlow,
        splitOrderScenarioFlow,
        tableOrderFlow,
        takeoutFlow,
      }),
    );
  },
});

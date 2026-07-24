import { expect } from '@playwright/test';
import type { ApiSetup } from '../api/setup/api-setup';
import type { OrderApiClient } from '../api/clients/order-api.client';
import {
  extractSavedOrderId,
  extractSavedOrderNumber,
} from '../api/read-models/order.read-model';
import type { SystemConfigurationApiClient } from '../api/clients/system-configuration-api.client';
import type { EmployeeLoginPage } from '../pages/employee-login.page';
import type { HomePage } from '../pages/home.page';
import type { OrderDishesPage } from '../pages/order-dishes.page';
import type { RecallPage } from '../pages/recall.page';
import type {
  OrderChargeSnapshot,
  OrderPriceSummary,
} from '../pages/order-dishes/order-dishes.types';
import type { ChargeSetupOverrides } from '../test-data/api/admin-config-api-data';
import {
  buildDineInOrderWithWholeChargeRequest,
  buildDineInOrderWithWholeChargesRequest,
  type ApiWholeChargeSeed,
} from '../test-data/split-order-charge';
import {
  orderServiceCustomers,
  orderServiceDishes,
  orderServiceSeatDisplayConfigurationUpdate,
  orderServiceSplitOperationCase,
} from '../test-data/order-service';
import { expectOkEnvelope } from '../api/setup/setup-resource';
import { createShortTestName } from '../api/core/test-data-id';
import { jiraIssueAnnotation } from '../utils/jira';
import {
  readChargeAmountFromDetailsText,
} from '../utils/split-order-charge';
import { escapeRegExp } from '../utils/text';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import type { EmployeeLoginFlow } from './employee-login.flow';
import type { OrderDishesFlow } from './order-dishes.flow';
import type { OrderRegressionFlow } from './order-regression.flow';
import type { RecallFlow } from './recall.flow';
import type { SelectTableFlow } from './select-table.flow';
import type { SplitOrderTargets } from './split-order.types';
import type { TakeoutFlow } from './takeout.flow';

type ScenarioDependencies = Readonly<{
  configurationResources: {
    updateByNameWithRestore(
      name: string,
      value: boolean,
      options?: { userId?: number; verify?: boolean },
    ): Promise<() => Promise<void>>;
  };
  employeeLoginFlow: EmployeeLoginFlow;
  orderDishesFlow: OrderDishesFlow;
  orderRegressionFlow: OrderRegressionFlow;
  recallFlow: RecallFlow;
  selectTableFlow: SelectTableFlow;
  takeoutFlow: TakeoutFlow;
}>;

type Tail<T extends readonly unknown[]> = T extends readonly [
  unknown,
  ...infer Rest,
]
  ? Rest
  : never;

async function enterDineInNoTableOrder(
  flows: ScenarioDependencies,
  homePage: HomePage,
): Promise<OrderDishesPage> {
  const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(homePage);
  await orderDishesPage.expectLoaded();
  return orderDishesPage;
}

async function readTargetCharge(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<number> {
  return (await readTargetPriceSummary(recallPage, orderNumber, targetOrderNumber)).Charge ?? 0;
}

async function readTargetPriceSummary(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<Record<string, number>> {
  await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.orderDetails.readDisplayedOrderPriceSummary();
  await recallPage.orderDetails.closeOrderDetailsDialog();
  return priceSummary;
}

async function openLatestSplitOrderTargets(
  flows: ScenarioDependencies,
  recallPage: RecallPage,
  expectedOrderNumber?: string,
): Promise<SplitOrderTargets> {
  const recallFlow = flows.recallFlow;
  const latestVisibleOrderNumber = expectedOrderNumber
    ? expectedOrderNumber
    : await recallFlow.readLatestVisibleOrderNumber(recallPage);
  const orderNumber = latestVisibleOrderNumber.replace(/-\d+$/, '');
  await recallPage.orderDetails.openOrderDetails(orderNumber);
  const targetOrderNumbers = await waitUntil(
    async () => await recallPage.orderDetails.readTargetOrderNumbers(),
    (orderNumbers) => orderNumbers.length >= 2,
    {
      timeout: 10_000,
      interval: 250,
      message: `Recall 母单 ${orderNumber} 未稳定展示至少两个分单子单。`,
    },
  );

  expect(targetOrderNumbers.length, 'Recall 详情应至少展示两个分单子单。').toBeGreaterThanOrEqual(2);

  const [firstTargetOrderNumber, secondTargetOrderNumber] = targetOrderNumbers;
  expect(firstTargetOrderNumber, '第一个子单号应存在。').toBeTruthy();
  expect(secondTargetOrderNumber, '第二个子单号应存在。').toBeTruthy();

  return {
    firstTargetOrderNumber,
    orderNumber,
    secondTargetOrderNumber,
  };
}

async function createSavedRecallOrder(
  flows: ScenarioDependencies,
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{ orderNumber: string; recallPage: RecallPage }> {
  const orderDishesPage = await enterDineInNoTableOrder(flows, readyHomePage);
  await flows.orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  const recallPage = await saveEditingOrderAndOpenRecall(
    flows,
    orderDishesPage,
    employeeLoginPage,
  );
  const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
  return { orderNumber, recallPage };
}

async function createChargeSetup(
  apiSetup: ApiSetup,
  charge: ChargeSetupOverrides,
): Promise<{ id: string | number; name: string }> {
  const setupCharge: ChargeSetupOverrides = {
    triggerMode: 2,
    type: 'DEFAULT',
    ...charge,
  };
  const resource = await apiSetup.charge.create(setupCharge);
  const updatedResource = await apiSetup.charge.update(resource.id, {
    ...setupCharge,
    name: resource.name,
  });

  return { id: updatedResource.id, name: updatedResource.name };
}

async function createSavedOrderWithManualCharge(
  flows: ScenarioDependencies,
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  chargeName: string,
  options: { addSecondDish?: boolean } = {},
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: OrderPriceSummary;
  orderId?: number;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const orderDishesPage = await enterDineInNoTableOrder(flows, readyHomePage);
  await flows.orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  if (options.addSecondDish) {
    await flows.orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.test.name,
      orderServiceDishes.test.menu,
    );
  }
  await flows.orderDishesFlow.applyChargeByScope(orderDishesPage, {
    optionName: chargeName,
    scope: 'whole',
  });
  const beforeSummary = await orderDishesPage.reads.readPriceSummary();
  const beforeChargeSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
  const recallPage = await saveEditingOrderAndOpenRecall(
    flows,
    orderDishesPage,
    employeeLoginPage,
  );
  const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);

  return { beforeChargeSnapshot, beforeSummary, orderNumber, recallPage };
}

async function createSavedOrderWithAutoCharge(
  flows: ScenarioDependencies,
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: OrderPriceSummary;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const orderDishesPage = await enterDineInNoTableOrder(flows, readyHomePage);
  await flows.orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  const beforeSummary = await orderDishesPage.reads.readPriceSummary();
  const beforeChargeSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
  const recallPage = await saveEditingOrderAndOpenRecall(
    flows,
    orderDishesPage,
    employeeLoginPage,
  );
  const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);

  return { beforeChargeSnapshot, beforeSummary, orderNumber, recallPage };
}

async function createSavedOrderWithApiAutoCharge(
  flows: ScenarioDependencies,
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderApi: OrderApiClient,
  chargeResource: { id: string | number; name: string },
  charge: ChargeSetupOverrides,
  options: { dishCount?: number } = {},
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: OrderPriceSummary;
  orderId: number;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const responseBody = await expectOkEnvelope(
    await orderApi.saveOrder(
      buildDineInOrderWithWholeChargeRequest(
        chargeResource,
        charge,
        options.dishCount ?? 1,
      ),
    ),
  );
  const orderNumber = extractSavedOrderNumber(responseBody.data);
  const orderId = extractSavedOrderId(responseBody.data);
  const editingPage = await editSavedOrderAfterConfigurationRefresh(
    flows,
    readyHomePage,
    employeeLoginPage,
    orderNumber,
  );
  const beforeSummary = await editingPage.reads.readPriceSummary();
  const beforeChargeSnapshot = await readOrderDishesChargeSnapshot(editingPage);
  const recallPage = await openRecallAfterConfigurationRefresh(flows, readyHomePage, employeeLoginPage);

  return { beforeChargeSnapshot, beforeSummary, orderId, orderNumber, recallPage };
}

async function createSavedDeliveryOrder(
  flows: ScenarioDependencies,
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: OrderPriceSummary;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const orderDishesPage = await flows.takeoutFlow.startDeliveryOrder(
    readyHomePage,
    orderServiceCustomers.delivery,
  );
  await flows.orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  const beforeSummary = await orderDishesPage.reads.readPriceSummary();
  const beforeChargeSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
  const recallPage = await saveEditingOrderAndOpenRecall(
    flows,
    orderDishesPage,
    employeeLoginPage,
  );
  const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);

  return { beforeChargeSnapshot, beforeSummary, orderNumber, recallPage };
}

async function combineSavedOrdersAfterConfigurationRefresh(
  flows: ScenarioDependencies,
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  primaryOrderNumber: string,
  secondaryOrderNumber: string,
): Promise<RecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(
    flows,
    homePage,
    employeeLoginPage,
  );
  await flows.recallFlow.combineOrders(
    recallPage,
    primaryOrderNumber,
    secondaryOrderNumber,
  );
  return recallPage;
}

async function readTransferredOrderChargeAmount(
  recallPage: RecallPage,
  chargeName: string,
  orderNumber?: string,
): Promise<{
  amount: number | null;
  hasNamedCharge: boolean;
  namedChargeCount: number;
  summary: Record<string, number> | null;
}> {
  if (orderNumber) {
    await recallPage.orderDetails.openOrderDetails(orderNumber);
  }

  const summary = await recallPage.orderDetails.readDisplayedOrderPriceSummary();
  const detailsText = await recallPage.orderDetails.readOrderDetailsText();
  const namedChargeAmount = readChargeAmountFromDetailsText(detailsText, chargeName);
  const namedChargeCount =
    detailsText.match(new RegExp(escapeRegExp(chargeName), 'g'))?.length ?? 0;

  return {
    amount:
      namedChargeAmount ??
      (orderNumber ? summary.Charge ?? summary.Total ?? summary['Total(Cash)'] ?? null : null),
    hasNamedCharge: namedChargeAmount !== null,
    namedChargeCount,
    summary,
  };
}

async function createSavedOrderWithApiCharges(
  flows: ScenarioDependencies,
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderApi: OrderApiClient,
  chargeSeeds: readonly ApiWholeChargeSeed[],
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: OrderPriceSummary;
  orderId: number;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const responseBody = await expectOkEnvelope(
    await orderApi.saveOrder(
      buildDineInOrderWithWholeChargesRequest(chargeSeeds),
    ),
  );
  const orderNumber = extractSavedOrderNumber(responseBody.data);
  const orderId = extractSavedOrderId(responseBody.data);
  const editingPage = await editSavedOrderAfterConfigurationRefresh(
    flows,
    readyHomePage,
    employeeLoginPage,
    orderNumber,
  );
  const beforeSummary = await editingPage.reads.readPriceSummary();
  const beforeChargeSnapshot =
    await readOrderDishesChargeSnapshot(editingPage);
  const recallPage = await openRecallAfterConfigurationRefresh(
    flows,
    readyHomePage,
    employeeLoginPage,
  );

  return {
    beforeChargeSnapshot,
    beforeSummary,
    orderId,
    orderNumber,
    recallPage,
  };
}

async function configureCombineChargeRecalculation(
  flows: ScenarioDependencies,
  enabled: boolean,
  homePage: HomePage,
): Promise<() => Promise<void>> {
  const restore =
    await flows.configurationResources.updateByNameWithRestore(
    'RECALCULATE_CHARGE_WHEN_COMBINE_ORDERS',
    enabled,
    { verify: true },
  );
  await homePage.clickRefresh();
  await homePage.confirmDelayedConfigurationRefresh();
  return restore;
}

async function configureTaxIncludesCharge(
  flows: ScenarioDependencies,
  enabled: boolean,
  homePage: HomePage,
): Promise<() => Promise<void>> {
  const restore =
    await flows.configurationResources.updateByNameWithRestore(
      'CHARGE_CALCULATION_INCLUDE_TAX',
      enabled,
      { verify: true },
    );
  await homePage.clickRefresh();
  await homePage.confirmDelayedConfigurationRefresh();
  return restore;
}

async function readOrderDishesChargeSnapshot(
  orderDishesPage: OrderDishesPage,
): Promise<OrderChargeSnapshot> {
  await orderDishesPage.charge.clickCharge();
  const snapshot = await orderDishesPage.charge.readChargeSnapshot();
  await orderDishesPage.charge.closeChargeDialog();
  return snapshot;
}

async function reopenSavedOrderForChargeCheck(
  flows: ScenarioDependencies,
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
): Promise<{
  chargeSnapshot: OrderChargeSnapshot;
  summary: OrderPriceSummary;
}> {
  const refreshedHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
  await refreshedHomePage.clickRefresh();
  await refreshedHomePage.confirmDelayedConfigurationRefresh();
  const recallPage = await refreshedHomePage.clickRecall();
  const editingPage = await flows.recallFlow.editOrder(recallPage, orderNumber);
  const summary = await editingPage.reads.readPriceSummary();
  const chargeSnapshot = await readOrderDishesChargeSnapshot(editingPage);

  return { chargeSnapshot, summary };
}

async function openRecallAfterConfigurationRefresh(
  flows: ScenarioDependencies,
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<RecallPage> {
  const refreshedHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
  await refreshedHomePage.clickRefresh();
  await refreshedHomePage.confirmDelayedConfigurationRefresh();
  return await refreshedHomePage.clickRecall();
}

async function editSavedOrderAfterConfigurationRefresh(
  flows: ScenarioDependencies,
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
): Promise<OrderDishesPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(
    flows,
    homePage,
    employeeLoginPage,
  );
  return await flows.recallFlow.editOrder(recallPage, orderNumber);
}

async function saveEditingOrderAndOpenRecall(
  flows: ScenarioDependencies,
  orderDishesPage: OrderDishesPage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<RecallPage> {
  const savedHomePage = await orderDishesPage.navigation.saveOrder();
  const readyHomePage = await flows.employeeLoginFlow.enterEmployeeContext(
    savedHomePage,
    employeeLoginPage,
  );
  return await flows.recallFlow.openRecallFromHome(readyHomePage);
}

async function sendEditingOrderAndOpenRecall(
  flows: ScenarioDependencies,
  orderDishesPage: OrderDishesPage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<RecallPage> {
  const returnedHomePage = await orderDishesPage.navigation.sendOrder();
  return await openRecallAfterConfigurationRefresh(
    flows,
    returnedHomePage,
    employeeLoginPage,
  );
}

export class SplitOrderScenarioFlow {
  private readonly dependencies: ScenarioDependencies;

  constructor(
    configurationResources: ScenarioDependencies['configurationResources'],
    employeeLoginFlow: EmployeeLoginFlow,
    orderDishesFlow: OrderDishesFlow,
    orderRegressionFlow: OrderRegressionFlow,
    recallFlow: RecallFlow,
    selectTableFlow: SelectTableFlow,
    takeoutFlow: TakeoutFlow,
  ) {
    this.dependencies = {
      configurationResources,
      employeeLoginFlow,
      orderDishesFlow,
      orderRegressionFlow,
      recallFlow,
      selectTableFlow,
      takeoutFlow,
    };
  }

  @step('业务流程：进入堂食无桌点单页')
  async enterDineInNoTableOrder(
    ...args: Tail<Parameters<typeof enterDineInNoTableOrder>>
  ): Promise<Awaited<ReturnType<typeof enterDineInNoTableOrder>>> {
    return await enterDineInNoTableOrder(this.dependencies, ...args);
  }

  @step('业务流程：读取目标子单加收金额')
  async readTargetCharge(
    ...args: Parameters<typeof readTargetCharge>
  ): Promise<Awaited<ReturnType<typeof readTargetCharge>>> {
    return await readTargetCharge(...args);
  }

  @step('业务流程：读取目标子单价格汇总')
  async readTargetPriceSummary(
    ...args: Parameters<typeof readTargetPriceSummary>
  ): Promise<Awaited<ReturnType<typeof readTargetPriceSummary>>> {
    return await readTargetPriceSummary(...args);
  }

  @step('业务流程：打开最新分单订单并读取子单目标')
  async openLatestSplitOrderTargets(
    ...args: Tail<Parameters<typeof openLatestSplitOrderTargets>>
  ): Promise<Awaited<ReturnType<typeof openLatestSplitOrderTargets>>> {
    return await openLatestSplitOrderTargets(this.dependencies, ...args);
  }

  @step('业务流程：创建已保存订单并进入 Recall')
  async createSavedRecallOrder(
    ...args: Tail<Parameters<typeof createSavedRecallOrder>>
  ): Promise<Awaited<ReturnType<typeof createSavedRecallOrder>>> {
    return await createSavedRecallOrder(this.dependencies, ...args);
  }

  @step('业务流程：创建并登记测试加收配置')
  async createChargeSetup(
    ...args: Parameters<typeof createChargeSetup>
  ): Promise<Awaited<ReturnType<typeof createChargeSetup>>> {
    return await createChargeSetup(...args);
  }

  @step('业务流程：创建带手动加收的已保存订单')
  async createSavedOrderWithManualCharge(
    ...args: Tail<Parameters<typeof createSavedOrderWithManualCharge>>
  ): Promise<Awaited<ReturnType<typeof createSavedOrderWithManualCharge>>> {
    return await createSavedOrderWithManualCharge(this.dependencies, ...args);
  }

  @step('业务流程：创建带自动加收的已保存订单')
  async createSavedOrderWithAutoCharge(
    ...args: Tail<Parameters<typeof createSavedOrderWithAutoCharge>>
  ): Promise<Awaited<ReturnType<typeof createSavedOrderWithAutoCharge>>> {
    return await createSavedOrderWithAutoCharge(this.dependencies, ...args);
  }

  @step('业务流程：通过 API 创建带自动加收的已保存订单')
  async createSavedOrderWithApiAutoCharge(
    ...args: Tail<Parameters<typeof createSavedOrderWithApiAutoCharge>>
  ): Promise<Awaited<ReturnType<typeof createSavedOrderWithApiAutoCharge>>> {
    return await createSavedOrderWithApiAutoCharge(this.dependencies, ...args);
  }

  @step('业务流程：通过 API 创建带多条加收的已保存订单')
  async createSavedOrderWithApiCharges(
    ...args: Tail<Parameters<typeof createSavedOrderWithApiCharges>>
  ): Promise<Awaited<ReturnType<typeof createSavedOrderWithApiCharges>>> {
    return await createSavedOrderWithApiCharges(this.dependencies, ...args);
  }

  @step('业务流程：创建已保存 Delivery 订单')
  async createSavedDeliveryOrder(
    ...args: Tail<Parameters<typeof createSavedDeliveryOrder>>
  ): Promise<Awaited<ReturnType<typeof createSavedDeliveryOrder>>> {
    return await createSavedDeliveryOrder(this.dependencies, ...args);
  }

  @step('业务流程：配置刷新后合并已保存订单')
  async combineSavedOrdersAfterConfigurationRefresh(
    ...args: Tail<
      Parameters<typeof combineSavedOrdersAfterConfigurationRefresh>
    >
  ): Promise<
    Awaited<ReturnType<typeof combineSavedOrdersAfterConfigurationRefresh>>
  > {
    return await combineSavedOrdersAfterConfigurationRefresh(
      this.dependencies,
      ...args
    );
  }

  @step('业务流程：读取转移后订单加收金额')
  async readTransferredOrderChargeAmount(
    ...args: Parameters<typeof readTransferredOrderChargeAmount>
  ): Promise<Awaited<ReturnType<typeof readTransferredOrderChargeAmount>>> {
    return await readTransferredOrderChargeAmount(...args);
  }

  @step('业务流程：配置合单加收重算策略')
  async configureCombineChargeRecalculation(
    ...args: Tail<Parameters<typeof configureCombineChargeRecalculation>>
  ): Promise<Awaited<ReturnType<typeof configureCombineChargeRecalculation>>> {
    return await configureCombineChargeRecalculation(
      this.dependencies,
      ...args
    );
  }

  @step('业务流程：配置税额是否计入加收计算')
  async configureTaxIncludesCharge(
    ...args: Tail<Parameters<typeof configureTaxIncludesCharge>>
  ): Promise<Awaited<ReturnType<typeof configureTaxIncludesCharge>>> {
    return await configureTaxIncludesCharge(this.dependencies, ...args);
  }

  @step('业务流程：读取点单页加收快照')
  async readOrderDishesChargeSnapshot(
    ...args: Parameters<typeof readOrderDishesChargeSnapshot>
  ): Promise<Awaited<ReturnType<typeof readOrderDishesChargeSnapshot>>> {
    return await readOrderDishesChargeSnapshot(...args);
  }

  @step('业务流程：重新打开已保存订单校验加收')
  async reopenSavedOrderForChargeCheck(
    ...args: Tail<Parameters<typeof reopenSavedOrderForChargeCheck>>
  ): Promise<Awaited<ReturnType<typeof reopenSavedOrderForChargeCheck>>> {
    return await reopenSavedOrderForChargeCheck(this.dependencies, ...args);
  }

  @step('业务流程：配置刷新后打开 Recall')
  async openRecallAfterConfigurationRefresh(
    ...args: Tail<Parameters<typeof openRecallAfterConfigurationRefresh>>
  ): Promise<Awaited<ReturnType<typeof openRecallAfterConfigurationRefresh>>> {
    return await openRecallAfterConfigurationRefresh(
      this.dependencies,
      ...args
    );
  }

  @step('业务流程：配置刷新后编辑已保存订单')
  async editSavedOrderAfterConfigurationRefresh(
    ...args: Tail<Parameters<typeof editSavedOrderAfterConfigurationRefresh>>
  ): Promise<
    Awaited<ReturnType<typeof editSavedOrderAfterConfigurationRefresh>>
  > {
    return await editSavedOrderAfterConfigurationRefresh(
      this.dependencies,
      ...args
    );
  }

  @step('业务流程：保存编辑订单并打开 Recall')
  async saveEditingOrderAndOpenRecall(
    ...args: Tail<Parameters<typeof saveEditingOrderAndOpenRecall>>
  ): Promise<Awaited<ReturnType<typeof saveEditingOrderAndOpenRecall>>> {
    return await saveEditingOrderAndOpenRecall(this.dependencies, ...args);
  }

  @step('业务流程：送厨编辑订单并打开 Recall')
  async sendEditingOrderAndOpenRecall(
    ...args: Tail<Parameters<typeof sendEditingOrderAndOpenRecall>>
  ): Promise<Awaited<ReturnType<typeof sendEditingOrderAndOpenRecall>>> {
    return await sendEditingOrderAndOpenRecall(this.dependencies, ...args);
  }
}

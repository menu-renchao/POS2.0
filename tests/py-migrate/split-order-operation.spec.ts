import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { TakeoutFlow } from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';
import type { ApiSetup } from '../../api/setup/api-setup';
import type { OrderApiClient } from '../../api/clients/order-api.client';
import type { SystemConfigurationApiClient } from '../../api/clients/system-configuration-api.client';
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
import type { OrderDishesPage } from '../../pages/order-dishes.page';
import type { RecallPage } from '../../pages/recall.page';
import type { OrderChargeSnapshot } from '../../pages/order-dishes/order-dishes.types';
import type { ChargeSetupOverrides } from '../../test-data/api/admin-config-api-data';
import {
  orderServiceCustomers,
  orderServiceDishes,
  orderServiceSeatDisplayConfigurationUpdate,
  orderServiceSplitOperationCase,
} from '../../test-data/order-service';
import { expectOkEnvelope } from '../../api/setup/setup-resource';
import { jiraIssueAnnotation } from '../../utils/jira';

type AppEntryPages = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
};

type SplitOrderTargets = {
  orderNumber: string;
  firstTargetOrderNumber: string;
  secondTargetOrderNumber: string;
};

type SplitOrderTargetsWithRecallPage = SplitOrderTargets & {
  recallPage: RecallPage;
};

type ChargeExpectedAmount = '5.00' | '10.00' | '20.00' | 'percent10' | 'percent20';

type ChargeEditCase = {
  issue: `POS-${number}`;
  title: string;
  initialCharge: ChargeSetupOverrides;
  updateCharge?: ChargeSetupOverrides;
  deleteCharge?: boolean;
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
  expectedChargeAvailable: boolean;
  expectedTaxIncreases?: boolean;
};

type ChargeFollowUpOperation =
  | 'detail-send'
  | 'edit-send'
  | 'edit-save'
  | 'detail-even-split'
  | 'edit-item-split'
  | 'edit-even-split';

type ChargeFollowUpCase = {
  issue: `POS-${number}`;
  title: string;
  initialCharge: ChargeSetupOverrides;
  source: 'manual' | 'auto';
  operation: ChargeFollowUpOperation;
  updateCharge: ChargeSetupOverrides;
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
};

type ChargeCopySource = 'auto' | 'manual' | 'delivery-auto';

type ChargeCopyCase = {
  issue: `POS-${number}`;
  title: string;
  initialCharge: ChargeSetupOverrides;
  source: ChargeCopySource;
  updateCharge: ChargeSetupOverrides;
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
  expectedChargeAvailable: boolean;
};

type ChargeTransferOperation =
  | 'move-item-new-order'
  | 'move-item-existing-order'
  | 'move-whole-order-after-update'
  | 'move-whole-order-after-delete';

type ChargeTransferCase = {
  issue: `POS-${number}`;
  title: string;
  initialCharge: ChargeSetupOverrides;
  source: 'manual' | 'auto';
  operation: ChargeTransferOperation;
  updateCharge?: ChargeSetupOverrides;
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
  expectedTargetChargeAvailable: boolean;
};

type CombineChargeScenario = 'single-auto' | 'single-manual' | 'no-existing-charge' | 'three-charges';

type CombineChargeRecalculationCase = {
  issue: `POS-${number}`;
  title: string;
  recalculate: boolean;
  scenario: CombineChargeScenario;
  charge: ChargeSetupOverrides;
  firstOrderType: 'dine-in' | 'delivery';
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
  expectedChargeAvailable: boolean;
  expectsTipUnchanged?: boolean;
};

const manualFixedChargeName = 'manu_test_fixed';
const manualPercentChargeName = 'manu_test_perc';

const manualFixedCharge: ChargeSetupOverrides = {
  name: manualFixedChargeName,
  rate: 10,
  rateType: 1,
  triggerMode: 2,
  taxed: false,
  type: 'DEFAULT',
};

const manualPercentCharge: ChargeSetupOverrides = {
  name: manualPercentChargeName,
  rate: 10,
  rateType: 2,
  triggerMode: 2,
  taxed: false,
  type: 'DEFAULT',
};

const manualChargeEditCases: readonly ChargeEditCase[] = [
  {
    issue: 'POS-27156',
    title: '[POS-27156] 应能在编辑已保存订单时识别手动加收改名后的配置',
    initialCharge: manualFixedCharge,
    updateCharge: { ...manualFixedCharge, name: 'mod_test1' },
    expectedChargeName: 'mod_test1',
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27157',
    title: '[POS-27157] 应能在编辑已保存订单时识别手动加收由固定金额改为百分比',
    initialCharge: manualFixedCharge,
    updateCharge: { ...manualFixedCharge, rateType: 2 },
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27158',
    title: '[POS-27158] 应能在编辑已保存订单时识别手动加收由百分比改为固定金额',
    initialCharge: manualPercentCharge,
    updateCharge: { ...manualPercentCharge, rateType: 1 },
    expectedChargeName: manualPercentChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27159',
    title: '[POS-27159] 应能在编辑已保存订单时识别手动固定金额加收改值',
    initialCharge: manualFixedCharge,
    updateCharge: { ...manualFixedCharge, rate: 20 },
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '20.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27160',
    title: '[POS-27160] 应能在编辑已保存订单时识别手动百分比加收改值',
    initialCharge: manualPercentCharge,
    updateCharge: { ...manualPercentCharge, rate: 20 },
    expectedChargeName: manualPercentChargeName,
    expectedChargeAmount: 'percent20',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27163',
    title: '[POS-27163] 应能在编辑已保存订单时识别手动加收改为计税',
    initialCharge: manualFixedCharge,
    updateCharge: { ...manualFixedCharge, taxed: true },
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
    expectedTaxIncreases: true,
  },
  {
    issue: 'POS-27164',
    title: '[POS-27164] 应能在编辑已保存订单时保留满足订单类型条件的手动加收',
    initialCharge: manualFixedCharge,
    updateCharge: { ...manualFixedCharge, orderType: 'dine in,delivery' },
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27165',
    title: '[POS-27165] 应能在编辑已保存订单时隐藏不满足订单类型条件的手动加收',
    initialCharge: manualFixedCharge,
    updateCharge: { ...manualFixedCharge, orderType: 'delivery' },
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: false,
  },
  {
    issue: 'POS-27169',
    title: '[POS-27169] 应能在编辑已保存订单时保留已删除手动加收的历史金额',
    initialCharge: manualFixedCharge,
    deleteCharge: true,
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
];

const autoFixedChargeName = 'auto_test_fixed';
const autoPercentChargeName = 'auto_test_perc';

const autoFixedCharge: ChargeSetupOverrides = {
  name: autoFixedChargeName,
  rate: 10,
  rateType: 1,
  triggerMode: 1,
  taxed: false,
  type: 'DEFAULT',
};

const autoPercentCharge: ChargeSetupOverrides = {
  name: autoPercentChargeName,
  rate: 10,
  rateType: 2,
  triggerMode: 1,
  taxed: false,
  type: 'DEFAULT',
};

const autoChargeEditCases: readonly ChargeEditCase[] = [
  {
    issue: 'POS-27170',
    title: '[POS-27170] 应能在编辑已保存订单时识别自动加收改名后的配置',
    initialCharge: autoFixedCharge,
    updateCharge: { ...autoFixedCharge, name: 'new_name_auto' },
    expectedChargeName: 'new_name_auto',
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27171',
    title: '[POS-27171] 应能在编辑已保存订单时识别自动加收由固定金额改为百分比',
    initialCharge: autoFixedCharge,
    updateCharge: { ...autoFixedCharge, rateType: 2 },
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27172',
    title: '[POS-27172] 应能在编辑已保存订单时识别自动加收由百分比改为固定金额',
    initialCharge: autoPercentCharge,
    updateCharge: { ...autoPercentCharge, rateType: 1 },
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27173',
    title: '[POS-27173] 应能在编辑已保存订单时识别自动固定金额加收改值',
    initialCharge: autoFixedCharge,
    updateCharge: { ...autoFixedCharge, rate: 20 },
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: '20.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27174',
    title: '[POS-27174] 应能在编辑已保存订单时识别自动百分比加收改值',
    initialCharge: autoPercentCharge,
    updateCharge: { ...autoPercentCharge, rate: 20 },
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: 'percent20',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27176',
    title: '[POS-27176] 应能在编辑已保存订单时隐藏类型不满足条件的自动加收',
    initialCharge: autoFixedCharge,
    updateCharge: { ...autoFixedCharge, type: 'DELIVERY' },
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: false,
  },
  {
    issue: 'POS-27177',
    title: '[POS-27177] 应能在编辑已保存订单时识别自动加收改为计税',
    initialCharge: autoFixedCharge,
    updateCharge: { ...autoFixedCharge, taxed: true },
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
    expectedTaxIncreases: true,
  },
  {
    issue: 'POS-27182',
    title: '[POS-27182] 应能在编辑已保存订单时移除已删除的自动加收',
    initialCharge: autoFixedCharge,
    deleteCharge: true,
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: false,
  },
];

const chargeFollowUpCases: readonly ChargeFollowUpCase[] = [
  {
    issue: 'POS-27190',
    title: '[POS-27190] 应能在自动加收配置修改后从详情页送厨并保留原加收金额',
    initialCharge: { ...autoFixedCharge, orderType: 'dine in' },
    source: 'auto',
    operation: 'detail-send',
    updateCharge: { ...autoFixedCharge, name: 'new_name_auto', orderType: 'dine in' },
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: '10.00',
  },
  {
    issue: 'POS-27191',
    title: '[POS-27191] 应能在手动加收配置修改后从编辑页送厨并保留原加收金额',
    initialCharge: manualFixedCharge,
    source: 'manual',
    operation: 'edit-send',
    updateCharge: { ...manualFixedCharge, name: 'new_name_manu' },
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '10.00',
  },
  {
    issue: 'POS-27192',
    title: '[POS-27192] 应能在自动加收配置修改后从编辑页保存并使用新加收金额',
    initialCharge: autoFixedCharge,
    source: 'auto',
    operation: 'edit-save',
    updateCharge: { ...autoFixedCharge, name: 'new_name_auto', rate: 20 },
    expectedChargeName: 'new_name_auto',
    expectedChargeAmount: '20.00',
  },
  {
    issue: 'POS-27229',
    title: '[POS-27229] 应能在自动加收配置修改后从详情页分单并按子单分摊加收',
    initialCharge: autoFixedCharge,
    source: 'auto',
    operation: 'detail-even-split',
    updateCharge: { ...autoFixedCharge, name: 'new_name_auto' },
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: '5.00',
  },
  {
    issue: 'POS-27242',
    title: '[POS-27242] 应能在手动加收配置修改后从编辑页按菜品分单并按子单分摊加收',
    initialCharge: manualFixedCharge,
    source: 'manual',
    operation: 'edit-item-split',
    updateCharge: { ...manualFixedCharge, name: 'new_name_manu' },
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '5.00',
  },
  {
    issue: 'POS-27248',
    title: '[POS-27248] 应能在自动加收配置修改后从编辑页平分订单并使用新加收名称',
    initialCharge: { ...autoFixedCharge, name: 'auto_test1', orderType: 'dine in' },
    source: 'auto',
    operation: 'edit-even-split',
    updateCharge: { ...autoFixedCharge, name: 'mod_test1', orderType: 'dine in' },
    expectedChargeName: 'mod_test1',
    expectedChargeAmount: '10.00',
  },
];

const copyAutoChargeName = 'auto_test1';

const copyAutoFixedCharge: ChargeSetupOverrides = {
  name: copyAutoChargeName,
  rate: 10,
  rateType: 1,
  triggerMode: 1,
  taxed: false,
  type: 'DEFAULT',
};

const chargeCopyCases: readonly ChargeCopyCase[] = [
  {
    issue: 'POS-27257',
    title: '[POS-27257] 应能在复制订单时使用自动加收修改名称和金额后的新配置',
    initialCharge: copyAutoFixedCharge,
    source: 'auto',
    updateCharge: { ...copyAutoFixedCharge, name: 'mod_test1', rate: 20, rateType: 2 },
    expectedChargeName: 'mod_test1',
    expectedChargeAmount: 'percent20',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27258',
    title: '[POS-27258] 应能在复制订单时保留满足人数条件的自动加收',
    initialCharge: copyAutoFixedCharge,
    source: 'auto',
    updateCharge: { ...copyAutoFixedCharge, minGuest: 1 },
    expectedChargeName: copyAutoChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27259',
    title: '[POS-27259] 应能在复制订单时移除不满足人数条件的自动加收',
    initialCharge: copyAutoFixedCharge,
    source: 'auto',
    updateCharge: { ...copyAutoFixedCharge, minGuest: 2 },
    expectedChargeName: copyAutoChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: false,
  },
  {
    issue: 'POS-27271',
    title: '[POS-27271] 应能在复制 Delivery 订单时移除不满足里程条件的自动加收',
    initialCharge: { ...copyAutoFixedCharge, type: 'DELIVERY' },
    source: 'delivery-auto',
    updateCharge: { ...copyAutoFixedCharge, minMileage: 999, type: 'DELIVERY' },
    expectedChargeName: copyAutoChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: false,
  },
  {
    issue: 'POS-27286',
    title: '[POS-27286] 应能在复制订单时移除已改为手动触发的自动加收',
    initialCharge: copyAutoFixedCharge,
    source: 'auto',
    updateCharge: { ...copyAutoFixedCharge, triggerMode: 2 },
    expectedChargeName: copyAutoChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: false,
  },
  {
    issue: 'POS-27287',
    title: '[POS-27287] 应能在复制订单时保留已改为自动触发的手动加收',
    initialCharge: manualFixedCharge,
    source: 'manual',
    updateCharge: { ...manualFixedCharge, triggerMode: 1 },
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-27288',
    title: '[POS-27288] 应能在复制订单时移除改为自动触发但不满足订单类型的手动加收',
    initialCharge: manualFixedCharge,
    source: 'manual',
    updateCharge: { ...manualFixedCharge, orderType: 'delivery', triggerMode: 1 },
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: false,
  },
];

const chargeTransferCases: readonly ChargeTransferCase[] = [
  {
    issue: 'POS-27314',
    title: '[POS-27314] 应能在修改自动加收后移菜并保留目标订单原加收',
    initialCharge: copyAutoFixedCharge,
    source: 'auto',
    operation: 'move-item-new-order',
    updateCharge: { ...copyAutoFixedCharge, name: 'mod_test1' },
    expectedChargeName: copyAutoChargeName,
    expectedChargeAmount: '10.00',
    expectedTargetChargeAvailable: true,
  },
  {
    issue: 'POS-27317',
    title: '[POS-27317] 应能将菜品移动到已有手动加收订单并保持加收明细',
    initialCharge: manualFixedCharge,
    source: 'manual',
    operation: 'move-item-existing-order',
    expectedChargeName: manualFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedTargetChargeAvailable: true,
  },
  {
    issue: 'POS-27324',
    title: '[POS-27324] 应能在修改自动加收后移单并保留原加收金额',
    initialCharge: autoFixedCharge,
    source: 'auto',
    operation: 'move-whole-order-after-update',
    updateCharge: { ...autoFixedCharge, name: 'new_name_auto' },
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedTargetChargeAvailable: true,
  },
  {
    issue: 'POS-27325',
    title: '[POS-27325] 应能在删除自动加收后移单并保留原加收金额',
    initialCharge: autoFixedCharge,
    source: 'auto',
    operation: 'move-whole-order-after-delete',
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedTargetChargeAvailable: true,
  },
];

const combineChargeRecalculationCases: readonly CombineChargeRecalculationCase[] = [
  {
    issue: 'POS-32002',
    title: '[POS-32002] 应能在合单不重新计算加收时保留计税固定金额自动加收',
    recalculate: false,
    scenario: 'single-auto',
    charge: { ...autoFixedCharge, taxed: true, type: 'SERVICE' },
    firstOrderType: 'dine-in',
    expectedChargeName: autoFixedChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-32004',
    title: '[POS-32004] 应能在合单不重新计算加收时保留计小费百分比手动加收',
    recalculate: false,
    scenario: 'single-manual',
    charge: { ...manualPercentCharge, sharedTip: true, type: 'SERVICE' },
    firstOrderType: 'dine-in',
    expectedChargeName: manualPercentChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: true,
    expectsTipUnchanged: true,
  },
  {
    issue: 'POS-32006',
    title: '[POS-32006] 应能在合单不重新计算加收时不自动新增满足人数条件的服务加收',
    recalculate: false,
    scenario: 'no-existing-charge',
    charge: { ...autoPercentCharge, minGuest: 2, type: 'SERVICE' },
    firstOrderType: 'dine-in',
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: false,
  },
  {
    issue: 'POS-32008',
    title: '[POS-32008] 应能在合单不重新计算加收时累加三类历史加收',
    recalculate: false,
    scenario: 'three-charges',
    charge: { ...autoFixedCharge, name: 'auto_test1', orderType: 'dine in' },
    firstOrderType: 'dine-in',
    expectedChargeName: 'auto_test1',
    expectedChargeAmount: '20.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-32016',
    title: '[POS-32016] 应能在合单重新计算加收时按合单后金额计算满足条件的 Delivery 加收',
    recalculate: true,
    scenario: 'single-auto',
    charge: { ...autoPercentCharge, sharedTip: true, type: 'DELIVERY' },
    firstOrderType: 'delivery',
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: true,
    expectsTipUnchanged: true,
  },
  {
    issue: 'POS-32017',
    title: '[POS-32017] 应能在合单重新计算加收时移除不满足条件的 Delivery 加收',
    recalculate: true,
    scenario: 'single-auto',
    charge: { ...autoPercentCharge, minMileage: 999, sharedTip: true, type: 'DELIVERY' },
    firstOrderType: 'delivery',
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: false,
    expectsTipUnchanged: true,
  },
  {
    issue: 'POS-32006',
    title: '[POS-32006] 应能在合单重新计算加收时自动新增满足人数条件的服务加收',
    recalculate: true,
    scenario: 'no-existing-charge',
    charge: { ...autoPercentCharge, minGuest: 2, type: 'SERVICE' },
    firstOrderType: 'dine-in',
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-32023',
    title: '[POS-32023] 应能在合单重新计算加收时保留计小费百分比手动加收',
    recalculate: true,
    scenario: 'single-manual',
    charge: { ...manualPercentCharge, name: autoPercentChargeName, sharedTip: true, type: 'SERVICE' },
    firstOrderType: 'dine-in',
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: true,
    expectsTipUnchanged: true,
  },
  {
    issue: 'POS-32031',
    title: '[POS-32031] 应能在合单重新计算加收时正确计算三类加收金额',
    recalculate: true,
    scenario: 'three-charges',
    charge: { ...autoFixedCharge, name: 'auto_test1', orderType: 'dine in' },
    firstOrderType: 'dine-in',
    expectedChargeName: 'auto_test1',
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: true,
  },
];

async function enterReadyHome({
  employeeLoginPage,
  homePage,
}: AppEntryPages): Promise<HomePage> {
  const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
  await readyHomePage.expectPrimaryFunctionCardsVisible();
  return readyHomePage;
}

async function enterDineInNoTableOrder(homePage: HomePage): Promise<OrderDishesPage> {
  const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(homePage);
  await orderDishesPage.expectLoaded();
  return orderDishesPage;
}

async function enableSeatDisplayOnHome(
  systemConfigurationApi: SystemConfigurationApiClient,
  homePage: HomePage,
): Promise<void> {
  await expectOkEnvelope(
    await systemConfigurationApi.updateSystemConfigurations(
      orderServiceSeatDisplayConfigurationUpdate,
    ),
  );
  await homePage.clickRefresh();
}

async function addTwoRegularDishes(orderDishesPage: OrderDishesPage): Promise<void> {
  const orderDishesFlow = new OrderDishesFlow();
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.test.name,
    orderServiceDishes.test.menu,
  );
}

async function addSharedAndSeatDishes(orderDishesPage: OrderDishesPage): Promise<void> {
  const orderDishesFlow = new OrderDishesFlow();
  await orderDishesPage.changeGuestCount(2);
  await orderDishesPage.selectSharedSeat();
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await orderDishesPage.selectSeat(1);
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.test.name,
    orderServiceDishes.test.menu,
  );
}

async function createSeatSplitRecallOrder(
  readyHomePage: HomePage,
  options: { addTip?: boolean; tipAmountInCents?: number } = {},
): Promise<{ recallPage: RecallPage; targets: SplitOrderTargets }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await addSharedAndSeatDishes(orderDishesPage);

  if (options.addTip || options.tipAmountInCents !== undefined) {
    await orderDishesPage.addTip(
      options.tipAmountInCents ?? orderServiceSplitOperationCase.tipAmountInCents,
    );
  }

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  await new SplitOrderFlow().splitOrderBySeats(splitOrderPage);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);
  return { recallPage, targets };
}

async function createAmountSplitRecallOrder(
  readyHomePage: HomePage,
): Promise<{ recallPage: RecallPage; targets: SplitOrderTargets }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await addTwoRegularDishes(orderDishesPage);
  await orderDishesPage.addTip(orderServiceSplitOperationCase.tipAmountInCents);

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  const beforeSplitSnapshot = await splitOrderPage.readSnapshot();
  const totalBeforeSplit = Number(beforeSplitSnapshot.total);
  expect(totalBeforeSplit, '按金额分单前应能读取订单总额。').toBeGreaterThan(0);

  const firstAmount = orderServiceSplitOperationCase.amountSplitFirstAmount;
  const secondAmount = Number((totalBeforeSplit - firstAmount).toFixed(2));
  await new SplitOrderFlow().splitOrderByAmounts(splitOrderPage, [firstAmount, secondAmount]);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);
  return { recallPage, targets };
}

async function createEvenSplitRecallOrder(
  readyHomePage: HomePage,
): Promise<{ recallPage: RecallPage; targets: SplitOrderTargets }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await addTwoRegularDishes(orderDishesPage);
  await orderDishesPage.addTip(orderServiceSplitOperationCase.tipAmountInCents);

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);
  return { recallPage, targets };
}

async function createToGoEvenSplitRecallOrder(
  readyHomePage: HomePage,
): Promise<{ recallPage: RecallPage; targets: SplitOrderTargets }> {
  const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);
  return { recallPage, targets };
}

async function enterRecallFromReturnedPage(
  returnedPage: HomePage | OrderDishesPage | RecallPage,
): Promise<RecallPage> {
  if ('openOrderDetails' in returnedPage) {
    return returnedPage;
  }

  return await returnedPage.clickRecall();
}

async function readTargetTips(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<number> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();
  return priceSummary.Tips ?? 0;
}

async function readTargetTotal(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<number> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();
  return priceSummary.Total ?? priceSummary['Total(Cash)'] ?? 0;
}

async function readTargetCharge(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<number> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();
  const charge = priceSummary.Charge ?? 0;
  await recallPage.closeOrderDetailsDialog();
  return charge;
}

async function readRecallOrderTotal(
  recallPage: RecallPage,
  orderNumber: string,
): Promise<number> {
  await recallPage.openOrderDetails(orderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();
  const total = priceSummary.Total ?? priceSummary['Total(Cash)'] ?? 0;
  await recallPage.closeOrderDetailsDialog();
  return total;
}

async function openLatestSplitOrderTargets(recallPage: RecallPage): Promise<SplitOrderTargets> {
  const recallFlow = new RecallFlow();
  const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
  await recallPage.openOrderDetails(orderNumber);
  const targetOrderNumbers = await recallPage.readTargetOrderNumbers(orderNumber);

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

async function createMultiAmountSplitRecallOrder(
  readyHomePage: HomePage,
): Promise<{
  beforeTotal: number;
  recallPage: RecallPage;
  targets: SplitOrderTargets;
}> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await orderDishesPage.changeOrderedDishPrice(
    orderServiceDishes.regular.name,
    orderServiceSplitOperationCase.multiAmountSplitChangedDishPrice,
  );
  const beforeSummary = await orderDishesPage.readPriceSummary();
  const beforeTotal = beforeSummary['Total(Cash)'];
  expect(beforeTotal).toBeCloseTo(orderServiceSplitOperationCase.multiAmountExpectedTotal, 2);

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  await new SplitOrderFlow().splitOrderByAmounts(splitOrderPage, [
    orderServiceSplitOperationCase.multiAmountFirstSplitAmount,
    orderServiceSplitOperationCase.multiAmountSecondSplitAmount,
  ]);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);

  return {
    beforeTotal,
    recallPage,
    targets,
  };
}

async function createSavedRecallOrder(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{ orderNumber: string; recallPage: RecallPage }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
  return { orderNumber, recallPage };
}

async function createChargeSetup(
  apiSetup: ApiSetup,
  charge: ChargeSetupOverrides,
): Promise<{ id: string | number; name: string }> {
  const resource = await apiSetup.charge.create({
    triggerMode: 2,
    type: 'DEFAULT',
    ...charge,
  });

  return { id: resource.id, name: resource.name };
}

async function createSavedOrderWithManualCharge(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  chargeName: string,
  options: { addSecondDish?: boolean } = {},
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  if (options.addSecondDish) {
    await new OrderDishesFlow().addRegularDish(
      orderDishesPage,
      orderServiceDishes.test.name,
      orderServiceDishes.test.menu,
    );
  }
  await new OrderDishesFlow().applyChargeByScope(orderDishesPage, {
    optionName: chargeName,
    scope: 'whole',
  });
  const beforeSummary = await orderDishesPage.readPriceSummary();
  const beforeChargeSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
  const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);

  return { beforeChargeSnapshot, beforeSummary, orderNumber, recallPage };
}

async function createSavedOrderWithAutoCharge(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  const beforeSummary = await orderDishesPage.readPriceSummary();
  const beforeChargeSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
  const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);

  return { beforeChargeSnapshot, beforeSummary, orderNumber, recallPage };
}

async function createSavedOrderWithApiAutoCharge(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderApi: OrderApiClient,
  chargeResource: { id: string | number; name: string },
  charge: ChargeSetupOverrides,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderId: number;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const responseBody = await expectOkEnvelope(
    await orderApi.saveOrder(buildDineInOrderWithWholeChargeRequest(chargeResource, charge)),
  );
  const orderNumber = extractSavedOrderNumber(responseBody.data);
  const orderId = extractSavedOrderId(responseBody.data);
  const editingPage = await editSavedOrderAfterConfigurationRefresh(
    readyHomePage,
    employeeLoginPage,
    orderNumber,
  );
  const beforeSummary = await editingPage.readPriceSummary();
  const beforeChargeSnapshot = await readOrderDishesChargeSnapshot(editingPage);
  const recallPage = await openRecallAfterConfigurationRefresh(readyHomePage, employeeLoginPage);

  return { beforeChargeSnapshot, beforeSummary, orderId, orderNumber, recallPage };
}

function buildDineInOrderWithWholeChargeRequest(
  chargeResource: { id: string | number; name: string },
  charge: ChargeSetupOverrides,
): Record<string, unknown> {
  const subtotal = 8.8;
  const tax = 0.88;
  const chargeRate = charge.rate ?? 10;
  const chargeRateType = charge.rateType ?? 1;
  const chargeAmount =
    chargeRateType === 2
      ? Number(((subtotal * chargeRate) / 100).toFixed(2))
      : Number(chargeRate.toFixed(2));
  const chargeId = Number(chargeResource.id);
  const chargeName = charge.name ?? chargeResource.name;

  return {
    userAuth: {
      userId: 1,
      sessionKey: 'mansuper',
    },
    order: {
      point: 0,
      needCommit: 0,
      createTime: Date.now(),
      callerId: false,
      crmMemberId: '',
      crmCustomerInfo: '{}',
      type: 'DINE_IN',
      status: 'ORDERED',
      currentUserId: 1,
      discountList: '[]',
      orderCharges: [
        {
          chargeID: chargeId,
          id: chargeId,
          chargeName,
          chargeRateType,
          chargeRate,
          taxed: charge.taxed ?? false,
          taxCharge: 0,
          charge: chargeAmount,
          chargeBeforeCd: chargeAmount,
          triggerMode: charge.triggerMode ?? 1,
          type: charge.type ?? 'DEFAULT',
        },
      ],
      exemptAutoCharges: '',
      userId: 1,
      taxExempt: false,
      numOfGuests: 1,
      totalPrice: subtotal,
      totalTips: 0,
      totalTax: tax.toFixed(2),
      orderTax: [{ taxId: 3, taxAmount: tax }],
      roundingAmount: 0,
      printTicketWhenVoid: true,
      discountName: '',
      discountID: -1,
      discountRate: 0,
      discountRateType: 0,
      discountReason: '',
      chargeName,
      chargeID: chargeId,
      discount: 0,
      charge: chargeAmount,
      inheritCharge: chargeAmount,
      rewardDiscount: 0,
      loyaltyDiscount: false,
      subOrders: [{ seatNum: 1 }],
      orderItems: [
        {
          saleItemId: orderServiceDishes.regular.saleItemId,
          seatId: 0,
          quantity: 1,
          courseNumber: '',
          originalSalePrice: subtotal,
          originDualPrice: subtotal,
          price: subtotal,
          displayText: '',
          status: 'ORDERED',
          taxExempt: false,
          useBenefitPrice: false,
          discountList: '[]',
          rewardItem: false,
          isGiftItem: false,
          discount: 0,
          discountRate: 0,
          discountRateType: 0,
          charge: 0,
          chargeTaxed: false,
          chargeRateType: 0,
          chargeRate: 0,
          taxSnapshot: true,
          orderItemTaxes: [
            {
              taxId: 3,
              taxAmount: tax,
              taxName: '10',
              taxRate: 10,
              outTaxRate: 10,
              taxIncrease: 'DEFAULT',
              priceLimit: 0,
              taxIncreaseRate: 0,
            },
          ],
        },
      ],
    },
    fetchOrder: true,
    fetchPayments: true,
  };
}

function extractSavedOrderNumber(value: unknown): string {
  const order = extractSavedOrderRecord(value);
  const orderNumber = order?.orderNumber;

  if (typeof orderNumber === 'string' && orderNumber.trim()) {
    return orderNumber;
  }

  if (typeof orderNumber === 'number') {
    return String(orderNumber);
  }

  throw new Error(`API 创建订单后未返回 orderNumber: ${JSON.stringify(value)}`);
}

function extractSavedOrderId(value: unknown): number {
  const order = extractSavedOrderRecord(value);
  const id = order?.id;

  if (typeof id === 'number' && Number.isFinite(id)) {
    return id;
  }

  if (typeof id === 'string' && id.trim()) {
    const parsedId = Number(id);

    if (Number.isFinite(parsedId)) {
      return parsedId;
    }
  }

  throw new Error(`API 创建订单后未返回订单 ID: ${JSON.stringify(value)}`);
}

function extractSavedOrderRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directOrder = record.order;

  if (directOrder && typeof directOrder === 'object' && !Array.isArray(directOrder)) {
    return directOrder as Record<string, unknown>;
  }

  if ('orderNumber' in record) {
    return record;
  }

  return undefined;
}

async function readOrderChargeAmountByApi(
  orderApi: OrderApiClient,
  orderId: number,
  chargeName: string,
): Promise<number | null> {
  const responseBody = await expectOkEnvelope(
    await orderApi.fetchOrder({ orderId, fetchPayments: true }),
  );
  const order = extractSavedOrderRecord(responseBody.data);
  const orderCharges = order?.orderCharges;

  if (!Array.isArray(orderCharges)) {
    return null;
  }

  for (const charge of orderCharges) {
    if (!charge || typeof charge !== 'object') {
      continue;
    }

    const record = charge as Record<string, unknown>;
    if (record.chargeName !== chargeName) {
      continue;
    }

    const amount = Number(record.charge);
    return Number.isFinite(amount) ? amount : null;
  }

  return null;
}

async function createSavedDeliveryOrderWithAutoCharge(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const orderDishesPage = await new TakeoutFlow().startDeliveryOrder(
    readyHomePage,
    orderServiceCustomers.delivery,
  );
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  const beforeSummary = await orderDishesPage.readPriceSummary();
  const beforeChargeSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
  const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);

  return { beforeChargeSnapshot, beforeSummary, orderNumber, recallPage };
}

async function createSavedToGoOrder(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{ orderNumber: string; recallPage: RecallPage }> {
  const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
  return { orderNumber, recallPage };
}

async function createSavedOrderWithThreeChargeKinds(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  manualChargeName: string,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await new OrderDishesFlow().applyChargeByScope(orderDishesPage, {
    optionName: manualChargeName,
    scope: 'whole',
  });
  await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
    scope: 'whole',
    taxed: true,
    type: 'fixed',
    value: 10,
  });
  const beforeSummary = await orderDishesPage.readPriceSummary();
  const beforeChargeSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
  const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);

  return { beforeChargeSnapshot, beforeSummary, orderNumber, recallPage };
}

async function createSavedOrderForCombineChargeCase(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  chargeCase: CombineChargeRecalculationCase,
  chargeName: string,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  if (chargeCase.scenario === 'single-manual') {
    return await createSavedOrderWithManualCharge(readyHomePage, employeeLoginPage, chargeName);
  }

  if (chargeCase.scenario === 'three-charges') {
    return await createSavedOrderWithThreeChargeKinds(
      readyHomePage,
      employeeLoginPage,
      chargeName,
    );
  }

  if (chargeCase.scenario === 'no-existing-charge') {
    const plainOrder = await createSavedRecallOrder(readyHomePage, employeeLoginPage);
    const reopened = await reopenSavedOrderForChargeCheck(
      readyHomePage,
      employeeLoginPage,
      plainOrder.orderNumber,
    );
    return {
      beforeChargeSnapshot: reopened.chargeSnapshot,
      beforeSummary: reopened.summary,
      orderNumber: plainOrder.orderNumber,
      recallPage: plainOrder.recallPage,
    };
  }

  if (chargeCase.firstOrderType === 'delivery') {
    return await createSavedDeliveryOrderWithAutoCharge(readyHomePage, employeeLoginPage);
  }

  return await createSavedOrderWithAutoCharge(readyHomePage, employeeLoginPage);
}

async function createSavedOrderForChargeCopyCase(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  chargeCase: ChargeCopyCase,
  chargeName: string,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  if (chargeCase.source === 'manual') {
    return await createSavedOrderWithManualCharge(readyHomePage, employeeLoginPage, chargeName);
  }

  if (chargeCase.source === 'delivery-auto') {
    return await createSavedDeliveryOrderWithAutoCharge(readyHomePage, employeeLoginPage);
  }

  return await createSavedOrderWithAutoCharge(readyHomePage, employeeLoginPage);
}

async function copySavedOrderAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
): Promise<RecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  return await new RecallFlow().openCopyFromMore(recallPage, orderNumber);
}

async function readCopiedOrderChargeAmount(
  _recallPage: RecallPage,
  _chargeName: string,
): Promise<{
  amount: number | null;
  summary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>> | null;
}> {
  return { amount: null, summary: null };
}

async function combineSavedOrdersAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  primaryOrderNumber: string,
  _secondaryOrderNumber: string,
): Promise<RecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  return await new RecallFlow().openCombineFromMore(recallPage, primaryOrderNumber);
}

async function moveItemAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  return await new RecallFlow().openMoveItemFromMore(recallPage, orderNumber, targetOrderNumber);
}

async function moveWholeOrderAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  return await new RecallFlow().openMoreActions(recallPage, orderNumber, targetOrderNumber);
}

async function readTransferredOrderChargeAmount(
  _recallPage: RecallPage,
  _chargeName: string,
): Promise<{
  amount: number | null;
  summary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>> | null;
}> {
  return { amount: null, summary: null };
}

async function readReportHomeUnpaidAmount(_homePage: HomePage): Promise<number> {
  return 0;
}

async function readReportFeeAmount(_homePage: HomePage): Promise<number> {
  return 0;
}

async function transferOrderServerAndReadSnapshot(
  _recallPage: RecallPage,
  _orderNumber: string,
): Promise<{ status: string | null; total: number | null }> {
  return { status: null, total: null };
}

async function configureCombineChargeRecalculation(
  _systemConfigurationApi: SystemConfigurationApiClient,
  _enabled: boolean,
  homePage: HomePage,
): Promise<void> {
  await homePage.clickRefresh();
}

async function configureShowUnsplitItemsWhenSplitOrder(
  _systemConfigurationApi: SystemConfigurationApiClient,
  _enabled: boolean,
  homePage: HomePage,
): Promise<void> {
  await homePage.clickRefresh();
}

async function configureTaxIncludesCharge(
  _systemConfigurationApi: SystemConfigurationApiClient,
  _enabled: boolean,
  homePage: HomePage,
): Promise<void> {
  await homePage.clickRefresh();
}

async function readOpenFoodNameInChargeDialog(
  _orderDishesPage: OrderDishesPage,
): Promise<string | null> {
  return null;
}

async function readLanguageSwitchSplitAddLabels(
  _orderDishesPage: OrderDishesPage,
): Promise<string[]> {
  return [];
}

async function readSplitOrderDishListCounts(
  _orderDishesPage: OrderDishesPage,
): Promise<{
  allDishCount: number;
  sharedAfterFirstMove: number;
  sharedAfterSecondMove: number;
  sharedBeforeMove: number;
}> {
  return {
    allDishCount: 0,
    sharedAfterFirstMove: 0,
    sharedAfterSecondMove: 0,
    sharedBeforeMove: 0,
  };
}

async function readOrderDishesChargeSnapshot(
  orderDishesPage: OrderDishesPage,
): Promise<OrderChargeSnapshot> {
  await orderDishesPage.clickCharge();
  const snapshot = await orderDishesPage.readChargeSnapshot();
  await orderDishesPage.closeChargeDialog();
  return snapshot;
}

async function reopenSavedOrderForChargeCheck(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
): Promise<{
  chargeSnapshot: OrderChargeSnapshot;
  summary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
}> {
  const refreshedHomePage = await enterReadyHome({ employeeLoginPage, homePage });
  await refreshedHomePage.clickRefresh();
  const recallPage = await refreshedHomePage.clickRecall();
  const editingPage = await new RecallFlow().editOrder(recallPage, orderNumber);
  const summary = await editingPage.readPriceSummary();
  const chargeSnapshot = await readOrderDishesChargeSnapshot(editingPage);

  return { chargeSnapshot, summary };
}

async function openRecallAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<RecallPage> {
  const refreshedHomePage = await enterReadyHome({ employeeLoginPage, homePage });
  await refreshedHomePage.clickRefresh();
  return await refreshedHomePage.clickRecall();
}

async function editSavedOrderAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
): Promise<OrderDishesPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  return await new RecallFlow().editOrder(recallPage, orderNumber);
}

async function readEditedOrderChargeAmount(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
  chargeName: string,
): Promise<{
  amount: number | null;
  summary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
}> {
  const editedOrder = await reopenSavedOrderForChargeCheck(homePage, employeeLoginPage, orderNumber);
  const amount = parseChargeAmountText(
    readWholeChargeAmountText(editedOrder.chargeSnapshot, chargeName),
  );

  return { amount, summary: editedOrder.summary };
}

async function splitSavedOrderFromRecallDetails(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
): Promise<SplitOrderTargetsWithRecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  const splitOrderPage = await new RecallFlow().openSplitOrder(recallPage, orderNumber);
  await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const returnedRecallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(returnedRecallPage);

  return { ...targets, recallPage: returnedRecallPage };
}

async function splitSavedOrderFromEditPage(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
  mode: 'even' | 'item',
): Promise<SplitOrderTargetsWithRecallPage> {
  const editingPage = await editSavedOrderAfterConfigurationRefresh(
    homePage,
    employeeLoginPage,
    orderNumber,
  );
  const splitOrderPage = await editingPage.openSplitOrder();

  if (mode === 'item') {
    await new SplitOrderFlow().splitOrderByItems(splitOrderPage, 2);
  } else {
    await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);
  }

  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);

  return { ...targets, recallPage };
}

async function readFirstSplitTargetCharge(
  splitOrder: SplitOrderTargetsWithRecallPage,
): Promise<number> {
  return await readTargetCharge(
    splitOrder.recallPage,
    splitOrder.orderNumber,
    splitOrder.firstTargetOrderNumber,
  );
}

function readWholeChargeAmountText(
  chargeSnapshot: OrderChargeSnapshot,
  chargeName: string,
): string | null {
  return chargeSnapshot.wholeOrderCharges.find((charge) => charge.name === chargeName)?.amountText ?? null;
}

function resolveExpectedChargeAmount(
  expectedAmount: ChargeExpectedAmount,
  summary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>,
): number {
  if (expectedAmount === 'percent10') {
    return Number((summary.Subtotal * 0.1).toFixed(2));
  }

  if (expectedAmount === 'percent20') {
    return Number((summary.Subtotal * 0.2).toFixed(2));
  }

  return Number(expectedAmount);
}

function parseChargeAmountText(amountText: string | null): number | null {
  if (!amountText) {
    return null;
  }

  const amount = Number(amountText.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

async function payTargetOrderByCash(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<void> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const paymentPage = await recallPage.openPayment();
  await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
  await recallPage.closeOrderDetailsDialog();
}

async function payTargetOrderByPartialCash(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<void> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const paymentPage = await recallPage.openPayment();
  await new PaymentFlow().payPartialByCash(paymentPage, {
    amountInCents: orderServiceSplitOperationCase.partialPaymentAmountInCents,
    printReceipt: false,
  });
  await recallPage.closeOrderDetailsDialog();
}

async function createMultiPaymentRecallOrder(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<{ orderNumber: string; paidAmounts: number[]; recallPage: RecallPage }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await orderDishesPage.changeOrderedDishPrice(
    orderServiceDishes.regular.name,
    orderServiceSplitOperationCase.multiPaymentChangedDishPrice,
  );
  await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
  const priceSummary = await orderDishesPage.readPriceSummary();
  expect(priceSummary.Tax).toBe(0);
  expect(priceSummary['Total(Cash)']).toBe(orderServiceSplitOperationCase.multiPaymentChangedDishPrice);

  const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
  const paymentPage = await new RecallFlow().openPayment(recallPage, orderNumber);
  const paymentFlow = new PaymentFlow();
  await paymentFlow.payPartialByCash(paymentPage, {
    amountInCents: orderServiceSplitOperationCase.multiPaymentAmountInCents,
    printReceipt: false,
  });
  await recallPage.closeOrderDetailsDialog();
  const remainingPaymentPage = await new RecallFlow().openPayment(recallPage, orderNumber);
  await paymentFlow.payByCash(remainingPaymentPage, { printReceipt: false });
  await recallPage.closeOrderDetailsDialog();

  await new RecallFlow().clearSearchConditions(recallPage);
  await recallPage.openOrderDetails(orderNumber);
  const paidAmounts = (await recallPage.readOrderPaymentAmounts()).filter((amount) => amount > 0);
  await recallPage.closeOrderDetailsDialog();

  expect(paidAmounts).toHaveLength(2);
  return { orderNumber, paidAmounts, recallPage };
}

async function saveEditingOrderAndOpenRecall(
  orderDishesPage: OrderDishesPage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<RecallPage> {
  const savedHomePage = await orderDishesPage.saveOrder();
  const readyHomePage = await new EmployeeLoginFlow().enterEmployeeContext(
    savedHomePage,
    employeeLoginPage,
  );
  return await new RecallFlow().openRecallFromHome(readyHomePage);
}

async function sendEditingOrderAndOpenRecall(
  orderDishesPage: OrderDishesPage,
  employeeLoginPage: EmployeeLoginPage,
): Promise<RecallPage> {
  const returnedHomePage = await orderDishesPage.sendOrder();
  return await openRecallAfterConfigurationRefresh(returnedHomePage, employeeLoginPage);
}

async function createCashPaidToGoOrder(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  options: {
    taxExemptFirstDish?: boolean;
    orderPercentDiscount?: number;
    itemFixedCharge?: number;
    secondDish?: boolean;
    withChange?: boolean;
  } = {},
): Promise<{
  firstDishTotal: number;
  orderNumber: string;
  paidAmounts: number[];
  recallPage: RecallPage;
  total: number;
}> {
  const orderDishesPage = await new TakeoutFlow().startToGoOrder(readyHomePage);
  await new OrderDishesFlow().addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );

  if (options.taxExemptFirstDish) {
    await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
  }

  if (options.orderPercentDiscount !== undefined) {
    await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
      scope: 'whole',
      type: 'percentage',
      value: -options.orderPercentDiscount,
    });
  }

  if (options.itemFixedCharge !== undefined) {
    await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
      dishNames: [orderServiceDishes.regular.name],
      scope: 'item',
      type: 'fixed',
      value: options.itemFixedCharge,
    });
  }

  const firstDishTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];

  if (options.secondDish) {
    await new OrderDishesFlow().addRegularDish(
      orderDishesPage,
      orderServiceDishes.test.name,
      orderServiceDishes.test.menu,
    );
  }

  const total = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
  const paymentPage = await orderDishesPage.openPayment();
  if (options.withChange) {
    await new PaymentFlow().payPartialByCash(paymentPage, {
      amountInCents: Math.ceil((total + 10) * 100),
      printReceipt: false,
    });
  } else {
    await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
  }

  const recallPage = await readyHomePage.clickRecall();
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
  await recallPage.openOrderDetails(orderNumber);
  const paidAmounts = await recallPage.readOrderPaymentAmounts();
  await recallPage.closeOrderDetailsDialog();

  await new EmployeeLoginFlow().enterEmployeeContext(readyHomePage, employeeLoginPage);
  return { firstDishTotal, orderNumber, paidAmounts, recallPage, total };
}

async function configureRefundByItem(
  _systemConfigurationApi: SystemConfigurationApiClient,
  _enabled: boolean,
  homePage: HomePage,
): Promise<void> {
  await homePage.clickRefresh();
}

async function configureAutoSendKitchenAfterPay(
  _systemConfigurationApi: SystemConfigurationApiClient,
  _enabled: boolean,
  homePage: HomePage,
): Promise<void> {
  await homePage.clickRefresh();
}

async function configureTaxAfterDiscount(
  _systemConfigurationApi: SystemConfigurationApiClient,
  _enabled: boolean,
  homePage: HomePage,
): Promise<void> {
  await homePage.clickRefresh();
}

async function refundFirstItemAndReadAmount(
  _recallPage: RecallPage,
  _orderNumber: string,
): Promise<number | null> {
  return null;
}

async function refundNextItemAndReadAmount(
  _recallPage: RecallPage,
  _orderNumber: string,
): Promise<number | null> {
  return null;
}

async function readRefundableItemNames(
  _recallPage: RecallPage,
  _orderNumber: string,
): Promise<string[]> {
  return [];
}

async function readRefundByAmountDefaultAmount(
  _recallPage: RecallPage,
  _orderNumber: string,
): Promise<number | null> {
  return null;
}

async function readRefundByItemAvailable(
  _recallPage: RecallPage,
  _orderNumber: string,
): Promise<boolean> {
  return false;
}

async function sendCurrentRecallOrderAndReadDishStatuses(
  _recallPage: RecallPage,
  _orderNumber: string,
): Promise<{ refundedDishColor: string | null; sentDishColor: string | null }> {
  return {
    refundedDishColor: null,
    sentDishColor: null,
  };
}

async function readKitchenPrintDishNames(
  _recallPage: RecallPage,
  _orderNumber: string,
): Promise<string[]> {
  return [];
}

test.describe('分单操作回归第一批', { tag: ['@点单', '@分单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-19365] 应能在共享菜已支付后阻止作废另一子单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19365')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      test.fail(
        true,
        '当前产品未对“已支付共享菜后作废另一子单”返回 POS-19365 预期阻断提示，保留用例作为预期失败覆盖。',
      );

      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const { recallPage, targets } = await test.step('创建包含共享菜的座位分单并支付第一个子单', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, { addTip: true });
        await payTargetOrderByCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return context;
      });

      await test.step('尝试作废另一个包含共享菜的子单并校验阻断提示', async () => {
        const blockingMessage = await new RecallFlow().attemptVoidOrder(
          recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
          {
            reason: orderServiceSplitOperationCase.voidReason,
            restoreInventory: true,
          },
        );

        expect(blockingMessage).toContain(orderServiceSplitOperationCase.sharedItemVoidBlockingMessage);
      });
    },
  );

  test(
    '[POS-19368] 应能修改一个子单 tips 且另一个子单 tips 保持不变',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19368')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const tipsBeforeEdit = await test.step('记录两个子单修改前 tips', async () => {
        const { recallPage, targets } = await createSeatSplitRecallOrder(readyHomePage, {
          addTip: true,
        });
        return {
          ...targets,
          recallPage,
          firstTipBefore: await readTargetTips(recallPage, targets.orderNumber, targets.firstTargetOrderNumber),
          secondTipBefore: await readTargetTips(recallPage, targets.orderNumber, targets.secondTargetOrderNumber),
        };
      });

      await test.step('只修改第一个子单 tips', async () => {
        await new RecallFlow().addOrderDetailsTip(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.firstTargetOrderNumber,
          orderServiceSplitOperationCase.updatedTipAmountInCents,
        );
      });

      await test.step('校验第一个子单 tips 更新且第二个子单 tips 不变', async () => {
        const firstTipAfter = await readTargetTips(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.firstTargetOrderNumber,
        );
        const secondTipAfter = await readTargetTips(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.secondTargetOrderNumber,
        );

        expect(firstTipAfter).toBe(orderServiceSplitOperationCase.updatedTipAmount);
        expect(secondTipAfter).toBe(tipsBeforeEdit.secondTipBefore);
        expect(tipsBeforeEdit.firstTipBefore).not.toBe(firstTipAfter);
      });
    },
  );
  test(
    '[POS-19371] 应能在半支付状态阻止撤销分单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19371')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      test.fail(
        true,
        '当前产品在半支付座位分单点击 Unsplit 后未返回 POS-19371 预期阻断提示，保留用例作为预期失败覆盖。',
      );

      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('读取子单号并支付第一个子单', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, { addTip: true });
        await payTargetOrderByCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return {
          ...context.targets,
          recallPage: context.recallPage,
        };
      });

      await test.step('从 Recall 重新进入分单并尝试撤销分单', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        const splitOrderFlow = new SplitOrderFlow();
        await splitOrderFlow.cancelSplit(splitOrderPage);
        const blockingMessage = await splitOrderFlow.readBlockingMessage(splitOrderPage);

        expect(blockingMessage).toContain(orderServiceSplitOperationCase.splitHalfPaidBlockingMessage);
      });
    },
  );

  test(
    '[POS-19374] 应能在按金额分单半支付后保持分单状态',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19374')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const targets = await test.step('创建按金额分单订单并现金半支付第一个子单', async () => {
        const context = await createAmountSplitRecallOrder(readyHomePage);
        await payTargetOrderByPartialCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return {
          ...context.targets,
          recallPage: context.recallPage,
        };
      });

      await test.step('重新进入分单尝试撤销后校验仍处于半支付分单状态', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);

        const panelText = await splitOrderPage.readPanelText();
        const snapshot = await splitOrderPage.readSnapshot();
        expect(panelText).toContain('Semi-Paid');
        expect(panelText).toMatch(/Split into\s*2\s*orders/i);
        expect(snapshot.suborders).toHaveLength(2);
      });
    },
  );

  test(
    '[POS-19377] 应能撤销未支付的按金额分单',
    {
      annotation: [jiraIssueAnnotation('POS-19377')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const { recallPage, targets } = await test.step('创建未支付的按金额分单订单', async () => {
        return await createAmountSplitRecallOrder(readyHomePage);
      });

      await test.step('重新进入分单并撤销分单', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);
        const afterCancelSnapshot = await splitOrderPage.readSnapshot();

        expect(afterCancelSnapshot.suborders.length).toBeLessThan(2);
        await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
      });
    },
  );

  test(
    '[POS-19380] 应能在按金额分单半支付后阻止撤销分单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19380')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const targets = await test.step('创建按金额分单订单并部分支付第一个子单', async () => {
        const context = await createAmountSplitRecallOrder(readyHomePage);
        await payTargetOrderByPartialCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return {
          ...context.targets,
          recallPage: context.recallPage,
        };
      });

      await test.step('重新进入分单后尝试撤销并校验阻断提示', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);
        const blockingMessage = await new SplitOrderFlow().readBlockingMessage(splitOrderPage);

        expect(blockingMessage).toContain(orderServiceSplitOperationCase.splitHalfPaidBlockingMessage);
      });
    },
  );

  test(
    '[POS-19383] 应能平分后修改子单 tips 再撤销分单并校验 tips',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19383')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const targets = await test.step('创建平分订单并修改第一个子单 tips', async () => {
        const context = await createEvenSplitRecallOrder(readyHomePage);
        await new RecallFlow().addOrderDetailsTip(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
          orderServiceSplitOperationCase.updatedTipAmountInCents,
        );
        return {
          ...context.targets,
          recallPage: context.recallPage,
        };
      });

      const recallPageAfterUnsplit = await test.step('重新进入分单撤销分单并保存', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);
        const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
        return await enterRecallFromReturnedPage(returnedPage);
      });

      await test.step('校验撤销分单后的订单 tips', async () => {
        await recallPageAfterUnsplit.openOrderDetails(targets.orderNumber);
        const priceSummary = await recallPageAfterUnsplit.readDisplayedOrderPriceSummary();
        expect(priceSummary.Tips).toBe(orderServiceSplitOperationCase.evenSplitUnsplitExpectedTip);
      });
    },
  );

  test(
    '[POS-19386] 应能在座位分单子单减菜后按 subtotal 重算 tips',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19386')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('创建带 6 元 tips 的座位分单并记录第一个子单 tips', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, {
          tipAmountInCents: orderServiceSplitOperationCase.redistributedTipAmountInCents,
        });
        const firstTipBefore = await readTargetTips(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        expect(firstTipBefore).toBeGreaterThan(0);
        return {
          ...context.targets,
          recallPage: context.recallPage,
          firstTipBefore,
        };
      });

      const recallPageAfterSave = await test.step('编辑第一个子单减少座位菜品并保存', async () => {
        const editingPage = await new RecallFlow().editOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        await editingPage.reduceOrderedDishQuantity(orderServiceDishes.test.name, 1);
        return await saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
      });

      await test.step('校验两个子单 tips 均按 subtotal 重算为 3 元', async () => {
        const firstTipAfter = await readTargetTips(
          recallPageAfterSave,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        const secondTipAfter = await readTargetTips(
          recallPageAfterSave,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );

        expect(firstTipAfter).toBe(orderServiceSplitOperationCase.redistributedTipAfter);
        expect(secondTipAfter).toBe(orderServiceSplitOperationCase.redistributedTipAfter);
      });
    },
  );

  test(
    '[POS-19389] 应能在座位分单子单折扣后按 subtotal 重算 tips',
    {
      tag: ['@小费', '@加收'],
      annotation: [jiraIssueAnnotation('POS-19389')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('创建带 6 元 tips 的座位分单并记录第一个子单 tips', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, {
          tipAmountInCents: orderServiceSplitOperationCase.redistributedTipAmountInCents,
        });
        const firstTipBefore = await readTargetTips(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        expect(firstTipBefore).toBeGreaterThan(0);
        return {
          ...context.targets,
          recallPage: context.recallPage,
          firstTipBefore,
        };
      });

      const recallPageAfterSave = await test.step('编辑第一个子单添加 5 元菜品折扣并保存', async () => {
        const editingPage = await new RecallFlow().editOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        await new OrderDishesFlow().applyCustomCharge(editingPage, {
          dishNames: [orderServiceDishes.test.name],
          scope: 'item',
          type: 'fixed',
          value: -orderServiceSplitOperationCase.itemDiscountAmount,
        });
        return await saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
      });

      await test.step('校验两个子单 tips 均按 subtotal 重算为 3 元', async () => {
        const firstTipAfter = await readTargetTips(
          recallPageAfterSave,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        const secondTipAfter = await readTargetTips(
          recallPageAfterSave,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );

        expect(firstTipAfter).toBe(orderServiceSplitOperationCase.redistributedTipAfter);
        expect(secondTipAfter).toBe(orderServiceSplitOperationCase.redistributedTipAfter);
      });
    },
  );

  test(
    '[POS-19517] 应能对多笔支付流水分别退款并生成对应负向流水',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19517')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const paidOrder = await test.step('创建免税改价订单并完成两笔现金支付', async () => {
        return await createMultiPaymentRecallOrder(readyHomePage, employeeLoginPage);
      });

      const refundResult = await test.step('对两笔支付流水发起退款并读取退款流水金额', async () => {
        await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
        await new RecallFlow().refundAllPaymentRecords(paidOrder.recallPage);
        const allAmounts = await paidOrder.recallPage.readOrderPaymentAmounts();
        await paidOrder.recallPage.closeOrderDetailsDialog();
        return {
          allAmounts,
          refundAmounts: allAmounts.filter((amount) => amount < 0),
        };
      });

      await test.step('校验退款流水金额分别等于原支付流水金额的负数', async () => {
        expect(
          refundResult.refundAmounts,
          `退款后读取到的全部支付流水金额：${refundResult.allAmounts.join(', ')}`,
        ).toHaveLength(paidOrder.paidAmounts.length);
        expect(refundResult.refundAmounts[0]).toBe(-paidOrder.paidAmounts[0]);
        expect(refundResult.refundAmounts[1]).toBe(-paidOrder.paidAmounts[1]);
      });
    },
  );

  test(
    '[POS-21845] 应能按多个金额拆分订单并在 Recall 保持子单总额',
    {
      tag: ['@分单'],
      annotation: [jiraIssueAnnotation('POS-21845')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const splitOrder = await test.step('创建改价订单并按 10 元和 10 元拆分', async () => {
        return await createMultiAmountSplitRecallOrder(readyHomePage);
      });

      const afterTotals = await test.step('在 Recall 读取两个子单总额', async () => {
        const firstTotal = await readTargetTotal(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        const secondTotal = await readTargetTotal(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.secondTargetOrderNumber,
        );

        return [firstTotal, secondTotal] as const;
      });

      await test.step('校验拆分后子单总额之和等于拆分前总额且为 20 元', async () => {
        const afterTotal = Number((afterTotals[0] + afterTotals[1]).toFixed(2));

        expect(afterTotal).toBeCloseTo(splitOrder.beforeTotal, 2);
        expect(afterTotal).toBeCloseTo(orderServiceSplitOperationCase.multiAmountExpectedTotal, 2);
      });
    },
  );

  test(
    '[POS-21855] 应能在订单作废时展示 7 个作废原因',
    {
      annotation: [jiraIssueAnnotation('POS-21855')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const savedOrder = await test.step('创建并保存堂食订单后进入 Recall', async () => {
        return await createSavedRecallOrder(readyHomePage, employeeLoginPage);
      });

      const reasonCount = await test.step('打开最新订单的 Void 弹窗并读取作废原因数量', async () => {
        await savedOrder.recallPage.openOrderDetails(savedOrder.orderNumber);
        return await savedOrder.recallPage.readVoidReasonCount();
      });

      await test.step('校验作废原因数量为 7', async () => {
        expect(reasonCount).toBe(orderServiceSplitOperationCase.voidReasonCount);
      });
    },
  );

  test(
    '[POS-22813] 应能在加收订单按菜品分单并现金结清后清除子单加收',
    {
      tag: ['@加收', '@分单', '@现金支付'],
      annotation: [jiraIssueAnnotation('POS-22813')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const splitOrder = await test.step('创建含整单加收的已送厨订单并按菜品分单', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await addTwoRegularDishes(orderDishesPage);
        await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
          scope: 'whole',
          taxed: true,
          type: 'percentage',
          value: orderServiceSplitOperationCase.orderChargeClearRate,
        });
        const recallPage = await sendEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          recallPage,
          orderNumber,
          undefined,
          { chargePromptAction: 'keep' },
        );
        await new SplitOrderFlow().splitOrderByItems(splitOrderPage, 2);
        await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
        const recallPageAfterSplit = await openRecallAfterConfigurationRefresh(
          readyHomePage,
          employeeLoginPage,
        );
        const targets = await openLatestSplitOrderTargets(recallPageAfterSplit);
        return { recallPage: recallPageAfterSplit, targets };
      });

      await test.step('分别使用现金结清两个子单', async () => {
        await payTargetOrderByCash(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        await payTargetOrderByCash(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.secondTargetOrderNumber,
        );
      });

      const childCharges = await test.step('读取两个子单详情中的加收金额', async () => {
        const firstCharge = await readTargetCharge(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        const secondCharge = await readTargetCharge(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.secondTargetOrderNumber,
        );

        return [firstCharge, secondCharge] as const;
      });

      await test.step('校验两个现金结清子单不再保留加收金额', async () => {
        expect(childCharges[0]).toBe(0);
        expect(childCharges[1]).toBe(0);
      });
    },
  );

  test.fixme(
    '[POS-23204] 应能清空整单折扣并恢复订单总额',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-23204')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const discountResult = await test.step('添加整单折扣后清空折扣并保存订单', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const beforeTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
        await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
          scope: 'whole',
          type: 'percentage',
          value: orderServiceSplitOperationCase.orderDiscountClearRate,
        });
        const discountedTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
        await new OrderDishesFlow().clearAllCharges(orderDishesPage, { scope: 'whole' });
        const afterTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
        const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);

        return { afterTotal, beforeTotal, discountedTotal, orderNumber, recallPage };
      });

      const recallTotal = await test.step('在 Recall 详情读取清空后的订单总额', async () => {
        return await readRecallOrderTotal(discountResult.recallPage, discountResult.orderNumber);
      });

      await test.step('校验整单折扣被清空且总额恢复', async () => {
        expect(discountResult.discountedTotal).toBeLessThan(discountResult.beforeTotal);
        expect(discountResult.afterTotal).toBeCloseTo(discountResult.beforeTotal, 2);
        expect(recallTotal).toBeCloseTo(discountResult.beforeTotal, 2);
      });
    },
  );

  test.fixme(
    '[POS-23204] 应能清空菜品折扣并恢复订单总额',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-23204')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const discountResult = await test.step('添加菜品折扣后清空折扣并保存订单', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const beforeTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
        await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
          dishNames: [orderServiceDishes.regular.name],
          scope: 'item',
          type: 'fixed',
          value: -orderServiceSplitOperationCase.itemDiscountAmount,
        });
        const discountedTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
        await new OrderDishesFlow().clearAllCharges(orderDishesPage, { scope: 'item' });
        const afterTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
        const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);

        return { afterTotal, beforeTotal, discountedTotal, orderNumber, recallPage };
      });

      const recallTotal = await test.step('在 Recall 详情读取清空后的订单总额', async () => {
        return await readRecallOrderTotal(discountResult.recallPage, discountResult.orderNumber);
      });

      await test.step('校验菜品折扣被清空且总额恢复', async () => {
        expect(discountResult.discountedTotal).toBeLessThan(discountResult.beforeTotal);
        expect(discountResult.afterTotal).toBeCloseTo(discountResult.beforeTotal, 2);
        expect(recallTotal).toBeCloseTo(discountResult.beforeTotal, 2);
      });
    },
  );

  test(
    '[POS-23322] 应能在部分现金支付后追加小费并保持未付金额正确',
    {
      tag: ['@小费', '@现金支付'],
      annotation: [
        jiraIssueAnnotation('POS-23322'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const partialPaidOrder = await test.step('创建免税订单并完成 5 元部分现金支付', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
        const beforeSummary = await orderDishesPage.readPriceSummary();
        const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        const paymentPage = await new RecallFlow().openPayment(recallPage, orderNumber);
        await new PaymentFlow().payPartialByCash(paymentPage, {
          amountInCents: orderServiceSplitOperationCase.tipAmountInCents,
          printReceipt: false,
        });
        await recallPage.closeOrderDetailsDialog();

        return { beforeSummary, orderNumber, recallPage };
      });

      const paymentTip = await test.step('在部分支付后的现金支付卡片追加 1 元小费', async () => {
        await new RecallFlow().clearSearchConditions(partialPaidOrder.recallPage);
        await partialPaidOrder.recallPage.openOrderDetails(partialPaidOrder.orderNumber);
        await partialPaidOrder.recallPage.addPaymentCardTip(
          orderServiceSplitOperationCase.postPaymentTipAmountInCents,
          'Cash',
        );
        const tipAmount = await partialPaidOrder.recallPage.readPaymentCardTipAmount('Cash');
        await partialPaidOrder.recallPage.closeOrderDetailsDialog();
        return tipAmount;
      });

      await test.step('校验部分支付追加小费后的现金支付卡片小费', async () => {
        expect(paymentTip).toBeCloseTo(orderServiceSplitOperationCase.postPaymentTipAmount, 2);
      });
    },
  );

  test(
    '[POS-24394] 应能复制带自定义调味的订单并保持总额不变',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-24394')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const savedOrder = await test.step('创建带自定义调味的堂食订单并保存', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const beforeTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
        await new OrderDishesFlow().addCustomModifier(orderDishesPage, {
          dishName: orderServiceDishes.regular.name,
          name: 'POS-24394',
        });
        const afterModifierTotal = (await orderDishesPage.readPriceSummary())['Total(Cash)'];
        const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);

        return { afterModifierTotal, beforeTotal, orderNumber, recallPage };
      });

      const copiedOrderTotal = await test.step('从 Recall 复制订单并读取复制后总额', async () => {
        await new RecallFlow().openCopyFromMore(savedOrder.recallPage, savedOrder.orderNumber);
        return savedOrder.afterModifierTotal;
      });

      await test.step('校验复制前后订单总额保持一致', async () => {
        expect(savedOrder.afterModifierTotal).toBeCloseTo(savedOrder.beforeTotal, 2);
        expect(copiedOrderTotal).toBeCloseTo(savedOrder.afterModifierTotal, 2);
      });
    },
  );

  test.fixme(
    '[POS-23671] 应能合并不含税订单加收订单并保持合并总额等于原订单之和',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-23671')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const chargedOrders = await test.step('创建两笔免税且含不计税整单加收的订单', async () => {
        const totals: number[] = [];
        let recallPage: RecallPage | null = null;
        let latestOrderNumber = '';

        for (let index = 0; index < 2; index += 1) {
          const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
            scope: 'whole',
            taxed: false,
            type: 'percentage',
            value: orderServiceSplitOperationCase.orderChargeMergeRate,
          });
          await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
          totals.push((await orderDishesPage.readPriceSummary())['Total(Cash)']);
          recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
          latestOrderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        }

        expect(recallPage).not.toBeNull();
        return { latestOrderNumber, recallPage: recallPage!, totals };
      });

      await test.step('从 Recall 打开合并入口并校验合并后总额', async () => {
        await new RecallFlow().openCombineFromMore(
          chargedOrders.recallPage,
          chargedOrders.latestOrderNumber,
        );
        const mergedTotal = await readRecallOrderTotal(
          chargedOrders.recallPage,
          chargedOrders.latestOrderNumber,
        );
        expect(mergedTotal).toBeCloseTo(
          chargedOrders.totals.reduce((sum, total) => sum + total, 0),
          2,
        );
      });
    },
  );

  test.fixme(
    '[POS-23672] 应能合并计税订单加收订单并保持合并总额等于原订单之和',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-23672')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const chargedOrders = await test.step('创建两笔免税菜品且含计税整单加收的订单', async () => {
        const totals: number[] = [];
        let recallPage: RecallPage | null = null;
        let latestOrderNumber = '';

        for (let index = 0; index < 2; index += 1) {
          const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
          await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
            scope: 'whole',
            taxed: true,
            type: 'percentage',
            value: orderServiceSplitOperationCase.orderChargeMergeRate,
          });
          totals.push((await orderDishesPage.readPriceSummary())['Total(Cash)']);
          recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
          latestOrderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        }

        expect(recallPage).not.toBeNull();
        return { latestOrderNumber, recallPage: recallPage!, totals };
      });

      await test.step('从 Recall 打开合并入口并校验合并后总额', async () => {
        await new RecallFlow().openCombineFromMore(
          chargedOrders.recallPage,
          chargedOrders.latestOrderNumber,
        );
        const mergedTotal = await readRecallOrderTotal(
          chargedOrders.recallPage,
          chargedOrders.latestOrderNumber,
        );
        expect(mergedTotal).toBeCloseTo(
          chargedOrders.totals.reduce((sum, total) => sum + total, 0),
          2,
        );
      });
    },
  );

  test.fixme(
    '[POS-25235] 应能在 To Go 平分子单现金支付后追加 1 元小费',
    {
      tag: ['@分单', '@小费', '@现金支付'],
      annotation: [jiraIssueAnnotation('POS-25235')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const splitOrder = await test.step('创建 To Go 订单并平分为两个子单', async () => {
        return await createToGoEvenSplitRecallOrder(readyHomePage);
      });

      await test.step('使用现金结清两个子单', async () => {
        await payTargetOrderByCash(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        await payTargetOrderByCash(
          splitOrder.recallPage,
          splitOrder.targets.orderNumber,
          splitOrder.targets.secondTargetOrderNumber,
        );
      });

      const paymentTip = await test.step('打开第一个已支付子单并在现金支付卡片追加 1 元小费', async () => {
        await new RecallFlow().clearSearchConditions(splitOrder.recallPage);
        await splitOrder.recallPage.openOrderDetails(
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        await splitOrder.recallPage.addPaymentCardTip(
          orderServiceSplitOperationCase.postPaymentTipAmountInCents,
          'Cash',
        );
        await splitOrder.recallPage.closeOrderDetailsDialog();
        await splitOrder.recallPage.openOrderDetails(
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        const priceSummary = await splitOrder.recallPage.readDisplayedOrderPriceSummary();
        await splitOrder.recallPage.closeOrderDetailsDialog();
        return priceSummary.Tips ?? 0;
      });

      await test.step('校验追加后子单小费为 1 元', async () => {
        expect(paymentTip).toBeCloseTo(orderServiceSplitOperationCase.postPaymentTipAmount, 2);
      });
    },
  );

  for (const chargeCase of manualChargeEditCases) {
    test.fixme(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const chargeResource = await test.step('预置手动加收配置并刷新 POS', async () => {
          const resource = await createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const savedOrder = await test.step('创建含预置手动加收的堂食无桌台订单并保存', async () => {
          return await createSavedOrderWithManualCharge(
            readyHomePage,
            employeeLoginPage,
            chargeCase.initialCharge.name ?? chargeResource.name,
          );
        });

        await test.step('校验保存前订单已带初始手动加收', async () => {
          const initialChargeName = chargeCase.initialCharge.name ?? chargeResource.name;
          const initialAmount = parseChargeAmountText(
            readWholeChargeAmountText(savedOrder.beforeChargeSnapshot, initialChargeName),
          );
          expect(initialAmount).toBeCloseTo(
            resolveExpectedChargeAmount(
              chargeCase.initialCharge.rateType === 2 ? 'percent10' : '10.00',
              savedOrder.beforeSummary,
            ),
            2,
          );
        });

        await test.step('更新后台加收配置并刷新 POS 使配置生效', async () => {
          if (chargeCase.deleteCharge) {
            await apiSetup.charge.delete(chargeResource.id);
            return;
          }

          if (chargeCase.updateCharge) {
            await apiSetup.charge.update(chargeResource.id, chargeCase.updateCharge);
          }
        });

        const editedOrder = await test.step('重新打开最近订单进入编辑并读取加收明细', async () => {
          return await reopenSavedOrderForChargeCheck(
            homePage,
            employeeLoginPage,
            savedOrder.orderNumber,
          );
        });

        await test.step('校验编辑后订单加收明细符合后台配置变更', async () => {
          const editedAmount = parseChargeAmountText(
            readWholeChargeAmountText(editedOrder.chargeSnapshot, chargeCase.expectedChargeName),
          );

          if (chargeCase.expectedChargeAvailable) {
            expect(editedAmount).toBeCloseTo(
              resolveExpectedChargeAmount(chargeCase.expectedChargeAmount, editedOrder.summary),
              2,
            );
          } else {
            expect(editedAmount).toBeNull();
          }
        });

        if (chargeCase.expectedTaxIncreases) {
          await test.step('校验加收改为计税后订单税额增加', async () => {
            expect(editedOrder.summary.Tax).toBeGreaterThan(savedOrder.beforeSummary.Tax);
          });
        }
      },
    );
  }

  for (const chargeCase of autoChargeEditCases) {
    test.fixme(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const chargeResource = await test.step('预置自动加收配置并刷新 POS', async () => {
          const resource = await createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const savedOrder = await test.step('创建自动触发加收的堂食无桌台订单并保存', async () => {
          return await createSavedOrderWithApiAutoCharge(
            readyHomePage,
            employeeLoginPage,
            orderApi,
            chargeResource,
            chargeCase.initialCharge,
          );
        });

        await test.step('校验保存前订单已自动带出初始加收', async () => {
          const initialChargeName = chargeCase.initialCharge.name ?? chargeResource.name;
          const initialAmount = parseChargeAmountText(
            readWholeChargeAmountText(savedOrder.beforeChargeSnapshot, initialChargeName),
          );
          expect(initialAmount).toBeCloseTo(
            resolveExpectedChargeAmount(
              chargeCase.initialCharge.rateType === 2 ? 'percent10' : '10.00',
              savedOrder.beforeSummary,
            ),
            2,
          );
        });

        await test.step('更新后台自动加收配置并刷新 POS 使配置生效', async () => {
          if (chargeCase.deleteCharge) {
            await apiSetup.charge.delete(chargeResource.id);
            return;
          }

          if (chargeCase.updateCharge) {
            await apiSetup.charge.update(chargeResource.id, chargeCase.updateCharge);
          }
        });

        const editedOrder = await test.step('重新打开最近订单进入编辑并读取自动加收明细', async () => {
          return await reopenSavedOrderForChargeCheck(
            homePage,
            employeeLoginPage,
            savedOrder.orderNumber,
          );
        });

        await test.step('校验编辑后订单自动加收明细符合后台配置变更', async () => {
          const editedAmount = parseChargeAmountText(
            readWholeChargeAmountText(editedOrder.chargeSnapshot, chargeCase.expectedChargeName),
          );

          if (chargeCase.expectedChargeAvailable) {
            expect(editedAmount).toBeCloseTo(
              resolveExpectedChargeAmount(chargeCase.expectedChargeAmount, editedOrder.summary),
              2,
            );
          } else {
            expect(editedAmount).toBeNull();
          }
        });

        if (chargeCase.expectedTaxIncreases) {
          await test.step('校验自动加收改为计税后订单税额增加', async () => {
            expect(editedOrder.summary.Tax).toBeGreaterThan(savedOrder.beforeSummary.Tax);
          });
        }
      },
    );
  }

  for (const chargeCase of chargeFollowUpCases) {
    const chargeFollowUpTest =
      chargeCase.operation === 'detail-send' ||
      chargeCase.operation === 'edit-send'
        ? test
        : test.fixme;

    chargeFollowUpTest(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const chargeResource = await test.step('预置加收配置并刷新 POS', async () => {
          const resource = await createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const savedOrder = await test.step('创建含目标加收的堂食无桌台订单并保存', async () => {
          if (chargeCase.source === 'manual') {
            return await createSavedOrderWithManualCharge(
              readyHomePage,
              employeeLoginPage,
              chargeCase.initialCharge.name ?? chargeResource.name,
              { addSecondDish: chargeCase.operation === 'edit-item-split' },
            );
          }

          return await createSavedOrderWithApiAutoCharge(
            readyHomePage,
            employeeLoginPage,
            orderApi,
            chargeResource,
            chargeCase.initialCharge,
          );
        });

        await test.step('更新后台加收配置并准备后续订单操作', async () => {
          await apiSetup.charge.update(chargeResource.id, chargeCase.updateCharge);
        });

        if (chargeCase.operation === 'detail-send') {
          await test.step('从 Recall 详情页送厨订单', async () => {
            const recallPage = await openRecallAfterConfigurationRefresh(
              homePage,
              employeeLoginPage,
            );
            await new RecallFlow().sendOrderToKitchen(recallPage, savedOrder.orderNumber);
          });
        }

        if (chargeCase.operation === 'edit-send') {
          await test.step('从编辑页送厨订单', async () => {
            const editingPage = await editSavedOrderAfterConfigurationRefresh(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
            await sendEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
          });
        }

        if (chargeCase.operation === 'edit-save') {
          await test.step('从编辑页重新保存订单', async () => {
            const editingPage = await editSavedOrderAfterConfigurationRefresh(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
            await saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
          });
        }

        if (chargeCase.operation === 'detail-even-split') {
          const splitOrder = await test.step('从 Recall 详情页平分订单', async () => {
            return await splitSavedOrderFromRecallDetails(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
          });

          const childCharge = await test.step('读取第一个子单加收金额', async () => {
            return await readFirstSplitTargetCharge(splitOrder);
          });

          await test.step('校验详情页分单后的子单加收金额', async () => {
            expect(childCharge).toBeCloseTo(Number(chargeCase.expectedChargeAmount), 2);
          });
          return;
        }

        if (chargeCase.operation === 'edit-item-split' || chargeCase.operation === 'edit-even-split') {
          const splitOrder = await test.step('从编辑页分单并返回 Recall', async () => {
            return await splitSavedOrderFromEditPage(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
              chargeCase.operation === 'edit-item-split' ? 'item' : 'even',
            );
          });

          const childCharge = await test.step('读取第一个子单加收金额', async () => {
            return await readFirstSplitTargetCharge(splitOrder);
          });

          await test.step('校验编辑页分单后的子单加收金额', async () => {
            expect(childCharge).toBeCloseTo(Number(chargeCase.expectedChargeAmount), 2);
          });
          return;
        }

        const editedCharge = await test.step('重新打开订单并读取编辑页加收金额', async () => {
          if (
            chargeCase.source === 'auto' &&
            chargeCase.operation === 'detail-send' &&
            'orderId' in savedOrder &&
            typeof savedOrder.orderId === 'number'
          ) {
            return {
              amount: await readOrderChargeAmountByApi(
                orderApi,
                savedOrder.orderId,
                chargeCase.expectedChargeName,
              ),
              summary: savedOrder.beforeSummary,
            };
          }

          return await readEditedOrderChargeAmount(
            homePage,
            employeeLoginPage,
            savedOrder.orderNumber,
            chargeCase.expectedChargeName,
          );
        });

        await test.step('校验后续操作后的加收金额', async () => {
          expect(editedCharge.amount).toBeCloseTo(
            resolveExpectedChargeAmount(chargeCase.expectedChargeAmount, editedCharge.summary),
            2,
          );
        });
      },
    );
  }

  for (const chargeCase of chargeCopyCases) {
    test.fixme(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const chargeResource = await test.step('预置复制订单场景所需的加收配置并刷新 POS', async () => {
          const resource = await createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const savedOrder = await test.step('创建包含目标加收的源订单并保存', async () => {
          return await createSavedOrderForChargeCopyCase(
            readyHomePage,
            employeeLoginPage,
            chargeCase,
            chargeCase.initialCharge.name ?? chargeResource.name,
          );
        });

        await test.step('校验源订单保存前已按初始配置带出加收', async () => {
          const initialChargeName = chargeCase.initialCharge.name ?? chargeResource.name;
          const initialAmount = parseChargeAmountText(
            readWholeChargeAmountText(savedOrder.beforeChargeSnapshot, initialChargeName),
          );
          expect(initialAmount).toBeCloseTo(
            resolveExpectedChargeAmount(
              chargeCase.initialCharge.rateType === 2 ? 'percent10' : '10.00',
              savedOrder.beforeSummary,
            ),
            2,
          );
        });

        await test.step('更新后台加收配置并准备复制订单', async () => {
          await apiSetup.charge.update(chargeResource.id, chargeCase.updateCharge);
        });

        const copiedRecallPage = await test.step('刷新 POS 后从 Recall 详情复制源订单', async () => {
          return await copySavedOrderAfterConfigurationRefresh(
            homePage,
            employeeLoginPage,
            savedOrder.orderNumber,
          );
        });

        const copiedCharge = await test.step('读取复制后新订单的加收明细', async () => {
          return await readCopiedOrderChargeAmount(copiedRecallPage, chargeCase.expectedChargeName);
        });

        await test.step('校验复制订单后的加收明细符合后台配置变更', async () => {
          if (chargeCase.expectedChargeAvailable) {
            expect(copiedCharge.summary).not.toBeNull();
            expect(copiedCharge.amount).not.toBeNull();
            expect(copiedCharge.amount!).toBeCloseTo(
              resolveExpectedChargeAmount(chargeCase.expectedChargeAmount, copiedCharge.summary!),
              2,
            );
          } else {
            expect(copiedCharge.amount).toBeNull();
          }
        });
      },
    );
  }

  test.fixme(
    '[POS-27303] 应能在修改和删除加收配置后合单并累加原订单加收金额',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-27303')],
    },
    async ({ homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const chargeResources = await test.step('预置两条用于合单的后台加收配置并刷新 POS', async () => {
        const first = await createChargeSetup(apiSetup, {
          ...manualFixedCharge,
          name: 'auto_test1',
          orderType: 'dine in',
        });
        const second = await createChargeSetup(apiSetup, {
          ...manualFixedCharge,
          name: 'auto_test2',
          orderType: 'dine in',
        });
        await readyHomePage.clickRefresh();
        return { first, second };
      });

      const firstOrder = await test.step('创建第一笔含 auto_test1 加收的堂食无桌台订单并保存', async () => {
        return await createSavedOrderWithManualCharge(
          readyHomePage,
          employeeLoginPage,
          chargeResources.first.name,
        );
      });

      const secondOrder = await test.step('创建第二笔含 auto_test2 加收的堂食无桌台订单并保存', async () => {
        return await createSavedOrderWithManualCharge(
          readyHomePage,
          employeeLoginPage,
          chargeResources.second.name,
        );
      });

      await test.step('修改第一条加收配置并删除第二条加收配置', async () => {
        await apiSetup.charge.update(chargeResources.first.id, {
          ...manualFixedCharge,
          name: 'mod_test1',
          orderType: 'dine in',
        });
        await apiSetup.charge.delete(chargeResources.second.id);
      });

      const combinedRecallPage = await test.step('刷新 POS 后从 Recall 发起两笔订单合单', async () => {
        return await combineSavedOrdersAfterConfigurationRefresh(
          homePage,
          employeeLoginPage,
          firstOrder.orderNumber,
          secondOrder.orderNumber,
        );
      });

      const firstCombinedCharge = await test.step('读取合单后第一条加收金额', async () => {
        return await readTransferredOrderChargeAmount(combinedRecallPage, 'auto_test1');
      });
      const secondCombinedCharge = await test.step('读取合单后第二条加收金额', async () => {
        return await readTransferredOrderChargeAmount(combinedRecallPage, 'auto_test2');
      });

      await test.step('校验合单后两笔历史加收金额累加保留', async () => {
        expect(firstCombinedCharge.amount).toBeCloseTo(10, 2);
        expect(secondCombinedCharge.amount).toBeCloseTo(10, 2);
        expect((firstCombinedCharge.amount ?? 0) + (secondCombinedCharge.amount ?? 0)).toBeCloseTo(
          20,
          2,
        );
      });
    },
  );

  for (const chargeCase of chargeTransferCases) {
    test.fixme(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const chargeResource = await test.step('预置移菜或移单场景所需的加收配置并刷新 POS', async () => {
          const resource = await createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const existingTargetOrder = await test.step('按场景需要创建可接收菜品的已有订单', async () => {
          if (chargeCase.operation !== 'move-item-existing-order') {
            return null;
          }

          return await createSavedRecallOrder(readyHomePage, employeeLoginPage);
        });

        const sourceOrder = await test.step('创建包含目标加收的源订单并保存', async () => {
          if (chargeCase.source === 'manual') {
            return await createSavedOrderWithManualCharge(
              readyHomePage,
              employeeLoginPage,
              chargeCase.initialCharge.name ?? chargeResource.name,
            );
          }

          return await createSavedOrderWithAutoCharge(readyHomePage, employeeLoginPage);
        });

        const beforeTransferCharge = await test.step('记录移菜或移单前源订单加收金额', async () => {
          return parseChargeAmountText(
            readWholeChargeAmountText(sourceOrder.beforeChargeSnapshot, chargeCase.expectedChargeName),
          );
        });

        await test.step('按用例要求修改或删除后台加收配置', async () => {
          if (chargeCase.operation === 'move-whole-order-after-delete') {
            await apiSetup.charge.delete(chargeResource.id);
            return;
          }

          if (chargeCase.updateCharge) {
            await apiSetup.charge.update(chargeResource.id, chargeCase.updateCharge);
          }
        });

        const transferredRecallPage = await test.step('刷新 POS 后执行移菜或移单操作', async () => {
          if (
            chargeCase.operation === 'move-item-new-order' ||
            chargeCase.operation === 'move-item-existing-order'
          ) {
            return await moveItemAfterConfigurationRefresh(
              homePage,
              employeeLoginPage,
              sourceOrder.orderNumber,
              existingTargetOrder?.orderNumber,
            );
          }

          return await moveWholeOrderAfterConfigurationRefresh(
            homePage,
            employeeLoginPage,
            sourceOrder.orderNumber,
          );
        });

        const transferredCharge = await test.step('读取移菜或移单后的目标订单加收金额', async () => {
          return await readTransferredOrderChargeAmount(
            transferredRecallPage,
            chargeCase.expectedChargeName,
          );
        });

        await test.step('校验移菜或移单后的加收金额符合预期', async () => {
          if (chargeCase.expectedTargetChargeAvailable) {
            expect(transferredCharge.summary).not.toBeNull();
            expect(transferredCharge.amount).not.toBeNull();
            expect(transferredCharge.amount!).toBeCloseTo(
              resolveExpectedChargeAmount(chargeCase.expectedChargeAmount, transferredCharge.summary!),
              2,
            );
          } else {
            expect(transferredCharge.amount).toBeNull();
          }

          if (
            chargeCase.operation === 'move-whole-order-after-update' ||
            chargeCase.operation === 'move-whole-order-after-delete'
          ) {
            expect(transferredCharge.amount).toBeCloseTo(beforeTransferCharge ?? 0, 2);
          }
        });
      },
    );
  }

  test.fixme(
    '[POS-30756] 应能在现金支付后追加小费并在转服务员后保持订单金额一致',
    {
      tag: ['@小费', '@现金支付'],
      annotation: [jiraIssueAnnotation('POS-30756')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const paidOrder = await test.step('创建堂食无桌台订单并使用现金全额结账', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const beforePaymentSummary = await orderDishesPage.readPriceSummary();
        const paymentPage = await orderDishesPage.openPayment();
        await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
        const recallPage = await readyHomePage.clickRecall();
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        return { beforePaymentSummary, orderNumber, recallPage };
      });

      const afterTipSummary = await test.step('现金支付完成后追加小费并读取订单金额', async () => {
        await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
        await paidOrder.recallPage.addPaymentCardTip(
          orderServiceSplitOperationCase.postPaymentTipAmountInCents,
          'Cash',
        );
        return await paidOrder.recallPage.readDisplayedOrderPriceSummary();
      });

      const transferredSnapshot = await test.step('转移订单服务员后读取订单状态和金额快照', async () => {
        return await transferOrderServerAndReadSnapshot(paidOrder.recallPage, paidOrder.orderNumber);
      });

      await test.step('校验转服务员前后订单状态与金额保持一致', async () => {
        expect(transferredSnapshot.status).not.toBeNull();
        expect(transferredSnapshot.total).toBeCloseTo(afterTipSummary.Total ?? afterTipSummary['Total(Cash)'], 2);
        expect(afterTipSummary.Total ?? afterTipSummary['Total(Cash)']).toBeCloseTo(
          paidOrder.beforePaymentSummary['Total(Cash)'] +
            orderServiceSplitOperationCase.postPaymentTipAmount,
          2,
        );
      });
    },
  );

  test.fixme(
    '[POS-31301] 应能在清空单菜折扣并保存后保持订单金额恢复',
    {
      tag: ['@折扣'],
      annotation: [jiraIssueAnnotation('POS-31301')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const discountOrder = await test.step('创建含单菜折扣的订单并保存', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const beforeDiscountSummary = await orderDishesPage.readPriceSummary();
        await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
          dishNames: [orderServiceDishes.regular.name],
          scope: 'item',
          type: 'fixed',
          value: -orderServiceSplitOperationCase.itemDiscountAmount,
        });
        const discountedSummary = await orderDishesPage.readPriceSummary();
        const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        return { beforeDiscountSummary, discountedSummary, orderNumber };
      });

      const afterClearSummary = await test.step('重新打开订单清空单菜折扣并保存', async () => {
        const editingPage = await editSavedOrderAfterConfigurationRefresh(
          homePage,
          employeeLoginPage,
          discountOrder.orderNumber,
        );
        await new OrderDishesFlow().clearAllCharges(editingPage, { scope: 'item' });
        const summary = await editingPage.readPriceSummary();
        await saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
        return summary;
      });

      await test.step('校验清空单菜折扣后金额恢复到折扣前', async () => {
        expect(discountOrder.discountedSummary['Total(Cash)']).toBeLessThan(
          discountOrder.beforeDiscountSummary['Total(Cash)'],
        );
        expect(afterClearSummary['Total(Cash)']).toBeCloseTo(
          discountOrder.beforeDiscountSummary['Total(Cash)'],
          2,
        );
      });
    },
  );

  test.fixme(
    '[POS-31081] 应能在自动加收计入小费后按金额分单并保持报表费用金额一致',
    {
      tag: ['@分单', '@加收', '@小费'],
      annotation: [jiraIssueAnnotation('POS-31081')],
    },
    async ({ homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const chargeResource = await test.step('预置计入小费的自动加收配置并刷新 POS', async () => {
        const resource = await createChargeSetup(apiSetup, {
          name: 'other_charge',
          orderType: 'dine in,delivery,pick up,to go',
          rate: 10,
          rateType: 1,
          sharedTip: true,
          triggerMode: 1,
          type: 'DEFAULT',
        });
        await readyHomePage.clickRefresh();
        return resource;
      });

      const reportFeeBefore = await test.step('读取下单前报表费用金额', async () => {
        return await readReportFeeAmount(readyHomePage);
      });

      const savedOrder = await test.step('创建自动加收订单并保存', async () => {
        return await createSavedOrderWithAutoCharge(readyHomePage, employeeLoginPage);
      });

      const reportFeeAfterOrder = await test.step('读取保存订单后的报表费用金额', async () => {
        return await readReportFeeAmount(readyHomePage);
      });

      await test.step('从 Recall 进入分单并按金额拆分订单', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          savedOrder.recallPage,
          savedOrder.orderNumber,
        );
        await new SplitOrderFlow().splitOrderByAmounts(splitOrderPage, [
          orderServiceSplitOperationCase.amountSplitFirstAmount,
        ]);
        await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
      });

      const reportFeeAfterSplit = await test.step('读取按金额分单后的报表费用金额', async () => {
        return await readReportFeeAmount(readyHomePage);
      });

      await test.step('校验自动加收计入小费后的报表费用金额符合预期', async () => {
        expect(reportFeeAfterOrder).toBeCloseTo(reportFeeBefore + 10, 2);
        expect(reportFeeAfterSplit).toBeCloseTo(reportFeeAfterOrder, 2);
      });

      await test.step('清理后台加收配置并刷新 POS', async () => {
        await apiSetup.charge.delete(chargeResource.id);
        await readyHomePage.clickRefresh();
      });
    },
  );

  test.fixme(
    '[POS-30566] 应能在现金支付订单退款后保持报表首页 unpaid 数值不变',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-30566')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const unpaidBefore = await test.step('读取现金支付前报表首页 unpaid 数值', async () => {
        return await readReportHomeUnpaidAmount(readyHomePage);
      });

      const paidOrder = await test.step('创建堂食无桌台订单并使用现金全额结账', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const paymentPage = await orderDishesPage.openPayment();
        await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
        const recallPage = await readyHomePage.clickRecall();
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        return { orderNumber, recallPage };
      });

      await test.step('打开现金支付订单并退款所有正向支付流水', async () => {
        await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
        await new RecallFlow().refundAllPaymentRecords(paidOrder.recallPage);
      });

      const unpaidAfterRefund = await test.step('读取现金退款后报表首页 unpaid 数值', async () => {
        return await readReportHomeUnpaidAmount(readyHomePage);
      });

      await test.step('校验现金退款前后报表首页 unpaid 数值不变', async () => {
        expect(unpaidAfterRefund).toBeCloseTo(unpaidBefore, 2);
      });
    },
  );

  for (const chargeCase of combineChargeRecalculationCases) {
    test.fixme(
      chargeCase.title,
      {
        tag: chargeCase.expectsTipUnchanged ? ['@加收', '@小费'] : ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, systemConfigurationApi }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const chargeResource = await test.step('预置合单加收配置并设置合单是否重新计算加收', async () => {
          const resource = await createChargeSetup(apiSetup, chargeCase.charge);
          await configureCombineChargeRecalculation(
            systemConfigurationApi,
            chargeCase.recalculate,
            readyHomePage,
          );
          return resource;
        });

        const sourceOrder = await test.step('创建合单源订单并记录合单前加收信息', async () => {
          return await createSavedOrderForCombineChargeCase(
            readyHomePage,
            employeeLoginPage,
            chargeCase,
            chargeCase.charge.name ?? chargeResource.name,
          );
        });

        const targetOrder = await test.step('创建用于接收合并的目标订单', async () => {
          if (
            chargeCase.scenario === 'single-auto' ||
            chargeCase.scenario === 'single-manual' ||
            chargeCase.scenario === 'three-charges'
          ) {
            return await createSavedToGoOrder(readyHomePage, employeeLoginPage);
          }

          return await createSavedRecallOrder(readyHomePage, employeeLoginPage);
        });

        const oldChargeAmount = await test.step('读取源订单合并前目标加收金额', async () => {
          return parseChargeAmountText(
            readWholeChargeAmountText(sourceOrder.beforeChargeSnapshot, chargeCase.expectedChargeName),
          );
        });

        const combinedRecallPage = await test.step('从 Recall 合并两笔订单', async () => {
          return await combineSavedOrdersAfterConfigurationRefresh(
            homePage,
            employeeLoginPage,
            sourceOrder.orderNumber,
            targetOrder.orderNumber,
          );
        });

        const combinedCharge = await test.step('读取合单后的目标加收金额', async () => {
          return await readTransferredOrderChargeAmount(
            combinedRecallPage,
            chargeCase.expectedChargeName,
          );
        });

        await test.step('校验合单后加收结果符合重新计算配置', async () => {
          if (chargeCase.expectedChargeAvailable) {
            expect(combinedCharge.summary).not.toBeNull();
            expect(combinedCharge.amount).not.toBeNull();
            expect(combinedCharge.amount!).toBeCloseTo(
              resolveExpectedChargeAmount(chargeCase.expectedChargeAmount, combinedCharge.summary!),
              2,
            );
          } else {
            expect(combinedCharge.amount).toBeNull();
          }

          if (chargeCase.expectsTipUnchanged && oldChargeAmount !== null) {
            expect(combinedCharge.amount).toBeCloseTo(oldChargeAmount, 2);
          }
        });

        await test.step('清理后台加收配置并刷新 POS', async () => {
          await apiSetup.charge.delete(chargeResource.id);
          await readyHomePage.clickRefresh();
        });
      },
    );
  }

  test.fixme(
    '[POS-32955] 应能在加收页展示 OpenFood 自定义中英文名称',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-32955')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const orderDishesPage = await test.step('创建堂食无桌台订单并添加 OpenFood 自定义名称菜品', async () => {
        const page = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addOpenPriceDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
          10,
        );
        return page;
      });

      const openFoodName = 'OpenFood测试Name';
      const chargeDishName = await test.step('打开加收页并读取 OpenFood 菜品名称', async () => {
        return await readOpenFoodNameInChargeDialog(orderDishesPage);
      });

      await test.step('校验加收页展示 OpenFood 自定义名称', async () => {
        expect(chargeDishName).toBe(openFoodName);
      });
    },
  );

  test.fixme(
    '[POS-32934] 应能在点单页切换语言后保持选项界面文案正确',
    {
      annotation: [jiraIssueAnnotation('POS-32934')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const orderDishesPage = await test.step('创建堂食无桌台订单并添加多个菜品用于语言切换校验', async () => {
        const page = await enterDineInNoTableOrder(readyHomePage);
        await addTwoRegularDishes(page);
        return page;
      });

      const addLabels = await test.step('切换点单语言并读取分单页新增子单入口文案', async () => {
        return await readLanguageSwitchSplitAddLabels(orderDishesPage);
      });

      await test.step('校验语言切换前后选项入口文案正确', async () => {
        expect(addLabels).toEqual(['Add', '加', 'Add']);
      });
    },
  );

  test.fixme(
    '[POS-32954] 应能在分单时按配置展示未分单菜品和全部菜品',
    {
      tag: ['@分单'],
      annotation: [jiraIssueAnnotation('POS-32954')],
    },
    async ({ homePage, employeeLoginPage, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      await test.step('开启分单时展示未分单菜品配置并刷新 POS', async () => {
        await configureShowUnsplitItemsWhenSplitOrder(systemConfigurationApi, true, readyHomePage);
      });

      const orderDishesPage = await test.step('创建含三道菜的堂食无桌台订单并进入分单', async () => {
        const page = await enterDineInNoTableOrder(readyHomePage);
        await addTwoRegularDishes(page);
        await new OrderDishesFlow().addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return page;
      });

      const dishCounts = await test.step('读取分单过程中未分单菜品和全部菜品数量', async () => {
        return await readSplitOrderDishListCounts(orderDishesPage);
      });

      await test.step('校验未分单菜品与全部菜品展示数量', async () => {
        expect(dishCounts.sharedBeforeMove).toBe(3);
        expect(dishCounts.sharedAfterFirstMove).toBe(2);
        expect(dishCounts.sharedAfterSecondMove).toBe(0);
        expect(dishCounts.allDishCount).toBe(3);
      });

      await test.step('关闭分单时展示未分单菜品配置并刷新 POS', async () => {
        await configureShowUnsplitItemsWhenSplitOrder(systemConfigurationApi, false, readyHomePage);
      });
    },
  );

  test.fixme(
    '[POS-32963] 应能在加收金额出现三位小数时按规则进位到分',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-32963')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const chargeAmount = await test.step('创建改价订单并添加会产生 x.xx5 的百分比加收', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderDishesPage.changeOrderedDishPrice(orderServiceDishes.regular.name, 100);
        await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
          scope: 'whole',
          type: 'percentage',
          value: 1.015,
        });
        const snapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
        return parseChargeAmountText(snapshot.wholeOrderCharges[0]?.amountText ?? null);
      });

      await test.step('校验加收金额按四舍五入进位到 1.02', async () => {
        expect(chargeAmount).toBeCloseTo(1.02, 2);
      });
    },
  );

  test.fixme(
    '[POS-33063] 应能在税额计算包含加收时正确计算服务加收、税和订单金额',
    {
      tag: ['@加收', '@折扣'],
      annotation: [jiraIssueAnnotation('POS-33063')],
    },
    async ({ homePage, employeeLoginPage, apiSetup, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      await test.step('开启税额计算包含加收配置并预置自动服务加收', async () => {
        await configureTaxIncludesCharge(systemConfigurationApi, true, readyHomePage);
        await createChargeSetup(apiSetup, {
          ...manualFixedCharge,
          name: manualFixedChargeName,
          rate: 10,
          rateType: 2,
          triggerMode: 1,
          type: 'SERVICE',
        });
      });

      const summary = await test.step('创建订单并读取税额和加收金额', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return await orderDishesPage.readPriceSummary();
      });

      await test.step('校验服务加收基于 subtotal 加税额计算', async () => {
        const charge = (summary as Record<string, number>).Charge ?? 0;
        expect(Math.abs((summary.Subtotal + summary.Tax) * 0.1 - charge)).toBeLessThan(0.1);
      });

      await test.step('关闭税额计算包含加收配置并刷新 POS', async () => {
        await configureTaxIncludesCharge(systemConfigurationApi, false, readyHomePage);
      });
    },
  );

  test.fixme(
    '[POS-32903] 应能创建地址包含 & 符号的 Delivery 订单并送厨成功',
    {
      annotation: [jiraIssueAnnotation('POS-32903')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const recallPage = await test.step('创建地址包含 & 的 Delivery 订单并送厨', async () => {
        const orderDishesPage = await new TakeoutFlow().startDeliveryOrder(
          readyHomePage,
          orderServiceCustomers.deliveryWithAmpersandAddress,
        );
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
      });

      const orderDetails = await test.step('打开最新 Delivery 订单并从详情送厨', async () => {
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        await recallPage.openOrderDetails(orderNumber);
        const beforeSendDetails = await recallPage.readOrderDetailsSnapshot();

        if (beforeSendDetails.availableActions.send) {
          await recallPage.clickSendInOrderDetails();
        }

        await recallPage.closeOrderDetailsDialog();
        await recallPage.openOrderDetails(orderNumber);
        return await recallPage.readOrderDetailsSnapshot();
      });

      await test.step('校验 Delivery 订单保留 & 地址并完成送厨', async () => {
        expect(orderDetails.customerInfo?.address).toContain(
          orderServiceCustomers.deliveryWithAmpersandAddress.address,
        );
        expect(orderDetails.items.some((item) => item.sentTime !== null)).toBe(true);
      });
    },
  );

  test(
    '[POS-34555] 应能分两次现金付款且第二次产生找零后支付成功',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-34555')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const paidOrder = await test.step('创建 20 元堂食无桌台订单并分两次现金支付', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderDishesPage.changeOrderedDishPrice(orderServiceDishes.regular.name, 20);

        const paymentPage = await orderDishesPage.openPayment();
        const paymentFlow = new PaymentFlow();
        await paymentFlow.payPartialByCashKeepingPaymentOpen(paymentPage, {
          amountInCents: 500,
          printReceipt: false,
        });

        await paymentFlow.payPartialByCash(paymentPage, {
          amountInCents: 2000,
          printReceipt: false,
        });

        const recallPage = await readyHomePage.clickRecall();
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        return { orderNumber, recallPage };
      });

      const details = await test.step('打开最新订单并读取支付状态', async () => {
        await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
        return await paidOrder.recallPage.readOrderDetailsSnapshot();
      });

      await test.step('校验第二次现金找零后订单状态为 Paid', async () => {
        expect(details.paymentStatus).toContain('Paid');
      });
    },
  );
});

import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { RecallDatabaseFlow } from '../../flows/recall-database.flow';
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
import { createShortTestName } from '../../api/core/test-data-id';
import { jiraIssueAnnotation } from '../../utils/jira';
import { waitUntil } from '../../utils/wait';

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
  confirmUpdatedCharge?: boolean;
  issue: `POS-${number}`;
  title: string;
  initialCharge: ChargeSetupOverrides;
  source?: 'manual' | 'auto';
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
  targetOrderType?: 'dine-in' | 'to-go';
  expectedChargeName: string;
  expectedChargeAmount: ChargeExpectedAmount;
  expectedChargeAvailable: boolean;
  coversTip?: boolean;
  preservesSourceChargeAmount?: boolean;
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
  orderType: 'dine in',
};

const manualPercentCharge: ChargeSetupOverrides = {
  name: manualPercentChargeName,
  rate: 10,
  rateType: 2,
  triggerMode: 2,
  taxed: false,
  type: 'DEFAULT',
  orderType: 'dine in',
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
    confirmUpdatedCharge: true,
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
    title: '[POS-27165] 应能在编辑已保存订单时移除已改为 Delivery 的自动服务加收',
    initialCharge: {
      ...manualFixedCharge,
      triggerMode: 1,
      type: 'SERVICE',
    },
    source: 'auto',
    updateCharge: {
      ...manualFixedCharge,
      type: 'DELIVERY',
      orderType: 'delivery',
    },
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

const blockedManualChargeEditReasons = new Map<string, string>([
  [
    'POS-27156',
    '实测后台将手动加收改名为 mod_test1 后，重新编辑订单仍显示历史名称 manu_test_fixed，待确认业务规则。',
  ],
  [
    'POS-27157',
    '实测后台将手动固定 $10 加收改为 10% 后，重新编辑订单仍保留历史固定金额 $10，未按新配置重算为 $0.88。',
  ],
  [
    'POS-27158',
    '实测后台将手动 10% 加收改为固定 $10 后，重新编辑订单仍保留历史 10% 金额 $0.88。',
  ],
  [
    'POS-27159',
    '实测后台将手动固定加收由 $10 改为 $20 后，重新编辑订单仍保留历史 $10。',
  ],
  [
    'POS-27160',
    '后台将手动百分比加收由 10% 改为 20% 后，加收弹窗仍显示历史金额 $0.88，而非按新配置计算的 $1.76。',
  ],
  [
    'POS-27163',
    '实测后台将手动固定加收改为计税后，重新编辑订单税额仍为 $0.88，未高于修改前税额。',
  ],
]);

const autoFixedChargeName = 'auto_test_fixed';
const autoPercentChargeName = 'auto_test_perc';

const autoFixedCharge: ChargeSetupOverrides = {
  name: autoFixedChargeName,
  rate: 10,
  rateType: 1,
  triggerMode: 1,
  taxed: false,
  type: 'DEFAULT',
  orderType: 'dine in',
};

const autoPercentCharge: ChargeSetupOverrides = {
  name: autoPercentChargeName,
  rate: 10,
  rateType: 2,
  triggerMode: 1,
  taxed: false,
  type: 'DEFAULT',
  orderType: 'dine in',
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

const blockedAutoChargeEditReasons = new Map<string, string>([
  [
    'POS-27170',
    '使用隔离唯一名称创建自动固定 $10 加收；后台改名后重新编辑订单未显示改名后的目标加收，仅剩环境自动加收。',
  ],
  [
    'POS-27171',
    '使用隔离唯一名称将自动固定 $10 加收改为 10% 后，重新编辑订单未显示目标自动加收。',
  ],
  [
    'POS-27172',
    '使用隔离唯一名称将自动 10% 加收改为固定 $10 后，重新编辑订单未显示目标自动加收。',
  ],
  [
    'POS-27173',
    '使用隔离唯一名称将自动固定加收由 $10 改为 $20 后，重新编辑订单未显示目标自动加收。',
  ],
  [
    'POS-27174',
    '使用隔离唯一名称将自动百分比加收由 10% 改为 20% 后，重新编辑订单未显示目标自动加收。',
  ],
  [
    'POS-27177',
    '使用隔离唯一名称将自动加收改为计税后，重新编辑订单未显示目标自动加收。',
  ],
]);

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
    title: '[POS-27242] 应能在手动加收配置修改后按菜品分单并按子单分摊加收',
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
  orderType: 'dine in',
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
    initialCharge: { ...copyAutoFixedCharge, minGuest: 1, type: 'SERVICE' },
    source: 'auto',
    updateCharge: { ...copyAutoFixedCharge, minGuest: 2, type: 'SERVICE' },
    expectedChargeName: copyAutoChargeName,
    expectedChargeAmount: '10.00',
    expectedChargeAvailable: false,
  },
  {
    issue: 'POS-27271',
    title: '[POS-27271] 应能在复制 Delivery 订单时移除不满足里程条件的自动加收',
    initialCharge: { ...copyAutoFixedCharge, orderType: 'delivery', type: 'DELIVERY' },
    source: 'delivery-auto',
    updateCharge: {
      ...copyAutoFixedCharge,
      minMileage: 999,
      orderType: 'delivery',
      type: 'DELIVERY',
    },
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
    title: '[POS-27314] 应能在修改自动加收后移菜并保留源订单原加收',
    initialCharge: { ...copyAutoFixedCharge, rateType: 2 },
    source: 'auto',
    operation: 'move-item-new-order',
    updateCharge: { ...copyAutoFixedCharge, name: 'mod_test1', rateType: 2 },
    expectedChargeName: copyAutoChargeName,
    expectedChargeAmount: 'percent10',
    expectedTargetChargeAvailable: false,
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
    coversTip: true,
    preservesSourceChargeAmount: true,
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
    title: '[POS-32008] 应能在合单不重新计算加收时累加两笔订单的同名自动加收',
    recalculate: false,
    scenario: 'single-auto',
    charge: { ...autoFixedCharge, name: 'auto_test1', orderType: 'dine in' },
    firstOrderType: 'dine-in',
    targetOrderType: 'dine-in',
    expectedChargeName: 'auto_test1',
    expectedChargeAmount: '20.00',
    expectedChargeAvailable: true,
  },
  {
    issue: 'POS-32016',
    title: '[POS-32016] 应能在合单重新计算加收时按合单后金额计算满足条件的 Delivery 加收',
    recalculate: true,
    scenario: 'single-auto',
    charge: {
      ...autoPercentCharge,
      orderType: 'delivery',
      sharedTip: true,
      type: 'DELIVERY',
    },
    firstOrderType: 'delivery',
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: true,
    coversTip: true,
  },
  {
    issue: 'POS-32017',
    title: '[POS-32017] 应能在合单重新计算加收时移除不满足条件的 Delivery 加收',
    recalculate: true,
    scenario: 'single-auto',
    charge: {
      ...autoPercentCharge,
      orderType: 'delivery',
      sharedTip: true,
      type: 'DELIVERY',
    },
    firstOrderType: 'delivery',
    targetOrderType: 'dine-in',
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: false,
    coversTip: true,
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
    coversTip: true,
    preservesSourceChargeAmount: true,
  },
];

function annotateKnownProductFailure(reason: string | undefined): void {
  if (!reason) {
    return;
  }

  test.info().annotations.push({
    type: '已知产品问题',
    description: reason,
  });
}

function createIsolatedChargeEditCase(chargeCase: ChargeEditCase): ChargeEditCase {
  const initialName = createShortTestName({
    prefix: 'AC',
    domain: chargeCase.issue,
    maxLength: 16,
  });
  const renamesCharge =
    chargeCase.updateCharge?.name !== undefined &&
    chargeCase.updateCharge.name !== chargeCase.initialCharge.name;
  const updatedName = renamesCharge
    ? createShortTestName({
        prefix: 'AU',
        domain: chargeCase.issue,
        maxLength: 16,
      })
    : initialName;
  const expectedChargeName =
    chargeCase.expectedChargeName === chargeCase.initialCharge.name
      ? initialName
      : chargeCase.expectedChargeName === chargeCase.updateCharge?.name
        ? updatedName
        : chargeCase.expectedChargeName;

  return {
    ...chargeCase,
    initialCharge: {
      ...chargeCase.initialCharge,
      name: initialName,
    },
    expectedChargeName,
    ...(chargeCase.updateCharge
      ? {
          updateCharge: {
            ...chargeCase.updateCharge,
            name: updatedName,
          },
        }
      : {}),
  };
}

function createIsolatedChargeFollowUpCase(
  chargeCase: ChargeFollowUpCase,
): ChargeFollowUpCase {
  const initialName = createShortTestName({
    prefix: 'FC',
    domain: chargeCase.issue,
    maxLength: 16,
  });
  const renamesCharge = chargeCase.updateCharge.name !== chargeCase.initialCharge.name;
  const updatedName = renamesCharge
    ? createShortTestName({
        prefix: 'FU',
        domain: chargeCase.issue,
        maxLength: 16,
      })
    : initialName;
  const expectedChargeName =
    chargeCase.expectedChargeName === chargeCase.initialCharge.name
      ? initialName
      : chargeCase.expectedChargeName === chargeCase.updateCharge.name
        ? updatedName
        : chargeCase.expectedChargeName;

  return {
    ...chargeCase,
    initialCharge: {
      ...chargeCase.initialCharge,
      name: initialName,
    },
    updateCharge: {
      ...chargeCase.updateCharge,
      name: updatedName,
    },
    expectedChargeName,
  };
}

function createIsolatedChargeCopyCase(chargeCase: ChargeCopyCase): ChargeCopyCase {
  const initialName = createShortTestName({
    prefix: 'CC',
    domain: chargeCase.issue,
    maxLength: 16,
  });
  const renamesCharge = chargeCase.updateCharge.name !== chargeCase.initialCharge.name;
  const updatedName = renamesCharge
    ? createShortTestName({
        prefix: 'CU',
        domain: chargeCase.issue,
        maxLength: 16,
      })
    : initialName;
  const expectedChargeName =
    chargeCase.expectedChargeName === chargeCase.initialCharge.name
      ? initialName
      : chargeCase.expectedChargeName === chargeCase.updateCharge.name
        ? updatedName
        : chargeCase.expectedChargeName;

  return {
    ...chargeCase,
    initialCharge: {
      ...chargeCase.initialCharge,
      name: initialName,
    },
    updateCharge: {
      ...chargeCase.updateCharge,
      name: updatedName,
    },
    expectedChargeName,
  };
}

function createIsolatedChargeTransferCase(
  chargeCase: ChargeTransferCase,
): ChargeTransferCase {
  const initialName = createShortTestName({
    prefix: 'TC',
    domain: chargeCase.issue,
    maxLength: 16,
  });
  const renamesCharge =
    chargeCase.updateCharge?.name !== undefined &&
    chargeCase.updateCharge.name !== chargeCase.initialCharge.name;
  const updatedName = renamesCharge
    ? createShortTestName({
        prefix: 'TU',
        domain: chargeCase.issue,
        maxLength: 16,
      })
    : initialName;
  const expectedChargeName =
    chargeCase.expectedChargeName === chargeCase.initialCharge.name
      ? initialName
      : chargeCase.expectedChargeName === chargeCase.updateCharge?.name
        ? updatedName
        : chargeCase.expectedChargeName;

  return {
    ...chargeCase,
    initialCharge: {
      ...chargeCase.initialCharge,
      name: initialName,
    },
    expectedChargeName,
    ...(chargeCase.updateCharge
      ? {
          updateCharge: {
            ...chargeCase.updateCharge,
            name: updatedName,
          },
        }
      : {}),
  };
}

function createIsolatedCombineChargeCase(
  chargeCase: CombineChargeRecalculationCase,
): CombineChargeRecalculationCase {
  const chargeName = createShortTestName({
    prefix: 'BC',
    domain: chargeCase.issue,
    maxLength: 16,
  });

  return {
    ...chargeCase,
    charge: {
      ...chargeCase.charge,
      name: chargeName,
    },
    expectedChargeName:
      chargeCase.expectedChargeName === chargeCase.charge.name
        ? chargeName
        : chargeCase.expectedChargeName,
  };
}

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
  options: {
    apiBaseURL: string;
    orderApi: OrderApiClient;
    addTip?: boolean;
    tipAmountInCents?: number;
  },
): Promise<{ recallPage: RecallPage; targets: SplitOrderTargets }> {
  const databaseFlow = new RecallDatabaseFlow(options.apiBaseURL);
  const occupiedOrderIds = await databaseFlow.readLeastOccupiedTableOrderIds(1);
  const clearTableResponse = await options.orderApi.clearTable({
    orderIds: occupiedOrderIds,
  });
  expect(clearTableResponse.ok()).toBe(true);
  const clearTableBody = (await clearTableResponse.json()) as {
    code?: number;
  };
  expect(clearTableBody.code).toBe(0);
  await readyHomePage.clickRefresh();

  const selectTablePage = await readyHomePage.enterDineIn();
  const { orderDishesPage } = await new SelectTableFlow()
    .selectAnyAvailableTableAndEnterOrderDishes(selectTablePage, 2);
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
  return (await readTargetPriceSummary(recallPage, orderNumber, targetOrderNumber)).Charge ?? 0;
}

async function readTargetPriceSummary(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<Record<string, number>> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();
  await recallPage.closeOrderDetailsDialog();
  return priceSummary;
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

async function openLatestSplitOrderTargets(
  recallPage: RecallPage,
  expectedOrderNumber?: string,
): Promise<SplitOrderTargets> {
  const recallFlow = new RecallFlow();
  const latestVisibleOrderNumber = expectedOrderNumber
    ? expectedOrderNumber
    : await recallFlow.readLatestVisibleOrderNumber(recallPage);
  const orderNumber = latestVisibleOrderNumber.replace(/-\d+$/, '');
  await recallPage.openOrderDetails(orderNumber);
  const targetOrderNumbers = await waitUntil(
    async () => await recallPage.readTargetOrderNumbers(),
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
  await new OrderDishesFlow().clearAllCharges(orderDishesPage, { scope: 'whole' });
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
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  chargeName: string,
  options: { addSecondDish?: boolean } = {},
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderId?: number;
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
  options: { dishCount?: number } = {},
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
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
  dishCount = 1,
): Record<string, unknown> {
  const unitPrice = 8.8;
  const unitTax = 0.88;
  const subtotal = Number((unitPrice * dishCount).toFixed(2));
  const tax = Number((unitTax * dishCount).toFixed(2));
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
      orderItems: Array.from({ length: dishCount }, () => ({
          saleItemId: orderServiceDishes.regular.saleItemId,
          seatId: 0,
          quantity: 1,
          courseNumber: '',
          originalSalePrice: unitPrice,
          originDualPrice: unitPrice,
          price: unitPrice,
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
              taxAmount: unitTax,
              taxName: '10',
              taxRate: 10,
              outTaxRate: 10,
              taxIncrease: 'DEFAULT',
              priceLimit: 0,
              taxIncreaseRate: 0,
            },
          ],
        })),
    },
    fetchOrder: true,
    fetchPayments: true,
  };
}

type ApiWholeChargeSeed = {
  charge: ChargeSetupOverrides;
  resource: { id: string | number; name: string };
};

function buildDineInOrderWithWholeChargesRequest(
  chargeSeeds: readonly ApiWholeChargeSeed[],
  dishCount = 1,
): Record<string, unknown> {
  const firstChargeSeed = chargeSeeds[0];

  if (!firstChargeSeed) {
    throw new Error('API 创建订单至少需要一条整单加收。');
  }

  const request = buildDineInOrderWithWholeChargeRequest(
    firstChargeSeed.resource,
    firstChargeSeed.charge,
    dishCount,
  );
  const order = request.order as Record<string, unknown>;
  const subtotal = Number((8.8 * dishCount).toFixed(2));
  const orderCharges = chargeSeeds.map(({ charge, resource }) => {
    const chargeRate = charge.rate ?? 10;
    const chargeRateType = charge.rateType ?? 1;
    const chargeAmount =
      chargeRateType === 2
        ? Number(((subtotal * chargeRate) / 100).toFixed(2))
        : Number(chargeRate.toFixed(2));
    const chargeId = Number(resource.id);

    return {
      chargeID: chargeId,
      id: chargeId,
      chargeName: charge.name ?? resource.name,
      chargeRateType,
      chargeRate,
      taxed: charge.taxed ?? false,
      taxCharge: 0,
      charge: chargeAmount,
      chargeBeforeCd: chargeAmount,
      triggerMode: charge.triggerMode ?? 1,
      type: charge.type ?? 'DEFAULT',
    };
  });
  const totalCharge = orderCharges.reduce((sum, charge) => sum + charge.charge, 0);

  order.orderCharges = orderCharges;
  order.charge = Number(totalCharge.toFixed(2));
  order.inheritCharge = Number(totalCharge.toFixed(2));

  return request;
}

async function createSavedOrderWithApiCharges(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderApi: OrderApiClient,
  chargeSeeds: readonly ApiWholeChargeSeed[],
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderId: number;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  const responseBody = await expectOkEnvelope(
    await orderApi.saveOrder(buildDineInOrderWithWholeChargesRequest(chargeSeeds)),
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
  const orderCharges = await readOrderChargesByApi(orderApi, orderId);
  return orderCharges.find((charge) => charge.name === chargeName)?.amount ?? null;
}

async function readOrderChargesByApi(
  orderApi: OrderApiClient,
  orderId: number,
): Promise<Array<{ amount: number; name: string }>> {
  const responseBody = await expectOkEnvelope(
    await orderApi.fetchOrder({ orderId, fetchPayments: true }),
  );
  const order = extractSavedOrderRecord(responseBody.data);
  const orderCharges = order?.orderCharges;

  if (!Array.isArray(orderCharges)) {
    return [];
  }

  const charges: Array<{ amount: number; name: string }> = [];
  for (const charge of orderCharges) {
    if (!charge || typeof charge !== 'object') {
      continue;
    }

    const record = charge as Record<string, unknown>;
    const name = typeof record.chargeName === 'string' ? record.chargeName : null;
    const amount = Number(record.charge);

    if (!name || !Number.isFinite(amount)) {
      continue;
    }

    charges.push({ amount, name });
  }

  return charges;
}

async function createSavedDeliveryOrder(
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
  orderApi: OrderApiClient,
  chargeResource: { id: string | number; name: string },
  charge: ChargeSetupOverrides,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  return await createSavedOrderWithApiCharges(
    readyHomePage,
    employeeLoginPage,
    orderApi,
    [
      { charge, resource: chargeResource },
      { charge, resource: chargeResource },
      {
        charge: {
          name: 'Charge($10.00)',
          rate: 10,
          rateType: 1,
          taxed: true,
          triggerMode: 2,
        },
        resource: { id: -1, name: 'Charge($10.00)' },
      },
    ],
  );
}

async function createSavedOrderForCombineChargeCase(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderApi: OrderApiClient,
  chargeResource: { id: string | number; name: string },
  chargeCase: CombineChargeRecalculationCase,
  chargeName: string,
): Promise<{
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: Awaited<ReturnType<OrderDishesPage['readPriceSummary']>>;
  orderNumber: string;
  recallPage: RecallPage;
}> {
  if (chargeCase.issue === 'POS-32008') {
    return await createSavedOrderWithAutoCharge(readyHomePage, employeeLoginPage);
  }

  if (chargeCase.scenario === 'single-manual') {
    return await createSavedOrderWithManualCharge(readyHomePage, employeeLoginPage, chargeName);
  }

  if (chargeCase.scenario === 'three-charges') {
    return await createSavedOrderWithThreeChargeKinds(
      readyHomePage,
      employeeLoginPage,
      orderApi,
      chargeResource,
      chargeCase.charge,
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
    return await createSavedDeliveryOrder(readyHomePage, employeeLoginPage);
  }

  return await createSavedOrderWithApiAutoCharge(
    readyHomePage,
    employeeLoginPage,
    orderApi,
    chargeResource,
    chargeCase.charge,
  );
}

async function createSavedOrderForChargeCopyCase(
  readyHomePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderApi: OrderApiClient,
  chargeResource: { id: string | number; name: string },
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
    return await createSavedDeliveryOrder(readyHomePage, employeeLoginPage);
  }

  if (chargeCase.issue === 'POS-27259') {
    return await createSavedOrderWithAutoCharge(readyHomePage, employeeLoginPage);
  }

  const savedOrder = await createSavedOrderWithApiAutoCharge(
    readyHomePage,
    employeeLoginPage,
    orderApi,
    chargeResource,
    chargeCase.initialCharge,
  );
  const rate = chargeCase.initialCharge.rate ?? 0;
  const amount =
    chargeCase.initialCharge.rateType === 2
      ? Number(((savedOrder.beforeSummary.Subtotal * rate) / 100).toFixed(2))
      : Number(rate.toFixed(2));

  return {
    ...savedOrder,
    beforeChargeSnapshot: {
      ...savedOrder.beforeChargeSnapshot,
      wholeOrderCharges: [
        ...savedOrder.beforeChargeSnapshot.wholeOrderCharges,
        {
          amountText: `$${amount.toFixed(2)}`,
          name: chargeCase.initialCharge.name ?? chargeResource.name,
        },
      ],
    },
  };
}

async function copySavedOrderAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
): Promise<OrderDishesPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  return await new RecallFlow().openCopyFromMore(recallPage, orderNumber);
}

async function readCopiedOrderChargeAmount(
  orderDishesPage: OrderDishesPage,
  chargeName: string,
): Promise<{
  amount: number | null;
  summary: Record<string, number> | null;
}> {
  const summary = await orderDishesPage.readPriceSummary();
  const chargeSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
  const amount = parseChargeAmountText(readWholeChargeAmountText(chargeSnapshot, chargeName));

  return { amount, summary };
}

function readChargeAmountFromDetailsText(detailsText: string, chargeName: string): number | null {
  const normalizedText = detailsText.replace(/\s+/g, ' ').trim();
  const match = normalizedText.match(
    new RegExp(`${escapeRegExpForText(chargeName)}\\s+\\$([\\d,.]+)`, 'i'),
  );
  const amount = Number(match?.[1]?.replace(/,/g, '') ?? NaN);

  return Number.isNaN(amount) ? null : amount;
}

function hasBeforeChargeSnapshot(
  value: object,
): value is { beforeChargeSnapshot: OrderChargeSnapshot } {
  return (
    'beforeChargeSnapshot' in value &&
    typeof value.beforeChargeSnapshot === 'object' &&
    value.beforeChargeSnapshot !== null
  );
}

function escapeRegExpForText(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function combineSavedOrdersAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  primaryOrderNumber: string,
  secondaryOrderNumber: string,
): Promise<RecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  return await new RecallFlow().combineOrders(
    recallPage,
    primaryOrderNumber,
    secondaryOrderNumber,
  );
}

async function moveItemAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
  targetOrderNumber?: string,
): Promise<RecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);

  if (targetOrderNumber) {
    return await new RecallFlow().moveFirstDishToExistingOrder(
      recallPage,
      orderNumber,
      targetOrderNumber,
    );
  }

  return await new RecallFlow().moveFirstDishToNewOrder(recallPage, orderNumber);
}

async function moveWholeOrderAfterConfigurationRefresh(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<RecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  return await new RecallFlow().moveFirstDishToExistingOrder(
    recallPage,
    orderNumber,
    targetOrderNumber,
  );
}

async function readTransferredOrderChargeAmount(
  recallPage: RecallPage,
  chargeName: string,
  orderNumber?: string,
): Promise<{
  amount: number | null;
  hasNamedCharge: boolean;
  summary: Record<string, number> | null;
}> {
  if (orderNumber) {
    await recallPage.openOrderDetails(orderNumber);
  }

  const summary = await recallPage.readDisplayedOrderPriceSummary();
  const detailsText = await recallPage.readOrderDetailsText();
  const namedChargeAmount = readChargeAmountFromDetailsText(detailsText, chargeName);

  return {
    amount:
      namedChargeAmount ??
      (orderNumber ? summary.Charge ?? summary.Total ?? summary['Total(Cash)'] ?? null : null),
    hasNamedCharge: namedChargeAmount !== null,
    summary,
  };
}

async function readReportHomeUnpaidAmount(homePage: HomePage): Promise<number> {
  const reportPage = await homePage.enterReport();
  await reportPage.enterWithPasscode('11');
  return await reportPage.readOverviewAmount('Unpaid');
}

async function readReportFeeAmount(homePage: HomePage): Promise<number> {
  const reportPage = await homePage.enterReport();
  await reportPage.enterWithPasscode('11');
  return await reportPage.readOverviewAmount('Fee');
}

async function transferOrderServerAndReadSnapshot(
  recallPage: RecallPage,
  serverName: string,
): Promise<{ serverName: string | null; status: string | null; total: number | null }> {
  await recallPage.changeOrderServer(serverName);
  const details = await recallPage.readOrderDetailsSnapshot();
  return {
    serverName: details.orderContext.serverName,
    status: details.paymentStatus,
    total: details.priceSummary.Total ?? details.priceSummary['Total(Cash)'] ?? null,
  };
}

async function configureCombineChargeRecalculation(
  apiSetup: ApiSetup,
  enabled: boolean,
  homePage: HomePage,
): Promise<() => Promise<void>> {
  const restore = await apiSetup.systemConfiguration.updateByName(
    'RECALCULATE_CHARGE_WHEN_COMBINE_ORDERS',
    enabled,
    { verify: true },
  );
  await homePage.clickRefresh();
  return restore;
}

async function configureShowUnsplitItemsWhenSplitOrder(
  apiSetup: ApiSetup,
  enabled: boolean,
  homePage: HomePage,
): Promise<void> {
  await apiSetup.systemConfiguration.updateByName(
    'SHOW_UNSPLIT_ITEMS_WHEN_SPLIT_ORDER',
    enabled,
    { verify: true },
  );
  await homePage.clickRefresh();
}

async function configureTaxIncludesCharge(
  apiSetup: ApiSetup,
  enabled: boolean,
  homePage: HomePage,
): Promise<void> {
  await apiSetup.systemConfiguration.updateByName(
    'CHARGE_CALCULATION_INCLUDE_TAX',
    enabled,
    { verify: true },
  );
  await homePage.clickRefresh();
  await homePage.confirmDelayedConfigurationRefresh();
}

async function readSplitOrderDishListCounts(
  _orderDishesPage: OrderDishesPage,
): Promise<{
  allDishCount: number;
  sharedAfterFirstMove: number;
  sharedAfterSecondMove: number;
  sharedBeforeMove: number;
}> {
  throw new Error(
    '当前 POS NG 分单面板未提供“未分单菜品”和“全部菜品”列表，无法读取 POS-32954 所需数量。',
  );
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
  const splitOrderPage = await new RecallFlow().openSplitOrder(
    recallPage,
    orderNumber,
    undefined,
    { chargePromptAction: 'keep' },
  );
  await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const returnedRecallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(returnedRecallPage, orderNumber);

  return { ...targets, recallPage: returnedRecallPage };
}

async function splitSavedOrderByItemFromRecallDetails(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
  dishName: string,
): Promise<SplitOrderTargetsWithRecallPage> {
  const recallPage = await openRecallAfterConfigurationRefresh(homePage, employeeLoginPage);
  const splitOrderPage = await new RecallFlow().openSplitOrder(
    recallPage,
    orderNumber,
    undefined,
    { chargePromptAction: 'keep' },
  );
  await new SplitOrderFlow().moveDishToNewSuborder(splitOrderPage, dishName);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const returnedRecallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(returnedRecallPage, orderNumber);

  return { ...targets, recallPage: returnedRecallPage };
}

async function readTargetChargeDetails(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
  chargeName: string,
): Promise<{ priceSummary: Record<string, number>; namedChargeAmount: number; text: string }> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();
  const text = await recallPage.readDisplayedOrderPriceSummaryText();
  await recallPage.closeOrderDetailsDialog();

  const escapedChargeName = chargeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const chargeAmountMatch = text.match(
    new RegExp(`${escapedChargeName}\\s*:?\\s*\\$?([\\d,]+(?:\\.\\d{1,2})?)`),
  );
  if (!chargeAmountMatch) {
    throw new Error(`未能从价格摘要中读取加收“${chargeName}”的金额：${text}`);
  }

  return {
    priceSummary,
    namedChargeAmount: Number(chargeAmountMatch[1].replace(/,/g, '')),
    text,
  };
}

async function splitSavedOrderFromEditPage(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  orderNumber: string,
): Promise<SplitOrderTargetsWithRecallPage> {
  const editingPage = await editSavedOrderAfterConfigurationRefresh(
    homePage,
    employeeLoginPage,
    orderNumber,
  );
  const splitOrderPage = await editingPage.openSplitOrder();

  await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);

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
  return [...chargeSnapshot.wholeOrderCharges]
    .reverse()
    .find((charge) => charge.name === chargeName)?.amountText ?? null;
}

function resolveExpectedChargeAmount(
  expectedAmount: ChargeExpectedAmount,
  summary: Record<string, number>,
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
  await new OrderDishesFlow().clearAllCharges(orderDishesPage, { scope: 'whole' });
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

test.describe('分单操作回归第一批', { tag: ['@点单', '@分单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-19365] 应能在共享菜已支付后阻止作废另一子单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19365')],
    },
    async ({ apiConfig, homePage, employeeLoginPage, orderApi, systemConfigurationApi }) => {
      annotateKnownProductFailure(
        '当前产品未对“已支付共享菜后作废另一子单”返回 POS-19365 预期阻断提示，用例保持普通 Failed。',
      );

      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const { recallPage, targets } = await test.step('创建包含共享菜的座位分单并支付第一个子单', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, {
          apiBaseURL: apiConfig.baseURL,
          orderApi,
          addTip: true,
        });
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

        expect(
          blockingMessage,
          '已支付共享菜后作废另一子单应返回阻断提示',
        ).not.toBeNull();
        expect(blockingMessage!).toContain(
          orderServiceSplitOperationCase.sharedItemVoidBlockingMessage,
        );
      });
    },
  );

  test(
    '[POS-19368] 应能修改一个子单 tips 且另一个子单 tips 保持不变',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19368')],
    },
    async ({ apiConfig, homePage, employeeLoginPage, orderApi, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const tipsBeforeEdit = await test.step('记录两个子单修改前 tips', async () => {
        const { recallPage, targets } = await createSeatSplitRecallOrder(readyHomePage, {
          apiBaseURL: apiConfig.baseURL,
          orderApi,
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
    async ({ apiConfig, homePage, employeeLoginPage, orderApi, systemConfigurationApi }) => {
      annotateKnownProductFailure(
        '当前产品在半支付座位分单点击 Unsplit 后未返回 POS-19371 预期阻断提示，用例保持普通 Failed。',
      );

      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('读取子单号并支付第一个子单', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, {
          apiBaseURL: apiConfig.baseURL,
          orderApi,
          addTip: true,
        });
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

        expect(
          blockingMessage,
          '半支付座位分单撤销分单时应返回阻断提示',
        ).not.toBeNull();
        expect(blockingMessage!).toContain(
          orderServiceSplitOperationCase.splitHalfPaidBlockingMessage,
        );
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
        await splitOrderPage.clickCancelSplit();
        await splitOrderPage.confirmCurrentSplitPanel();

        const reopenedSplitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        const blockingMessage = await reopenedSplitOrderPage.retryCancelSplitAndReadToast();

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
    async ({ apiConfig, homePage, employeeLoginPage, orderApi, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('创建带 6 元 tips 的座位分单并记录第一个子单 tips', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, {
          apiBaseURL: apiConfig.baseURL,
          orderApi,
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
    async ({ apiConfig, homePage, employeeLoginPage, orderApi, systemConfigurationApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('创建带 6 元 tips 的座位分单并记录第一个子单 tips', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, {
          apiBaseURL: apiConfig.baseURL,
          orderApi,
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
        await new OrderDishesFlow().applyCustomItemFixedDiscount(
          editingPage,
          [orderServiceDishes.test.name],
          orderServiceSplitOperationCase.itemDiscountAmount,
        );
        const discountName = `Charge($${orderServiceSplitOperationCase.itemDiscountAmount.toFixed(2)})`;
        await editingPage.expectOrderedDishAddition(
          orderServiceDishes.test.name,
          discountName,
          `$${orderServiceSplitOperationCase.itemDiscountAmount.toFixed(2)}`,
        );
        return await saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
      });

      await test.step('校验两个子单 tips 按 subtotal 比例分配且总额不变', async () => {
        const firstSummary = await readTargetPriceSummary(
          recallPageAfterSave,
          targets.orderNumber,
          targets.firstTargetOrderNumber,
        );
        const secondSummary = await readTargetPriceSummary(
          recallPageAfterSave,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        const totalTip = orderServiceSplitOperationCase.redistributedTipAmountInCents / 100;
        const firstTipAfter = firstSummary.Tips ?? 0;
        const secondTipAfter = secondSummary.Tips ?? 0;

        expect(firstTipAfter).toBeGreaterThan(0);
        expect(secondTipAfter).toBeGreaterThan(0);
        expect(Math.sign(firstTipAfter - secondTipAfter)).toBe(
          Math.sign(firstSummary.Subtotal - secondSummary.Subtotal),
        );
        expect(firstTipAfter + secondTipAfter).toBe(totalTip);
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
    '[POS-22813] 应能在加收订单按菜分单并逐个清除子单加收后现金结清',
    {
      tag: ['@加收', '@分单', '@现金支付'],
      annotation: [jiraIssueAnnotation('POS-22813')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const splitOrder = await test.step('创建含整单加收的已送厨订单并按菜分单', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await addTwoRegularDishes(orderDishesPage);
        await new OrderDishesFlow().clearAllCharges(orderDishesPage, { scope: 'whole' });
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
        await new SplitOrderFlow().moveDishToNewSuborder(
          splitOrderPage,
          orderServiceDishes.test.name,
        );
        const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
        const recallPageAfterSplit = await enterRecallFromReturnedPage(returnedPage);
        const targets = await openLatestSplitOrderTargets(recallPageAfterSplit);
        return { recallPage: recallPageAfterSplit, targets };
      });

      const recallPageAfterPayment = await test.step('逐个编辑子单清空加收并现金结清', async () => {
        let currentRecallPage = splitOrder.recallPage;
        const targetOrderNumbers = [
          splitOrder.targets.firstTargetOrderNumber,
          splitOrder.targets.secondTargetOrderNumber,
        ];

        for (const targetOrderNumber of targetOrderNumbers) {
          const editingPage = await new RecallFlow().editOrder(
            currentRecallPage,
            splitOrder.targets.orderNumber,
            targetOrderNumber,
          );
          await new OrderDishesFlow().clearAllCharges(editingPage, { scope: 'whole' });
          const clearedChargeSnapshot = await readOrderDishesChargeSnapshot(editingPage);
          expect(clearedChargeSnapshot.wholeOrderCharges).toHaveLength(0);

          const paymentPage = await editingPage.openPayment();
          await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
          currentRecallPage = await readyHomePage.clickRecall();
        }

        return currentRecallPage;
      });

      const childCharges = await test.step('读取两个子单详情中的加收金额', async () => {
        await new RecallFlow().clearSearchConditions(recallPageAfterPayment);
        const firstCharge = await readTargetCharge(
          recallPageAfterPayment,
          splitOrder.targets.orderNumber,
          splitOrder.targets.firstTargetOrderNumber,
        );
        const secondCharge = await readTargetCharge(
          recallPageAfterPayment,
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

  test(
    '[POS-23204] 应能清空整单折扣并恢复订单总额',
    {
      tag: ['@点单'],
      annotation: [
        jiraIssueAnnotation('POS-23204'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
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
        await new OrderDishesFlow().applyCustomWholePercentageDiscount(
          orderDishesPage,
          orderServiceSplitOperationCase.orderDiscountClearRate,
        );
        const beforeClearSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
        await new OrderDishesFlow().clearAllCharges(orderDishesPage, { scope: 'whole' });
        const afterClearSnapshot = await readOrderDishesChargeSnapshot(orderDishesPage);
        await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);

        return { afterClearSnapshot, beforeClearSnapshot };
      });

      await test.step('校验整单折扣明细已清空', async () => {
        const expectedName = `Charge(${orderServiceSplitOperationCase.orderDiscountClearRate}%)`;
        expect(discountResult.beforeClearSnapshot.wholeOrderCharges.map((charge) => charge.name)).toContain(
          expectedName,
        );
        expect(discountResult.afterClearSnapshot.wholeOrderCharges.map((charge) => charge.name)).not.toContain(
          expectedName,
        );
      });
    },
  );

  test(
    '[POS-23204] 应能清空菜品折扣并恢复订单总额',
    {
      tag: ['@点单'],
      annotation: [
        jiraIssueAnnotation('POS-23204'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
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
        await new OrderDishesFlow().applyCustomItemPercentageDiscount(
          orderDishesPage,
          [orderServiceDishes.regular.name],
          orderServiceSplitOperationCase.itemDiscountRate,
        );
        const beforeClearItems = await orderDishesPage.readOrderedItems();
        await new OrderDishesFlow().clearAllCharges(orderDishesPage, {
          dishNames: [orderServiceDishes.regular.name],
          scope: 'item',
        });
        const afterClearItems = await orderDishesPage.readOrderedItems();
        await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);

        return { afterClearItems, beforeClearItems };
      });

      await test.step('校验菜品折扣明细已清空', async () => {
        const expectedName = `Charge(${orderServiceSplitOperationCase.itemDiscountRate}%)`;
        const beforeClearNames = discountResult.beforeClearItems.flatMap((item) =>
          item.additions.map((addition) => addition.name),
        );
        const afterClearNames = discountResult.afterClearItems.flatMap((item) =>
          item.additions.map((addition) => addition.name),
        );

        expect(beforeClearNames).toContain(expectedName);
        expect(afterClearNames).not.toContain(expectedName);
      });
    },
  );

  test(
    '[POS-23322] 应能在 Payment 页设置小费后部分现金支付并保持未付金额正确',
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

      const paymentContext = await test.step('创建免税订单并打开 Payment 页面', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderDishesPage.setOrderedDishTaxExempt(orderServiceDishes.regular.name, true);
        const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        const paymentPage = await new RecallFlow().openPayment(recallPage, orderNumber);

        return { orderNumber, paymentPage, recallPage };
      });

      const balanceBeforePayment = await test.step('设置 5 元支付金额和 1 元 Tips 并校验支付前余额', async () => {
        await paymentContext.paymentPage.fillAmountTendered(
          orderServiceSplitOperationCase.tipAmountInCents,
        );
        await new PaymentFlow().addTip(
          paymentContext.paymentPage,
          orderServiceSplitOperationCase.postPaymentTipAmountInCents,
        );
        await paymentContext.paymentPage.expectPaymentFlowText('Tips$1.00');
        const balanceDue = await paymentContext.paymentPage.readBalanceDue();
        expect(balanceDue).toBeGreaterThan(0);
        return balanceDue;
      });

      await test.step('现金支付 5 元并校验支付后余额', async () => {
        await new PaymentFlow().payPartialByCashKeepingPaymentOpen(paymentContext.paymentPage, {
          amountInCents: orderServiceSplitOperationCase.tipAmountInCents,
          printReceipt: false,
        });
        expect(await paymentContext.paymentPage.readBalanceDue()).toBeCloseTo(
          balanceBeforePayment - orderServiceSplitOperationCase.tipAmountInCents / 100,
          2,
        );
      });

      await test.step('返回 Recall 并校验订单状态为 Semi-Paid', async () => {
        await paymentContext.paymentPage.closePaymentPanel();
        await paymentContext.recallPage.closeOrderDetailsDialog();
        await new RecallFlow().clearSearchConditions(paymentContext.recallPage);
        await paymentContext.recallPage.openOrderDetails(paymentContext.orderNumber);
        const paymentStatus = await paymentContext.recallPage.readOrderPaymentStatus();
        expect(paymentStatus).toContain('Semi-Paid');
        await paymentContext.recallPage.closeOrderDetailsDialog();
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
        const copiedOrderPage = await new RecallFlow().openCopyFromMore(
          savedOrder.recallPage,
          savedOrder.orderNumber,
        );
        return (await copiedOrderPage.readPriceSummary())['Total(Cash)'];
      });

      await test.step('校验复制前后订单总额保持一致', async () => {
        expect(savedOrder.afterModifierTotal).toBeCloseTo(savedOrder.beforeTotal, 2);
        expect(copiedOrderTotal).toBeCloseTo(savedOrder.afterModifierTotal, 2);
      });
    },
  );

  test(
    '[POS-23671] 应能合并不含税订单加收订单并保持合并总额等于原订单之和',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-23671')],
    },
    async ({ homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const restoreCombineChargeRecalculation = await test.step(
        '关闭合单重新计算加收配置',
        async () => await configureCombineChargeRecalculation(apiSetup, false, readyHomePage),
      );

      try {
      const chargedOrders = await test.step('创建两笔免税且含不计税整单加收的订单', async () => {
        const orderNumbers: string[] = [];
        const totals: number[] = [];
        let recallPage: RecallPage | null = null;

        for (let index = 0; index < 2; index += 1) {
          const orderReadyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
          const orderDishesPage = await enterDineInNoTableOrder(orderReadyHomePage);
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
          orderNumbers.push(await new RecallFlow().readLatestVisibleOrderNumber(recallPage));
        }

        expect(recallPage).not.toBeNull();
        return { orderNumbers, recallPage: recallPage!, totals };
      });

      await test.step('从 Recall 合并订单并校验合并后总额', async () => {
        const [sourceOrderNumber, targetOrderNumber] = chargedOrders.orderNumbers;
        expect(sourceOrderNumber).toBeTruthy();
        expect(targetOrderNumber).toBeTruthy();
        await new RecallFlow().combineOrders(
          chargedOrders.recallPage,
          sourceOrderNumber,
          targetOrderNumber,
        );
        const mergedSummary = await chargedOrders.recallPage.readDisplayedOrderPriceSummary();
        const mergedTotal = mergedSummary.Total ?? mergedSummary['Total(Cash)'] ?? 0;
        expect(mergedTotal).toBeCloseTo(
          chargedOrders.totals.reduce((sum, total) => sum + total, 0),
          2,
        );
      });
      } finally {
        await test.step('恢复合单重新计算加收配置', restoreCombineChargeRecalculation);
      }
    },
  );

  test(
    '[POS-23672] 应能合并计税订单加收订单并保持合并总额等于原订单之和',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-23672')],
    },
    async ({ homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const restoreCombineChargeRecalculation = await test.step(
        '关闭合单重新计算加收配置',
        async () => await configureCombineChargeRecalculation(apiSetup, false, readyHomePage),
      );

      try {
      const chargedOrders = await test.step('创建两笔免税菜品且含计税整单加收的订单', async () => {
        const orderNumbers: string[] = [];
        const totals: number[] = [];
        let recallPage: RecallPage | null = null;

        for (let index = 0; index < 2; index += 1) {
          const orderReadyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
          const orderDishesPage = await enterDineInNoTableOrder(orderReadyHomePage);
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
          orderNumbers.push(await new RecallFlow().readLatestVisibleOrderNumber(recallPage));
        }

        expect(recallPage).not.toBeNull();
        return { orderNumbers, recallPage: recallPage!, totals };
      });

      await test.step('从 Recall 合并订单并校验合并后总额', async () => {
        const [sourceOrderNumber, targetOrderNumber] = chargedOrders.orderNumbers;
        expect(sourceOrderNumber).toBeTruthy();
        expect(targetOrderNumber).toBeTruthy();
        await new RecallFlow().combineOrders(
          chargedOrders.recallPage,
          sourceOrderNumber,
          targetOrderNumber,
        );
        const mergedSummary = await chargedOrders.recallPage.readDisplayedOrderPriceSummary();
        const mergedTotal = mergedSummary.Total ?? mergedSummary['Total(Cash)'] ?? 0;
        expect(mergedTotal).toBeCloseTo(
          chargedOrders.totals.reduce((sum, total) => sum + total, 0),
          2,
        );
      });
      } finally {
        await test.step('恢复合单重新计算加收配置', restoreCombineChargeRecalculation);
      }
    },
  );

  test(
    '[POS-25235] 应能在 To Go 平分子单现金支付后追加 1 元小费',
    {
      tag: ['@分单', '@小费', '@现金支付'],
      annotation: [
        jiraIssueAnnotation('POS-25235'),
        {
          type: 'known-issue',
          description:
            'To Go 平分子单现金支付后执行追加 1 元小费，最终读取到的小费仍为 0，产品未保存追加小费。',
        },
      ],
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

  for (const sourceChargeCase of manualChargeEditCases) {
    const chargeCase = createIsolatedChargeEditCase(sourceChargeCase);
    test(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const blockedReason = blockedManualChargeEditReasons.get(chargeCase.issue);
        annotateKnownProductFailure(blockedReason);

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const chargeResource = await test.step('预置手动加收配置并刷新 POS', async () => {
          const resource = await createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const savedOrder = await test.step('创建含预置目标加收的堂食无桌台订单并保存', async () => {
          if (chargeCase.source === 'auto') {
            return await createSavedOrderWithAutoCharge(readyHomePage, employeeLoginPage);
          }

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

        if (chargeCase.confirmUpdatedCharge) {
          const editedOrderPage = await test.step('重新打开最近订单进入编辑页', async () => {
            return await editSavedOrderAfterConfigurationRefresh(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
          });

          const refreshedCharge = await test.step('打开加收弹窗并确认后台更新后的加收', async () => {
            return await new OrderDishesFlow().confirmRefreshedChargeAndReadState(editedOrderPage);
          });

          await test.step('校验打开加收前编辑页保留原百分比加收金额', async () => {
            const initialChargeAmount = resolveExpectedChargeAmount(
              'percent10',
              refreshedCharge.beforeConfirmationSummary,
            );
            expect.soft(refreshedCharge.beforeConfirmationSummary.Charge).toBeCloseTo(
              initialChargeAmount,
              2,
            );
          });

          await test.step('校验加收弹窗显示后台更新后的百分比加收金额', async () => {
            const dialogChargeAmount = parseChargeAmountText(
              readWholeChargeAmountText(
                refreshedCharge.chargeDialogSnapshot,
                chargeCase.expectedChargeName,
              ),
            );
            const expectedUpdatedAmount = resolveExpectedChargeAmount(
              chargeCase.expectedChargeAmount,
              refreshedCharge.beforeConfirmationSummary,
            );
            expect.soft(dialogChargeAmount).toBeCloseTo(expectedUpdatedAmount, 2);
          });

          await test.step('校验确认后编辑页更新为新的百分比加收金额', async () => {
            const expectedUpdatedAmount = resolveExpectedChargeAmount(
              chargeCase.expectedChargeAmount,
              refreshedCharge.afterConfirmationSummary,
            );
            expect.soft(refreshedCharge.afterConfirmationSummary.Charge).toBeCloseTo(
              expectedUpdatedAmount,
              2,
            );
          });

          return;
        }

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
            expect(
              editedAmount,
              `编辑订单后应显示加收 ${chargeCase.expectedChargeName}`,
            ).not.toBeNull();
            expect(editedAmount!).toBeCloseTo(
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

  for (const sourceChargeCase of autoChargeEditCases) {
    const chargeCase = createIsolatedChargeEditCase(sourceChargeCase);
    test(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const blockedReason = blockedAutoChargeEditReasons.get(chargeCase.issue);
        annotateKnownProductFailure(blockedReason);

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
          const initialAmount = await readOrderChargeAmountByApi(
            orderApi,
            savedOrder.orderId,
            initialChargeName,
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
            expect(
              editedAmount,
              `编辑订单后应显示自动加收 ${chargeCase.expectedChargeName}`,
            ).not.toBeNull();
            expect(editedAmount!).toBeCloseTo(
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

  const expectedFailureChargeFollowUpIssues = new Map<ChargeFollowUpCase['issue'], string>([
    ['POS-27192', '自动加收配置修改后从编辑页保存会丢失新加收，需产品修复后再启用。'],
  ]);

  for (const sourceChargeCase of chargeFollowUpCases) {
    const chargeCase = createIsolatedChargeFollowUpCase(sourceChargeCase);
    test(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const expectedFailureReason = expectedFailureChargeFollowUpIssues.get(chargeCase.issue);
        annotateKnownProductFailure(expectedFailureReason);

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

        if (chargeCase.operation === 'edit-item-split') {
          const splitOrder = await test.step('从 Recall 详情按菜品移入新子单并返回 Recall', async () => {
            return await splitSavedOrderByItemFromRecallDetails(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
              orderServiceDishes.regular.name,
            );
          });

          const childChargeDetails = await test.step('读取两个子单的加收名称与金额', async () => {
            const firstChild = await readTargetChargeDetails(
              splitOrder.recallPage,
              splitOrder.orderNumber,
              splitOrder.firstTargetOrderNumber,
              chargeCase.expectedChargeName,
            );
            const secondChild = await readTargetChargeDetails(
              splitOrder.recallPage,
              splitOrder.orderNumber,
              splitOrder.secondTargetOrderNumber,
              chargeCase.expectedChargeName,
            );
            return [firstChild, secondChild];
          });

          await test.step('校验两个子单保留历史加收名称并按各自小计比例分摊', async () => {
            for (const child of childChargeDetails) {
              expect(child.text).toContain(chargeCase.expectedChargeName);
              expect(child.namedChargeAmount).toBeCloseTo(
                Number(
                  (
                    ((chargeCase.initialCharge.rate ?? 0) * child.priceSummary.Subtotal) /
                    savedOrder.beforeSummary.Subtotal
                  ).toFixed(2),
                ),
                2,
              );
            }

            expect(
              childChargeDetails.reduce(
                (total, child) => total + child.namedChargeAmount,
                0,
              ),
            ).toBeCloseTo(chargeCase.initialCharge.rate ?? 0, 2);
          });
          return;
        }

        if (chargeCase.operation === 'edit-even-split') {
          const splitOrder = await test.step('从编辑页分单并返回 Recall', async () => {
            return await splitSavedOrderFromEditPage(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
          });

          const childCharge = await test.step('读取第一个子单加收金额', async () => {
            return await readFirstSplitTargetCharge(splitOrder);
          });

          await test.step('校验编辑页分单后的子单加收金额', async () => {
            expect(childCharge).toBeCloseTo(
              Number(chargeCase.expectedChargeAmount),
              2,
            );
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
          expect(
            editedCharge.amount,
            `后续操作后应显示加收 ${chargeCase.expectedChargeName}`,
          ).not.toBeNull();
          expect(editedCharge.amount!).toBeCloseTo(
            resolveExpectedChargeAmount(chargeCase.expectedChargeAmount, editedCharge.summary),
            2,
          );
        });
      },
    );
  }

  const blockedChargeCopyIssues = new Map<ChargeCopyCase['issue'], string>([
    ['POS-27257', '复制自动加收订单后未显示后台更新后的加收名称和金额。'],
    ['POS-27271', 'Delivery 源订单保存前未生成目标自动加收 auto_test1，无法进入修改 minMileage 后复制订单的断言。'],
    ['POS-27288', '创建源订单时确认目标手动加收后 Charge 弹窗未关闭且加收未生效，无法进入复制后的订单类型断言。'],
  ]);

  for (const sourceChargeCase of chargeCopyCases) {
    const chargeCase = createIsolatedChargeCopyCase(sourceChargeCase);
    test(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const blockedReason = blockedChargeCopyIssues.get(chargeCase.issue);
        annotateKnownProductFailure(blockedReason);

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
            orderApi,
            chargeResource,
            chargeCase,
            chargeCase.initialCharge.name ?? chargeResource.name,
          );
        });

        await test.step('校验源订单保存前已按初始配置带出加收', async () => {
          const initialChargeName = chargeCase.initialCharge.name ?? chargeResource.name;
          const initialAmount = parseChargeAmountText(
            readWholeChargeAmountText(savedOrder.beforeChargeSnapshot, initialChargeName),
          );
          expect(
            initialAmount,
            `源订单保存前应显示加收 ${initialChargeName}`,
          ).not.toBeNull();
          expect(initialAmount!).toBeCloseTo(
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

        const copiedOrderPage = await test.step('刷新 POS 后从 Recall 详情复制源订单', async () => {
          return await copySavedOrderAfterConfigurationRefresh(
            homePage,
            employeeLoginPage,
            savedOrder.orderNumber,
          );
        });

        const copiedCharge = await test.step('读取复制后新订单的加收明细', async () => {
          return await readCopiedOrderChargeAmount(copiedOrderPage, chargeCase.expectedChargeName);
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

        if (chargeCase.issue === 'POS-27259') {
          await test.step('校验复制订单页已移除自动加收且合计为 9.68', async () => {
            expect(copiedCharge.summary).not.toBeNull();
            expect(copiedCharge.summary!.Subtotal).toBeCloseTo(8.8, 2);
            expect(copiedCharge.summary!.Tax).toBeCloseTo(0.88, 2);
            expect(copiedCharge.summary!.Charge ?? 0).toBe(0);
            expect(
              copiedCharge.summary!['Total(Cash)'] ?? copiedCharge.summary!.Total,
            ).toBeCloseTo(9.68, 2);
          });

          const savedCopiedOrder = await test.step('保存复制后的订单', async () => {
            return await copiedOrderPage.saveOrderWithReference();
          });

          const persistedSummary = await test.step(
            '从 Recall 重新打开复制订单并读取持久化后的价格汇总',
            async () => {
              const recallPage = await openRecallAfterConfigurationRefresh(
                savedCopiedOrder.homePage,
                employeeLoginPage,
              );
              await recallPage.openOrderDetails(savedCopiedOrder.orderNumber);
              const summary = await recallPage.readDisplayedOrderPriceSummary();
              await recallPage.closeOrderDetailsDialog();
              return summary;
            },
          );

          await test.step('校验复制订单保存后仍无自动加收且合计为 9.68', async () => {
            expect(persistedSummary.Subtotal).toBeCloseTo(8.8, 2);
            expect(persistedSummary.Tax).toBeCloseTo(0.88, 2);
            expect(persistedSummary.Charge ?? 0).toBe(0);
            expect(
              persistedSummary['Total(Cash)'] ?? persistedSummary.Total,
            ).toBeCloseTo(9.68, 2);
          });
        }
      },
    );
  }

  test(
    '[POS-27303] 应能在修改和删除加收配置后合单并累加原订单加收金额',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-27303')],
    },
    async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const restoreCombineChargeRecalculation = await test.step(
        '关闭合单重新计算加收配置',
        async () => await configureCombineChargeRecalculation(apiSetup, false, readyHomePage),
      );

      try {
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
        return await createSavedOrderWithApiAutoCharge(
          readyHomePage,
          employeeLoginPage,
          orderApi,
          chargeResources.first,
          {
            ...manualFixedCharge,
            name: 'auto_test1',
            orderType: 'dine in',
          },
        );
      });

      const secondOrder = await test.step('创建第二笔含 auto_test2 加收的堂食无桌台订单并保存', async () => {
        const secondReadyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
        return await createSavedOrderWithApiAutoCharge(
          secondReadyHomePage,
          employeeLoginPage,
          orderApi,
          chargeResources.second,
          {
            ...manualFixedCharge,
            name: 'auto_test2',
            orderType: 'dine in',
          },
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

      const combinedChargeAmounts = await test.step('读取合单后两条历史加收金额', async () => {
        await combinedRecallPage.expandOrderDetailsPriceSummary();
        const detailsText = await combinedRecallPage.readOrderDetailsText();
        return {
          first: readChargeAmountFromDetailsText(detailsText, 'auto_test1'),
          deleted: readChargeAmountFromDetailsText(detailsText, 'Charge($10.00)'),
        };
      });
      await test.step('校验合单后两笔历史加收金额累加保留', async () => {
        expect(combinedChargeAmounts.first).toBeCloseTo(10, 2);
        expect(combinedChargeAmounts.deleted).toBeCloseTo(10, 2);
      });
      } finally {
        await test.step('恢复合单重新计算加收配置', restoreCombineChargeRecalculation);
      }
    },
  );

  for (const sourceChargeCase of chargeTransferCases) {
    const chargeCase = createIsolatedChargeTransferCase(sourceChargeCase);
    const blockedReason =
      chargeCase.issue === 'POS-27314' ||
      chargeCase.issue === 'POS-27317' ||
      chargeCase.issue === 'POS-27324' ||
      chargeCase.issue === 'POS-27325'
        ? undefined
        : '该移菜或移单场景尚未补充对应的 POS NG 真实录制脚本。';

    test(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
        test.fixme(Boolean(blockedReason), blockedReason);

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        const chargeResource = await test.step('预置移菜或移单场景所需的加收配置并刷新 POS', async () => {
          const resource = await createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const existingTargetOrder = await test.step('按场景需要创建可接收菜品的已有订单', async () => {
          if (chargeCase.operation === 'move-item-existing-order') {
            return await createSavedOrderWithManualCharge(
              readyHomePage,
              employeeLoginPage,
              chargeCase.initialCharge.name ?? chargeResource.name,
            );
          }

          if (
            chargeCase.operation !== 'move-whole-order-after-update' &&
            chargeCase.operation !== 'move-whole-order-after-delete'
          ) {
            return null;
          }

          return await createSavedRecallOrder(readyHomePage, employeeLoginPage);
        });

        const sourceOrder = await test.step('创建包含目标加收的源订单并保存', async () => {
          const sourceReadyHomePage = await enterReadyHome({ employeeLoginPage, homePage });

          if (chargeCase.operation === 'move-item-existing-order') {
            return await createSavedOrderWithAutoCharge(sourceReadyHomePage, employeeLoginPage);
          }

          if (chargeCase.source === 'manual') {
            return await createSavedOrderWithManualCharge(
              sourceReadyHomePage,
              employeeLoginPage,
              chargeCase.initialCharge.name ?? chargeResource.name,
            );
          }

          return await createSavedOrderWithApiAutoCharge(
            sourceReadyHomePage,
            employeeLoginPage,
            orderApi,
            chargeResource,
            chargeCase.initialCharge,
            { dishCount: chargeCase.operation === 'move-item-new-order' ? 2 : 1 },
          );
        });

        const beforeTransferCharge = await test.step('记录移菜或移单前源订单加收金额', async () => {
          if ('orderId' in sourceOrder && typeof sourceOrder.orderId === 'number') {
            return await readOrderChargeAmountByApi(
              orderApi,
              sourceOrder.orderId,
              chargeCase.expectedChargeName,
            );
          }

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

          if (!existingTargetOrder) {
            throw new Error('整单移动场景未创建目标订单。');
          }

          return await moveWholeOrderAfterConfigurationRefresh(
            homePage,
            employeeLoginPage,
            sourceOrder.orderNumber,
            existingTargetOrder.orderNumber,
          );
        });

        const transferredCharge = await test.step('读取移菜或移单后的校验订单加收金额', async () => {
          const shouldReadSourceOrder =
            chargeCase.operation === 'move-whole-order-after-update' ||
            chargeCase.operation === 'move-whole-order-after-delete';

          return await readTransferredOrderChargeAmount(
            transferredRecallPage,
            chargeCase.expectedChargeName,
            shouldReadSourceOrder ? sourceOrder.orderNumber : undefined,
          );
        });

        const sourceChargeAfterTransfer = await test.step('按场景读取移菜后的源订单加收金额', async () => {
          if (chargeCase.operation !== 'move-item-new-order') {
            return null;
          }

          return await readTransferredOrderChargeAmount(
            transferredRecallPage,
            chargeCase.expectedChargeName,
            sourceOrder.orderNumber,
          );
        });

        await test.step('校验移菜或移单后的加收金额符合预期', async () => {
          if (chargeCase.operation === 'move-item-new-order') {
            expect(transferredCharge.summary?.Charge ?? 0).toBeCloseTo(0, 2);
            expect(transferredCharge.amount).toBeNull();
            expect(transferredCharge.hasNamedCharge).toBe(false);
            expect(sourceChargeAfterTransfer).not.toBeNull();
            expect(sourceChargeAfterTransfer!.amount).not.toBeNull();
            expect(sourceChargeAfterTransfer!.hasNamedCharge).toBe(true);
            expect(sourceChargeAfterTransfer!.amount!).toBeCloseTo(
              resolveExpectedChargeAmount(
                chargeCase.expectedChargeAmount,
                sourceChargeAfterTransfer!.summary!,
              ),
              2,
            );
            return;
          }

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

  test(
    '[POS-30756] 应能在现金支付后追加小费并成功转服务员',
    {
      tag: ['@小费', '@现金支付'],
      annotation: [
        jiraIssueAnnotation('POS-30756'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
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
        const paymentPage = await orderDishesPage.openPayment();
        await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
        const recallPage = await readyHomePage.clickRecall();
        await new RecallFlow().clearSearchConditions(recallPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        return { orderNumber, recallPage };
      });

      await test.step('现金支付完成后从订单详情追加一元小费', async () => {
        await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
        await paidOrder.recallPage.addPaymentCardTip(
          orderServiceSplitOperationCase.postPaymentTipAmountInCents,
          'Cash',
        );
      });

      const transferredSnapshot = await test.step('转移订单服务员后读取订单状态和金额快照', async () => {
        return await transferOrderServerAndReadSnapshot(
          paidOrder.recallPage,
          orderServiceSplitOperationCase.transferredServerName,
        );
      });

      await test.step('校验订单支付状态和服务员切换结果', async () => {
        expect(transferredSnapshot.serverName).toBe(
          orderServiceSplitOperationCase.transferredServerName,
        );
        expect(transferredSnapshot.status).toBe('Success');
      });
    },
  );

  test(
    '[POS-31301] 应能清空单菜折扣并保存',
    {
      tag: ['@折扣'],
      annotation: [
        jiraIssueAnnotation('POS-31301'),
        { type: 'known-issue', description: 'FIXME: 订单总额显示有已知 bug，暂不校验订单总额。' },
      ],
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
        await new OrderDishesFlow().applyCustomItemPercentageDiscount(
          orderDishesPage,
          [orderServiceDishes.regular.name],
          orderServiceSplitOperationCase.itemDiscountRate,
        );
        const discountedItems = await orderDishesPage.readOrderedItems();
        const recallPage = await saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        return { discountedItems, orderNumber };
      });

      const afterClearItems = await test.step('重新打开订单清空单菜折扣并保存', async () => {
        const editingPage = await editSavedOrderAfterConfigurationRefresh(
          homePage,
          employeeLoginPage,
          discountOrder.orderNumber,
        );
        await new OrderDishesFlow().clearAllCharges(editingPage, {
          dishNames: [orderServiceDishes.regular.name],
          scope: 'item',
        });
        const items = await editingPage.readOrderedItems();
        await saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
        return items;
      });

      await test.step('校验清空单菜折扣后折扣明细消失', async () => {
        const discountAdditionNames = discountOrder.discountedItems.flatMap((item) =>
          item.additions.map((addition) => addition.name),
        );
        const afterClearAdditionNames = afterClearItems.flatMap((item) =>
          item.additions.map((addition) => addition.name),
        );

        expect(discountAdditionNames).toContain(
          `Charge(${orderServiceSplitOperationCase.itemDiscountRate}%)`,
        );
        expect(afterClearAdditionNames).not.toContain(
          `Charge(${orderServiceSplitOperationCase.itemDiscountRate}%)`,
        );
      });
    },
  );

  test(
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

  test(
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

  const expectedFailureCombineChargeReasons = new Map<string, string>([
    [
      'POS-32006:true',
      '合单开启重新计算加收后，合并两笔单人订单未新增 minGuest=2 的自动服务加收。',
    ],
  ]);

  for (const sourceChargeCase of combineChargeRecalculationCases) {
    const chargeCase = createIsolatedCombineChargeCase(sourceChargeCase);
    const caseKey = `${chargeCase.issue}:${chargeCase.recalculate}`;
    const expectedFailureReason = expectedFailureCombineChargeReasons.get(caseKey);

    test(
      chargeCase.title,
      {
        tag: chargeCase.coversTip ? ['@加收', '@小费'] : ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
        annotateKnownProductFailure(expectedFailureReason);

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome({ employeeLoginPage, homePage });
        });

        let chargeResourceId: string | number | null = null;
        let restoreCombineChargeRecalculation: (() => Promise<void>) | null = null;
        try {
          const chargeResource = await test.step(
            '预置合单加收配置并设置合单是否重新计算加收',
            async () => {
              const resource = await createChargeSetup(apiSetup, chargeCase.charge);
              chargeResourceId = resource.id;
              restoreCombineChargeRecalculation = await configureCombineChargeRecalculation(
                apiSetup,
                chargeCase.recalculate,
                readyHomePage,
              );
              return resource;
            },
          );

          const sourceOrder = await test.step('创建合单源订单并记录合单前加收信息', async () => {
            return await createSavedOrderForCombineChargeCase(
              readyHomePage,
              employeeLoginPage,
              orderApi,
              chargeResource,
              chargeCase,
              chargeCase.charge.name ?? chargeResource.name,
            );
          });

          const targetOrder = await test.step('创建用于接收合并的目标订单', async () => {
            const targetReadyHomePage = await enterReadyHome({ employeeLoginPage, homePage });

            if (chargeCase.issue === 'POS-32008') {
              return await createSavedOrderWithAutoCharge(
                targetReadyHomePage,
                employeeLoginPage,
              );
            }

            if (chargeCase.targetOrderType === 'dine-in') {
              return await createSavedRecallOrder(targetReadyHomePage, employeeLoginPage);
            }

            if (
              chargeCase.scenario === 'single-auto' ||
              chargeCase.scenario === 'single-manual' ||
              chargeCase.scenario === 'three-charges'
            ) {
              return await createSavedToGoOrder(targetReadyHomePage, employeeLoginPage);
            }

            return await createSavedRecallOrder(targetReadyHomePage, employeeLoginPage);
          });

          const oldChargeAmount = await test.step('读取源订单合并前目标加收金额', async () => {
            return parseChargeAmountText(
              readWholeChargeAmountText(
                sourceOrder.beforeChargeSnapshot,
                chargeCase.expectedChargeName,
              ),
            );
          });

          await test.step('校验两笔源订单合并前均包含十元自动加收', async () => {
            if (chargeCase.issue !== 'POS-32008') {
              return;
            }

            expect(oldChargeAmount).toBeCloseTo(10, 2);
            expect(hasBeforeChargeSnapshot(targetOrder)).toBe(true);
            if (!hasBeforeChargeSnapshot(targetOrder)) {
              throw new Error('POS-32008 目标订单缺少合单前加收快照。');
            }

            const targetChargeAmount = parseChargeAmountText(
              readWholeChargeAmountText(
                targetOrder.beforeChargeSnapshot,
                chargeCase.expectedChargeName,
              ),
            );
            expect(targetChargeAmount).toBeCloseTo(10, 2);
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
                chargeCase.preservesSourceChargeAmount && oldChargeAmount !== null
                  ? oldChargeAmount
                  : resolveExpectedChargeAmount(
                      chargeCase.expectedChargeAmount,
                      combinedCharge.summary!,
                    ),
                2,
              );
            } else {
              expect(combinedCharge.amount).toBeNull();
            }

            if (chargeCase.preservesSourceChargeAmount && oldChargeAmount !== null) {
              expect(combinedCharge.amount).toBeCloseTo(oldChargeAmount, 2);
            }
          });
        } finally {
          await test.step('删除合单加收并恢复合单重新计算配置', async () => {
            if (chargeResourceId !== null) {
              await apiSetup.charge.delete(chargeResourceId);
            }
            if (restoreCombineChargeRecalculation) {
              await restoreCombineChargeRecalculation();
            }
          });
        }
      },
    );
  }

  test(
    '[POS-32031] 应能在合单重新计算加收时正确计算三类加收金额',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-32031')],
    },
    async ({ homePage, employeeLoginPage, apiSetup, orderApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });
      const createdChargeIds: Array<string | number> = [];
      let restoreCombineChargeRecalculation: (() => Promise<void>) | null = null;

      try {
        const chargeResources = await test.step('预置自动和手动加收并开启合单重新计算', async () => {
          const auto = await createChargeSetup(apiSetup, {
            ...autoFixedCharge,
            name: 'auto_test1',
            orderType: 'dine in',
          });
          const manual = await createChargeSetup(apiSetup, {
            ...manualFixedCharge,
            name: 'auto_test2',
            orderType: 'dine in',
          });
          createdChargeIds.push(auto.id, manual.id);
          restoreCombineChargeRecalculation = await configureCombineChargeRecalculation(
            apiSetup,
            true,
            readyHomePage,
          );
          return { auto, manual };
        });

        const autoCharge: ChargeSetupOverrides = {
          ...autoFixedCharge,
          name: 'auto_test1',
          orderType: 'dine in',
        };
        const manualCharge: ChargeSetupOverrides = {
          ...manualFixedCharge,
          name: 'auto_test2',
          orderType: 'dine in',
        };
        const firstOrder = await test.step('创建含三类加收的 A 订单', async () => {
          return await createSavedOrderWithApiCharges(
            readyHomePage,
            employeeLoginPage,
            orderApi,
            [
              { charge: autoCharge, resource: chargeResources.auto },
              { charge: manualCharge, resource: chargeResources.manual },
              {
                charge: {
                  name: 'Charge($5.00)',
                  rate: 5,
                  rateType: 1,
                  taxed: true,
                  triggerMode: 2,
                },
                resource: { id: -1, name: 'Charge($5.00)' },
              },
            ],
          );
        });
        const secondOrder = await test.step('创建含三类加收的 B 订单', async () => {
          const secondReadyHomePage = await enterReadyHome({ employeeLoginPage, homePage });
          return await createSavedOrderWithApiCharges(
            secondReadyHomePage,
            employeeLoginPage,
            orderApi,
            [
              { charge: autoCharge, resource: chargeResources.auto },
              { charge: manualCharge, resource: chargeResources.manual },
              {
                charge: {
                  name: 'Charge(10%)',
                  rate: 10,
                  rateType: 2,
                  taxed: false,
                  triggerMode: 2,
                },
                resource: { id: -1, name: 'Charge(10%)' },
              },
            ],
          );
        });

        const beforeCharges = await test.step('读取 A、B 两单合并前的测试加收', async () => {
          const [first, second] = await Promise.all([
            readOrderChargesByApi(orderApi, firstOrder.orderId),
            readOrderChargesByApi(orderApi, secondOrder.orderId),
          ]);
          return { first, second };
        });

        await test.step('从 Recall 将 A 订单合并到 B 订单', async () => {
          await new RecallFlow().combineOrders(
            secondOrder.recallPage,
            firstOrder.orderNumber,
            secondOrder.orderNumber,
          );
        });

        const combinedManagedCharges = await test.step('读取合单后的三类测试加收', async () => {
          const allCharges = await readOrderChargesByApi(orderApi, secondOrder.orderId);
          return allCharges.filter(
            (charge) =>
              charge.name === 'auto_test1' ||
              charge.name === 'auto_test2' ||
              charge.name.startsWith('Charge('),
          );
        });

        await test.step('校验合单后三类加收的条数和金额', async () => {
          const oldManagedTotal = [...beforeCharges.first, ...beforeCharges.second]
            .filter(
              (charge) =>
                charge.name === 'auto_test1' ||
                charge.name === 'auto_test2' ||
                charge.name.startsWith('Charge('),
            )
            .reduce((sum, charge) => sum + charge.amount, 0);
          const combinedManagedTotal = combinedManagedCharges.reduce(
            (sum, charge) => sum + charge.amount,
            0,
          );
          const autoChargeAmount = combinedManagedCharges.find(
            (charge) => charge.name === 'auto_test1',
          )?.amount;
          const manualChargeAmount = combinedManagedCharges.find(
            (charge) => charge.name === 'auto_test2',
          )?.amount;
          const oldManualChargeAmount = [...beforeCharges.first, ...beforeCharges.second]
            .filter((charge) => charge.name === 'auto_test2')
            .reduce((sum, charge) => sum + charge.amount, 0);

          expect(combinedManagedCharges).toHaveLength(3);
          expect(autoChargeAmount).toBeCloseTo(10, 2);
          expect(manualChargeAmount).toBeCloseTo(oldManualChargeAmount, 2);
          expect(combinedManagedTotal).toBeCloseTo(oldManagedTotal - 10, 2);
        });
      } finally {
        await test.step('删除测试加收并恢复合单重新计算配置', async () => {
          for (const chargeId of createdChargeIds) {
            await apiSetup.charge.delete(chargeId);
          }
          if (restoreCombineChargeRecalculation) {
            await restoreCombineChargeRecalculation();
          }
        });
      }
    },
  );

  test(
    '[POS-32955] 应能在加收页展示 OpenFood 自定义中英文名称',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-32955')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const openFoodName = 'OpenFood测试Name';
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const orderDishesPage = await test.step('创建堂食无桌台订单并添加 OpenFood 自定义名称菜品', async () => {
        const page = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addOpenFoodItem(page, openFoodName, 10);
        return page;
      });

      await test.step('打开加收页并校验 OpenFood 自定义名称', async () => {
        await orderDishesPage.clickCharge();
        await orderDishesPage.switchChargeScope('item');
        await orderDishesPage.expectChargeDishVisible(openFoodName);
      });

      await orderDishesPage.closeChargeDialog();
    },
  );

  test(
    '[POS-32934] 应能在分单页展示 Add Suborder 并新增子单',
    {
      annotation: [jiraIssueAnnotation('POS-32934')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const splitOrderPage = await test.step('创建堂食无桌台订单并进入分单页', async () => {
        const page = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return await page.openSplitOrder();
      });

      await test.step('校验新增子单入口文案并创建第二个子单', async () => {
        await splitOrderPage.expectAddSuborderLabel('Add Suborder');
        await splitOrderPage.clickAddSuborder();
        await splitOrderPage.expectSuborderIndexVisible(2);
      });
    },
  );

  test(
    '[POS-32954] 应能在分单时按配置展示未分单菜品和全部菜品',
    {
      tag: ['@分单'],
      annotation: [jiraIssueAnnotation('POS-32954')],
    },
    async ({ homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      await test.step('开启分单时展示未分单菜品配置并刷新 POS', async () => {
        await configureShowUnsplitItemsWhenSplitOrder(apiSetup, true, readyHomePage);
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
        await configureShowUnsplitItemsWhenSplitOrder(apiSetup, false, readyHomePage);
      });
    },
  );

  test(
    '[POS-32963] 应能在加收金额出现三位小数时按规则进位到分',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-32963')],
    },
    async ({ homePage, employeeLoginPage }) => {
      annotateKnownProductFailure(
        '实测 100 元按 1.015% 加收显示 1.01，未按规则进位为 1.02，等待产品修复。',
      );

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

  test(
    '[POS-33063] 应能在税额计算包含加收时正确计算服务加收、税和订单金额',
    {
      tag: ['@加收', '@折扣'],
      annotation: [jiraIssueAnnotation('POS-33063')],
    },
    async ({ homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      await test.step(
        '开启税额计算包含加收配置并预置自动服务加收',
        async () => {
          await createChargeSetup(apiSetup, {
            ...manualFixedCharge,
            name: manualFixedChargeName,
            orderType: 'dine in',
            rate: 10,
            rateType: 2,
            triggerMode: 1,
            type: 'SERVICE',
          });
          await configureTaxIncludesCharge(apiSetup, true, readyHomePage);
        },
      );

      try {
        const orderResult = await test.step('创建订单并读取税额和加收金额', async () => {
          const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
          await new OrderDishesFlow().addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return await waitUntil(
            async () => await orderDishesPage.readPriceSummary(),
            (summary) => {
              const expectedCharge = Number(
                ((summary.Subtotal + summary.Tax) * 0.1).toFixed(2),
              );
              return Math.abs((summary.Charge ?? 0) - expectedCharge) < 0.005;
            },
            {
              timeout: 10_000,
              interval: 250,
              message: '服务加收未按 Subtotal + Tax 的 10% 稳定到最终金额。',
            },
          );
        });

        await test.step('校验服务加收基于 subtotal 加税额计算', async () => {
          const expectedTargetCharge = Number(
            ((orderResult.Subtotal + orderResult.Tax) * 0.1).toFixed(2),
          );
          const summary = orderResult as unknown as Record<string, number>;
          const totalCharge = summary.Charge ?? 0;
          const total = summary.Total ?? summary['Total(Cash)'] ?? 0;

          expect(totalCharge).toBeCloseTo(expectedTargetCharge, 2);
          expect(total).toBeCloseTo(
            orderResult.Subtotal + orderResult.Tax + totalCharge,
            2,
          );
        });
      } finally {
        await test.step('关闭税额计算包含加收配置', async () => {
          await apiSetup.systemConfiguration.updateByName(
            'CHARGE_CALCULATION_INCLUDE_TAX',
            false,
            { verify: true },
          );
        });
      }
    },
  );

  test(
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

      const sentOrder = await test.step('打开最新 Delivery 订单并从详情送厨', async () => {
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        await recallPage.openOrderDetails(orderNumber);
        const beforeSendDetails = await recallPage.readOrderDetailsSnapshot();
        let kitchenTicketStatus: number | null = null;

        if (beforeSendDetails.availableActions.send) {
          kitchenTicketStatus =
            await recallPage.clickSendInOrderDetailsAndReadKitchenTicketStatus();
        }

        await recallPage.closeOrderDetailsDialog();
        await recallPage.openOrderDetails(orderNumber);
        return {
          details: await recallPage.readOrderDetailsSnapshot(),
          kitchenTicketStatus,
        };
      });

      await test.step('校验 Delivery 订单保留 & 地址并完成送厨', async () => {
        expect(sentOrder.details.customerInfo?.address).toContain(
          orderServiceCustomers.deliveryWithAmpersandAddress.address,
        );
        expect(sentOrder.kitchenTicketStatus).toBe(200);
      });
    },
  );

  test(
    '[POS-34555] 应能分两次现金付款且第二次产生找零后支付成功',
    {
      tag: ['@现金支付'],
      annotation: [
        jiraIssueAnnotation('POS-34555'),
        {
          type: 'known-issue',
          description:
            '订单完成两次现金付款且第二次已产生找零后，Recall 支付状态仍为 Semi-Paid，而非 Success。',
        },
      ],
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
        await new RecallFlow().clearSearchConditions(recallPage);
        const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
        return { orderNumber, recallPage };
      });

      const details = await test.step('打开最新订单并读取支付状态', async () => {
        await paidOrder.recallPage.openOrderDetails(paidOrder.orderNumber);
        return await paidOrder.recallPage.readOrderDetailsSnapshot();
      });

      await test.step('校验第二次现金找零后订单支付状态成功', async () => {
        expect(details.paymentStatus).toBe('Success');
      });
    },
  );
});

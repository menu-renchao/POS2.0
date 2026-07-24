import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import {
  orderServiceCustomers,
  orderServiceDishes,
  orderServiceSeatDisplayConfigurationUpdate,
  orderServiceSplitOperationCase,
} from '../../test-data/order-service';
import { expectOkEnvelope } from '../../api/setup/setup-resource';
import { jiraIssueAnnotation } from '../../utils/jira';
import { waitUntil } from '../../utils/wait';
import {
  ChargeExpectedAmount,
  ChargeCopySource,
  ChargeCopyCase,
  manualFixedChargeName,
  manualPercentChargeName,
  manualFixedCharge,
  manualPercentCharge,
  autoFixedChargeName,
  autoPercentChargeName,
  autoFixedCharge,
  autoPercentCharge,
  buildDineInOrderWithWholeChargeRequest,
  createIsolatedChargeEditCase,
  createIsolatedChargeFollowUpCase,
  type ChargeEditCase,
  type ChargeFollowUpCase,
} from '../../test-data/split-order-charge';
import {
  readChargeAmountFromDetailsText,
  readWholeChargeAmountText,
  resolveExpectedChargeAmount,
  parseChargeAmountText,
} from '../../utils/split-order-charge';
import { escapeRegExp } from '../../utils/text';
import { annotateKnownProductFailure } from '../../utils/test-annotation';

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
    expectedChargeAmount: '5.00',
  },
];

test.describe('分单加收编辑与后续操作回归', { tag: ['@点单', '@分单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

for (const sourceChargeCase of manualChargeEditCases) {
    const chargeCase = createIsolatedChargeEditCase(sourceChargeCase);
    test(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ flows, homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const blockedReason = blockedManualChargeEditReasons.get(chargeCase.issue);
        annotateKnownProductFailure(blockedReason);

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const chargeResource = await test.step('预置手动加收配置并刷新 POS', async () => {
          const resource = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const savedOrder = await test.step('创建含预置目标加收的堂食无桌台订单并保存', async () => {
          if (chargeCase.source === 'auto') {
            return await flows.splitOrderScenarioFlow.createSavedOrderWithAutoCharge(readyHomePage, employeeLoginPage);
          }

          return await flows.splitOrderScenarioFlow.createSavedOrderWithManualCharge(readyHomePage,
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
            return await flows.splitOrderScenarioFlow.editSavedOrderAfterConfigurationRefresh(homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
          });

          const refreshedCharge = await test.step('打开加收弹窗并确认后台更新后的加收', async () => {
            return await flows.orderDishesFlow.confirmRefreshedChargeAndReadState(editedOrderPage);
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
          return await flows.splitOrderScenarioFlow.reopenSavedOrderForChargeCheck(homePage,
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
      async ({ flows, homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const blockedReason = blockedAutoChargeEditReasons.get(chargeCase.issue);
        annotateKnownProductFailure(blockedReason);

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const chargeResource = await test.step('预置自动加收配置并刷新 POS', async () => {
          const resource = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const savedOrder = await test.step('创建自动触发加收的堂食无桌台订单并保存', async () => {
          return await flows.splitOrderScenarioFlow.createSavedOrderWithApiAutoCharge(readyHomePage,
            employeeLoginPage,
            orderApi,
            chargeResource,
            chargeCase.initialCharge,
          );
        });

        await test.step('校验保存前订单已自动带出初始加收', async () => {
          const initialChargeName = chargeCase.initialCharge.name ?? chargeResource.name;
          const initialAmount = await orderApi.readOrderChargeAmount(
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
          return await flows.splitOrderScenarioFlow.reopenSavedOrderForChargeCheck(homePage,
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
      async ({ flows, homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const expectedFailureReason = expectedFailureChargeFollowUpIssues.get(chargeCase.issue);
        annotateKnownProductFailure(expectedFailureReason);

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const chargeResource = await test.step('预置加收配置并刷新 POS', async () => {
          const resource = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const savedOrder = await test.step('创建含目标加收的堂食无桌台订单并保存', async () => {
          if (chargeCase.source === 'manual') {
            return await flows.splitOrderScenarioFlow.createSavedOrderWithManualCharge(readyHomePage,
              employeeLoginPage,
              chargeCase.initialCharge.name ?? chargeResource.name,
              { addSecondDish: chargeCase.operation === 'edit-item-split' },
            );
          }

          return await flows.splitOrderScenarioFlow.createSavedOrderWithApiAutoCharge(readyHomePage,
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
            const recallPage = await flows.splitOrderScenarioFlow.openRecallAfterConfigurationRefresh(homePage,
              employeeLoginPage,
            );
            await flows.recallFlow.sendOrderToKitchen(recallPage, savedOrder.orderNumber);
          });
        }

        if (chargeCase.operation === 'edit-send') {
          await test.step('从编辑页送厨订单', async () => {
            const editingPage = await flows.splitOrderScenarioFlow.editSavedOrderAfterConfigurationRefresh(homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
            await flows.splitOrderScenarioFlow.sendEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
          });
        }

        if (chargeCase.operation === 'edit-save') {
          await test.step('从编辑页重新保存订单', async () => {
            const editingPage = await flows.splitOrderScenarioFlow.editSavedOrderAfterConfigurationRefresh(homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
            await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(editingPage, employeeLoginPage);
          });
        }

        if (chargeCase.operation === 'detail-even-split') {
          const splitOrder = await test.step('从 Recall 详情页平分订单', async () => {
            return await flows.splitOrderChargeEditFlow.splitSavedOrderFromRecallDetails(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
          });

          const childCharge = await test.step('读取第一个子单加收金额', async () => {
            return await flows.splitOrderChargeEditFlow.readFirstSplitTargetCharge(
              splitOrder,
            );
          });

          await test.step('校验详情页分单后的子单加收金额', async () => {
            expect(childCharge).toBeCloseTo(Number(chargeCase.expectedChargeAmount), 2);
          });
          return;
        }

        if (chargeCase.operation === 'edit-item-split') {
          const splitOrder = await test.step('从 Recall 详情按菜品移入新子单并返回 Recall', async () => {
            return await flows.splitOrderChargeEditFlow.splitSavedOrderByItemFromRecallDetails(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
              orderServiceDishes.regular.name,
            );
          });

          const childChargeDetails = await test.step('读取两个子单的加收名称与金额', async () => {
            const firstChild =
              await flows.splitOrderChargeEditFlow.readTargetChargeDetails(
              splitOrder.recallPage,
              splitOrder.orderNumber,
              splitOrder.firstTargetOrderNumber,
              chargeCase.expectedChargeName,
            );
            const secondChild =
              await flows.splitOrderChargeEditFlow.readTargetChargeDetails(
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
            return await flows.splitOrderChargeEditFlow.splitSavedOrderFromEditPage(
              homePage,
              employeeLoginPage,
              savedOrder.orderNumber,
            );
          });

          const childCharge = await test.step('读取第一个子单加收金额', async () => {
            return await flows.splitOrderChargeEditFlow.readFirstSplitTargetCharge(
              splitOrder,
            );
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
              amount: await orderApi.readOrderChargeAmount(
                savedOrder.orderId,
                chargeCase.expectedChargeName,
              ),
              summary: savedOrder.beforeSummary,
            };
          }

          return await flows.splitOrderChargeEditFlow.readEditedOrderChargeAmount(
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

});

import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import type { ChargeSetupOverrides } from '../../test-data/api/admin-config-api-data';
import { jiraIssueAnnotation } from '../../utils/jira';
import {
  ChargeCopyCase,
  manualFixedChargeName,
  manualPercentChargeName,
  manualFixedCharge,
  manualPercentCharge,
  autoFixedChargeName,
  autoPercentChargeName,
  autoFixedCharge,
  autoPercentCharge,
  createIsolatedChargeCopyCase,
  createIsolatedChargeTransferCase,
  type ChargeTransferCase,
} from '../../test-data/split-order-charge';
import {
  readChargeAmountFromDetailsText,
  readWholeChargeAmountText,
  resolveExpectedChargeAmount,
  parseChargeAmountText,
} from '../../utils/split-order-charge';
import { annotateKnownProductFailure } from '../../utils/test-annotation';

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

const blockedChargeCopyIssues = new Map<ChargeCopyCase['issue'], string>([
  ['POS-27257', '复制自动加收订单后未显示后台更新后的加收名称和金额。'],
  [
    'POS-27271',
    'Delivery 源订单保存前未生成目标自动加收 auto_test1，无法进入修改 minMileage 后复制订单的断言。',
  ],
  [
    'POS-27288',
    '创建源订单时确认目标手动加收后 Charge 弹窗未关闭且加收未生效，无法进入复制后的订单类型断言。',
  ],
]);

test.describe('分单加收复制与转移回归', { tag: ['@点单', '@分单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

for (const sourceChargeCase of chargeCopyCases) {
    const chargeCase = createIsolatedChargeCopyCase(sourceChargeCase);
    test(
      chargeCase.title,
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation(chargeCase.issue)],
      },
      async ({ flows, homePage, employeeLoginPage, apiSetup, orderApi }) => {
        const blockedReason = blockedChargeCopyIssues.get(chargeCase.issue);
        annotateKnownProductFailure(blockedReason);

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const chargeResource = await test.step('预置复制订单场景所需的加收配置并刷新 POS', async () => {
          const resource = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const savedOrder = await test.step('创建包含目标加收的源订单并保存', async () => {
          return await flows.splitOrderChargeTransferFlow.createSavedOrderForChargeCopyCase(
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
          return await flows.splitOrderChargeTransferFlow.copySavedOrderAfterConfigurationRefresh(
            homePage,
            employeeLoginPage,
            savedOrder.orderNumber,
          );
        });

        const copiedCharge = await test.step('读取复制后新订单的加收明细', async () => {
          return await flows.splitOrderChargeTransferFlow.readCopiedOrderChargeAmount(
            copiedOrderPage,
            chargeCase.expectedChargeName,
          );
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
            return await copiedOrderPage.navigation.saveOrderWithReference();
          });

          const persistedSummary = await test.step(
            '从 Recall 重新打开复制订单并读取持久化后的价格汇总',
            async () => {
              const recallPage = await flows.splitOrderScenarioFlow.openRecallAfterConfigurationRefresh(savedCopiedOrder.homePage,
                employeeLoginPage,
              );
              await recallPage.orderDetails.openOrderDetails(savedCopiedOrder.orderNumber);
              const summary = await recallPage.orderDetails.readDisplayedOrderPriceSummary();
              await recallPage.orderDetails.closeOrderDetailsDialog();
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
    async ({ flows, homePage, employeeLoginPage, apiSetup, orderApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const restoreCombineChargeRecalculation = await test.step(
        '关闭合单重新计算加收配置',
        async () => await flows.splitOrderScenarioFlow.configureCombineChargeRecalculation(false, readyHomePage),
      );

      try {
      const chargeResources = await test.step('预置两条用于合单的后台加收配置并刷新 POS', async () => {
        const first = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, {
          ...manualFixedCharge,
          name: 'auto_test1',
          orderType: 'dine in',
        });
        const second = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, {
          ...manualFixedCharge,
          name: 'auto_test2',
          orderType: 'dine in',
        });
        await readyHomePage.clickRefresh();
        return { first, second };
      });

      const firstOrder = await test.step('创建第一笔含 auto_test1 加收的堂食无桌台订单并保存', async () => {
        return await flows.splitOrderScenarioFlow.createSavedOrderWithApiAutoCharge(readyHomePage,
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
        const secondReadyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        return await flows.splitOrderScenarioFlow.createSavedOrderWithApiAutoCharge(secondReadyHomePage,
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
        return await flows.splitOrderScenarioFlow.combineSavedOrdersAfterConfigurationRefresh(homePage,
          employeeLoginPage,
          firstOrder.orderNumber,
          secondOrder.orderNumber,
        );
      });

      const combinedChargeAmounts = await test.step('读取合单后两条历史加收金额', async () => {
        await combinedRecallPage.orderDetails.expandOrderDetailsPriceSummary();
        const detailsText = await combinedRecallPage.orderDetails.readOrderDetailsText();
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
      async ({ flows, homePage, employeeLoginPage, apiSetup, orderApi }) => {
        test.fixme(Boolean(blockedReason), blockedReason);

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const chargeResource = await test.step('预置移菜或移单场景所需的加收配置并刷新 POS', async () => {
          const resource = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, chargeCase.initialCharge);
          await readyHomePage.clickRefresh();
          return resource;
        });

        const existingTargetOrder = await test.step('按场景需要创建可接收菜品的已有订单', async () => {
          if (chargeCase.operation === 'move-item-existing-order') {
            return await flows.splitOrderScenarioFlow.createSavedOrderWithManualCharge(readyHomePage,
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

          return await flows.splitOrderScenarioFlow.createSavedRecallOrder(readyHomePage, employeeLoginPage);
        });

        const sourceOrder = await test.step('创建包含目标加收的源订单并保存', async () => {
          const sourceReadyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);

          if (chargeCase.operation === 'move-item-existing-order') {
            return await flows.splitOrderScenarioFlow.createSavedOrderWithAutoCharge(sourceReadyHomePage, employeeLoginPage);
          }

          if (chargeCase.source === 'manual') {
            return await flows.splitOrderScenarioFlow.createSavedOrderWithManualCharge(sourceReadyHomePage,
              employeeLoginPage,
              chargeCase.initialCharge.name ?? chargeResource.name,
            );
          }

          return await flows.splitOrderScenarioFlow.createSavedOrderWithApiAutoCharge(sourceReadyHomePage,
            employeeLoginPage,
            orderApi,
            chargeResource,
            chargeCase.initialCharge,
            { dishCount: chargeCase.operation === 'move-item-new-order' ? 2 : 1 },
          );
        });

        const beforeTransferCharge = await test.step('记录移菜或移单前源订单加收金额', async () => {
          if ('orderId' in sourceOrder && typeof sourceOrder.orderId === 'number') {
            return await orderApi.readOrderChargeAmount(
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
            return await flows.splitOrderChargeTransferFlow.moveItemAfterConfigurationRefresh(
              homePage,
              employeeLoginPage,
              sourceOrder.orderNumber,
              existingTargetOrder?.orderNumber,
            );
          }

          if (!existingTargetOrder) {
            throw new Error('整单移动场景未创建目标订单。');
          }

          return await flows.splitOrderChargeTransferFlow.moveWholeOrderAfterConfigurationRefresh(
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

          return await flows.splitOrderScenarioFlow.readTransferredOrderChargeAmount(
            transferredRecallPage,
            chargeCase.expectedChargeName,
            shouldReadSourceOrder ? sourceOrder.orderNumber : undefined,
          );
        });

        const sourceChargeAfterTransfer = await test.step('按场景读取移菜后的源订单加收金额', async () => {
          if (chargeCase.operation !== 'move-item-new-order') {
            return null;
          }

          return await flows.splitOrderScenarioFlow.readTransferredOrderChargeAmount(
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
});

import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import type { ChargeSetupOverrides } from '../../test-data/api/admin-config-api-data';
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
  createIsolatedCombineChargeCase,
  type CombineChargeRecalculationCase,
} from '../../test-data/split-order-charge';
import {
  readChargeAmountFromDetailsText,
  readWholeChargeAmountText,
  resolveExpectedChargeAmount,
  parseChargeAmountText,
  hasBeforeChargeSnapshot,
} from '../../utils/split-order-charge';
import { escapeRegExp } from '../../utils/text';
import { annotateKnownProductFailure } from '../../utils/test-annotation';

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
      description: '',
      minConsumption: 0,
      minGuest: 0,
      minMileage: 0,
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
    title: '[POS-32023] 应能在合单不重新计算加收时保留计小费百分比手动加收',
    recalculate: false,
    scenario: 'single-manual',
    charge: {
      ...autoPercentCharge,
      active: true,
      description: '',
      minConsumption: 0,
      minGuest: 0,
      minMileage: 0,
      orderType: 'dine in',
      rate: 10,
      rateType: 2,
      sharedTip: true,
      taxed: false,
      triggerMode: 0,
      type: 'SERVICE',
    },
    firstOrderType: 'dine-in',
    expectedChargeName: autoPercentChargeName,
    expectedChargeAmount: 'percent10',
    expectedChargeAvailable: true,
    coversTip: true,
    preservesSourceChargeAmount: true,
  },
];

const expectedFailureCombineChargeReasons = new Map<string, string>([
  [
    'POS-32006:true',
    '合单开启重新计算加收后，合并两笔单人订单未新增 minGuest=2 的自动服务加收。',
  ],
]);

test.describe('分单加收合并与金额回归', { tag: ['@点单', '@分单', '@ui-exclusive-config'] }, () => {
  test.describe.configure({ timeout: 180_000 });

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
      async ({ flows, homePage, employeeLoginPage, apiSetup, orderApi }) => {
        annotateKnownProductFailure(expectedFailureReason);

        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const workingHomePage = readyHomePage;
        let chargeResourceId: string | number | null = null;
        let restoreCombineChargeRecalculation: (() => Promise<void>) | null = null;
        try {
          const chargeResource = await test.step(
            '预置合单加收配置并设置合单是否重新计算加收',
            async () => {
              const resource = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, chargeCase.charge);
              chargeResourceId = resource.id;
              restoreCombineChargeRecalculation = await flows.splitOrderScenarioFlow.configureCombineChargeRecalculation(
                chargeCase.recalculate,
                workingHomePage,
              );
              return resource;
            },
          );

          const sourceOrder = await test.step('创建合单源订单并记录合单前加收信息', async () => {
            return await flows.splitOrderChargeCombineFlow.createSavedOrderForCombineChargeCase(
              workingHomePage,
              employeeLoginPage,
              orderApi,
              chargeResource,
              chargeCase,
              chargeCase.charge.name ?? chargeResource.name,
            );
          });

          const targetOrder = await test.step('创建用于接收合并的目标订单', async () => {
            const targetReadyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);

            if (chargeCase.issue === 'POS-32008') {
              return await flows.splitOrderScenarioFlow.createSavedOrderWithAutoCharge(targetReadyHomePage,
                employeeLoginPage,
              );
            }

            if (chargeCase.targetOrderType === 'dine-in') {
              return await flows.splitOrderScenarioFlow.createSavedRecallOrder(targetReadyHomePage, employeeLoginPage);
            }

            if (
              chargeCase.scenario === 'single-auto' ||
              chargeCase.scenario === 'single-manual' ||
              chargeCase.scenario === 'three-charges'
            ) {
              if (chargeCase.issue === 'POS-32016') {
                return await flows.splitOrderChargeCombineFlow.createSavedToGoOrder(
                  targetReadyHomePage,
                  employeeLoginPage,
                  orderServiceDishes.test,
                );
              }

              return await flows.splitOrderChargeCombineFlow.createSavedToGoOrder(
                targetReadyHomePage,
                employeeLoginPage,
              );
            }

            return await flows.splitOrderScenarioFlow.createSavedRecallOrder(targetReadyHomePage, employeeLoginPage);
          });

          const oldChargeAmount = await test.step('读取源订单合并前目标加收金额', async () => {
            return parseChargeAmountText(
              readWholeChargeAmountText(
                sourceOrder.beforeChargeSnapshot,
                chargeCase.expectedChargeName,
              ),
            );
          });

          await test.step('校验目标订单合单前不含目标加收', async () => {
            if (chargeCase.issue !== 'POS-32016' && chargeCase.issue !== 'POS-32023') {
              return;
            }

            expect(hasBeforeChargeSnapshot(targetOrder)).toBe(true);
            if (!hasBeforeChargeSnapshot(targetOrder)) {
              throw new Error(`${chargeCase.issue} 目标订单缺少合单前加收快照。`);
            }

            expect(
              parseChargeAmountText(
                readWholeChargeAmountText(
                  targetOrder.beforeChargeSnapshot,
                  chargeCase.expectedChargeName,
                ),
              ),
            ).toBeNull();

            if (chargeCase.issue === 'POS-32023') {
              expect(targetOrder.beforeSummary.Subtotal).toBeCloseTo(8.8, 2);
              expect(targetOrder.beforeSummary.Tax).toBeCloseTo(0.88, 2);
              expect(targetOrder.beforeSummary.Charge ?? 0).toBe(0);
              expect(targetOrder.beforeSummary['Total(Cash)']).toBeCloseTo(9.68, 2);
            }

            if (chargeCase.issue === 'POS-32016') {
              expect(oldChargeAmount).toBeCloseTo(0.88, 2);
              expect(sourceOrder.beforeSummary.Subtotal).toBeCloseTo(8.8, 2);
              expect(sourceOrder.beforeSummary.Tax).toBeCloseTo(0.88, 2);
              expect(sourceOrder.beforeSummary.Charge).toBeCloseTo(0.88, 2);
              expect(sourceOrder.beforeSummary['Total(Cash)']).toBeCloseTo(10.56, 2);
              expect(targetOrder.beforeSummary.Subtotal).toBeCloseTo(9.9, 2);
              expect(targetOrder.beforeSummary.Tax).toBeCloseTo(0.99, 2);
              expect(targetOrder.beforeSummary.Charge ?? 0).toBe(0);
              expect(targetOrder.beforeSummary['Total(Cash)']).toBeCloseTo(10.89, 2);
            }
          });

          await test.step('校验 POS-32023 订单 A 合单前手动加收金额为 0.88', async () => {
            if (chargeCase.issue !== 'POS-32023') {
              return;
            }

            expect(oldChargeAmount).toBeCloseTo(0.88, 2);
            expect(sourceOrder.beforeSummary.Subtotal).toBeCloseTo(8.8, 2);
            expect(sourceOrder.beforeSummary.Tax).toBeCloseTo(0.88, 2);
            expect(sourceOrder.beforeSummary.Charge).toBeCloseTo(0.88, 2);
            expect(sourceOrder.beforeSummary['Total(Cash)']).toBeCloseTo(10.56, 2);
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
            if (chargeCase.issue === 'POS-32016') {
              return await flows.splitOrderScenarioFlow.combineSavedOrdersAfterConfigurationRefresh(homePage,
                employeeLoginPage,
                targetOrder.orderNumber,
                sourceOrder.orderNumber,
              );
            }

            return await flows.splitOrderScenarioFlow.combineSavedOrdersAfterConfigurationRefresh(homePage,
              employeeLoginPage,
              sourceOrder.orderNumber,
              targetOrder.orderNumber,
            );
          });

          const combinedCharge = await test.step('读取合单后的目标加收金额', async () => {
            return await flows.splitOrderScenarioFlow.readTransferredOrderChargeAmount(
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

            if (chargeCase.issue === 'POS-32023') {
              expect(combinedCharge.namedChargeCount).toBe(1);
              expect(combinedCharge.summary!.Subtotal).toBeCloseTo(17.6, 2);
              expect(combinedCharge.summary!.Tax).toBeCloseTo(1.76, 2);
              expect(combinedCharge.summary!.Charge).toBeCloseTo(0.88, 2);
              expect(
                combinedCharge.summary!['Total(Cash)'] ?? combinedCharge.summary!.Total,
              ).toBeCloseTo(20.24, 2);
            }

            if (chargeCase.issue === 'POS-32016') {
              expect(combinedCharge.summary!.Count).toBe(2);
              expect(combinedCharge.summary!.Subtotal).toBeCloseTo(18.7, 2);
              expect(combinedCharge.summary!.Tax).toBeCloseTo(1.87, 2);
              expect(combinedCharge.summary!.Charge).toBeCloseTo(1.87, 2);
              expect(
                combinedCharge.summary!['Total(Cash)'] ?? combinedCharge.summary!.Total,
              ).toBeCloseTo(22.44, 2);
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
    async ({ flows, homePage, employeeLoginPage, apiSetup, orderApi }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });
      const createdChargeIds: Array<string | number> = [];
      let restoreCombineChargeRecalculation: (() => Promise<void>) | null = null;

      try {
        const chargeResources = await test.step('预置自动和手动加收并开启合单重新计算', async () => {
          const auto = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, {
            ...autoFixedCharge,
            name: 'auto_test1',
            orderType: 'dine in',
          });
          const manual = await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, {
            ...manualFixedCharge,
            name: 'auto_test2',
            orderType: 'dine in',
          });
          createdChargeIds.push(auto.id, manual.id);
          restoreCombineChargeRecalculation = await flows.splitOrderScenarioFlow.configureCombineChargeRecalculation(
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
          return await flows.splitOrderScenarioFlow.createSavedOrderWithApiCharges(
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
          const secondReadyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
          return await flows.splitOrderScenarioFlow.createSavedOrderWithApiCharges(
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
            orderApi.readOrderCharges(firstOrder.orderId),
            orderApi.readOrderCharges(secondOrder.orderId),
          ]);
          return { first, second };
        });

        await test.step('从 Recall 将 A 订单合并到 B 订单', async () => {
          await flows.recallFlow.combineOrders(
            secondOrder.recallPage,
            firstOrder.orderNumber,
            secondOrder.orderNumber,
          );
        });

        const combinedManagedCharges = await test.step('读取合单后的三类测试加收', async () => {
          const allCharges = await orderApi.readOrderCharges(
            secondOrder.orderId,
          );
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
    async ({ flows, homePage, employeeLoginPage }) => {
      const openFoodName = 'OpenFood测试Name';
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const orderDishesPage = await test.step('创建堂食无桌台订单并添加 OpenFood 自定义名称菜品', async () => {
        const page = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addOpenFoodItem(page, openFoodName, 10);
        return page;
      });

      await test.step('打开加收页并校验 OpenFood 自定义名称', async () => {
        await orderDishesPage.charge.clickCharge();
        await orderDishesPage.charge.switchChargeScope('item');
        await orderDishesPage.charge.expectChargeDishVisible(openFoodName);
      });

      await orderDishesPage.charge.closeChargeDialog();
    },
  );

test(
    '[POS-32934] 应能在分单页展示 Add Suborder 并新增子单',
    {
      annotation: [jiraIssueAnnotation('POS-32934')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const splitOrderPage = await test.step('创建堂食无桌台订单并进入分单页', async () => {
        const page = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return await page.navigation.openSplitOrder();
      });

      await test.step('校验新增子单入口文案并创建第二个子单', async () => {
        await splitOrderPage.expectAddSuborderLabel('Add Suborder');
        await splitOrderPage.clickAddSuborder();
        await splitOrderPage.expectSuborderIndexVisible(2);
      });
    },
  );

test(
    '[POS-32963] 应能在加收金额出现三位小数时按规则进位到分',
    {
      tag: ['@加收'],
      annotation: [jiraIssueAnnotation('POS-32963')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      annotateKnownProductFailure(
        '实测 100 元按 1.015% 加收显示 1.01，未按规则进位为 1.02，等待产品修复。',
      );

      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const chargeAmount = await test.step('创建改价订单并添加会产生 x.xx5 的百分比加收', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderDishesPage.menu.changeOrderedDishPrice(orderServiceDishes.regular.name, 100);
        await flows.orderDishesFlow.applyCustomCharge(orderDishesPage, {
          scope: 'whole',
          type: 'percentage',
          value: 1.015,
        });
        const snapshot = await flows.splitOrderScenarioFlow.readOrderDishesChargeSnapshot(orderDishesPage);
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
    async ({ flows, homePage, employeeLoginPage, apiSetup }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const restoreTaxIncludesCharge = await test.step(
        '开启税额计算包含加收配置并预置自动服务加收',
        async () => {
          await flows.splitOrderScenarioFlow.createChargeSetup(apiSetup, {
            ...manualFixedCharge,
            name: manualFixedChargeName,
            orderType: 'dine in',
            rate: 10,
            rateType: 2,
            triggerMode: 1,
            type: 'SERVICE',
          });
          return await flows.splitOrderScenarioFlow.configureTaxIncludesCharge(
            true,
            readyHomePage,
          );
        },
      );

      try {
        const orderResult = await test.step('创建订单并读取税额和加收金额', async () => {
          const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return await waitUntil(
            async () => await orderDishesPage.reads.readPriceSummary(),
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
        await test.step('恢复税额计算包含加收配置', async () => {
          await restoreTaxIncludesCharge();
        });
      }
    },
  );

test(
    '[POS-32903] 应能创建地址包含 & 符号的 Delivery 订单并送厨成功',
    {
      annotation: [jiraIssueAnnotation('POS-32903')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const recallPage = await test.step('创建地址包含 & 的 Delivery 订单并送厨', async () => {
        const orderDishesPage = await flows.takeoutFlow.startDeliveryOrder(
          readyHomePage,
          orderServiceCustomers.deliveryWithAmpersandAddress,
        );
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return await flows.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(orderDishesPage, employeeLoginPage);
      });

      const sentOrder = await test.step('打开最新 Delivery 订单并从详情送厨', async () => {
        const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
        await recallPage.orderDetails.openOrderDetails(orderNumber);
        const beforeSendDetails = await recallPage.orderDetails.readOrderDetailsSnapshot();
        let kitchenTicketStatus: number | null = null;

        if (beforeSendDetails.availableActions.send) {
          kitchenTicketStatus =
            await recallPage.orderDetails.clickSendInOrderDetailsAndReadKitchenTicketStatus();
        }

        await recallPage.orderDetails.closeOrderDetailsDialog();
        await recallPage.orderDetails.openOrderDetails(orderNumber);
        return {
          details: await recallPage.orderDetails.readOrderDetailsSnapshot(),
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
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      });

      const paidOrder = await test.step('创建 20 元堂食无桌台订单并分两次现金支付', async () => {
        const orderDishesPage = await flows.splitOrderScenarioFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        await orderDishesPage.menu.changeOrderedDishPrice(orderServiceDishes.regular.name, 20);

        const paymentPage = await orderDishesPage.navigation.openPayment();
        const paymentFlow = flows.paymentFlow;
        await paymentFlow.payPartialByCashKeepingPaymentOpen(paymentPage, {
          amountInCents: 500,
          printReceipt: false,
        });

        await paymentFlow.payPartialByCash(paymentPage, {
          amountInCents: 2000,
          printReceipt: false,
          successButtonText: 'NO RECEIPT',
        });

        const recallPage = await readyHomePage.clickRecall();
        await flows.recallFlow.clearSearchConditions(recallPage);
        const orderNumber = await flows.recallFlow.readLatestVisibleOrderNumber(recallPage);
        return { orderNumber, recallPage };
      });

      const details = await test.step('打开最新订单并读取支付状态', async () => {
        await paidOrder.recallPage.orderDetails.openOrderDetails(paidOrder.orderNumber);
        return await paidOrder.recallPage.orderDetails.readOrderDetailsSnapshot();
      });

      await test.step('校验第二次现金找零后订单支付状态成功', async () => {
        expect(details.paymentStatus).toBe('Success');
      });
    },
  );
});

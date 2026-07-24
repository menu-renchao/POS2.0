import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import {
  buildAnonymousPickupEditCustomer,
  buildOrderServiceCategoryPosNameCase,
  buildOrderServiceOrderChargeExcludedCategoryCase,
  buildOrderServiceMenuProductModeCase,
  buildOrderServiceRequiredCategoryCase,
  buildOrderServiceDineInCustomer,
  orderServiceCategoryOptions,
  orderServiceChineseInitialSearchCase,
  orderServiceComboOptionRemovalCase,
  orderServiceComboParentOptionCase,
  orderServiceComboSubItemPriceCase,
  orderServiceComboSubItemNotePermissionCase,
  orderServiceCustomDeliveryPrintCase,
  orderServiceCustomers,
  orderServiceDeliveryInformationCase,
  orderServiceDishes,
  orderServiceEditRecallTaxCase,
  orderServiceMenu,
  orderServiceModifyGlobalOptionCase,
  orderServiceOpenFoodChineseKeyboardCase,
  orderServiceSavedComboSubItemModifyCase,
  orderServiceSameNameAndNumberSearchCase,
  orderServiceSplitChildDiscountCase,
  orderServiceSplitTipsCase,
  orderServiceSearchMenuConfigurationCase,
} from '../../test-data/order-service';
import {
  RecallManualSearchTags,
  RecallPaymentStatuses,
  RecallOrderPaymentSuccessStatus,
} from '../../test-data/recall-search-options';
import { jiraIssueAnnotation, jiraIssueAnnotations } from '../../utils/jira';
import { waitUntil } from '../../utils/wait';

test.describe('点单选项与回显回归', { tag: ['@点单'] }, () => {
test.describe('Modify 全局选项数量调整', () => {
    test(
      '[POS-31662] 应能通过 Add 增加全局选项数量并保持 Modify 面板可见',
      {
        annotation: [jiraIssueAnnotation('POS-31662')],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const orderDishesPage = await test.step('进入 To Go 并添加普通菜', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await flows.orderDishesFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        await test.step('选择全局选项并通过 Add 增加数量', async () => {
          const result = await flows.orderDishesFlow.changeGlobalOptionQuantity(
            orderDishesPage,
            {
              dishName: orderServiceDishes.regular.name,
              operations: [{ type: 'add' }],
              optionName: orderServiceModifyGlobalOptionCase.optionName,
            },
          );

          expect(result.quantities).toEqual(
            orderServiceModifyGlobalOptionCase.addExpectedQuantities,
          );
          expect(result.modifyPanelVisible).toEqual(
            orderServiceModifyGlobalOptionCase.addExpectedQuantities.map(() => true),
          );
          await orderDishesPage.modifier.closeModifyPanel();
        });
      },
    );

    test(
      '[POS-31663] 应能通过 Count 设置全局选项数量并在归零后移除选项',
      {
        annotation: [
          jiraIssueAnnotation('POS-31663'),
          jiraIssueAnnotation('POS-50142'),
        ],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        test.info().annotations.push({
          type: '已知产品问题',
          description:
            'Count 弹窗已将全局选项数量显示为 0，但 Confirm 按钮仍为 disabled，无法按需求确认归零并移除选项。',
        });
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const orderDishesPage = await test.step('进入 To Go 并添加普通菜', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await flows.orderDishesFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        await test.step('通过 Count 将全局选项设为 5 后再归零', async () => {
          const result = await flows.orderDishesFlow.changeGlobalOptionQuantity(
            orderDishesPage,
            {
              dishName: orderServiceDishes.regular.name,
              operations: [
                { type: 'count', quantity: orderServiceModifyGlobalOptionCase.countQuantity },
                { type: 'count', quantity: 0 },
              ],
              optionName: orderServiceModifyGlobalOptionCase.optionName,
            },
          );

          expect(result.quantities).toEqual(
            orderServiceModifyGlobalOptionCase.countExpectedQuantities,
          );
          expect(result.modifyPanelVisible).toEqual(
            orderServiceModifyGlobalOptionCase.countExpectedQuantities.map(() => true),
          );
          await orderDishesPage.modifier.closeModifyPanel();
        });
      },
    );

    test(
      '[POS-31664] 应能通过 Reduce 将全局选项从 2 逐次减至移除',
      {
        annotation: [
          jiraIssueAnnotation('POS-31664'),
          jiraIssueAnnotation('POS-50141'),
        ],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const orderDishesPage = await test.step('进入 To Go 并添加普通菜', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await flows.orderDishesFlow.addRegularDish(
            page,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return page;
        });

        await test.step('将全局选项设为 2 并通过 Reduce 逐次减至移除', async () => {
          const result = await flows.orderDishesFlow.changeGlobalOptionQuantity(
            orderDishesPage,
            {
              dishName: orderServiceDishes.regular.name,
              operations: [
                {
                  type: 'count',
                  quantity: orderServiceModifyGlobalOptionCase.reduceStartQuantity,
                },
                { type: 'reduce' },
                { type: 'reduce' },
              ],
              optionName: orderServiceModifyGlobalOptionCase.optionName,
            },
          );

          expect(result.quantities).toEqual(
            orderServiceModifyGlobalOptionCase.reduceExpectedQuantities,
          );
          expect(result.modifyPanelVisible).toEqual(
            orderServiceModifyGlobalOptionCase.reduceExpectedQuantities.map(
              (quantity) => quantity > 0,
            ),
          );
          await orderDishesPage.modifier.closeModifyPanel();
        });
      },
    );
  });

test.describe('option 选择回显', () => {
    test(
      '[POS-15760] 应能只选择菜品一级选项并跳过二级选项后在 Recall 正确回显',
      {
        annotation: [jiraIssueAnnotation('POS-15760')],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        await test.step('选择普通菜1的菜品级一级选项并保留二级选项未选择', async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.menu.selectCategoryOption(orderServiceCategoryOptions.paidNested.name);
          await orderDishesPage.menu.expectItemOptionVisible(
            orderServiceCategoryOptions.paidNested.suboptionName,
          );
          await flows.orderOptionVerificationFlow.assertDishOptionsRoundTrip(
            orderDishesPage,
            orderServiceDishes.regular.name,
            [orderServiceCategoryOptions.paidNested.name],
            orderServiceCategoryOptions.paidNested.expectedDishPrice,
          );
        });
      },
    );

    test(
      '[POS-15762] 应能不选择菜品选项直接保存并在 Recall 保持无选项',
      {
        annotation: [jiraIssueAnnotation('POS-15762')],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        await test.step('添加普通菜1但不选择任何菜品选项并保存回查', async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.menu.expectItemOptionVisible(orderServiceCategoryOptions.freeNested.name);
          await flows.orderOptionVerificationFlow.assertDishOptionsRoundTrip(
            orderDishesPage,
            orderServiceDishes.regular.name,
            [],
            orderServiceDishes.regular.expectedBasePrice,
          );
        });
      },
    );

    test(
      '[POS-15761 POS-15763] 应能选择菜品一级和二级选项并在 Recall 正确回显',
      {
        annotation: jiraIssueAnnotations(['POS-15761', 'POS-15763']),
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        await test.step('选择普通菜1的 A 与 a1 两级选项并保存回查', async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
          await flows.orderDishesFlow.addRegularDish(
            orderDishesPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          await orderDishesPage.menu.selectCategoryOption(
            orderServiceCategoryOptions.paidNested.name,
            orderServiceCategoryOptions.paidNested.suboptionName,
          );
          await flows.orderOptionVerificationFlow.assertDishOptionsRoundTrip(
            orderDishesPage,
            orderServiceDishes.regular.name,
            [
              orderServiceCategoryOptions.paidNested.name,
              orderServiceCategoryOptions.paidNested.suboptionName,
            ],
            orderServiceCategoryOptions.paidNested.expectedDishPrice,
          );
        });
      },
    );

    test(
      '[POS-31045] 应能连续删除套餐子菜选项并在 Recall 保留剩余选项',
      {
        annotation: [jiraIssueAnnotation('POS-31045')],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        test.setTimeout(60_000);
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        const orderDishesPage = await test.step('创建无桌堂食并为套餐子菜选择四个选项', async () => {
          const orderPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
          await flows.orderDishesFlow.addComboDishWithItemOptions(orderPage, {
            comboName: orderServiceComboOptionRemovalCase.comboName,
            itemIndex: orderServiceComboOptionRemovalCase.itemIndex,
            menuSelection: orderServiceDishes.regular.menu,
            saleItemId: orderServiceComboOptionRemovalCase.saleItemId,
            sectionId: orderServiceComboOptionRemovalCase.sectionId,
            selections: [
              {
                option: orderServiceCategoryOptions.paidNested.name,
                suboption: orderServiceCategoryOptions.paidNested.suboptionName,
              },
              { option: orderServiceCategoryOptions.priced.name },
              { option: orderServiceCategoryOptions.freeNested.name },
            ],
          });
          return orderPage;
        });

        await test.step('连续删除 a1 和 A 并校验套餐剩余选项及价格', async () => {
          await flows.orderOptionVerificationFlow.expectOrderedDishDetails(
            orderDishesPage,
            orderServiceComboOptionRemovalCase.comboName,
            [
              orderServiceComboOptionRemovalCase.itemName,
              ...orderServiceComboOptionRemovalCase.initialOptions,
            ],
          );
          expect(
            await orderDishesPage.reads.readOrderedDishPrice(orderServiceComboOptionRemovalCase.comboName),
          ).toBeCloseTo(orderServiceComboOptionRemovalCase.initialPrice, 2);

          await orderDishesPage.menu.reduceSelectedComboOption(
            orderServiceComboOptionRemovalCase.comboName,
          );
          await flows.orderOptionVerificationFlow.expectOrderedDishDetails(
            orderDishesPage,
            orderServiceComboOptionRemovalCase.comboName,
            [
              orderServiceComboOptionRemovalCase.itemName,
              ...orderServiceComboOptionRemovalCase.firstRemovalOptions,
            ],
            [orderServiceCategoryOptions.paidNested.suboptionName],
          );

          await orderDishesPage.menu.reduceSelectedComboOption(
            orderServiceComboOptionRemovalCase.comboName,
          );
          await flows.orderOptionVerificationFlow.expectOrderedDishDetails(
            orderDishesPage,
            orderServiceComboOptionRemovalCase.comboName,
            [
              orderServiceComboOptionRemovalCase.itemName,
              ...orderServiceComboOptionRemovalCase.finalOptions,
            ],
            [
              orderServiceCategoryOptions.paidNested.name,
              orderServiceCategoryOptions.paidNested.suboptionName,
            ],
          );
          expect(
            await orderDishesPage.reads.readOrderedDishPrice(orderServiceComboOptionRemovalCase.comboName),
          ).toBeCloseTo(orderServiceComboOptionRemovalCase.finalPrice, 2);
        });

        await test.step('保存并按精确订单号在 Recall 校验套餐剩余选项', async () => {
          const savedOrder = await orderDishesPage.navigation.saveOrderWithReference();
          const recallPage = await flows.recallFlow.openRecallFromHome(savedOrder.homePage);
          await recallPage.orderDetails.openOrderDetails(savedOrder.orderNumber);
          await flows.orderOptionVerificationFlow.expectRecallDishDetails(
            recallPage,
            orderServiceComboOptionRemovalCase.comboName,
            [
              orderServiceComboOptionRemovalCase.itemName,
              ...orderServiceComboOptionRemovalCase.finalOptions,
            ],
            [
              orderServiceCategoryOptions.paidNested.name,
              orderServiceCategoryOptions.paidNested.suboptionName,
            ],
          );
          expect(
            await recallPage.orderDetails.readOrderItemPrice(orderServiceComboOptionRemovalCase.comboName),
          ).toBeCloseTo(orderServiceComboOptionRemovalCase.finalPrice, 2);
        });
      },
    );

    test(
      '[POS-24394] 应能在分类菜品上选择有价格 option 并正确计算总额',
      {
        tag: ['@加收'],
        annotation: [jiraIssueAnnotation('POS-24394')],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        await test.step('从 To Go 进入点单页，选择有价格 option 并校验总额变化', async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
          await orderDishesPage.menu.clickDish(orderServiceDishes.categoryOption.name);

          const subtotalBeforeOption = (await orderDishesPage.reads.readPriceSummary()).Subtotal;
          await orderDishesPage.menu.selectCategoryOption(orderServiceCategoryOptions.priced.name);

          const subtotalAfterOption = (await orderDishesPage.reads.readPriceSummary()).Subtotal;
          const orderedItems = await orderDishesPage.reads.readOrderedItems();
          const orderedItem = orderedItems.find(
            (item) => item.name === orderServiceDishes.categoryOption.name,
          );

          expect(
            subtotalAfterOption,
            '选择有价格 option 后 Subtotal 应增加',
          ).toBeGreaterThan(subtotalBeforeOption);
          expect(
            subtotalAfterOption - subtotalBeforeOption,
            '有价格 option 的金额增量应符合测试数据配置',
          ).toBeCloseTo(orderServiceCategoryOptions.priced.expectedSubtotalDelta, 2);
          expect(orderedItem?.additions.map((addition) => addition.name.trim()) ?? []).toEqual([
            orderServiceCategoryOptions.priced.name,
          ]);

          const orderDetails = await flows.orderRegressionFlow.saveOrderAndOpenLatestRecallDetails(orderDishesPage);
          const recallDish = orderDetails.items.find(
            (item) => item.name === orderServiceDishes.categoryOption.name,
          );

          expect(orderDetails.priceSummary.Subtotal).toBe(subtotalAfterOption);
          expect(recallDish?.additions.map((addition) => addition.name.trim()) ?? []).toEqual([
            orderServiceCategoryOptions.priced.name,
          ]);
        });
      },
    );

    test(
      '[POS-15759] 应能选择分类一级 option 并跳过二级 option 后在 Recall 正确回显',
      {
        annotation: [jiraIssueAnnotation('POS-15759')],
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        await test.step('选择分类一级 option 并保留二级 option 未选择', async () => {
          const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
          await flows.orderOptionVerificationFlow.assertCategoryOptionOrderRoundTrip(
            orderDishesPage,
            orderServiceDishes.categoryOption.name,
            orderServiceCategoryOptions.freeNested.name,
          );
        });
      },
    );

    test(
      '[POS-15643 POS-15758] 应能在分类菜品上选择 option 和二级 option 并在 Recall 正确回显',
      {
        annotation: jiraIssueAnnotations(['POS-15643', 'POS-15758']),
      },
      async ({ flows, homePage, employeeLoginPage }) => {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        });

        await test.step(
          `从 To Go 进入点单页，选择 ${orderServiceCategoryOptions.freeNested.name} 和 ${orderServiceCategoryOptions.freeNested.suboptionName} 并校验回显`,
          async () => {
            const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
            await flows.orderOptionVerificationFlow.assertCategoryOptionOrderRoundTrip(
              orderDishesPage,
              orderServiceDishes.categoryOption.name,
              orderServiceCategoryOptions.freeNested.name,
              orderServiceCategoryOptions.freeNested.suboptionName,
            );
          },
        );
      },
    );

  });
});

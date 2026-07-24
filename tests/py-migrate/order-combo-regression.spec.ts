import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';

import { orderServiceCategoryOptions, orderServiceComboParentOptionCase, orderServiceComboSubItemPriceCase, orderServiceComboSubItemNotePermissionCase, orderServiceDishes, orderServiceSavedComboSubItemModifyCase } from '../../test-data/order-service';

import { jiraIssueAnnotation, jiraIssueAnnotations } from '../../utils/jira';

test.describe('套餐子菜编辑与权限回归', { tag: ['@点单', '@ui-exclusive-config'] }, () => {

  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-42061] 套餐子菜应支持独立改价并更新套餐总价',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-42061')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      test.setTimeout(60_000);
      const priceCase = orderServiceComboSubItemPriceCase;
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);

      await test.step('添加包含目标子菜的套餐', async () => {
        await flows.orderDishesFlow.addComboDishWithItemOptions(orderDishesPage, {
          comboName: priceCase.comboName,
          itemIndex: priceCase.itemIndex,
          menuSelection: orderServiceDishes.regular.menu,
          saleItemId: priceCase.saleItemId,
          sectionId: priceCase.sectionId,
          selections: [{ option: orderServiceCategoryOptions.priced.name }],
        });
      });

      await test.step('选中套餐子菜并改价后校验子菜与套餐总价', async () => {
        const beforeComboPrice = await orderDishesPage.reads.readOrderedDishPrice(priceCase.comboName);
        expect(
          await orderDishesPage.reads.readComboSubItemPrice(
            priceCase.comboName,
            priceCase.saleItemId,
          ),
        ).toBeCloseTo(priceCase.initialSubItemPrice, 2);

        await orderDishesPage.menu.changeComboSubItemPrice(
          priceCase.comboName,
          priceCase.saleItemId,
          priceCase.changedPrice,
        );

        expect(
          await orderDishesPage.reads.readComboSubItemPrice(
            priceCase.comboName,
            priceCase.saleItemId,
          ),
        ).toBeCloseTo(priceCase.changedPrice, 2);
        expect(await orderDishesPage.reads.readOrderedDishPrice(priceCase.comboName)).toBeCloseTo(
          beforeComboPrice - priceCase.initialSubItemPrice + priceCase.changedPrice,
          2,
        );
      });

      await orderDishesPage.navigation.saveOrderWithReference();
    },
  );

  test(
    '[POS-37804] 无 Note 权限员工为套餐子菜添加备注时应要求授权',
    {
      tag: ['@点单', '@套餐', '@调味'],
      annotation: jiraIssueAnnotations(['POS-37804', 'POS-36081']),
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const noteCase = orderServiceComboSubItemNotePermissionCase;
      const restrictedEmployee = await test.step('创建不含 Note 权限的一次性员工', async () => {
        return await apiSetup.staff.createWithoutNotePermission();
      });
      const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
        restrictedEmployee.passcode,
      );
      const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);

      await test.step('添加包含目标子菜的套餐', async () => {
        await flows.orderDishesFlow.addComboDishWithItemOptions(orderDishesPage, {
          comboName: noteCase.comboName,
          itemIndex: noteCase.itemIndex,
          menuSelection: orderServiceDishes.regular.menu,
          saleItemId: noteCase.saleItemId,
          sectionId: noteCase.sectionId,
          selections: [{ option: noteCase.optionName }],
        });
      });

      await test.step('选中套餐子菜并校验权限提示后使用主管口令授权添加 Note', async () => {
        await flows.orderPermissionFlow.addNoteToComboSubItemWithAuthorization(
          orderDishesPage,
          noteCase.comboName,
          noteCase.saleItemId,
          noteCase.authorizationPasscode,
          noteCase.note,
        );
      });

      const savedOrder = await test.step('保存并确认 Note 写入套餐子菜层级', async () => {
        const result = await orderDishesPage.navigation.saveOrderWithReference();
        const comboItem = result.orderItems.find(
          (item) => String(item.saleItemId) === String(noteCase.comboSaleItemId),
        );
        const comboSubItem = comboItem?.comboSubItems.find(
          (item) => String(item.saleItemId) === String(noteCase.saleItemId),
        );
        const noteOptions =
          comboSubItem?.options.filter((option) => option.type === 'NOTE') ?? [];

        expect(comboItem, '保存请求应包含套餐主菜').toBeTruthy();
        expect(comboItem?.displayText, '套餐主菜自身不应写入子菜 Note').toBe('');
        expect(noteOptions).toEqual([{ name: noteCase.note, type: 'NOTE' }]);
        return result;
      });

      await test.step('Recall 精确回查套餐并确认备注已持久化', async () => {
        const recallFlow = flows.recallFlow;
        const recallPage = await recallFlow.openRecallFromHome(savedOrder.homePage);
        const details = await recallFlow.viewOrderDetails(recallPage, savedOrder.orderNumber);
        const comboItem = details.items.find((item) => item.name === noteCase.comboName);

        expect(comboItem, 'Recall 应展示目标套餐').toBeTruthy();
        expect(comboItem?.additions.map((addition) => addition.name)).toContain(noteCase.note);
      });
    },
  );

  test(
    '[POS-43823] 选择无 option 套餐子菜后应返回主菜并可选择 option',
    {
      tag: ['@点单', '@调味', '@套餐'],
      annotation: [jiraIssueAnnotation('POS-43823')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      test.setTimeout(60_000);
      const comboCase = orderServiceComboParentOptionCase;
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);

      await test.step('选择无 option 套餐子菜并返回主菜 option 面板', async () => {
        await orderDishesPage.menu.clickDish(comboCase.comboName);
        await orderDishesPage.menu.selectComboItem(
          comboCase.comboSubItem.sectionId,
          comboCase.comboSubItem.saleItemId,
          comboCase.comboSubItem.itemIndex,
        );
        await orderDishesPage.menu.expectItemOptionVisible(comboCase.parentOption);
        await orderDishesPage.menu.selectCategoryOption(comboCase.parentOption);
        await orderDishesPage.menu.confirmComboDialog();
      });

      await test.step('添加带自身 option 的普通菜作为归属对照', async () => {
        await orderDishesPage.menu.clickDish(comboCase.ordinaryDish.name);
        await orderDishesPage.menu.selectCategoryOption(
          comboCase.ordinaryOption.name,
          comboCase.ordinaryOption.suboptionName,
        );
      });

      await test.step('校验套餐主菜 option 与普通菜 option 互不混淆并保存', async () => {
        const orderedItems = await orderDishesPage.reads.readOrderedItems();
        const comboItem = orderedItems.find((item) => item.name === comboCase.comboName);
        const ordinaryItem = orderedItems.find(
          (item) => item.name === comboCase.ordinaryDish.name,
        );
        const comboAdditionNames = comboItem?.additions.map((addition) => addition.name) ?? [];
        const ordinaryAdditionNames =
          ordinaryItem?.additions.map((addition) => addition.name) ?? [];
        const comboSubItem = comboItem?.additions.find(
          (addition) => addition.name === comboCase.comboSubItem.name,
        );

        expect(comboItem, '订单应包含目标套餐').toBeTruthy();
        expect(comboAdditionNames).toEqual([
          comboCase.comboSubItem.name,
          comboCase.parentOption,
        ]);
        expect(comboSubItem?.subAdditions ?? []).toEqual([]);
        expect(ordinaryItem, '订单应包含普通菜对照项').toBeTruthy();
        expect(ordinaryAdditionNames).toEqual([
          comboCase.ordinaryOption.name,
          comboCase.ordinaryOption.suboptionName,
        ]);
        expect(ordinaryAdditionNames).not.toContain(comboCase.parentOption);

        await orderDishesPage.navigation.saveOrderWithReference();
      });
    },
  );

  test(
    '[POS-43956] 已保存套餐应能编辑子菜并保留 display-all 与 max 选择结果',
    {
      tag: ['@点单', '@套餐', '@调味'],
      annotation: [jiraIssueAnnotation('POS-43956')],
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      test.setTimeout(90_000);
      const comboCase = orderServiceSavedComboSubItemModifyCase;
      const readyHomePage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
      const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);

      const savedOrder = await test.step('一次展示全部候选子菜并按 max 规则保存套餐', async () => {
        await orderDishesPage.menu.clickDish(comboCase.comboName);
        for (const item of comboCase.displayAllItems) {
          await orderDishesPage.menu.expectComboItemVisible(
            comboCase.sectionId,
            item.saleItemId,
            item.itemIndex,
          );
        }
        await orderDishesPage.menu.selectComboItem(
          comboCase.sectionId,
          comboCase.targetSaleItemId,
          comboCase.targetItemIndex,
        );
        await orderDishesPage.menu.expectItemOptionVisible(comboCase.parentOption);
        await orderDishesPage.menu.selectCategoryOption(comboCase.parentOption);
        await orderDishesPage.menu.confirmComboDialog();

        const comboItem = (await orderDishesPage.reads.readOrderedItems()).find(
          (item) => item.name === comboCase.comboName,
        );
        expect(
          comboItem?.additions.filter(
            (addition) => addition.name === comboCase.targetSubItemName,
          ),
        ).toHaveLength(1);
        return await orderDishesPage.navigation.saveOrderWithReference();
      });

      const updatedOrder = await test.step('从 Recall 编辑已保存订单并修改套餐子菜', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(savedOrder.homePage);
        const editingPage = await flows.recallFlow.editOrder(
          recallPage,
          savedOrder.orderNumber,
        );
        await editingPage.menu.selectComboSubItem(
          comboCase.comboName,
          comboCase.targetSaleItemId,
        );
        await editingPage.modifier.openModifyForSelectedItem();
        await editingPage.modifier.selectModifyOption(comboCase.modifierName);
        await editingPage.modifier.closeModifyPanel();

        const editedComboItem = (await editingPage.reads.readOrderedItems()).find(
          (item) => item.name === comboCase.comboName,
        );
        expect(
          editedComboItem?.additions.some((addition) =>
            addition.name.includes(comboCase.modifierName),
          ),
        ).toBe(true);
        return await editingPage.navigation.saveOrderWithReference();
      });

      await test.step('再次 Recall 校验子菜、主菜 option 与调味均已保存', async () => {
        const recallPage = await flows.recallFlow.openRecallFromHome(updatedOrder.homePage);
        const details = await flows.recallFlow.viewOrderDetails(
          recallPage,
          updatedOrder.orderNumber,
        );
        const comboItem = details.items.find((item) => item.name === comboCase.comboName);
        const additionNames = comboItem?.additions.map((addition) => addition.name) ?? [];

        expect(comboItem, 'Recall 应展示目标套餐').toBeTruthy();
        expect(
          additionNames.filter((name) => name === comboCase.targetSubItemName),
        ).toHaveLength(1);
        expect(additionNames).toContain(comboCase.parentOption);
        expect(additionNames).toContain(comboCase.modifierName);
      });
    },
  );
});

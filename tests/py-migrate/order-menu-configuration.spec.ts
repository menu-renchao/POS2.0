import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import type { HomePage } from '../../pages/home.page';
import type { OrderDishesPage } from '../../pages/order-dishes.page';
import { buildOrderServiceCategoryPosNameCase, buildOrderServiceOrderChargeExcludedCategoryCase, buildOrderServiceMenuProductModeCase, buildOrderServiceRequiredCategoryCase, orderServiceChineseInitialSearchCase, orderServiceDishes, orderServiceMenu, orderServiceOpenFoodChineseKeyboardCase, orderServiceSameNameAndNumberSearchCase, orderServiceSearchMenuConfigurationCase } from '../../test-data/order-service';

import { jiraIssueAnnotation, jiraIssueAnnotations } from '../../utils/jira';

test.describe('菜单配置、搜索与开放菜品回归', { tag: ['@点单', '@ui-exclusive-config'] }, () => {

  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-15605 POS-15737] 切换中文后应展示中文菜单组和类别',
    {
      tag: ['@点单'],
      annotation: jiraIssueAnnotations(['POS-15605', 'POS-15737']),
    },
    async ({ flows, homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并切换为中文', async () => {
        const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        await readyPage.switchLanguage('zh-cn');
        expect(await readyPage.readCurrentLanguage()).toBe('zh-cn');
        return readyPage;
      });

      let orderDishesPage: OrderDishesPage | undefined;

      try {
        orderDishesPage = await test.step('进入 To Go 点单页读取当前菜单组和类别', async () => {
          return await flows.takeoutFlow.startToGoOrder(readyHomePage, employeeLoginPage);
        });

        await test.step('确认菜单组和类别均展示配置的中文名称', async () => {
          expect(await orderDishesPage?.menu.readSelectedMenuGroupName()).toBe(
            orderServiceMenu.group,
          );
          expect(await orderDishesPage?.menu.readSelectedMenuCategoryName()).toBe(
            orderServiceMenu.category,
          );
        });
      } finally {
        const returnedHomePage = orderDishesPage
          ? await orderDishesPage.navigation.exitOrderPageWithoutConfirmation()
          : readyHomePage;
        await returnedHomePage.switchLanguage('en');
        expect(await returnedHomePage.readCurrentLanguage()).toBe('en');
      }
    },
  );

  test(
    '[POS-43827] 中文界面按菜品拼音首字母搜索应返回对应菜品',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-43827')],
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(150_000);
      const restoreSearchMenuConfiguration =
        await apiSetup.systemConfiguration.updateByName(
          orderServiceSearchMenuConfigurationCase.configurationName,
          orderServiceSearchMenuConfigurationCase.visibleValue,
          { verify: true },
        );

      try {
        const readyHomePage = await test.step('刷新 POS 并将界面切换为中文', async () => {
          const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
          await readyPage.clickRefresh();
          await readyPage.confirmDelayedConfigurationRefresh();
          await readyPage.switchLanguage('zh-cn');
          expect(await readyPage.readCurrentLanguage()).toBe('zh-cn');
          return readyPage;
        });

        const orderDishesPage = await test.step('进入 To Go 并按 ptc 搜索普通菜1', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await page.menu.openChineseSearchMenuAndFill(orderServiceChineseInitialSearchCase.query);
          await page.menu.expectSearchMenuResult(
            orderServiceChineseInitialSearchCase.resultTestId,
            orderServiceChineseInitialSearchCase.resultName,
          );
          await page.menu.clickSearchMenuResult(orderServiceChineseInitialSearchCase.resultTestId);
          return page;
        });

        const savedOrder = await test.step('确认目标菜进入订单并保存', async () => {
          const orderedItems = await orderDishesPage.reads.readOrderedItems();
          expect(orderedItems.map((item) => item.name)).toContain(
            orderServiceChineseInitialSearchCase.resultName,
          );
          return await orderDishesPage.navigation.saveOrderWithReference();
        });

        await test.step('恢复英文界面', async () => {
          await savedOrder.homePage.switchLanguage('en');
          expect(await savedOrder.homePage.readCurrentLanguage()).toBe('en');
        });
      } finally {
        await restoreSearchMenuConfiguration();
      }
    },
  );

  test(
    '[POS-42097] 点单页面类别应展示配置的 POS NAME',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-42097')],
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      const categoryCase = buildOrderServiceCategoryPosNameCase();

      await test.step('创建后台名称与 POS NAME 不同的临时类别和菜品', async () => {
        const createdCategory = await apiSetup.category.create({
          displayName: categoryCase.backendName,
          menuGroupId: categoryCase.menuGroupId,
          menuId: categoryCase.menuId,
          name: categoryCase.backendName,
          posName: categoryCase.posName,
        });
        await apiSetup.saleItem.create({
          categoryId: createdCategory.id,
          displayName: categoryCase.dishName,
          menuGroupId: categoryCase.menuGroupId,
          menuId: categoryCase.menuId,
          name: categoryCase.dishName,
          posName: categoryCase.dishName,
          price: categoryCase.price,
        });
      });

      const readyHomePage = await test.step('进入 POS 主页并刷新菜单数据', async () => {
        const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        await readyPage.clickRefresh();
        await readyPage.confirmDelayedConfigurationRefresh();
        return readyPage;
      });

      const orderDishesPage = await test.step('进入 To Go 并切换到目标菜单组', async () => {
        const page = await flows.takeoutFlow.startToGoOrder(readyHomePage, employeeLoginPage);
        await page.menu.switchMenuGroup(categoryCase.menuGroupName);
        return page;
      });

      await test.step('确认类别卡展示 POS NAME 而不是后台名称', async () => {
        const categoryNames = await orderDishesPage.menu.readMenuCategoryNames();
        expect(categoryNames).toContain(categoryCase.posName);
        expect(categoryNames).not.toContain(categoryCase.backendName);

        await orderDishesPage.menu.switchMenuCategory(categoryCase.posName);
        expect(await orderDishesPage.menu.readSelectedMenuCategoryName()).toBe(categoryCase.posName);
      });

      await test.step('确认选择 POS NAME 类别后显示关联菜品', async () => {
        const dishNames = await orderDishesPage.menu.readCurrentCategoryDishNames();
        expect(dishNames.length).toBeGreaterThan(0);
      });
    },
  );

  test(
    '[POS-42060] 未满足必选类别时应阻止保存并自动跳转到该类别',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-42060')],
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      const requiredCase = buildOrderServiceRequiredCategoryCase();

      await test.step('创建必选类别及其关联菜品', async () => {
        const category = await apiSetup.category.create({
          displayName: requiredCase.backendName,
          menuGroupId: requiredCase.menuGroupId,
          menuId: requiredCase.menuId,
          name: requiredCase.backendName,
          posName: requiredCase.posName,
          requireCategory: true,
        });
        await apiSetup.saleItem.create({
          categoryId: category.id,
          displayName: requiredCase.dishName,
          menuGroupId: requiredCase.menuGroupId,
          menuId: requiredCase.menuId,
          name: requiredCase.dishName,
          posName: requiredCase.dishName,
          price: requiredCase.price,
        });
      });

      const readyHomePage = await test.step('进入 POS 主页并刷新菜单数据', async () => {
        const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        await readyPage.clickRefresh();
        await readyPage.confirmDelayedConfigurationRefresh();
        return readyPage;
      });

      const orderDishesPage = await test.step('进入 To Go 并只添加普通类别菜品', async () => {
        const page = await flows.takeoutFlow.startToGoOrder(readyHomePage, employeeLoginPage);
        await flows.orderDishesFlow.addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return page;
      });

      await test.step('确认保存被阻止且自动跳转到未满足的必选类别', async () => {
        await orderDishesPage.navigation.clickSaveOrder();
        await orderDishesPage.expectLoaded();
        expect(await orderDishesPage.menu.readSelectedMenuCategoryName()).toBe(requiredCase.posName);
      });

      await test.step('添加必选类别菜品后应能正常保存', async () => {
        await orderDishesPage.menu.clickFirstCurrentCategoryDish();
        await orderDishesPage.navigation.saveOrderWithReference();
      });
    },
  );

  test(
    '[POS-42958] 未启用整单折扣适用性的类别菜品不应参与整单比例加收',
    {
      tag: ['@点单', '@加收'],
      annotation: [jiraIssueAnnotation('POS-42958')],
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      test.info().annotations.push({
        type: '已知产品问题',
        description:
          '10% 整单加收预期仅按普通菜 $8.80 计算为 $0.88，实际为 $1.88，未启用整单折扣适用性的 $10 类别菜仍被计入加收基数。',
      });
      const chargeCase = buildOrderServiceOrderChargeExcludedCategoryCase();

      await test.step('创建不参与整单折扣的类别及两道菜品', async () => {
        const category = await apiSetup.category.create({
          applicableToOrderDiscount: false,
          discountAllowed: true,
          displayName: chargeCase.backendName,
          menuGroupId: chargeCase.menuGroupId,
          menuId: chargeCase.menuId,
          name: chargeCase.backendName,
          posName: chargeCase.posName,
        });
        const categoryData = (await apiSetup.category.read(category.id)) as {
          menuCategory?: { applicableToOrderDiscount?: boolean };
        };
        expect(categoryData.menuCategory?.applicableToOrderDiscount).toBe(false);

        for (let index = 0; index < chargeCase.dishNames.length; index += 1) {
          await apiSetup.saleItem.create({
            categoryId: category.id,
            displayName: chargeCase.dishNames[index],
            menuGroupId: chargeCase.menuGroupId,
            menuId: chargeCase.menuId,
            name: chargeCase.dishNames[index],
            posName: chargeCase.dishNames[index],
            price: chargeCase.dishPrices[index],
          });
        }
      });

      const readyHomePage = await test.step('进入 POS 主页并刷新菜单数据', async () => {
        const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
        await readyPage.clickRefresh();
        await readyPage.confirmDelayedConfigurationRefresh();
        return readyPage;
      });

      const orderDishesPage = await test.step('添加目标类别全部菜品及参与加收的对照菜', async () => {
        const page = await flows.takeoutFlow.startToGoOrder(readyHomePage, employeeLoginPage);
        await page.menu.switchMenu(chargeCase.menuGroupName, chargeCase.posName);

        for (const dishName of chargeCase.dishNames) {
          await page.menu.clickCurrentCategoryDish(dishName);
        }

        await flows.orderDishesFlow.addRegularDish(
          page,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        return page;
      });

      await test.step('确认目标类别的两道菜均未进入整单比例加收基数', async () => {
        const beforeSummary = await orderDishesPage.reads.readPriceSummary();
        expect(beforeSummary.Subtotal).toBeCloseTo(
          chargeCase.dishPrices.reduce((sum, price) => sum + price, 0) +
            orderServiceDishes.regular.expectedBasePrice,
          2,
        );

        await flows.orderDishesFlow.applyCustomCharge(orderDishesPage, {
          scope: 'whole',
          type: 'percentage',
          value: chargeCase.percentageCharge,
        });

        const afterSummary = await orderDishesPage.reads.readPriceSummary();
        const expectedCharge =
          orderServiceDishes.regular.expectedBasePrice * chargeCase.percentageCharge / 100;
        expect(afterSummary.Charge).toBeCloseTo(expectedCharge, 2);
        expect(afterSummary.Subtotal).toBeCloseTo(beforeSummary.Subtotal + expectedCharge, 2);
      });

      await orderDishesPage.navigation.saveOrderWithReference();
    },
  );

  test(
    '[POS-30762] 切换 POS 与 EMENU 菜单模式后应能搜索对应菜单菜品',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-30762')],
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(150_000);
      const modeCase = buildOrderServiceMenuProductModeCase();
      const originalConfigurationIndex = await apiSetup.systemConfiguration.listIndex();
      const originalMode = originalConfigurationIndex.get(modeCase.configurationName)?.value;
      const originalSearchMenu = originalConfigurationIndex.get(
        orderServiceSearchMenuConfigurationCase.configurationName,
      )?.value;

      if (originalMode === undefined || originalSearchMenu === undefined) {
        throw new Error('未能读取菜单模式或搜索菜单配置原值。');
      }

      await apiSetup.systemConfiguration.updateManyByName(
        {
          [modeCase.configurationName]: modeCase.posMode,
          [orderServiceSearchMenuConfigurationCase.configurationName]: true,
        },
        { verify: true },
      );
      let returnedHomePage: HomePage | undefined;
      let finalOrderDishesPage: OrderDishesPage | undefined;

      try {
        await test.step('分别创建 POS 与 EMENU 模式的目标搜索菜品', async () => {
          await apiSetup.saleItem.create({
            categoryId: modeCase.posCategoryId,
            displayName: modeCase.posDishName,
            menuGroupId: modeCase.posMenuGroupId,
            menuId: modeCase.posMenuId,
            name: modeCase.posDishName,
            posName: modeCase.posDishName,
            price: modeCase.price,
          });

          const emenuGroup = await apiSetup.menuGroup.create({
            menuId: modeCase.emenuMenuId,
            name: modeCase.emenuGroupName,
          });
          const emenuCategory = await apiSetup.category.create({
            displayName: modeCase.emenuCategoryName,
            menuGroupId: emenuGroup.id,
            menuId: modeCase.emenuMenuId,
            name: modeCase.emenuCategoryName,
            posName: modeCase.emenuCategoryName,
          });
          await apiSetup.saleItem.create({
            categoryId: emenuCategory.id,
            displayName: modeCase.emenuDishName,
            menuGroupId: emenuGroup.id,
            menuId: modeCase.emenuMenuId,
            name: modeCase.emenuDishName,
            posName: modeCase.emenuDishName,
            price: modeCase.price,
          });
        });

        const readyHomePage = await test.step('以 POS 菜单模式刷新主页', async () => {
          const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
          await readyPage.clickRefresh();
          await readyPage.confirmDelayedConfigurationRefresh();
          return readyPage;
        });

        returnedHomePage = await test.step('POS 模式应能搜索 Broccoli Garlic Sauce', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await page.menu.openSearchMenuAndFill(modeCase.posSearchQuery);
          await page.menu.expectSearchMenuResultByName(modeCase.posDishName);
          return await page.navigation.exitOrderPageWithoutConfirmation();
        });

        await apiSetup.systemConfiguration.updateByName(
          modeCase.configurationName,
          modeCase.emenuMode,
          { verify: true },
        );
        await returnedHomePage.clickRefresh();
        await returnedHomePage.confirmDelayedConfigurationRefresh();

        finalOrderDishesPage = await test.step('EMENU 模式应能搜索 All you can eat item', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(
            returnedHomePage!,
            employeeLoginPage,
          );
          await page.menu.openSearchMenuAndFill(modeCase.emenuSearchQuery);
          await page.menu.expectSearchMenuResultByName(modeCase.emenuDishName);
          return page;
        });
      } finally {
        await apiSetup.systemConfiguration.updateManyByName(
          {
            [modeCase.configurationName]: String(originalMode),
            [orderServiceSearchMenuConfigurationCase.configurationName]: String(originalSearchMenu),
          },
          { verify: true },
        );

        if (finalOrderDishesPage) {
          await finalOrderDishesPage.navigation.confirmConfigurationRefresh();
        }
      }
    },
  );

  test(
    '[ORDER-PAGE-015] Open Food 屏幕键盘应能切换中文并输入候选字',
    { tag: ['@点单'] },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      const keyboardCase = orderServiceOpenFoodChineseKeyboardCase;
      const restoreKeyboardConfiguration =
        await apiSetup.systemConfiguration.updateByName(
          keyboardCase.configurationName,
          keyboardCase.configurationValue,
          { verify: true },
        );
      let returnedHomePage: HomePage | undefined;

      try {
        const readyHomePage = await test.step('刷新 POS 使屏幕键盘配置生效', async () => {
          const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
          await readyPage.clickRefresh();
          await readyPage.confirmDelayedConfigurationRefresh();
          return readyPage;
        });
        const orderDishesPage = await flows.takeoutFlow.startToGoOrder(
          readyHomePage,
          employeeLoginPage,
        );

        await test.step('切换 Open Food 屏幕键盘为中文并输入候选字', async () => {
          await orderDishesPage.menu.openOpenFoodDialog();
          expect(await orderDishesPage.menu.readOpenFoodKeyboardLanguage()).toBe(
            keyboardCase.initialLanguage,
          );
          await orderDishesPage.menu.switchOpenFoodKeyboardLanguage();
          expect(await orderDishesPage.menu.readOpenFoodKeyboardLanguage()).toBe(
            keyboardCase.switchedLanguage,
          );
          await orderDishesPage.menu.pressOpenFoodKeyboardLetters(keyboardCase.pinyinKeys);
          await orderDishesPage.menu.selectOpenFoodKeyboardCandidate(keyboardCase.name);
          expect(await orderDishesPage.menu.readOpenFoodName()).toBe(keyboardCase.name);
          await orderDishesPage.menu.fillOpenFoodPriceAndConfirm(keyboardCase.price);
        });

        await test.step('确认中文名称进入订单行并保存', async () => {
          const orderedItems = await orderDishesPage.reads.readOrderedItems();
          expect(orderedItems.map((item) => item.name)).toContain(keyboardCase.name);
          const savedOrder = await orderDishesPage.navigation.saveOrderWithReference();
          returnedHomePage = savedOrder.homePage;
        });
      } finally {
        await restoreKeyboardConfiguration();

        if (returnedHomePage) {
          await returnedHomePage.clickRefresh();
          await returnedHomePage.confirmDelayedConfigurationRefresh();
        }
      }
    },
  );

  test(
    '[POS-36255] 菜品名称与编号相同时搜索结果应只展示一次',
    {
      tag: ['@点单'],
      annotation: [jiraIssueAnnotation('POS-36255')],
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      test.setTimeout(120_000);
      test.info().annotations.push({
        type: '已知产品问题',
        description: '同一菜品的名称与编号同时命中 AA 时，搜索结果实际重复显示 2 条，需求预期为 1 条。',
      });
      const searchCase = orderServiceSameNameAndNumberSearchCase;
      const restoreSearchMenuConfiguration =
        await apiSetup.systemConfiguration.updateByName(
          orderServiceSearchMenuConfigurationCase.configurationName,
          orderServiceSearchMenuConfigurationCase.visibleValue,
          { verify: true },
        );

      try {
        await test.step('创建名称和编号均为 AA 的临时菜品', async () => {
          await apiSetup.saleItem.create({
            categoryId: searchCase.categoryId,
            itemNumber: searchCase.itemNumber,
            menuGroupId: searchCase.menuGroupId,
            menuId: searchCase.menuId,
            name: searchCase.name,
            posName: searchCase.name,
            price: searchCase.price,
          });
        });

        const readyHomePage = await test.step('进入 POS 主页并刷新菜单数据', async () => {
          const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
          await readyPage.clickRefresh();
          await readyPage.confirmDelayedConfigurationRefresh();
          return readyPage;
        });

        const orderDishesPage = await test.step('进入 To Go 并搜索 AA', async () => {
          const page = await flows.takeoutFlow.startToGoOrder(
            readyHomePage,
            employeeLoginPage,
          );
          await page.menu.openSearchMenuAndFill(searchCase.name);
          return page;
        });

        await test.step('确认同一菜品不会因名称和编号同时命中而重复展示', async () => {
          const resultCount = await orderDishesPage.menu.readSearchMenuResultCountByNameAndNumber(
            searchCase.name,
            searchCase.itemNumber,
          );

          expect(resultCount).toBe(1);
        });
      } finally {
        await restoreSearchMenuConfiguration();
      }
    },
  );



  test(
    '[POS-33447 POS-33456] 应能按配置控制新订单与 Recall 编辑页的菜单搜索入口',
    {
      annotation: jiraIssueAnnotations(['POS-33447', 'POS-33456']),
    },
    async ({ flows, apiSetup, homePage, employeeLoginPage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        orderServiceSearchMenuConfigurationCase.configurationName,
        orderServiceSearchMenuConfigurationCase.visibleValue,
        { verify: true },
      );

      try {
        const readyHomePage = await test.step('设置搜索入口可见并刷新 POS', async () => {
          const readyPage = await flows.orderRegressionFlow.enterReadyHome(homePage, employeeLoginPage);
          await readyPage.clickRefresh();
          return readyPage;
        });

        const savedOrder = await test.step('在新订单搜索并保存精确订单号', async () => {
          const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
          await orderDishesPage.menu.expectSearchMenuVisible(true);
          await orderDishesPage.menu.openSearchMenuAndFill(
            orderServiceSearchMenuConfigurationCase.query,
          );
          await orderDishesPage.menu.expectSearchMenuResult(
            orderServiceSearchMenuConfigurationCase.resultTestId,
            orderServiceSearchMenuConfigurationCase.resultName,
          );
          await orderDishesPage.menu.clickSearchMenuResult(
            orderServiceSearchMenuConfigurationCase.resultTestId,
          );
          return await orderDishesPage.navigation.saveOrderWithReference();
        });

        await test.step('切换为隐藏配置并确认新订单不展示搜索入口', async () => {
          await apiSetup.systemConfiguration.updateByName(
            orderServiceSearchMenuConfigurationCase.configurationName,
            orderServiceSearchMenuConfigurationCase.hiddenValue,
            { verify: true },
          );
          await savedOrder.homePage.clickRefresh();
          const hiddenSearchPage = await flows.selectTableFlow.enterDineInNoTableOrder(
            savedOrder.homePage,
          );
          await hiddenSearchPage.menu.expectSearchMenuVisible(false);
          await hiddenSearchPage.navigation.exitOrderPage();
          await savedOrder.homePage.expectPrimaryFunctionCardsVisible();
        });

        await test.step('恢复可见配置并从 Recall 编辑页完成搜索', async () => {
          await apiSetup.systemConfiguration.updateByName(
            orderServiceSearchMenuConfigurationCase.configurationName,
            orderServiceSearchMenuConfigurationCase.visibleValue,
            { verify: true },
          );
          await savedOrder.homePage.clickRefresh();
          const recallPage = await flows.recallFlow.openRecallFromHome(savedOrder.homePage);
          const editingPage = await flows.recallFlow.editOrder(
            recallPage,
            savedOrder.orderNumber,
          );
          await editingPage.menu.expectSearchMenuVisible(true);
          await editingPage.menu.openSearchMenuAndFill(orderServiceSearchMenuConfigurationCase.query);
          await editingPage.menu.expectSearchMenuResult(
            orderServiceSearchMenuConfigurationCase.resultTestId,
            orderServiceSearchMenuConfigurationCase.resultName,
          );
          await editingPage.menu.clickSearchMenuResult(
            orderServiceSearchMenuConfigurationCase.resultTestId,
          );
          await editingPage.navigation.exitOrderPage();
        });
      } finally {
        await restoreConfiguration();
      }
    },
  );
});

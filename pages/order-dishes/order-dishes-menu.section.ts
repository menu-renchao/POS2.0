import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';

export class OrderDishesMenuSection {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
  ) {}

  private get page() {
    return this.ctx.page;
  }

  private get locators(): OrderDishesLocators {
    return this.ctx.locators;
  }

    @step((tableNumber: string) => `页面操作：确认点餐页顶部桌号为 ${tableNumber}`)
    async expectTableNumber(tableNumber: string): Promise<void> {
      await expect(this.resolveTableNumberButton(tableNumber)).toBeVisible();
    }

    @step((tableNumber: string) => `页面操作：从点餐页桌号 ${tableNumber} 进入换桌页面`)
    async openChangeTable(tableNumber: string): Promise<void> {
      await this.host.expectLoaded();
      await this.resolveTableNumberButton(tableNumber).click();
      await expect(this.changeTablePrompt()).toBeVisible();
      await expect(this.changeTableConfirmButton()).toBeDisabled();
    }

    @step('页面读取：读取换桌页面中的可选目标桌号')
    async readAvailableChangeTableNumbers(): Promise<string[]> {
      await expect(this.changeTablePrompt()).toBeVisible();
      const targetCount = await waitUntil(
        async () => await this.changeTableTargetButtons().count(),
        (count) => count > 0,
        {
          timeout: 5_000,
          message: '换桌页面未加载出可选目标桌台。',
        },
      );
      const targetButtons = this.changeTableTargetButtons();
      const tableNumbers: string[] = [];

      for (let index = 0; index < targetCount; index += 1) {
        const text = (await targetButtons.nth(index).innerText()).trim();
        const tableNumber = text.match(/^\d+/)?.[0];
        if (tableNumber) {
          tableNumbers.push(tableNumber);
        }
      }

      return tableNumbers;
    }

    @step((tableNumber: string) => `页面操作：选择换桌目标桌台 ${tableNumber}`)
    async selectChangeTableTarget(tableNumber: string): Promise<void> {
      const targetTable = this.locators.changeTableTargetButtonByNumber(tableNumber);
      await expect(targetTable).toHaveCount(1);
      await targetTable.click();
      await expect(this.changeTableConfirmButton()).toBeEnabled();
    }

    @step((tableNumber: string) => `页面操作：确认换桌到桌台 ${tableNumber} 并返回点餐页`)
    async confirmChangeTable(tableNumber: string): Promise<void> {
      await this.changeTableConfirmButton().click();
      await this.host.expectLoaded();
      await this.expectTableNumber(tableNumber);
    }

    @step((guestCount: number) => `页面操作：确认点餐页顶部人数为 ${guestCount}`)
    async expectGuestCount(guestCount: number): Promise<void> {
      await expect(this.locators.guestCountButton).toHaveText(String(guestCount));
    }

    @step((guestCount: number) => `页面操作：将点餐页人数改为 ${guestCount}`)
    async changeGuestCount(guestCount: number): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.guestCountButton.click();

      await expect(this.locators.guestCountDialog).toBeVisible();
      await this.locators.guestCountClearButton.click();
      await this.locators.guestCountNumberButton(guestCount).click();
      await waitForInputSettled(this.locators.guestCountInput);
      await this.locators.guestCountConfirmButton.click();
      await expect(this.locators.guestCountDialog).toBeHidden({ timeout: 10_000 });
      await this.expectGuestCount(guestCount);
    }

    @step('页面操作：选择整桌共享座位')
    async selectSharedSeat(): Promise<void> {
      await this.host.expectLoaded();
      await (await this.resolveSharedSeatButton()).click();
    }

    @step((seatNumber: number) => `页面操作：选择 ${seatNumber} 号座位`)
    async selectSeat(seatNumber: number): Promise<void> {
      await this.host.expectLoaded();
      await (await this.resolveSeatButton(seatNumber)).click();
    }

    @step((dishName: string) => `页面操作：点击菜品 ${dishName}`)
    async clickDish(dishName: string): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.menuItemButtonByName(dishName).click();
    }

    @step((dishName: string) => `页面操作：通过 Search menu 搜索并点击菜品 ${dishName}`)
    async searchAndClickDish(dishName: string): Promise<void> {
      await this.locators.searchMenuButton.click();
      await expect(this.locators.searchMenuInput).toBeVisible();
      await this.locators.searchMenuInput.fill(dishName);
      await this.locators.searchMenuResultByName(dishName).click();
    }

    @step((visible: boolean) => `页面断言：Search Menu 入口${visible ? '可见' : '不可见'}`)
    async expectSearchMenuVisible(visible: boolean): Promise<void> {
      if (visible) {
        await expect(this.locators.searchMenuButton).toBeVisible();
        return;
      }

      await expect(this.locators.searchMenuButton).toBeHidden();
    }

    @step((query: string) => `页面操作：打开 Search Menu 并搜索 ${query}`)
    async openSearchMenuAndFill(query: string): Promise<void> {
      await this.locators.searchMenuButton.click();
      await expect(this.locators.searchMenuInput).toBeVisible();
      await this.locators.searchMenuInput.fill(query);
    }

    @step((query: string) => `页面操作：在中文界面打开搜索菜单并搜索 ${query}`)
    async openChineseSearchMenuAndFill(query: string): Promise<void> {
      await this.locators.chineseSearchMenuButton.click();
      await expect(this.locators.searchMenuInput).toBeVisible();
      await this.locators.searchMenuInput.fill(query);
    }

    @step(
      (name: string, itemNumber: string) =>
        `页面读取：获取 Search Menu 中名称 ${name}、编号 ${itemNumber} 的结果数量`,
    )
    async readSearchMenuResultCountByNameAndNumber(
      name: string,
      itemNumber: string,
    ): Promise<number> {
      const resultCards = this.locators.searchMenuResultCardsByNameAndNumber(
        name,
        itemNumber,
      );
      await resultCards.first().waitFor({ state: 'visible', timeout: 10_000 });
      return await resultCards.count();
    }

    @step(
      (testId: string, expectedText: string) =>
        `页面断言：Search Menu 结果 ${testId} 展示 ${expectedText}`,
    )
    async expectSearchMenuResult(testId: string, expectedText: string): Promise<void> {
      await expect(this.locators.searchMenuResultCard(testId)).toContainText(expectedText);
    }

    @step((dishName: string) => `页面断言：Search Menu 展示菜品 ${dishName}`)
    async expectSearchMenuResultByName(dishName: string): Promise<void> {
      await expect(this.locators.menuItemButtonByName(dishName)).toBeVisible();
    }

    @step((testId: string) => `页面操作：点击 Search Menu 结果 ${testId}`)
    async clickSearchMenuResult(testId: string): Promise<void> {
      await this.locators.searchMenuResultCard(testId).click();
    }

    @step((groupName: string) => `页面操作：切换菜单组 ${groupName}`)
    async switchMenuGroup(groupName: string): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.menuGroupCard(groupName).click();
      await expect(this.locators.selectedMenuGroupName).toHaveText(groupName);
    }

    @step((categoryName: string) => `页面操作：切换菜单类别 ${categoryName}`)
    async switchMenuCategory(categoryName: string): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.menuCategoryCard(categoryName).click();
      await expect(this.locators.selectedMenuCategoryName).toContainText(categoryName);
    }

    @step((groupName: string, categoryName: string) => `页面操作：切换菜单组 ${groupName} 和类别 ${categoryName}`)
    async switchMenu(groupName: string, categoryName: string): Promise<void> {
      await this.switchMenuGroup(groupName);
      await this.switchMenuCategory(categoryName);
    }

    @step('页面读取：读取当前选中的菜单组名称')
    async readSelectedMenuGroupName(): Promise<string> {
      await this.host.expectLoaded();
      return (await this.locators.selectedMenuGroupName.innerText()).replace(/\s+/g, ' ').trim();
    }

    @step('页面读取：读取当前选中的菜单类别名称')
    async readSelectedMenuCategoryName(): Promise<string> {
      await this.host.expectLoaded();
      return (await this.locators.selectedMenuCategoryName.innerText()).replace(/\s+/g, ' ').trim();
    }

    @step('页面读取：读取菜单类别名称列表')
    async readMenuCategoryNames(): Promise<string[]> {
      await this.host.expectLoaded();
      return (await this.locators.menuCategoryCards.allInnerTexts())
        .map((name) => name.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    }

    @step('页面读取：读取当前类别的菜品名称列表')
    async readCurrentCategoryDishNames(): Promise<string[]> {
      await this.host.expectLoaded();
      return (await this.locators.menuItemCards.allInnerTexts())
        .map((name) => name.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    }

    @step('页面操作：点击当前类别的第一道菜品')
    async clickFirstCurrentCategoryDish(): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.menuItemCards.first().click();
    }

    @step((dishName: string) => `页面操作：按名称 ${dishName} 点击当前类别菜品`)
    async clickCurrentCategoryDish(dishName: string): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.menuItemButtonByName(dishName).click();
    }

    @step((dishName: string) => `页面操作：双击当前类别菜品 ${dishName}`)
    async doubleClickCurrentCategoryDish(dishName: string): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.menuItemButtonByName(dishName).dblclick();
    }

    @step((quantity: number) => `页面操作：通过 Count 按钮将待点菜数量修改为 ${quantity}`)
    async changeDishCount(quantity: number): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.countButton.click();
      await this.enterCountDialogQuantity(quantity);
    }

    @step((dishName: string) => `页面操作：选中已下单菜品 ${dishName}`)
    async selectOrderedDish(dishName: string): Promise<void> {
      await this.host.expectLoaded();
      await (await this.resolveOrderedDishButton(dishName)).click();
    }

    @step('页面操作：点击已选菜品的加 1 按钮')
    async clickSelectedDishAdd(): Promise<void> {
      await this.host.expectLoaded();
      const selectedDishAddButton = await this.resolveSelectedDishAddButton();
      await expect(selectedDishAddButton).toBeVisible({ timeout: 10_000 });
      await selectedDishAddButton.click();
    }

    @step((dishName: string) => `页面操作：选中已下单菜品 ${dishName} 并点击加 1`)
    async increaseOrderedDishQuantityByOne(dishName: string): Promise<void> {
      await this.selectOrderedDish(dishName);
      await this.clickSelectedDishAdd();
    }

    @step('页面操作：在点餐页新增一条菜品分线')
    async clickAddLine(): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.addLineButton.click();
    }

    @step((dishName: string, price: number) => `页面操作：将已点菜品 ${dishName} 的价格修改为 ${price}`)
    async changeOrderedDishPrice(dishName: string, price: number): Promise<void> {
      await this.selectOrderedDish(dishName);
      await this.locators.changePriceButton.click();
      await this.expectCurrencyKeypadVisible();
      await this.clickCurrencyKeypadClear();
      await this.enterCurrencyKeypadAmount(price);
      await waitForInputSettled(this.locators.changePriceInput);
      const confirmButton = await this.resolveCurrencyKeypadConfirmButton();
      await confirmButton.click();
      await expect(confirmButton).toBeHidden({ timeout: 5_000 });
    }

    @step((dishName: string, taxExempt: boolean) =>
      `页面操作：将已点菜品 ${dishName} 设置为${taxExempt ? '免税' : '计税'}`,
    )
    async setOrderedDishTaxExempt(dishName: string, taxExempt: boolean): Promise<void> {
      await this.selectOrderedDish(dishName);
      await this.locators.taxExemptButton.click();
      await this.selectTaxExemptionChoice(taxExempt);
    }

    private async resolveChangePriceButton(): Promise<Locator> {
      return this.locators.changePriceButton;
    }

    private async selectTaxExemptionChoice(taxExempt: boolean): Promise<void> {
      await expect(this.locators.taxExemptionDialog).toBeVisible();
      await this.locators.taxExemptionChoiceButton(taxExempt).click();
      await expect(this.locators.taxExemptionDialog).toBeHidden({ timeout: 5_000 });
    }

    private async expectCurrencyKeypadVisible(): Promise<void> {
      await this.resolveCurrencyKeypadConfirmButton();
    }

    @step('页面操作：确认重量输入弹窗可见')
    async expectWeightDialogVisible(): Promise<void> {
      await expect(this.locators.weightDialog).toBeVisible({ timeout: 10_000 });
      await this.waitUntilWeightDialogReady();
    }

    @step((weight: number) => `页面操作：输入重量 ${weight}`)
    async enterWeight(weight: number): Promise<void> {
      await this.expectWeightDialogVisible();

      await expect(this.locators.weightInput).toBeVisible();
      await this.locators.weightInput.fill(String(weight));
    }

    @step('页面操作：确认重量输入')
    async confirmWeightDialog(): Promise<void> {
      await this.expectWeightDialogVisible();
      await waitForInputSettled(this.locators.weightInput);
      await this.locators.weightConfirmButton.click();
    }

    @step('页面操作：确认价格输入弹窗可见')
    async expectPriceDialogVisible(): Promise<void> {
      await expect(this.locators.priceDialog).toBeVisible();
    }

    @step((price: number) => `页面操作：输入价格 ${price}`)
    async enterPrice(price: number): Promise<void> {
      await this.expectPriceDialogVisible();
      await this.locators.priceInput.fill(String(price));
    }

    @step('页面操作：确认价格输入')
    async confirmPriceDialog(): Promise<void> {
      await this.expectPriceDialogVisible();
      await waitForInputSettled(this.locators.priceInput);
      await this.locators.priceConfirmButton.click();
    }

    @step((name: string, price: number) => `页面操作：添加 Open Food 菜品 ${name}，价格 ${price}`)
    async addOpenFood(name: string, price: number): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.openFoodButton.click();
      await expect(this.locators.openFoodConfirmButton).toBeVisible();

      await this.locators.openFoodNameInput.fill(name);
      await this.locators.openFoodPriceInput.fill(price.toFixed(3));
      await this.locators.openFoodKeyboardCloseButton.click();
      await waitForInputSettled(this.locators.openFoodPriceInput);
      await this.locators.openFoodConfirmButton.click();
      await expect(this.locators.openFoodConfirmButton).toBeHidden();
    }

    @step((dishName: string) => `页面操作：将菜品 ${dishName} 标记为 To Go`)
    async markOrderedDishToGo(dishName: string): Promise<void> {
      await this.host.expectLoaded();
      await this.selectOrderedDish(dishName);
      await this.locators.changeToGoButton.click();
      await expect(this.locators.orderedDishItemByName(dishName)).toContainText('To go', {
        ignoreCase: true,
      });
    }

    @step('页面操作：打开 Open Food 弹框')
    async openOpenFoodDialog(): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.openFoodButton.click();
      await expect(this.locators.openFoodDialog).toBeVisible();
      await expect(this.locators.openFoodKeyboardLanguageButton).toBeVisible();
    }

    @step('页面读取：读取 Open Food 屏幕键盘语言标识')
    async readOpenFoodKeyboardLanguage(): Promise<string> {
      return (await this.locators.openFoodKeyboardLanguageButton.innerText()).trim();
    }

    @step('页面操作：切换 Open Food 屏幕键盘语言')
    async switchOpenFoodKeyboardLanguage(): Promise<void> {
      await this.locators.openFoodKeyboardLanguageButton.click();
    }

    @step((letters: readonly string[]) => `页面操作：通过屏幕键盘输入拼音 ${letters.join('')}`)
    async pressOpenFoodKeyboardLetters(letters: readonly string[]): Promise<void> {
      for (const letter of letters) {
        await this.locators.openFoodKeyboardLetterButton(letter).click();
      }
    }

    @step((candidate: string) => `页面操作：选择屏幕键盘中文候选字 ${candidate}`)
    async selectOpenFoodKeyboardCandidate(candidate: string): Promise<void> {
      await this.locators.openFoodKeyboardCandidateButton(candidate).click();
      await expect(this.locators.openFoodNameInput).toHaveValue(candidate);
    }

    @step('页面读取：读取 Open Food 名称')
    async readOpenFoodName(): Promise<string> {
      return await this.locators.openFoodNameInput.inputValue();
    }

    @step((price: number) => `页面操作：填写 Open Food 价格 ${price} 并确认`)
    async fillOpenFoodPriceAndConfirm(price: number): Promise<void> {
      await this.locators.openFoodPriceInput.fill(price.toFixed(3));
      await this.locators.openFoodKeyboardCloseButton.click();
      await waitForInputSettled(this.locators.openFoodPriceInput);
      await this.locators.openFoodConfirmButton.click();
      await expect(this.locators.openFoodDialog).toBeHidden();
    }

    @step((name: string, price: number) => `页面操作：添加不选择税的 Open Food 菜品 ${name}，价格 ${price}`)
    async addOpenFoodWithoutTax(name: string, price: number): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.openFoodButton.click();
      await expect(this.locators.openFoodConfirmButton).toBeVisible();

      await this.locators.openFoodNameInput.fill(name);
      await this.locators.openFoodPriceInput.fill(price.toFixed(3));
      await this.locators.openFoodKeyboardCloseButton.click();
      await this.locators.openFoodNoTaxOption.click();
      await waitForInputSettled(this.locators.openFoodPriceInput);
      await this.locators.openFoodConfirmButton.click();
      await expect(this.locators.notification).toContainText('No tax selected. Confirm to save?');
      await this.locators.notificationConfirmButton.click();
      await expect(this.locators.openFoodConfirmButton).toBeHidden();
    }

    @step('页面操作：确认规格选择弹窗可见')
    async expectSpecificationDialogVisible(): Promise<void> {
      await expect(this.locators.specificationDialog).toBeVisible();
    }

    @step('页面操作：检查规格选择弹窗是否可见')
    async isSpecificationDialogVisible(): Promise<boolean> {
      return await this.locators.specificationDialog.isVisible();
    }

    @step('页面操作：确认分类 option 面板可见')
    async expectCategoryOptionPanelVisible(): Promise<void> {
      await waitUntil(
        async () => await this.isCategoryOptionPanelVisible(),
        (visible) => visible,
        {
          timeout: 10_000,
          message: '分类 option 面板未在超时内可见。',
        },
      );
    }

    @step((suboption: string) => `页面操作：检查分类二级 option ${suboption} 是否可见`)
    private async isCategorySubOptionVisible(suboption: string): Promise<boolean> {
      return await this.locators.itemOptionButton(suboption).isVisible().catch(() => false);
    }

    @step((optionName: string) => `页面断言：菜品 option ${optionName} 可见`)
    async expectItemOptionVisible(optionName: string): Promise<void> {
      await expect(this.locators.itemOptionButton(optionName)).toBeVisible();
    }

    @step('页面操作：检查分类 option 面板是否可见')
    async isCategoryOptionPanelVisible(): Promise<boolean> {
      return await this.locators.categoryOptionPanel.isVisible().catch(() => false);
    }

    @step((spec: string) => `页面操作：选择规格 ${spec}`)
    async selectSpecification(spec: string): Promise<void> {
      await this.expectSpecificationDialogVisible();
      await this.resolveSpecificationButton(spec).click();
    }

    @step((option: string, suboption?: string) =>
      suboption
        ? `页面操作：选择分类 option ${option} 和二级 option ${suboption}`
        : `页面操作：选择分类 option ${option}`,
    )
    async selectCategoryOption(option: string, suboption?: string): Promise<void> {
      const optionButton = this.locators.itemOptionButton(option);
      await expect(optionButton).toBeVisible();
      await optionButton.click();

      if (suboption) {
        await waitUntil(
          async () => await this.isCategorySubOptionVisible(suboption),
          (visible) => visible,
          {
            timeout: 10_000,
            message: `分类二级 option ${suboption} 未在超时内可见。`,
          },
        );
        await this.locators.itemOptionButton(suboption).click();
      }
    }

    @step('页面操作：确认规格选择')
    async confirmSpecificationDialog(): Promise<void> {
      await this.expectSpecificationDialogVisible();
      await this.locators.specificationConfirmButton.click();
    }

    @step(
      (sectionName: string, dishName: string, quantity: number = 1) =>
        quantity === 1
          ? `页面操作：在套餐区域 ${sectionName} 选择菜品 ${dishName}`
          : `页面操作：在套餐区域 ${sectionName} 选择菜品 ${dishName} 共 ${quantity} 份`,
    )
    async selectComboSectionItem(
      sectionName: string,
      dishName: string,
      quantity: number = 1,
    ): Promise<void> {
      if (quantity < 1) {
        return;
      }

      await this.activateComboSection(sectionName);
      await (await this.resolveComboSectionItemButton(sectionName, dishName)).click();

      for (let currentQuantity = 1; currentQuantity < quantity; currentQuantity += 1) {
        await (await this.resolveComboSectionItemPlusButton(sectionName, dishName)).click();
      }
    }

    @step('页面操作：确认套餐选择')
    async confirmComboDialog(): Promise<void> {
      await this.locators.comboConfirmButton.click();
      await expect(this.locators.comboDialog).toBeHidden();
    }

    @step((comboName: string) => `页面操作：选中已点套餐 ${comboName} 并打开套餐编辑器`)
    async openComboEditorForOrderedCombo(comboName: string): Promise<void> {
      await this.selectOrderedDish(comboName);
      await expect(this.locators.comboDialog).toBeVisible();
    }

    @step(
      (sectionId: number, saleItemId: number) =>
        `页面操作：在套餐区域 ${sectionId} 选择菜品 ID ${saleItemId}`,
    )
    async selectComboItem(
      sectionId: number,
      saleItemId: number,
      itemIndex: number = 0,
    ): Promise<void> {
      const comboItemButton = this.locators.comboItemButton(sectionId, saleItemId, itemIndex);
      await expect(comboItemButton).toBeVisible();
      await comboItemButton.click();
    }

    @step(
      (sectionId: number, saleItemId: number) =>
        `页面断言：套餐区域 ${sectionId} 的菜品 ID ${saleItemId} 可见`,
    )
    async expectComboItemVisible(
      sectionId: number,
      saleItemId: number,
      itemIndex: number = 0,
    ): Promise<void> {
      await expect(this.locators.comboItemButton(sectionId, saleItemId, itemIndex)).toBeVisible();
    }

    @step(
      (comboName: string, saleItemId: number) =>
        `页面操作：选择套餐 ${comboName} 的子菜 ID ${saleItemId}`,
    )
    async selectComboSubItem(comboName: string, saleItemId: number): Promise<void> {
      const comboSubItem = this.locators.comboSubItemBySaleItemId(comboName, saleItemId);
      await expect(comboSubItem).toBeVisible();
      await comboSubItem.click();
    }

    @step(
      (comboName: string, saleItemId: number, price: number) =>
        `页面操作：将套餐 ${comboName} 的子菜 ID ${saleItemId} 改价为 ${price}`,
    )
    async changeComboSubItemPrice(
      comboName: string,
      saleItemId: number,
      price: number,
    ): Promise<void> {
      await this.selectComboSubItem(comboName, saleItemId);
      const changePriceButton = await this.resolveChangePriceButton();
      await expect(changePriceButton).toBeEnabled();
      await changePriceButton.click();
      await this.expectCurrencyKeypadVisible();
      await this.clickCurrencyKeypadClear();
      await this.enterCurrencyKeypadAmount(price);
      await waitForInputSettled(this.locators.changePriceInput);
      const confirmButton = await this.resolveCurrencyKeypadConfirmButton();
      await confirmButton.click();
      await expect(confirmButton).toBeHidden({ timeout: 5_000 });
    }

    @step((dishName: string) => `页面操作：删除已点套餐 ${dishName} 当前选中的一个 option`)
    async reduceSelectedComboOption(dishName: string): Promise<void> {
      await this.selectOrderedDish(dishName);
      await expect(this.locators.reduceSelectedOptionButton).toBeVisible();
      await this.locators.reduceSelectedOptionButton.click();
    }

    @step((dishName: string, times: number) => `页面操作：将已点菜品 ${dishName} 减菜 ${times} 次`)
    async reduceOrderedDishQuantity(dishName: string, times: number): Promise<void> {
      await this.selectOrderedDish(dishName);
      await expect(this.locators.reduceButton).toBeVisible();

      for (let index = 0; index < times; index += 1) {
        await this.locators.reduceButton.click();
      }
    }

    @step((dishName: string) => `页面操作：尝试删除已送厨菜品 ${dishName} 并校验权限提示`)
    async requestSentDishRemovalAndExpectAuthorization(dishName: string): Promise<void> {
      await this.selectOrderedDish(dishName);
      await this.locators.removeItemButton.click();
      await this.expectPendingDishRemovalAuthorization();
    }

    @step((dishName: string) => `页面操作：双击并删除已送厨菜品 ${dishName}`)
    async removeSentDish(dishName: string): Promise<void> {
      await this.host.expectLoaded();
      const orderedDish = this.locators.orderedDishItemByName(dishName);
      await expect(orderedDish).toBeVisible();
      await orderedDish.dblclick();
      await expect(this.locators.removeItemButton).toBeVisible();
      await this.locators.removeItemButton.click();
    }

    @step('页面校验：校验已出现送厨删菜授权提示')
    async expectPendingDishRemovalAuthorization(): Promise<void> {
      await expect(this.locators.kitchenVoidPermissionMessage).toBeVisible();
      await expect(this.locators.authorizationConfirmButton).toBeVisible();
    }

    @step('页面操作：输入授权员工口令并确认删菜授权')
    async authorizePendingDishRemoval(passcode: string): Promise<void> {
      if (!/^\d+$/.test(passcode)) {
        throw new Error('删菜授权口令必须只包含数字。');
      }

      for (const digit of passcode) {
        await this.locators.authorizationDigitButton(digit).click();
      }
      await this.locators.authorizationConfirmButton.click();
      await expect(this.locators.authorizationConfirmButton).toBeHidden();
    }

    @step((dishName: string, quantity: number) => `页面操作：将已点菜品 ${dishName} 数量修改为 ${quantity}`)
    async changeOrderedDishQuantity(dishName: string, quantity: number): Promise<void> {
      await this.selectOrderedDish(dishName);
      await this.locators.countButton.click();
      await this.enterCountDialogQuantity(quantity);
    }

    @step((quantity: number) => `页面操作：在 Count 数字键盘输入数量 ${quantity} 并确认`)
    private async enterCountDialogQuantity(quantity: number): Promise<void> {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`菜品数量必须是大于 0 的有限数字，实际为 ${quantity}。`);
      }

      const countDialog = this.locators.countDialog;
      await expect(countDialog).toBeVisible();
      const countDialogInput = this.locators.countDialogInput;
      const countDialogConfirmButton = this.locators.countDialogConfirmButton;

      await expect(countDialogInput).toBeVisible();
      await this.locators.countDialogClearButton.click();
      for (const key of String(quantity)) {
        await this.locators.countDialogKeyButton(key).click();
      }

      await waitForInputSettled(countDialogInput);
      await countDialogConfirmButton.click();
      await expect(countDialog).toBeHidden();
    }

    private async enterCurrencyKeypadAmount(amount: number): Promise<void> {
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`Invalid currency amount: ${amount}`);
      }

      const centsText = String(Math.round(amount * 100)).replace(/^0+(?=\d)/, '');
      const keypadInputs =
        centsText.endsWith('00') && centsText.length > 2
          ? [...centsText.slice(0, -2), 'double-zero']
          : [...centsText];

      for (const keypadInput of keypadInputs) {
        await (await this.resolveCurrencyKeypadButton(keypadInput)).click();
      }
    }

    @step('页面操作：清空菜品价格输入框')
    private async clickCurrencyKeypadClear(): Promise<void> {
      await expect(this.locators.changePriceClearButton).toBeVisible({ timeout: 5_000 });
      await this.locators.changePriceClearButton.click();
    }

    private async resolveCurrencyKeypadButton(keypadInput: string): Promise<Locator> {
      return this.locators.currencyKeypadButton(keypadInput);
    }

    private async resolveCurrencyKeypadConfirmButton(): Promise<Locator> {
      await expect(this.locators.changePriceConfirmButton).toBeVisible({ timeout: 5_000 });
      return this.locators.changePriceConfirmButton;
    }

    private async resolveOrderedDishButton(dishName: string): Promise<Locator> {
      const orderedDishButton = this.locators.orderedDishItemByName(dishName);
      await expect(orderedDishButton).toBeVisible();
      return orderedDishButton;
    }

    private async waitUntilWeightDialogReady(): Promise<void> {
      try {
        await waitUntil(
          async () => ({
            isLoading: await this.locators.weightDialogLoadingText.isVisible().catch(() => false),
            hasVisibleInput: await this.locators.weightInput.isVisible().catch(() => false),
            digitButtonCount: await this.locators.weightDialog
              .getByRole('button')
              .filter({ hasText: /^\d$/ })
              .count()
              .catch(() => 0),
          }),
          (state) => !state.isLoading && (state.hasVisibleInput || state.digitButtonCount > 0),
          {
            timeout: 20_000,
            message: 'Weight dialog did not finish loading input controls in time.',
          },
        );
      } catch (error) {
        const isStillLoading = await this.locators.weightDialogLoadingText.isVisible().catch(() => false);
        const hasVisibleInput = await this.locators.weightInput.isVisible().catch(() => false);
        const digitButtonCount = await this.locators.weightDialog
          .getByRole('button')
          .filter({ hasText: /^\d$/ })
          .count()
          .catch(() => 0);

        if (isStillLoading && !hasVisibleInput && digitButtonCount === 0) {
          throw new Error('当前license为磅秤模式，无法输入重量');
        }

        throw error;
      }
    }

    private resolveCountDialogNumberButton(digit: string): Locator {
      return this.locators.countDialog.getByRole('button', { name: digit, exact: true });
    }

    private resolveSpecificationButton(spec: string): Locator {
      return this.locators.specificationDialog.getByRole('button', { name: spec, exact: true });
    }

    private async resolveCategoryOptionButton(option: string): Promise<Locator> {
      const escapedOption = this.ctx.escapeRegExp(option);
      const optionPattern = new RegExp(`^\\s*${escapedOption}\\s*(?:\\$[\\d,.]+)?\\s*$`);
      return this.locators.categoryOptionButton(optionPattern);
    }

    private async resolveCategorySubOptionButton(option: string): Promise<Locator> {
      const escapedOption = this.ctx.escapeRegExp(option);
      const optionPattern = new RegExp(`^\\s*${escapedOption}\\s*(?:\\$[\\d,.]+)?\\s*$`);
      return this.locators.categorySubOptionButton(optionPattern);
    }

    private async activateComboSection(sectionName: string): Promise<void> {
      const sectionButton = this.locators.comboDialog
        .getByRole('button', {
          name: new RegExp(`^${this.ctx.escapeRegExp(sectionName)}$`),
        })
        .first();

      if (await sectionButton.isVisible().catch(() => false)) {
        await sectionButton.click();
      }
    }

    private async resolveComboSectionItemButton(
      sectionName: string,
      dishName: string,
    ): Promise<Locator> {
      return this.locators.comboSectionItemButton(sectionName, dishName);
    }

    private async resolveComboSectionItemPlusButton(
      sectionName: string,
      dishName: string,
    ): Promise<Locator> {
      return this.locators.comboSectionItemPlusButton(sectionName, dishName);
    }

    private resolveTableNumberButton(tableNumber: string): Locator {
      return this.page.getByRole('button', {
        name: new RegExp(`^TableIcon\\s*${this.ctx.escapeRegExp(tableNumber)}$`),
      });
    }

    private changeTablePrompt(): Locator {
      return this.page.getByText('Select a target table', { exact: true });
    }

    private changeTableTargetButtons(): Locator {
      return this.locators.changeTableTargetButtons;
    }

    private changeTableConfirmButton(): Locator {
      return this.page.getByRole('button', { name: 'Confirm', exact: true });
    }

    private async resolveSharedSeatButton(): Promise<Locator> {
      return this.locators.sharedSeatButton;
    }

    private async resolveSeatButton(seatNumber: number): Promise<Locator> {
      return this.locators.seatButton(seatNumber);
    }

    private async resolveSelectedDishAddButton(): Promise<Locator> {
      return this.locators.selectedDishAddButton;
    }
}

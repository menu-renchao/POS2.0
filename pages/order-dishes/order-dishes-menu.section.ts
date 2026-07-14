import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';

const CONFIRM_BUTTON_NAME = /^(Confirm|确认)$/;

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

    @step((guestCount: number) => `页面操作：确认点餐页顶部人数为 ${guestCount}`)
    async expectGuestCount(guestCount: number): Promise<void> {
      await expect(await this.resolveGuestCountButton(guestCount)).toBeVisible();
    }

    @step((guestCount: number) => `页面操作：将点餐页人数改为 ${guestCount}`)
    async changeGuestCount(guestCount: number): Promise<void> {
      await this.host.expectLoaded();
      await (await this.resolveAnyGuestCountButton()).click();

      const guestCountDialog = await this.resolveGuestCountDialog();
      await expect(guestCountDialog).toBeVisible();
      await guestCountDialog.getByRole('button', { name: String(guestCount), exact: true }).click();
      await waitForInputSettled(undefined, 250);
      await this.resolveGuestCountDialogConfirmButton(guestCountDialog).click();
      await expect(guestCountDialog).toBeHidden({ timeout: 10_000 });
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

      try {
        await (await this.resolveDishButton(dishName)).click();
        return;
      } catch (error) {
        await this.searchAndClickDish(dishName).catch(() => {
          throw error;
        });
      }
    }

    @step((dishName: string) => `页面操作：通过 Search menu 搜索并点击菜品 ${dishName}`)
    async searchAndClickDish(dishName: string): Promise<void> {
      const searchMenuButton = await this.ctx.resolveVisibleLocator(
        [
          this.page.getByRole('button', { name: 'Search menu' }).first(),
          this.locators.appFrame.getByRole('button', { name: 'Search menu' }).first(),
        ],
        'Unable to find Search menu button on order dishes page.',
      );
      await searchMenuButton.click();

      const searchInput = await this.ctx.resolveVisibleLocator(
        [
          this.ctx.scopedLocator('#searchiptedit'),
          this.ctx.scopedLocator('#schipt'),
          this.page.getByRole('textbox').last(),
        ],
        'Unable to find Search menu input on order dishes page.',
      );
      await searchInput.fill(dishName);

      const searchResult = await this.ctx.resolveVisibleLocator(
        [
          this.ctx.scopedLocator('#itemdsply').getByText(dishName, { exact: true }).first(),
          this.page.getByRole('button', { name: dishName, exact: true }).first(),
          this.locators.appFrame.getByRole('button', { name: dishName, exact: true }).first(),
        ],
        `Unable to find Search menu result for dish: ${dishName}.`,
      );
      await searchResult.click();
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
      await (await this.resolveMenuCategoryCard(categoryName)).click();
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

    @step((quantity: number) => `页面操作：通过 Count 按钮将待点菜数量修改为 ${quantity}`)
    async changeDishCount(quantity: number): Promise<void> {
      await this.host.expectLoaded();
      await (await this.resolveCountButton()).click();

      const countDialog = await this.resolveCountDialog();
      await expect(countDialog).toBeVisible();
      const countDialogInput = countDialog.locator('input').first();
      const countDialogConfirmButton = countDialog
        .getByTestId('dish-count-modal-numeric-input-confirm-button')
        .or(
          countDialog.getByRole('button', {
            name: /^(Confirm|确认)$/,
          }),
        )
        .first();

      if (await countDialogInput.isVisible().catch(() => false)) {
        await countDialogInput.fill(String(quantity)).catch(async () => {
          await countDialogInput.evaluate((inputElement, nextValue) => {
            const input = inputElement as HTMLInputElement;
            input.value = String(nextValue);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }, String(quantity));
        });
      } else {
        for (const digit of String(quantity)) {
          const numericKey = countDialog.getByTestId(`dish-count-modal-numeric-input-number-${digit}`);

          if (await numericKey.isVisible().catch(() => false)) {
            await numericKey.click();
            continue;
          }

          await countDialog.getByRole('button', { name: digit, exact: true }).click();
        }
      }

      await waitForInputSettled(countDialogInput);
      await countDialogConfirmButton.click();
      await expect(countDialog).toBeHidden();
    }

    @step('页面操作：点击第一个可用菜品')
    async clickFirstAvailableDish(): Promise<void> {
      await this.host.expectLoaded();
      await this.locators.firstAvailableDishButton.click();
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
      const addLineButton = await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByTestId('action-rail-button-addline').first(),
          this.page.getByTestId('action-rail-button-addline').first(),
        ],
        'Unable to find order-dishes Add Line button.',
      );

      await addLineButton.evaluate((buttonElement) => {
        (buttonElement as HTMLElement).click();
      });
    }

    @step((dishName: string, price: number) => `页面操作：将已点菜品 ${dishName} 的价格修改为 ${price}`)
    async changeOrderedDishPrice(dishName: string, price: number): Promise<void> {
      await this.selectOrderedDish(dishName);
      const changePriceButton = await this.resolveChangePriceButton();

      await changePriceButton.evaluate((buttonElement) => {
        (buttonElement as HTMLElement).click();
      });
      await this.expectCurrencyKeypadVisible();
      await this.enterCurrencyKeypadAmount(price);
      await waitForInputSettled(undefined, 250);
      const confirmButton = await this.resolveCurrencyKeypadConfirmButton();
      await confirmButton.evaluate((buttonElement) => {
        (buttonElement as HTMLElement).click();
      });
      await expect(confirmButton).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
    }

    @step((dishName: string, taxExempt: boolean) =>
      `页面操作：将已点菜品 ${dishName} 设置为${taxExempt ? '免税' : '计税'}`,
    )
    async setOrderedDishTaxExempt(dishName: string, taxExempt: boolean): Promise<void> {
      await this.selectOrderedDish(dishName);
      const taxExemptButton = await this.resolveTaxExemptButton();

      await taxExemptButton.click();
      await this.selectTaxExemptionChoice(taxExempt);
      await waitForInputSettled(undefined, 250);
    }

    private async resolveChangePriceButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByTestId('action-rail-button-chgPrc').first(),
          this.page.getByTestId('action-rail-button-chgPrc').first(),
        ],
        'Unable to find order-dishes Change Price button.',
      );
    }

    private async resolveTaxExemptButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByTestId('action-rail-button-taxExempt').first(),
          this.page.getByTestId('action-rail-button-taxExempt').first(),
          this.locators.appFrame.getByRole('button', { name: /^Tax$/ }).first(),
          this.page.getByRole('button', { name: /^Tax$/ }).first(),
          this.locators.appFrame.getByRole('button', { name: /^(Tax Exempt|免税)$/ }).first(),
          this.page.getByRole('button', { name: /^(Tax Exempt|免税)$/ }).first(),
        ],
        'Unable to find order-dishes Tax Exempt button.',
      );
    }

    private async selectTaxExemptionChoice(taxExempt: boolean): Promise<void> {
      const taxDialog = await this.ctx.resolveVisibleLocator(
        [
          this.page
            .getByRole('alertdialog')
            .filter({ has: this.page.getByText(/Tax exemption or not\?/i) })
            .first(),
          this.page
            .getByRole('dialog')
            .filter({ has: this.page.getByText(/Tax exemption or not\?/i) })
            .first(),
          this.locators.appFrame
            .getByRole('alertdialog')
            .filter({ has: this.locators.appFrame.getByText(/Tax exemption or not\?/i) })
            .first(),
          this.locators.appFrame
            .getByRole('dialog')
            .filter({ has: this.locators.appFrame.getByText(/Tax exemption or not\?/i) })
            .first(),
        ],
        'Unable to find order-dishes tax exemption dialog.',
      );
      const choiceButton = taxDialog
        .getByRole('button', { name: taxExempt ? /^Exempt$/ : /^Taxes$/ })
        .first();

      await choiceButton.click();
      await expect(taxDialog).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
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

      if (await this.locators.weightInput.isVisible().catch(() => false)) {
        await this.locators.weightInput.fill(String(weight));
        return;
      }

      for (const digit of String(weight)) {
        await this.locators.weightDialog.getByRole('button', { name: digit, exact: true }).click();
      }
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
      const escapedSuboption = this.ctx.escapeRegExp(suboption);
      const suboptionPattern = new RegExp(`^\\s*${escapedSuboption}\\s*(?:\\$[\\d,.]+)?\\s*$`);

      return await this.page
        .getByRole('button', { name: suboptionPattern })
        .isVisible()
        .catch(() => false);
    }

    @step('页面操作：检查分类 option 面板是否可见')
    async isCategoryOptionPanelVisible(): Promise<boolean> {
      const panelCandidates = [
        this.locators.categoryOptionPanel,
        this.page
          .locator('[data-testid="item-option-panel-collapse-button"]')
          .locator('xpath=ancestor::div[contains(@class,"_dock_")][1]'),
        this.locators.appFrame
          .locator('[data-testid="item-option-panel-collapse-button"]')
          .locator('xpath=ancestor::motion[contains(@class,"_dock_")][1]'),
      ];

      for (const panel of panelCandidates) {
        if (await panel.isVisible().catch(() => false)) {
          return true;
        }
      }

      return await this.page
        .getByRole('button', { name: /^Collapse/i })
        .isVisible()
        .catch(() => false);
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
      await this.expectCategoryOptionPanelVisible();
      await (await this.resolveCategoryOptionButton(option)).click();

      if (suboption) {
        await waitUntil(
          async () => await this.isCategorySubOptionVisible(suboption),
          (visible) => visible,
          {
            timeout: 10_000,
            message: `分类二级 option ${suboption} 未在超时内可见。`,
          },
        );
        await (await this.resolveCategorySubOptionButton(suboption)).click();
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
    }

    @step((dishName: string, times: number) => `页面操作：将已点菜品 ${dishName} 减菜 ${times} 次`)
    async reduceOrderedDishQuantity(dishName: string, times: number): Promise<void> {
      await this.selectOrderedDish(dishName);

      const removeButton = await this.ctx.resolveVisibleLocator(
        [
          this.page.getByTestId('action-rail-button-rmvItem').first(),
          this.locators.appFrame.getByTestId('action-rail-button-rmvItem').first(),
          this.locators.appFrame.getByRole('button', { name: /^Reduce$/ }).first(),
          this.page.getByRole('button', { name: /^Reduce$/ }).first(),
          this.ctx.scopedLocator('#reduce1icon'),
        ],
        'Unable to find order-dishes remove item button.',
      );

      for (let index = 0; index < times; index += 1) {
        await removeButton.click();
      }
    }

    @step((dishName: string, quantity: number) => `页面操作：将已点菜品 ${dishName} 数量修改为 ${quantity}`)
    async changeOrderedDishQuantity(dishName: string, quantity: number): Promise<void> {
      await this.selectOrderedDish(dishName);
      await (await this.resolveCountButton()).click();

      const countDialog = await this.resolveCountDialog();
      await expect(countDialog).toBeVisible();
      const countDialogInput = countDialog.locator('input').first();
      const countDialogConfirmButton = countDialog.getByRole('button', {
        name: /^(Confirm|确认)$/,
      });

      if (await countDialogInput.isVisible().catch(() => false)) {
        await countDialogInput.fill(String(quantity)).catch(async () => {
          await countDialogInput.evaluate((inputElement, nextValue) => {
            const input = inputElement as HTMLInputElement;
            input.value = String(nextValue);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }, String(quantity));
        });
      } else {
        for (const digit of String(quantity)) {
          await countDialog.getByRole('button', { name: digit, exact: true }).click();
        }
      }

      await waitForInputSettled(countDialogInput);
      await countDialogConfirmButton.click();
      await expect(countDialog).toBeHidden();
    }

    private async resolveCountButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.page.getByTestId('action-rail-button-chgNum').first(),
          this.locators.appFrame.getByTestId('action-rail-button-chgNum').first(),
          this.locators.appFrame
            .locator(
              '[data-testid="action-rail-button-count"], [data-test-id="action-rail-button-count"]',
            )
            .first(),
          this.page
            .locator(
              '[data-testid="action-rail-button-count"], [data-test-id="action-rail-button-count"]',
            )
            .first(),
          this.locators.appFrame.getByRole('button', { name: /^(Count|数量)$/ }).first(),
          this.page.getByRole('button', { name: /^(Count|数量)$/ }).first(),
          this.locators.countButton,
        ],
        'Unable to find visible Count button on the order page.',
      );
    }

    private async resolveCountDialog(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.page.locator('[data-testid="dish-count-modal"], [data-testid="option-count-modal"]'),
          this.locators.appFrame.locator('[data-testid="dish-count-modal"], [data-testid="option-count-modal"]'),
          this.page
            .getByRole('dialog')
            .filter({ has: this.page.getByRole('heading', { name: /^(Count|数量)$/ }) }),
          this.locators.appFrame
            .getByRole('dialog')
            .filter({ has: this.locators.appFrame.getByRole('heading', { name: /^(Count|数量)$/ }) }),
          this.locators.countDialog,
        ],
        'Unable to find visible Count dialog on the order page.',
      );
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

    private async resolveCurrencyKeypadButton(keypadInput: string): Promise<Locator> {
      if (keypadInput === 'double-zero') {
        return await this.ctx.resolveVisibleLocator(
          [
            this.locators.appFrame.getByTestId('preset-currency-keypad-input-double-zero').first(),
            this.page.getByTestId('preset-currency-keypad-input-double-zero').first(),
          ],
          'Unable to find currency keypad double-zero button.',
        );
      }

      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByTestId(`preset-currency-keypad-input-number-${keypadInput}`).first(),
          this.page.getByTestId(`preset-currency-keypad-input-number-${keypadInput}`).first(),
        ],
        `Unable to find currency keypad number button: ${keypadInput}.`,
      );
    }

    private async resolveCurrencyKeypadConfirmButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByTestId('preset-currency-keypad-input-confirm-button').first(),
          this.page.getByTestId('preset-currency-keypad-input-confirm-button').first(),
        ],
        'Unable to find currency keypad confirm button.',
      );
    }

    private async resolveDishButton(dishName: string): Promise<Locator> {
      const dishCandidates = [
        this.locators.appFrame.getByRole('button', { name: dishName, exact: true }).first(),
        this.page.getByRole('button', { name: dishName, exact: true }).first(),
        this.locators.appFrame
          .getByRole('button')
          .filter({ has: this.locators.appFrame.getByText(dishName, { exact: true }) })
          .first(),
        this.page
          .getByRole('button')
          .filter({ has: this.page.getByText(dishName, { exact: true }) })
          .first(),
      ];
      const dishNextButton = this.ctx.scopedLocator('#postfalse');

      for (let attempt = 0; attempt < 15; attempt += 1) {
        const visibleDishButton = await this.ctx.findVisibleLocator(dishCandidates);

        if (visibleDishButton) {
          return visibleDishButton;
        }

        if (!(await dishNextButton.isVisible().catch(() => false))) {
          break;
        }

        await dishNextButton.click();
      }

      throw new Error(`Unable to find dish button: ${dishName}.`);
    }

    private async resolveMenuCategoryCard(categoryName: string): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.menuCategoryCards
            .filter({
              hasText: new RegExp(this.ctx.escapeRegExp(categoryName)),
            })
            .first(),
          this.locators.appFrame.getByRole('button', { name: categoryName, exact: true }).first(),
          this.page.getByRole('button', { name: categoryName, exact: true }).first(),
        ],
        `Unable to find menu category: ${categoryName}.`,
      );
    }

    private async resolveOrderedDishButton(dishName: string): Promise<Locator> {
      const escapedDishName = this.ctx.escapeRegExp(dishName);
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByRole('button', {
            name: new RegExp(
              `(?:^|\\s)\\d+\\s+${escapedDishName}(?:\\s+\\d+\\s+sent)?\\s+\\$[\\d,.]+`,
            ),
          }).first(),
          this.page.getByRole('button', {
            name: new RegExp(
              `(?:^|\\s)\\d+\\s+${escapedDishName}(?:\\s+\\d+\\s+sent)?\\s+\\$[\\d,.]+`,
            ),
          }).first(),
        ],
        `Unable to find ordered dish button: ${dishName}.`,
      );
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

      return await this.ctx.resolveVisibleLocator(
        [
          this.page.getByRole('button', { name: optionPattern }).first(),
          this.locators.appFrame.getByRole('button', { name: optionPattern }).first(),
          this.locators.categoryOptionGrid.getByRole('button', { name: optionPattern }).first(),
          this.locators.categoryOptionGrid
            .locator('[data-testid^="category-option-"], [data-test-id^="category-option-"]')
            .filter({ hasText: optionPattern })
            .first(),
          this.locators.categoryOptionGrid.locator('[class*="_card_"]').filter({ hasText: optionPattern }).first(),
        ],
        `Unable to find category option button: ${option}.`,
      );
    }

    private async resolveCategorySubOptionButton(option: string): Promise<Locator> {
      const escapedOption = this.ctx.escapeRegExp(option);
      const optionPattern = new RegExp(`^\\s*${escapedOption}\\s*(?:\\$[\\d,.]+)?\\s*$`);

      return await this.ctx.resolveVisibleLocator(
        [
          this.page.getByRole('button', { name: optionPattern }).first(),
          this.locators.appFrame.getByRole('button', { name: optionPattern }).first(),
          this.locators.categoryOptionSubGrid.getByRole('button', { name: optionPattern }).first(),
          this.locators.categoryOptionSubGrid
            .locator('[data-testid^="category-sub-option-"], [data-test-id^="category-sub-option-"]')
            .filter({ hasText: optionPattern })
            .first(),
          this.locators.categoryOptionSubGrid
            .locator('[class*="_card_"]')
            .filter({ hasText: optionPattern })
            .first(),
        ],
        `Unable to find category sub option button: ${option}.`,
      );
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

    private resolveLegacyComboSection(sectionName: string): Locator {
      return this.locators.comboDialog
        .locator('div[class*="_sectionName_"]')
        .filter({
          hasText: new RegExp(`^${this.ctx.escapeRegExp(sectionName)}$`),
        })
        .first()
        .locator('xpath=ancestor::section[1]');
    }

    private resolveComboSectionItemCardShell(sectionName: string, dishName: string): Locator {
      const itemTitle = this.locators.comboDialog.locator('span[class*="_itemTitle_"]', {
        hasText: new RegExp(`^${this.ctx.escapeRegExp(dishName)}$`),
      });

      return this.resolveLegacyComboSection(sectionName)
        .locator('span[class*="_itemTitle_"]', {
          hasText: new RegExp(`^${this.ctx.escapeRegExp(dishName)}$`),
        })
        .locator('xpath=ancestor::div[contains(@class,"_cardShell_")][1]')
        .or(itemTitle.locator('xpath=ancestor::div[contains(@class,"_cardShell_")][1]'))
        .first();
    }

    private async resolveComboSectionItemButton(
      sectionName: string,
      dishName: string,
    ): Promise<Locator> {
      const cardShell = this.resolveComboSectionItemCardShell(sectionName, dishName);

      return await this.ctx.resolveVisibleLocator(
        [cardShell.getByRole('button').first()],
        `Unable to find combo item button: ${sectionName} / ${dishName}.`,
      );
    }

    private async resolveComboSectionItemPlusButton(
      sectionName: string,
      dishName: string,
    ): Promise<Locator> {
      const cardShell = this.resolveComboSectionItemCardShell(sectionName, dishName);

      return await this.ctx.resolveVisibleLocator(
        [
          cardShell.locator('button[class*="_counterBtnPlus_"]').first(),
          cardShell.getByRole('button', { name: '+', exact: true }).first(),
        ],
        `Unable to find combo item plus button: ${sectionName} / ${dishName}.`,
      );
    }

    private resolveTableNumberButton(tableNumber: string): Locator {
      return this.locators.appFrame
        .getByRole('button', {
          name: new RegExp(`TableIcon\\s*${this.ctx.escapeRegExp(tableNumber)}`),
        })
        .or(
          this.page.getByRole('button', {
            name: new RegExp(`TableIcon\\s*${this.ctx.escapeRegExp(tableNumber)}`),
          }),
        )
        .first();
    }

    private async resolveGuestCountButton(guestCount: number): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.page.getByRole('button', { name: new RegExp(`SeatIcon\\s*${guestCount}`) }).first(),
          this.locators.appFrame.getByRole('button', { name: new RegExp(`SeatIcon\\s*${guestCount}`) }).first(),
        ],
        `Unable to find order-dishes guest-count button for ${guestCount}.`,
      );
    }

    private async resolveAnyGuestCountButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.page.getByRole('button', { name: /SeatIcon\s*\d+/ }).first(),
          this.locators.appFrame.getByRole('button', { name: /SeatIcon\s*\d+/ }).first(),
        ],
        'Unable to find order-dishes guest-count button.',
      );
    }

    private async resolveGuestCountDialog(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.page.getByRole('dialog', { name: 'Party Size' }).first(),
          this.page
            .getByRole('dialog')
            .filter({ has: this.page.getByRole('heading', { name: 'Party Size' }) })
            .first(),
          this.locators.appFrame.getByRole('dialog', { name: 'Party Size' }).first(),
          this.locators.appFrame
            .getByRole('dialog')
            .filter({ has: this.locators.appFrame.getByRole('heading', { name: 'Party Size' }) })
            .first(),
        ],
        'Unable to find order-dishes guest-count dialog.',
      );
    }

    private resolveGuestCountDialogConfirmButton(guestCountDialog: Locator): Locator {
      return guestCountDialog.getByRole('button', { name: CONFIRM_BUTTON_NAME }).first();
    }

    private async resolveSharedSeatButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.page.getByRole('button', { name: 'Share For Whole Table', exact: true }).first(),
          this.locators.appFrame.getByRole('button', { name: 'Share For Whole Table', exact: true }).first(),
        ],
        'Unable to find Share For Whole Table button.',
      );
    }

    private async resolveSeatButton(seatNumber: number): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.page.getByRole('button', { name: `Seat ${seatNumber}`, exact: true }).first(),
          this.locators.appFrame.getByRole('button', { name: `Seat ${seatNumber}`, exact: true }).first(),
        ],
        `Unable to find Seat ${seatNumber} button.`,
      );
    }

    private async resolveSelectedDishAddButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame
            .locator(
              '[data-testid="action-rail-button-add1"], [data-test-id="action-rail-button-add1"]',
            )
            .or(
              this.locators.appFrame
                .locator('aside, [role="complementary"]')
                .getByRole('button', { name: /^(Add|加)$/ }),
            )
            .first(),
          this.page
            .locator(
              '[data-testid="action-rail-button-add1"], [data-test-id="action-rail-button-add1"]',
            )
            .or(
              this.page
                .locator('aside, [role="complementary"]')
                .getByRole('button', { name: /^(Add|加)$/ }),
            )
            .first(),
        ],
        'Unable to find selected-dish add button.',
      );
    }
}

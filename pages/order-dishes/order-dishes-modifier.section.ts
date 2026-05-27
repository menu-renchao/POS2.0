import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import type { ModifierPriceSelection } from './order-dishes.types';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';

export class OrderDishesModifierSection {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
    private readonly selectOrderedDish: (dishName: string) => Promise<void>,
  ) {}

  private get page() {
    return this.ctx.page;
  }

  private get locators(): OrderDishesLocators {
    return this.ctx.locators;
  }

    @step((dishName: string) => `页面操作：选中已点菜品 ${dishName} 并打开 Modify 面板`)
    async openModifyForOrderedDish(dishName: string): Promise<void> {
      await this.selectOrderedDish(dishName);
      await (await this.resolveModifyButton()).click();
      await this.expectModifyPanelVisible();
    }

    @step('页面操作：确认 Modify 面板可见')
    async expectModifyPanelVisible(): Promise<void> {
      await expect(this.locators.modifyPanel).toBeVisible();
    }

    @step('页面操作：点击 Modify 面板返回按钮关闭调味页面')
    async closeModifyPanel(): Promise<void> {
      if (!(await this.locators.modifyPanel.isVisible().catch(() => false))) {
        return;
      }

      await this.locators.modifyBackButton.click();
      await expect(this.locators.modifyPanel).toBeHidden();
    }

    @step((action: string) => `页面操作：选择调味动作 ${action}`)
    async selectModifyAction(action: string): Promise<void> {
      await this.expectModifyPanelVisible();
      await (await this.resolveModifySectionButton('Actions', action)).click();
    }

    @step((category: string) => `页面操作：选择调味分类 ${category}`)
    async selectModifyCategory(category: string): Promise<void> {
      await this.expectModifyPanelVisible();
      await (await this.resolveModifySectionButton('Category', category)).click();
    }

    @step((option: string) => `页面操作：选择系统预置调味 ${option}`)
    async selectModifyOption(option: string): Promise<void> {
      await this.expectModifyPanelVisible();
      await (await this.resolveModifyOptionButton(option)).click();
    }

    @step((price: ModifierPriceSelection) => `页面操作：选择调味价格 ${price.kind === 'preset' ? price.value : `自定义 ${price.value}`}`)
    async selectModifyPrice(price: ModifierPriceSelection): Promise<void> {
      await this.expectModifyPanelVisible();

      if (price.kind === 'preset') {
        await (await this.resolveModifySectionButton('Price', price.value)).click();
        return;
      }

      await (await this.resolveModifySectionButton('Price', 'Custom')).click();
      const customPriceInput = await this.resolveModifyCustomPriceInput();
      await customPriceInput.fill(this.formatModifierPriceInput(price.value));
      await waitForInputSettled(customPriceInput);
      await customPriceInput.press('Enter').catch(() => {});
      await customPriceInput.blur().catch(() => {});
    }

    @step((name: string, price: number | string = 0) => `页面操作：添加自定义调味 ${name}，价格 ${price}`)
    async addCustomModifier(name: string, price: number | string = 0): Promise<void> {
      await this.expectModifyPanelVisible();
      await this.locators.customModifierNameInput.fill(name);
      await this.locators.customModifierPriceInput.fill(this.formatModifierPriceInput(price));
      await waitForInputSettled(this.locators.customModifierPriceInput);
      await this.locators.customModifierAddButton.click();
    }

    private async resolveModifyButton(): Promise<Locator> {
      const candidates = [this.locators.modifyButton];

      const directModifyButton = await this.ctx.findVisibleLocator(candidates);
      if (directModifyButton) {
        return directModifyButton;
      }

      if (await this.locators.moreActionButton.isVisible().catch(() => false)) {
        await this.locators.moreActionButton.click();
        const modifyButtonAfterMore = await this.ctx.findVisibleLocator(candidates);

        if (modifyButtonAfterMore) {
          return modifyButtonAfterMore;
        }
      }

      throw new Error('Unable to find the Modify button for the selected ordered dish.');
    }

    private resolveModifySection(sectionName: string): Locator {
      const escapedSectionName = this.ctx.escapeRegExp(sectionName);

      return this.locators.modifyPanel
        .locator('[class*="_section_"], [class*="_optionsSection_"]')
        .filter({
          hasText: new RegExp(`(^|\\s)${escapedSectionName}(\\s|$)`),
        })
        .first();
    }

    private async resolveModifySectionButton(
      sectionName: string,
      buttonName: string,
    ): Promise<Locator> {
      const section = this.resolveModifySection(sectionName);
      const escapedButtonName = this.ctx.escapeRegExp(buttonName);
      const fallbackSectionLocators: Locator[] = [];

      if (sectionName === 'Actions') {
        fallbackSectionLocators.push(
          this.locators.modifyPanel.locator('[class*="_actionsGrid_"], [class*="_actionGrid_"]'),
        );
      }

      if (sectionName === 'Category') {
        fallbackSectionLocators.push(
          this.locators.modifyPanel.locator('[class*="_categoryGrid_"], [class*="_categoryOptions_"]'),
        );
      }

      if (sectionName === 'Option') {
        fallbackSectionLocators.push(
          this.locators.modifyPanel.locator('[class*="_optionsGrid_"], [class*="_optionGrid_"]'),
        );
      }

      if (sectionName === 'Price') {
        fallbackSectionLocators.push(
          this.locators.modifyPanel.locator('[class*="_priceGrid_"], [class*="_priceSection_"]'),
        );
      }

      return await this.ctx.resolveVisibleLocator(
        [
          section.getByRole('button', { name: buttonName, exact: true }).first(),
          section
            .locator('button')
            .filter({
              hasText: new RegExp(`^\\s*${escapedButtonName}\\s*$`),
            })
            .first(),
          ...fallbackSectionLocators.map((locator) =>
            locator
              .getByRole('button', { name: buttonName, exact: true })
              .first(),
          ),
          ...fallbackSectionLocators.map((locator) =>
            locator
              .locator('button')
              .filter({ hasText: new RegExp(`^\\s*${escapedButtonName}\\s*$`) })
              .first(),
          ),
        ],
        `Unable to find Modify ${sectionName} button: ${buttonName}.`,
      );
    }

    private async resolveModifyOptionButton(optionName: string): Promise<Locator> {
      const optionSection = this.resolveModifySection('Option');
      const escapedOptionName = this.ctx.escapeRegExp(optionName);
      const optionNamePattern = new RegExp(`^\\s*${escapedOptionName}\\s*(?:\\$[\\d,.]+)?\\s*$`);

      return await this.ctx.resolveVisibleLocator(
        [
          optionSection.getByRole('button', { name: optionNamePattern }).first(),
          optionSection
            .locator('[data-testid^="modifier-option-"], [data-test-id^="modifier-option-"]')
            .filter({ hasText: optionNamePattern })
            .first(),
          optionSection
            .locator('[class*="_optionCard_"]')
            .filter({ hasText: optionNamePattern })
            .first(),
        ],
        `Unable to find Modify option button: ${optionName}.`,
      );
    }

    private async resolveModifyCustomPriceInput(): Promise<Locator> {
      const priceSection = this.resolveModifySection('Price');

      return await this.ctx.resolveVisibleLocator(
        [
          priceSection
            .locator(
              '[data-testid="modifier-custom-price-input"], [data-test-id="modifier-custom-price-input"]',
            )
            .first(),
          priceSection.locator('input').first(),
          this.locators.appFrame
            .locator(
              '[data-testid="modifier-custom-price-input"], [data-test-id="modifier-custom-price-input"]',
            )
            .first(),
        ],
        'Unable to find Modify custom price input after selecting Custom price.',
      );
    }

    private formatModifierPriceInput(price: number | string): string {
      const rawText = String(price).trim().replace(/^\$/, '');
      const numericValue = Number(rawText);

      if (Number.isFinite(numericValue)) {
        return numericValue.toFixed(2);
      }

      return rawText;
    }
}

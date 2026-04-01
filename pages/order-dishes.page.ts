import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../utils/step';
import { HomePage } from './home.page';

export class OrderDishesPage {
  private readonly appFrame: ReturnType<Page['frameLocator']>;
  private readonly backButton: Locator;
  private readonly sendButton: Locator;
  private readonly payButton: Locator;
  private readonly countButton: Locator;
  private readonly firstAvailableDishButton: Locator;
  private readonly countDialog: Locator;
  private readonly countDialogInput: Locator;
  private readonly countDialogConfirmButton: Locator;
  private readonly weightDialog: Locator;
  private readonly weightInput: Locator;
  private readonly weightConfirmButton: Locator;
  private readonly priceDialog: Locator;
  private readonly priceInput: Locator;
  private readonly priceConfirmButton: Locator;
  private readonly specificationDialog: Locator;
  private readonly specificationConfirmButton: Locator;
  private readonly comboDialog: Locator;
  private readonly comboConfirmButton: Locator;
  private readonly cartButton: Locator;
  private readonly cartBadge: Locator;
  private readonly saveOrderButton: Locator;

  constructor(private readonly page: Page) {
    this.appFrame = this.page.frameLocator('iframe[data-wujie-id="orderDishes"]');
    this.backButton = this.appFrame.getByRole('button', { name: 'Back' });
    this.sendButton = this.appFrame.getByRole('button', { name: 'Send' });
    this.payButton = this.appFrame.getByRole('button', { name: 'Pay' });
    this.countButton = this.appFrame.getByRole('button', { name: /^(Count|数量)$/ });
    this.firstAvailableDishButton = this.appFrame.locator(
      'button:not([name*="Back"]):not([name*="Cart"]):not([name*="Send"]):not([name*="Pay"])',
    ).first();
    this.countDialog = this.appFrame.locator(
      '[data-testid="dish-count-modal"], [data-testid="option-count-modal"]',
    );
    this.countDialogInput = this.countDialog.locator('input').first();
    this.countDialogConfirmButton = this.countDialog.getByRole('button', {
      name: /^(Confirm|确认)$/,
    });
    this.weightDialog = this.appFrame.getByRole('dialog', { name: 'Enter Weight' });
    this.weightInput = this.weightDialog.getByRole('textbox', { name: 'Weight' });
    this.weightConfirmButton = this.weightDialog.getByRole('button', { name: 'Confirm' });
    this.priceDialog = this.appFrame.getByRole('dialog', { name: 'Enter Price' });
    this.priceInput = this.priceDialog.getByRole('textbox', { name: 'Price' });
    this.priceConfirmButton = this.priceDialog.getByRole('button', { name: 'Confirm' });
    this.specificationDialog = this.appFrame.getByRole('dialog', {
      name: 'Select Specifications',
    });
    this.specificationConfirmButton = this.specificationDialog.getByRole('button', {
      name: 'Confirm',
    });
    this.comboDialog = this.appFrame.locator('aside[class*="_panel_"]').filter({
      has: this.appFrame.getByRole('button', { name: 'Cancel', exact: true }),
    }).first();
    this.comboConfirmButton = this.comboDialog.locator('button', {
      hasText: /^(Confirm|确认)$/,
    }).first();
    this.cartButton = this.appFrame.getByRole('button', { name: 'Cart' });
    this.cartBadge = this.appFrame.locator('[data-testid="cart-badge"]');
    this.saveOrderButton = this.appFrame.locator('[data-testid="bottom-button-saveOrderBtn"]');
  }

  @step('页面操作：确认点餐页已加载')
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/#orderDishes/);
    await expect(this.backButton).toBeVisible();
    await expect(this.sendButton).toBeVisible();
    await expect(this.payButton).toBeVisible();
  }

  @step((tableNumber: string) => `页面操作：确认点餐页顶部桌号为 ${tableNumber}`)
  async expectTableNumber(tableNumber: string): Promise<void> {
    await expect(this.resolveTableNumberButton(tableNumber)).toBeVisible();
  }

  @step((guestCount: number) => `页面操作：确认点餐页顶部人数为 ${guestCount}`)
  async expectGuestCount(guestCount: number): Promise<void> {
    await expect(this.resolveGuestCountButton(guestCount)).toBeVisible();
  }

  @step((dishName: string) => `页面操作：点击菜品 ${dishName}`)
  async clickDish(dishName: string): Promise<void> {
    await this.expectLoaded();
    await this.resolveDishButton(dishName).click();
  }

  @step((quantity: number) => `页面操作：通过 Count 按钮将待点菜数量修改为 ${quantity}`)
  async changeDishCount(quantity: number): Promise<void> {
    await this.expectLoaded();
    await this.countButton.click();
    await expect(this.countDialog).toBeVisible();

    if (await this.countDialogInput.isVisible().catch(() => false)) {
      await this.countDialogInput.fill(String(quantity)).catch(async () => {
        await this.countDialogInput.evaluate((inputElement, nextValue) => {
          const input = inputElement as HTMLInputElement;
          input.value = String(nextValue);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, String(quantity));
      });
    } else {
      for (const digit of String(quantity)) {
        await this.resolveCountDialogNumberButton(digit).click();
      }
    }

    await this.countDialogConfirmButton.click();
    await expect(this.countDialog).toBeHidden();
  }

  @step('页面操作：点击第一个可用菜品')
  async clickFirstAvailableDish(): Promise<void> {
    await this.expectLoaded();
    await this.firstAvailableDishButton.click();
  }

  @step('页面操作：确认重量输入弹窗可见')
  async expectWeightDialogVisible(): Promise<void> {
    await expect(this.weightDialog).toBeVisible();
  }

  @step((weight: number) => `页面操作：输入重量 ${weight}`)
  async enterWeight(weight: number): Promise<void> {
    await this.expectWeightDialogVisible();
    await this.weightInput.fill(String(weight));
  }

  @step('页面操作：确认重量输入')
  async confirmWeightDialog(): Promise<void> {
    await this.expectWeightDialogVisible();
    await this.weightConfirmButton.click();
  }

  @step('页面操作：确认价格输入弹窗可见')
  async expectPriceDialogVisible(): Promise<void> {
    await expect(this.priceDialog).toBeVisible();
  }

  @step((price: number) => `页面操作：输入价格 ${price}`)
  async enterPrice(price: number): Promise<void> {
    await this.expectPriceDialogVisible();
    await this.priceInput.fill(String(price));
  }

  @step('页面操作：确认价格输入')
  async confirmPriceDialog(): Promise<void> {
    await this.expectPriceDialogVisible();
    await this.priceConfirmButton.click();
  }

  @step('页面操作：确认规格选择弹窗可见')
  async expectSpecificationDialogVisible(): Promise<void> {
    await expect(this.specificationDialog).toBeVisible();
  }

  @step('页面操作：检查规格选择弹窗是否可见')
  async isSpecificationDialogVisible(): Promise<boolean> {
    return await this.specificationDialog.isVisible();
  }

  @step((spec: string) => `页面操作：选择规格 ${spec}`)
  async selectSpecification(spec: string): Promise<void> {
    await this.expectSpecificationDialogVisible();
    await this.resolveSpecificationButton(spec).click();
  }

  @step('页面操作：确认规格选择')
  async confirmSpecificationDialog(): Promise<void> {
    await this.expectSpecificationDialogVisible();
    await this.specificationConfirmButton.click();
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

    await this.resolveComboSectionItemButton(sectionName, dishName).click();

    for (let currentQuantity = 1; currentQuantity < quantity; currentQuantity += 1) {
      await this.resolveComboSectionItemPlusButton(sectionName, dishName).click();
    }
  }

  @step('页面操作：确认套餐选择')
  async confirmComboDialog(): Promise<void> {
    await this.comboConfirmButton.click();
  }

  @step('页面操作：确认购物车中有菜品')
  async expectCartHasItems(): Promise<void> {
    await expect(this.cartButton).toBeVisible();

    if (await this.cartBadge.isVisible()) {
      const count = await this.cartBadge.textContent();
      expect(Number(count)).toBeGreaterThan(0);
    }
  }

  @step('页面操作：保存订单')
  async saveOrder(): Promise<HomePage> {
    await this.saveOrderButton.click();
    return new HomePage(this.page);
  }

  private resolveTableNumberButton(tableNumber: string): Locator {
    return this.appFrame.getByRole('button', {
      name: new RegExp(`TableIcon\\s*${tableNumber}`),
    });
  }

  private resolveGuestCountButton(guestCount: number): Locator {
    return this.appFrame.getByRole('button', {
      name: new RegExp(`SeatIcon\\s*${guestCount}`),
    });
  }

  private resolveDishButton(dishName: string): Locator {
    return this.appFrame.getByRole('button', { name: dishName, exact: true });
  }

  private resolveCountDialogNumberButton(digit: string): Locator {
    return this.countDialog.getByRole('button', { name: digit, exact: true });
  }

  private resolveSpecificationButton(spec: string): Locator {
    return this.specificationDialog.getByRole('button', { name: spec, exact: true });
  }

  private resolveComboSection(sectionName: string): Locator {
    return this.comboDialog
      .locator('div[class*="_sectionName_"]')
      .filter({
        hasText: new RegExp(`^${this.escapeRegExp(sectionName)}$`),
      })
      .first()
      .locator('xpath=ancestor::section[1]');
  }

  private resolveComboSectionItemCardShell(sectionName: string, dishName: string): Locator {
    return this.resolveComboSection(sectionName)
      .locator('span[class*="_itemTitle_"]', {
        hasText: new RegExp(`^${this.escapeRegExp(dishName)}$`),
      })
      .locator('xpath=ancestor::div[contains(@class,"_cardShell_")][1]');
  }

  private resolveComboSectionItemButton(sectionName: string, dishName: string): Locator {
    return this.resolveComboSectionItemCardShell(sectionName, dishName)
      .locator('xpath=.//button[not(contains(@class, "_counterBtn_"))][1]');
  }

  private resolveComboSectionItemPlusButton(sectionName: string, dishName: string): Locator {
    return this.resolveComboSectionItemCardShell(sectionName, dishName)
      .locator('button[class*="_counterBtnPlus_"]')
      .first();
  }

  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

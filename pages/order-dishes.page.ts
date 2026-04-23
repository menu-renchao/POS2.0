import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { HomePage } from './home.page';
import type { RecallPage } from './recall.page';
import { SplitOrderPage } from './split-order.page';

export type OrderedDishItem = {
  additions: OrderedDishItemAddition[];
  quantity: string;
  name: string;
  price: string | null;
};

export type OrderedDishItemAddition = {
  name: string;
  price?: string;
  subAdditions?: OrderedDishItemAddition[];
};

export type OrderPriceSummary = {
  Count: number;
  Subtotal: number;
  Tax: number;
  'Total Before Tips': number;
  'Total(Cash)': number;
  'Total(Card)': number;
};

export type OrderDishesSnapshot = {
  items: OrderedDishItem[];
  priceSummary: OrderPriceSummary;
};

export type ChargeScope = 'whole' | 'item';

export type ChargeCustomType = 'percentage' | 'fixed';

export type ModifierPriceSelection =
  | {
      kind: 'preset';
      value: string;
    }
  | {
      kind: 'custom';
      value: number | string;
    };

export type WholeOrderChargeInfo = {
  amountText: string | null;
  name: string;
};

export type ItemChargeInfo = {
  dishName: string;
  optionName: string | null;
};

export type OrderChargeSnapshot = {
  itemCharges: ItemChargeInfo[];
  scope: ChargeScope;
  selectedDishNames: string[];
  wholeOrderCharges: WholeOrderChargeInfo[];
};

type ChargeOptionDraft = {
  kind: ChargeCustomType;
  name: string;
  taxed?: boolean;
  value?: number | null;
};

type ChargeState = {
  itemCharges: Record<string, ChargeOptionDraft>;
  scope: ChargeScope;
  selectedDishNames: string[];
  wholeOrderCharges: ChargeOptionDraft[];
};

const CHARGE_BUTTON_NAMES = /^(Charge|加费)$/;
const CHARGE_DIALOG_TEXT =
  /Whole Order Charge|Item Charge|Charge Options|整单加费|菜品加费|加费选项/;
const CUSTOM_CHARGE_DIALOG_TEXT = /Custom Charge|自定义加费/;
const WHOLE_ORDER_BUTTON_NAMES = /^(Whole Order Charge|Whole Order|整单加费|整单加收)$/;
const ITEM_CHARGE_BUTTON_NAMES = /^(Item Charge|Item Discount|菜品加费|菜品加收)$/;
const CLEAR_SELECTED_BUTTON_NAMES = /^(Clear Selected|清除已选|清空已选)$/;
const CLEAR_ALL_BUTTON_NAMES = /^(Clear All|清除全部|清空全部)$/;
const CANCEL_BUTTON_NAMES = /^(Cancel|取消)$/;
const CONFIRM_BUTTON_NAMES = /^(Confirm|确认)$/;
const CUSTOM_PERCENTAGE_BUTTON_NAMES = /^(Percentage|%)$/;
const CUSTOM_FIXED_BUTTON_NAMES = /^(Fixed Amount|\$)$/;
const CUSTOM_TAXED_LABELS = /^(Taxed|含税)$/;

export class OrderDishesPage {
  private readonly appFrame: ReturnType<Page['frameLocator']>;
  private readonly backButton: Locator;
  private readonly headerRecallButton: Locator;
  private readonly sendButton: Locator;
  private readonly payButton: Locator;
  private readonly selectedDishAddButton: Locator;
  private readonly countButton: Locator;
  private readonly firstAvailableDishButton: Locator;
  private readonly menuGroupCards: Locator;
  private readonly menuCategoryCards: Locator;
  private readonly countDialog: Locator;
  private readonly countDialogInput: Locator;
  private readonly countDialogConfirmButton: Locator;
  private readonly weightDialog: Locator;
  private readonly weightDialogLoadingText: Locator;
  private readonly weightInput: Locator;
  private readonly weightConfirmButton: Locator;
  private readonly priceDialog: Locator;
  private readonly priceInput: Locator;
  private readonly priceConfirmButton: Locator;
  private readonly specificationDialog: Locator;
  private readonly specificationConfirmButton: Locator;
  private readonly categoryOptionPanel: Locator;
  private readonly categoryOptionGrid: Locator;
  private readonly categoryOptionSubGrid: Locator;
  private readonly comboDialog: Locator;
  private readonly comboConfirmButton: Locator;
  private readonly cartBadge: Locator;
  private readonly priceSummaryToggle: Locator;
  private readonly priceSummaryDetailsContainer: Locator;
  private readonly priceSummaryTotalContainer: Locator;
  private readonly saveOrderButton: Locator;
  private readonly moreActionButton: Locator;
  private readonly splitButton: Locator;
  private readonly modifyButton: Locator;
  private readonly modifyPanel: Locator;
  private readonly modifyBackButton: Locator;
  private readonly customModifierNameInput: Locator;
  private readonly customModifierPriceInput: Locator;
  private readonly customModifierAddButton: Locator;
  private readonly chargeButton: Locator;
  private readonly chargeDialog: Locator;
  private readonly customChargeDialog: Locator;
  private readonly clearAllChargesButton: Locator;
  private readonly confirmChargeButton: Locator;
  private readonly cancelChargeButton: Locator;
  private readonly clearSelectedChargeButton: Locator;
  private readonly customChargeConfirmButton: Locator;
  private readonly customChargeCancelButton: Locator;
  private readonly customChargeValueInput: Locator;
  private persistedChargeState: ChargeState = this.createEmptyChargeState();
  private draftChargeState: ChargeState | null = null;
  private customChargeDraft: {
    taxed: boolean;
    type: ChargeCustomType;
    value: number | null;
  } = {
    taxed: false,
    type: 'percentage',
    value: null,
  };

  constructor(private readonly page: Page) {
    this.appFrame = this.page.frameLocator('iframe[data-wujie-id="orderDishes"]');
    this.backButton = this.appFrame.getByRole('button', { name: 'Back' });
    this.headerRecallButton = this.appFrame.getByRole('button', { name: /Recall/ }).first();
    this.sendButton = this.appFrame
      .locator(
        '[data-testid="bottom-button-sendOrderBtn"], [data-test-id="bottom-button-sendOrderBtn"]',
      )
      .or(this.appFrame.getByRole('button', { name: 'Send' }))
      .first();
    this.payButton = this.appFrame.getByRole('button', { name: 'Pay' });
    this.selectedDishAddButton = this.appFrame
      .locator('[data-testid="action-rail-button-add1"], [data-test-id="action-rail-button-add1"]')
      .or(
        this.appFrame
          .locator('aside, [role="complementary"]')
          .getByRole('button', { name: /^(Add|加)$/ }),
      )
      .first();
    this.countButton = this.appFrame.getByRole('button', { name: /^(Count|数量)$/ });
    this.firstAvailableDishButton = this.appFrame.locator(
      'button:not([name*="Back"]):not([name*="Cart"]):not([name*="Send"]):not([name*="Pay"])',
    ).first();
    this.menuGroupCards = this.appFrame.locator(
      '[data-testid^="menu-group-card-"], [data-test-id^="menu-group-card-"]',
    );
    this.menuCategoryCards = this.appFrame.locator(
      '[data-testid^="menu-category-card-"], [data-test-id^="menu-category-card-"]',
    );
    this.countDialog = this.appFrame.locator(
      '[data-testid="dish-count-modal"], [data-testid="option-count-modal"]',
    );
    this.countDialogInput = this.countDialog.locator('input').first();
    this.countDialogConfirmButton = this.countDialog.getByRole('button', {
      name: /^(Confirm|确认)$/,
    });
    this.weightDialog = this.appFrame.getByRole('dialog').filter({
      has: this.appFrame.getByText('Weight', { exact: true }),
    }).first();
    this.weightDialogLoadingText = this.weightDialog.getByText('Loading', { exact: true });
    this.weightInput = this.weightDialog.locator('input').first();
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
    this.categoryOptionPanel = this.appFrame
      .locator('[data-testid="item-option-panel-collapse-button"]')
      .locator('xpath=ancestor::div[contains(@class,"_dock_")][1]');
    this.categoryOptionGrid = this.categoryOptionPanel.locator('[class*="_grid_"]').first();
    this.categoryOptionSubGrid = this.categoryOptionPanel.locator('[class*="_subGrid_"]').first();
    this.comboDialog = this.appFrame.locator('aside[class*="_panel_"]').filter({
      has: this.appFrame.getByRole('button', { name: 'Cancel', exact: true }),
    }).first();
    this.comboConfirmButton = this.comboDialog.locator('button', {
      hasText: /^(Confirm|确认)$/,
    }).first();
    this.cartBadge = this.appFrame.locator('[data-testid="cart-badge"]');
    this.priceSummaryToggle = this.appFrame
      .locator(
        '[data-test-id="shared-order-price-summary-toggle"], [data-testid="shared-order-price-summary-toggle"]',
      )
      .or(this.appFrame.getByRole('button', { name: /Total\(Cash\).*Total\(Card\)/ }))
      .first();
    this.priceSummaryDetailsContainer = this.priceSummaryToggle.locator('xpath=following-sibling::*[1]');
    this.priceSummaryTotalContainer = this.priceSummaryToggle.locator('xpath=following-sibling::*[2]');
    this.saveOrderButton = this.appFrame.locator('[data-testid="bottom-button-saveOrderBtn"]');
    this.moreActionButton = this.appFrame.getByRole('button', {
      name: /^(More|更多)$/,
    }).first();
    this.splitButton = this.appFrame.getByRole('button', {
      name: /^Split$/,
    }).first();
    this.modifyButton = this.appFrame
      .locator(
        '[data-testid="action-rail-button-modify"], [data-test-id="action-rail-button-modify"], [data-testid="modify-button"], [data-test-id="modify-button"]',
      )
      .or(this.appFrame.getByRole('button', { name: /^(Modify|修改)$/ }))
      .first();
    this.modifyPanel = this.appFrame
      .locator(
        '[data-testid="modify-panel"], [data-test-id="modify-panel"], [class*="_panel_"]',
      )
      .filter({
        has: this.appFrame.getByText(/^(Modify|修改)$/),
      })
      .first();
    this.modifyBackButton = this.modifyPanel
      .locator('[aria-label="onLeftIcon"], [aria-label="Back"], [aria-label="返回"]')
      .first();
    this.customModifierNameInput = this.modifyPanel
      .getByPlaceholder(/^(Enter custom modifier|输入自定义调味)$/)
      .first();
    this.customModifierPriceInput = this.modifyPanel
      .getByPlaceholder(/^(0\.00)$/)
      .first();
    this.customModifierAddButton = this.modifyPanel
      .locator('[class*="_bodyFirstRow_"]')
      .getByRole('button', { name: /^(Add|添加)$/ })
      .first();
    this.chargeButton = this.appFrame.getByRole('button', {
      name: CHARGE_BUTTON_NAMES,
    }).first();
    this.chargeDialog = this.appFrame
      .locator('[data-testid="charge-dialog"], [data-test-id="charge-dialog"], [role="dialog"]')
      .filter({
        has: this.appFrame.getByText(CHARGE_DIALOG_TEXT),
      })
      .first();
    this.customChargeDialog = this.appFrame
      .locator(
        '[data-testid="custom-charge-dialog"], [data-test-id="custom-charge-dialog"], [role="dialog"]',
      )
      .filter({
        has: this.appFrame.getByRole('checkbox', { name: CUSTOM_TAXED_LABELS }).first(),
      })
      .first();
    this.clearAllChargesButton = this.chargeDialog.getByRole('button', {
      name: CLEAR_ALL_BUTTON_NAMES,
    }).first();
    this.confirmChargeButton = this.chargeDialog.getByRole('button', {
      name: CONFIRM_BUTTON_NAMES,
    }).first();
    this.cancelChargeButton = this.chargeDialog.getByRole('button', {
      name: CANCEL_BUTTON_NAMES,
    }).first();
    this.clearSelectedChargeButton = this.chargeDialog.getByRole('button', {
      name: CLEAR_SELECTED_BUTTON_NAMES,
    }).first();
    this.customChargeConfirmButton = this.customChargeDialog.getByRole('button', {
      name: CONFIRM_BUTTON_NAMES,
    }).first();
    this.customChargeCancelButton = this.customChargeDialog.getByRole('button', {
      name: CANCEL_BUTTON_NAMES,
    }).first();
    this.customChargeValueInput = this.customChargeDialog
      .locator('input[type="text"], input')
      .first();
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

  @step((groupName: string) => `页面操作：切换菜单组 ${groupName}`)
  async switchMenuGroup(groupName: string): Promise<void> {
    await this.expectLoaded();
    await (await this.resolveMenuGroupCard(groupName)).click();
  }

  @step((categoryName: string) => `页面操作：切换菜单类别 ${categoryName}`)
  async switchMenuCategory(categoryName: string): Promise<void> {
    await this.expectLoaded();
    await (await this.resolveMenuCategoryCard(categoryName)).click();
  }

  @step((groupName: string, categoryName: string) => `页面操作：切换菜单组 ${groupName} 和类别 ${categoryName}`)
  async switchMenu(groupName: string, categoryName: string): Promise<void> {
    await this.switchMenuGroup(groupName);
    await this.switchMenuCategory(categoryName);
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

  @step((dishName: string) => `页面操作：选中已下单菜品 ${dishName}`)
  async selectOrderedDish(dishName: string): Promise<void> {
    await this.expectLoaded();
    await this.resolveOrderedDishButton(dishName).click();
  }

  @step('页面操作：点击已选菜品的加 1 按钮')
  async clickSelectedDishAdd(): Promise<void> {
    await this.expectLoaded();
    await expect(this.selectedDishAddButton).toBeVisible({ timeout: 10_000 });
    await this.selectedDishAddButton.click();
  }

  @step((dishName: string) => `页面操作：选中已下单菜品 ${dishName} 并点击加 1`)
  async increaseOrderedDishQuantityByOne(dishName: string): Promise<void> {
    await this.selectOrderedDish(dishName);
    await this.clickSelectedDishAdd();
  }

  @step((dishName: string) => `页面操作：选中已点菜品 ${dishName} 并打开 Modify 面板`)
  async openModifyForOrderedDish(dishName: string): Promise<void> {
    await this.selectOrderedDish(dishName);
    await (await this.resolveModifyButton()).click();
    await this.expectModifyPanelVisible();
  }

  @step('页面操作：确认 Modify 面板可见')
  async expectModifyPanelVisible(): Promise<void> {
    await expect(this.modifyPanel).toBeVisible();
  }

  @step('页面操作：点击 Modify 面板返回按钮关闭调味页面')
  async closeModifyPanel(): Promise<void> {
    if (!(await this.modifyPanel.isVisible().catch(() => false))) {
      return;
    }

    await this.modifyBackButton.click();
    await expect(this.modifyPanel).toBeHidden();
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
    await customPriceInput.press('Enter').catch(() => {});
    await customPriceInput.blur().catch(() => {});
  }

  @step((name: string, price: number | string = 0) => `页面操作：添加自定义调味 ${name}，价格 ${price}`)
  async addCustomModifier(name: string, price: number | string = 0): Promise<void> {
    await this.expectModifyPanelVisible();
    await this.customModifierNameInput.fill(name);
    await this.customModifierPriceInput.fill(this.formatModifierPriceInput(price));
    await this.customModifierAddButton.click();
  }

  @step('页面操作：确认重量输入弹窗可见')
  async expectWeightDialogVisible(): Promise<void> {
    await expect(this.weightDialog).toBeVisible({ timeout: 10_000 });
    await this.waitUntilWeightDialogReady();
  }

  @step((weight: number) => `页面操作：输入重量 ${weight}`)
  async enterWeight(weight: number): Promise<void> {
    await this.expectWeightDialogVisible();

    if (await this.weightInput.isVisible().catch(() => false)) {
      await this.weightInput.fill(String(weight));
      return;
    }

    for (const digit of String(weight)) {
      await this.weightDialog.getByRole('button', { name: digit, exact: true }).click();
    }
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

  @step('页面操作：确认分类 option 面板可见')
  async expectCategoryOptionPanelVisible(): Promise<void> {
    await expect(this.categoryOptionPanel).toBeVisible();
  }

  @step('页面操作：检查分类 option 面板是否可见')
  async isCategoryOptionPanelVisible(): Promise<boolean> {
    return await this.categoryOptionPanel.isVisible().catch(() => false);
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
      await expect(this.categoryOptionSubGrid).toBeVisible({ timeout: 10_000 });
      await (await this.resolveCategorySubOptionButton(suboption)).click();
    }
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

    await this.activateComboSection(sectionName);
    await (await this.resolveComboSectionItemButton(sectionName, dishName)).click();

    for (let currentQuantity = 1; currentQuantity < quantity; currentQuantity += 1) {
      await (await this.resolveComboSectionItemPlusButton(sectionName, dishName)).click();
    }
  }

  @step('页面操作：确认套餐选择')
  async confirmComboDialog(): Promise<void> {
    await this.comboConfirmButton.click();
  }

  @step('页面操作：点击 Charge 并打开加收弹窗')
  async clickCharge(): Promise<void> {
    await this.expectLoaded();
    this.openChargeDraft();
    await (await this.resolveChargeButton()).click();
    await this.expectChargeDialogVisible();
  }

  @step('页面操作：确认加收弹窗可见')
  async expectChargeDialogVisible(): Promise<void> {
    await expect(this.chargeDialog).toBeVisible();
  }

  @step('页面操作：检查加收弹窗是否可见')
  async isChargeDialogVisible(): Promise<boolean> {
    return await this.chargeDialog.isVisible().catch(() => false);
  }

  @step((scope: ChargeScope) => `页面操作：切换加收模式为 ${scope === 'whole' ? '整单加收' : '菜品加收'}`)
  async switchChargeScope(scope: ChargeScope): Promise<void> {
    await this.expectChargeDialogVisible();
    await (await this.resolveChargeScopeLocator(scope)).click();
    this.ensureChargeDraft().scope = scope;
    this.ensureChargeDraft().selectedDishNames = [];
  }

  @step((dishName: string) => `页面操作：在加收弹窗中切换菜品 ${dishName}`)
  async toggleChargeDish(dishName: string): Promise<void> {
    await this.expectChargeDialogVisible();
    const dishLocator = await this.resolveChargeDishLocator(dishName);
    await dishLocator.click();

    const draft = this.ensureChargeDraft();
    if (draft.selectedDishNames.includes(dishName)) {
      draft.selectedDishNames = draft.selectedDishNames.filter(
        (currentDishName) => currentDishName !== dishName,
      );
      return;
    }

    draft.selectedDishNames = [...draft.selectedDishNames, dishName];
  }

  @step((optionName: string) => `页面操作：在加收弹窗中切换预置加收项 ${optionName}`)
  async toggleChargeOption(optionName: string): Promise<void> {
    await this.expectChargeDialogVisible();
    const optionLocator = await this.resolveChargeOptionLocator(optionName);
    await optionLocator.click();
    this.applyDraftChargeOption({
      kind: 'fixed',
      name: optionName,
    });
  }

  @step('页面操作：点击 Custom Charge')
  async clickCustomCharge(): Promise<void> {
    await this.expectChargeDialogVisible();
    const customChargeButton = await this.resolveCustomChargeButton();
    await customChargeButton.click();
    await expect(this.customChargeDialog).toBeVisible();
  }

  @step((type: ChargeCustomType) => `页面操作：切换自定义加收类型为 ${type === 'percentage' ? '百分比' : '固定金额'}`)
  async selectCustomChargeType(type: ChargeCustomType): Promise<void> {
    await expect(this.customChargeDialog).toBeVisible();
    await (await this.resolveCustomChargeTypeLocator(type)).click();
    this.customChargeDraft.type = type;
  }

  @step((value: number) => `页面操作：输入自定义加收值 ${value}`)
  async fillCustomChargeValue(value: number): Promise<void> {
    await expect(this.customChargeDialog).toBeVisible();
    const valueText = String(value);

    await this.customChargeValueInput.fill(valueText).catch(async () => {
      await this.customChargeValueInput.evaluate((inputElement, nextValue) => {
        const input = inputElement as HTMLInputElement;
        input.value = String(nextValue);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, valueText);
    });

    const directInputAccepted = await waitUntil(
      async () => {
        const currentValue = await this.customChargeValueInput.inputValue().catch(() => '');
        const confirmEnabled = !(await this.customChargeConfirmButton.isDisabled().catch(() => true));

        return {
          confirmEnabled,
          matches: currentValue === valueText,
        };
      },
      (state) => state.matches && state.confirmEnabled,
      {
        timeout: 1_000,
        message: `Custom charge value ${valueText} was not applied through direct input.`,
      },
    ).catch(() => null);

    if (!directInputAccepted) {
      await this.enterCustomChargeValueByKeypad(value);
    }

    this.customChargeDraft.value = value;
  }

  @step((taxed: boolean) => `页面操作：将自定义加收含税设置为 ${taxed ? '是' : '否'}`)
  async setCustomChargeTaxed(taxed: boolean): Promise<void> {
    await expect(this.customChargeDialog).toBeVisible();
    const taxedLocator = await this.resolveCustomTaxedLocator();

    if (!taxedLocator) {
      this.customChargeDraft.taxed = taxed;
      return;
    }

    const isChecked = await taxedLocator.evaluate((element) => {
      if (element instanceof HTMLInputElement) {
        return element.checked;
      }

      const ariaChecked = element.getAttribute('aria-checked');
      if (ariaChecked === 'true' || ariaChecked === 'false') {
        return ariaChecked === 'true';
      }

      return element.getAttribute('aria-pressed') === 'true';
    });

    if (isChecked !== taxed) {
      await taxedLocator.click();
    }

    this.customChargeDraft.taxed = taxed;
  }

  @step('页面操作：确认自定义加收弹窗')
  async confirmCustomChargeDialog(): Promise<void> {
    await expect(this.customChargeDialog).toBeVisible();
    await this.customChargeConfirmButton.click();
    await expect(this.customChargeDialog).toBeHidden();

    const customValue = this.customChargeDraft.value ?? 0;
    this.applyDraftChargeOption({
      kind: this.customChargeDraft.type,
      name: this.formatCustomChargeName(this.customChargeDraft.type, customValue),
      taxed: this.customChargeDraft.taxed,
      value: customValue,
    });
    this.resetCustomChargeDraft();
  }

  @step('页面操作：关闭自定义加收弹窗')
  async closeCustomChargeDialog(): Promise<void> {
    if (!(await this.customChargeDialog.isVisible().catch(() => false))) {
      return;
    }

    if (await this.customChargeCancelButton.isVisible().catch(() => false)) {
      await this.customChargeCancelButton.click();
      await expect(this.customChargeDialog).toBeHidden();
      this.resetCustomChargeDraft();
      return;
    }

    await this.page.keyboard.press('Escape').catch(() => {});
    if (await this.customChargeDialog.isVisible().catch(() => false)) {
      this.resetCustomChargeDraft();
      return;
    }

    this.resetCustomChargeDraft();
  }

  @step('页面操作：清除当前已选加收')
  async clearSelectedChargeEntries(): Promise<void> {
    await this.expectChargeDialogVisible();
    await this.clearSelectedChargeButton.click();
    this.clearDraftSelectedChargeEntries();
  }

  @step('页面操作：清空全部加收')
  async clearAllCharges(): Promise<void> {
    await this.expectChargeDialogVisible();
    await this.clearAllChargesButton.click();
    this.draftChargeState = this.createEmptyChargeState(this.ensureChargeDraft().scope);
  }

  @step('页面操作：确认加收并关闭弹窗')
  async confirmChargeDialog(): Promise<void> {
    await this.expectChargeDialogVisible();
    await this.confirmChargeButton.click();
    await expect(this.chargeDialog).toBeHidden();
    this.persistedChargeState = this.cloneChargeState(this.ensureChargeDraft());
    this.persistedChargeState.selectedDishNames = [];
    this.draftChargeState = null;
  }

  @step('页面操作：关闭加收弹窗并返回纯净点单页')
  async closeChargeDialog(): Promise<void> {
    if (!(await this.isChargeDialogVisible())) {
      this.draftChargeState = null;
      return;
    }

    if (await this.cancelChargeButton.isVisible().catch(() => false)) {
      await this.cancelChargeButton.click();
      await expect(this.chargeDialog).toBeHidden();
      this.draftChargeState = null;
      return;
    }

    await this.page.keyboard.press('Escape').catch(() => {});
    if (await this.isChargeDialogVisible()) {
      this.draftChargeState = null;
      return;
    }

    this.draftChargeState = null;
  }

  @step('页面读取：读取当前加收快照')
  async readChargeSnapshot(): Promise<OrderChargeSnapshot> {
    await this.expectChargeDialogVisible();
    const activeState = this.getActiveChargeState();

    return {
      itemCharges: this.buildItemChargeSnapshot(activeState),
      scope: await this.readChargeScopeFromDom(activeState.scope),
      selectedDishNames: await this.readSelectedDishNamesFromDom(activeState.selectedDishNames),
      wholeOrderCharges: await this.readWholeOrderChargesFromDom(activeState.wholeOrderCharges),
    };
  }

  @step('页面操作：确认购物车中有菜品')
  async expectCartHasItems(): Promise<void> {
    if (await this.cartBadge.isVisible()) {
      const count = await this.cartBadge.textContent();
      expect(Number(count)).toBeGreaterThan(0);
    }
  }

  @step('页面读取：读取点单页左侧已点菜品明细')
  async readOrderedItems(): Promise<OrderedDishItem[]> {
    await this.expectLoaded();

    const structuredItems = await this.readStructuredOrderedItems();

    if (structuredItems.length > 0) {
      return structuredItems;
    }

    const buttonTexts = await this.appFrame.locator('button, [role="button"]').evaluateAll((buttonLikeElements) =>
      buttonLikeElements
        .map((buttonLikeElement) => (buttonLikeElement as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    );
    const itemsFromButtons = this.parseOrderedItemsFromTexts(buttonTexts);

    if (itemsFromButtons.length > 0) {
      return itemsFromButtons;
    }

    const frameLines = (await this.appFrame.locator('body').innerText())
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return this.parseOrderedItemsFromTexts(frameLines);
  }

  private async readStructuredOrderedItems(): Promise<OrderedDishItem[]> {
    return await this.appFrame.locator('body').evaluate(() => {
      type OrderedDishItemFromDom = {
        additions: Array<{ name: string; price?: string }>;
        name: string;
        price: string | null;
        quantity: string;
      };
      type OrderedDishItemAdditionFromDom = {
        name: string;
        price?: string;
        subAdditions?: OrderedDishItemAdditionFromDom[];
      };

      const cleanText = (value: string | null | undefined): string =>
        value?.replace(/\s+/g, ' ').trim() ?? '';
      const normalizeOptionalText = (value: string | null | undefined): string | null => {
        const normalizedText = cleanText(value);
        return normalizedText.length > 0 ? normalizedText : null;
      };
      const selectText = (root: Element, selector: string): string | null =>
        normalizeOptionalText(root.querySelector(selector)?.textContent);
      const readTexts = (root: Element, selector: string): string[] =>
        Array.from(root.querySelectorAll(selector))
          .map((element) => cleanText(element.textContent))
          .filter(Boolean);
      const dedupeElements = <T extends Element>(elements: T[]): T[] => {
        const seenElements = new Set<T>();

        return elements.filter((element) => {
          if (seenElements.has(element)) {
            return false;
          }

          seenElements.add(element);
          return true;
        });
      };
      const additionSelectors = [
        '[data-testid^="dish-item-subitem-"]',
        '[data-test-id^="dish-item-subitem-"]',
        '[class*="_extraItem_"]',
        '[class*="_optionItemContainer_"]',
      ].join(', ');
      const readDishName = (
        dishElement: Element,
        quantity: string | null,
        price: string | null,
      ): string | null => {
        const explicitDishName = selectText(dishElement, '[class*="_dishName_"]');

        if (explicitDishName) {
          return explicitDishName;
        }

        return (
          readTexts(dishElement, 'span, div')
            .find(
              (text) =>
                text !== quantity &&
                text !== price &&
                !/^\$[\d,.]+$/.test(text) &&
                !/^\d+(?:\.\d+)?$/.test(text),
            ) ?? null
        );
      };
      const isAdditionElement = (element: Element): boolean => element.matches(additionSelectors);
      const parseAdditionElement = (
        additionElement: Element,
        childMap: Map<Element, Element[]>,
      ): OrderedDishItemAdditionFromDom | null => {
        const rawAdditionText = normalizeOptionalText(additionElement.textContent);
        const additionPrice =
          selectText(additionElement, '[class*="_optionPrice_"]') ??
          rawAdditionText?.match(/\$[\d,.]+$/)?.[0] ??
          null;
        const additionName =
          selectText(additionElement, '[class*="_extraText_"]') ??
          selectText(additionElement, '[class*="_optionName_"]') ??
          (rawAdditionText && additionPrice
            ? normalizeOptionalText(
                rawAdditionText.replace(
                  new RegExp(`\\s*${additionPrice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
                  '',
                ),
              )
            : rawAdditionText);

        if (!additionName) {
          return null;
        }

        const subAdditions = (childMap.get(additionElement) ?? [])
          .map((childElement) => parseAdditionElement(childElement, childMap))
          .filter((addition): addition is OrderedDishItemAdditionFromDom => addition !== null);

        return {
          ...(additionPrice ? { price: additionPrice } : {}),
          ...(subAdditions.length > 0 ? { subAdditions } : {}),
          name: additionName,
        };
      };

      return dedupeElements(
        Array.from(
          document.querySelectorAll(
            '[data-testid="pos-ui-dish-item"], [data-test-id="pos-ui-dish-item"], [class*="_dishItem_"]',
          ),
        ),
      ).reduce<OrderedDishItemFromDom[]>((items, dishElement) => {
        const quantity =
          selectText(dishElement, '[class*="_quantity_"]') ??
          readTexts(dishElement, 'span').find((text) => /^\d+(?:\.\d+)?$/.test(text)) ??
          null;
        const price =
          selectText(dishElement, '[class*="_dishPrice_"]') ??
          readTexts(dishElement, 'span').find((text) => /^\$[\d,.]+$/.test(text)) ??
          null;
        const name = readDishName(dishElement, quantity, price);

        if (!quantity || !name) {
          return items;
        }

        const additionElements = dedupeElements(Array.from(dishElement.querySelectorAll(additionSelectors)));
        const additionElementSet = new Set(additionElements);
        const childMap = new Map<Element, Element[]>();
        const topLevelAdditionElements: Element[] = [];

        for (const additionElement of additionElements) {
          let parentAdditionElement: Element | null = null;
          let currentParent = additionElement.parentElement;

          while (currentParent && currentParent !== dishElement) {
            if (additionElementSet.has(currentParent)) {
              parentAdditionElement = currentParent;
              break;
            }

            currentParent = currentParent.parentElement;
          }

          if (parentAdditionElement) {
            const children = childMap.get(parentAdditionElement) ?? [];
            children.push(additionElement);
            childMap.set(parentAdditionElement, children);
            continue;
          }

          topLevelAdditionElements.push(additionElement);
        }

        const additions = topLevelAdditionElements
          .map((additionElement) => parseAdditionElement(additionElement, childMap))
          .filter(
            (addition): addition is OrderedDishItemAdditionFromDom => addition !== null,
          );

        items.push({
          additions,
          name,
          price,
          quantity,
        });

        return items;
      }, []);
    });
  }

  private parseOrderedItemsFromTexts(texts: string[]): OrderedDishItem[] {
    return texts.reduce<OrderedDishItem[]>((items, text) => {
      const matchedItem = text.match(/^(\d+(?:\.\d+)?)\s+(.+?)\s+(?:\d+(?:\.\d+)?\s+sent\s+)?(\$[\d,.]+)$/i);

      if (!matchedItem) {
        return items;
      }

      const [, quantity, name, price] = matchedItem;

      items.push({
        additions: [],
        quantity,
        name,
        price,
      });

      return items;
    }, []);
  }

  @step('页面读取：读取点单页左侧价格汇总')
  async readPriceSummary(): Promise<OrderPriceSummary> {
    await this.expectLoaded();
    await this.expandPriceSummary();
    const summary: Partial<OrderPriceSummary> = {};

    summary.Count = await this.readPriceSummaryRowNumber('Count');
    summary.Subtotal = await this.readPriceSummaryRowNumber('Subtotal');
    summary.Tax = await this.readPriceSummaryRowNumber('Tax');
    summary['Total Before Tips'] = await this.readPriceSummaryRowNumber('Total Before Tips');
    summary['Total(Cash)'] = await this.readPriceSummaryMoneyNumber('Total(Cash)');
    summary['Total(Card)'] = await this.readPriceSummaryMoneyNumber('Total(Card)');

    return summary as OrderPriceSummary;
  }

  @step('页面操作：展开点单页价格汇总')
  async expandPriceSummary(): Promise<void> {
    await this.expectLoaded();

    if (await this.isPriceSummaryExpanded()) {
      return;
    }

    await this.priceSummaryToggle.click({ timeout: 5_000 });
    await waitUntil(
      async () => await this.isPriceSummaryExpanded(),
      (summaryExpanded) => summaryExpanded,
      {
        timeout: 5_000,
        probeTimeout: 1_000,
        message: '点单页价格汇总未在展开后变为展开状态。',
      },
    );
  }

  private async isPriceSummaryExpanded(): Promise<boolean> {
    const expanded = await this.priceSummaryToggle.getAttribute('aria-expanded').catch(() => null);

    if (expanded === 'true') {
      return true;
    }

    if (expanded === 'false') {
      return false;
    }

    return await this.priceSummaryDetailsContainer.isVisible().catch(() => false);
  }

  private async readPriceSummaryRowNumber(label: string): Promise<number> {
    const labelLocator = this.appFrame.getByText(label, { exact: true }).first();
    await expect(labelLocator).toBeVisible();
    const value = await labelLocator.evaluate((labelElement) => {
      const nextElement = labelElement.nextElementSibling;

      return nextElement?.textContent ?? '';
    });
    const normalizedValue = value.replace(/\s+/g, ' ').trim();

    if (!normalizedValue) {
      throw new Error(`Unable to read ${label} from order price summary.`);
    }

    const parsedValue = Number(normalizedValue.replace(/[$,]/g, ''));

    if (Number.isNaN(parsedValue)) {
      throw new Error(`Unable to parse ${label} from order price summary: ${normalizedValue}`);
    }

    return parsedValue;
  }

  private async readPriceSummaryMoneyNumber(label: string): Promise<number> {
    const labelLocator = this.appFrame.getByText(label, { exact: true }).first();
    await expect(labelLocator).toBeVisible();
    const value = await labelLocator.evaluate((labelElement) => {
      let currentElement = labelElement.nextElementSibling;
      const isPriceSummaryLabel = (value: string): boolean =>
        /^(Count|Subtotal|Tax|Total Before Tips|Total(?:\((?:Cash|Card)\))?)$/i.test(value);

      while (currentElement) {
        const currentText = currentElement.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        const moneyMatches = currentText.match(/\$[\d,.]+/g);

        if (isPriceSummaryLabel(currentText)) {
          return '';
        }

        if (moneyMatches && moneyMatches.length > 1) {
          return moneyMatches.at(-1) ?? '';
        }

        if (moneyMatches?.length === 1 && !/^Save/i.test(currentText)) {
          return moneyMatches[0];
        }

        currentElement = currentElement.nextElementSibling;
      }

      return '';
    });
    const normalizedValue = value.replace(/\s+/g, ' ').trim();
    const moneyMatches = normalizedValue.match(/\$[\d,.]+/g);
    const moneyValue = moneyMatches?.at(-1) ?? '';

    if (!moneyValue) {
      throw new Error(`Unable to read ${label} from order price summary.`);
    }

    const parsedValue = Number(moneyValue.replace(/[$,]/g, ''));

    if (Number.isNaN(parsedValue)) {
      throw new Error(`Unable to parse ${label} from order price summary: ${moneyValue}`);
    }

    return parsedValue;
  }

  @step('页面读取：读取点单页税额')
  async readTaxAmount(): Promise<number> {
    const priceSummary = await this.readPriceSummary();
    const taxAmount = priceSummary.Tax;

    if (taxAmount === undefined || taxAmount === null) {
      throw new Error('Unable to read Tax from order price summary.');
    }

    return taxAmount;
  }

  @step('页面读取：读取点单页当前订单快照')
  async readOrderSnapshot(): Promise<OrderDishesSnapshot> {
    return {
      items: await this.readOrderedItems(),
      priceSummary: await this.readPriceSummary(),
    };
  }

  @step('页面操作：保存订单')
  async saveOrder(): Promise<HomePage> {
    await this.saveOrderButton.click();
    return new HomePage(this.page);
  }

  @step('页面操作：点击 Send 送厨订单')
  async sendOrder(): Promise<HomePage> {
    await this.expectLoaded();
    await this.sendButton.click();
    return new HomePage(this.page);
  }

  @step('页面操作：点击 Save 保存订单但不假设页面跳转')
  async clickSaveOrder(): Promise<void> {
    await this.expectLoaded();
    await this.saveOrderButton.click();
  }

  @step('页面操作：从点单页顶部点击 Recall 入口')
  async clickRecall(): Promise<RecallPage> {
    await this.expectLoaded();
    await this.headerRecallButton.click();

    const { RecallPage } = await import('./recall.page.js');
    const recallPage = new RecallPage(this.page);
    await recallPage.expectLoaded();

    return recallPage;
  }

  @step('页面操作：点击 Split 并打开分单面板')
  async openSplitOrder(): Promise<SplitOrderPage> {
    await this.expectLoaded();
    await (await this.resolveSplitButton()).evaluate((buttonElement) => {
      (buttonElement as HTMLElement).click();
    });

    const splitOrderPage = new SplitOrderPage(this.page);
    await splitOrderPage.expectLoaded();

    return splitOrderPage;
  }

  private createEmptyChargeState(scope: ChargeScope = 'whole'): ChargeState {
    return {
      itemCharges: {},
      scope,
      selectedDishNames: [],
      wholeOrderCharges: [],
    };
  }

  private cloneChargeState(state: ChargeState): ChargeState {
    return {
      itemCharges: Object.fromEntries(
        Object.entries(state.itemCharges).map(([dishName, option]) => [dishName, { ...option }]),
      ),
      scope: state.scope,
      selectedDishNames: [...state.selectedDishNames],
      wholeOrderCharges: state.wholeOrderCharges.map((option) => ({ ...option })),
    };
  }

  private openChargeDraft(): void {
    this.draftChargeState = this.cloneChargeState(this.persistedChargeState);
  }

  private ensureChargeDraft(): ChargeState {
    if (!this.draftChargeState) {
      this.openChargeDraft();
    }

    return this.draftChargeState as ChargeState;
  }

  private getActiveChargeState(): ChargeState {
    return this.cloneChargeState(this.draftChargeState ?? this.persistedChargeState);
  }

  private resetCustomChargeDraft(): void {
    this.customChargeDraft = {
      taxed: false,
      type: 'percentage',
      value: null,
    };
  }

  private applyDraftChargeOption(option: ChargeOptionDraft): void {
    const draft = this.ensureChargeDraft();

    if (draft.scope === 'whole') {
      const alreadySelected = draft.wholeOrderCharges.some(
        (currentOption) => currentOption.name === option.name,
      );

      draft.wholeOrderCharges = alreadySelected
        ? draft.wholeOrderCharges.filter((currentOption) => currentOption.name !== option.name)
        : [...draft.wholeOrderCharges, option];

      return;
    }

    if (draft.selectedDishNames.length === 0) {
      return;
    }

    for (const dishName of draft.selectedDishNames) {
      draft.itemCharges[dishName] = { ...option };
    }

    draft.selectedDishNames = [];
  }

  private clearDraftSelectedChargeEntries(): void {
    const draft = this.ensureChargeDraft();

    if (draft.scope === 'whole') {
      draft.wholeOrderCharges = [];
      return;
    }

    for (const dishName of draft.selectedDishNames) {
      delete draft.itemCharges[dishName];
    }

    draft.selectedDishNames = [];
  }

  private async readChargeScopeFromDom(fallbackScope: ChargeScope): Promise<ChargeScope> {
    const wholeButton = await this.resolveChargeScopeLocator('whole');
    const itemButton = await this.resolveChargeScopeLocator('item');

    if (await wholeButton.isVisible().catch(() => false)) {
      const wholePressed = await this.readPressedState(wholeButton);

      if (wholePressed !== null) {
        return wholePressed ? 'whole' : 'item';
      }
    }

    if (await itemButton.isVisible().catch(() => false)) {
      const itemPressed = await this.readPressedState(itemButton);

      if (itemPressed !== null) {
        return itemPressed ? 'item' : 'whole';
      }
    }

    return fallbackScope;
  }

  private async readSelectedDishNamesFromDom(
    fallbackDishNames: string[],
  ): Promise<string[]> {
    const selectedDishButtons = this.chargeDialog.locator(
      '[data-dish-name][aria-pressed="true"]',
    );
    const selectedCount = await selectedDishButtons.count().catch(() => 0);

    if (selectedCount === 0) {
      return [...fallbackDishNames];
    }

    const selectedDishNames: string[] = [];

    for (let index = 0; index < selectedCount; index += 1) {
      const dishName = await selectedDishButtons.nth(index).getAttribute('data-dish-name');

      if (dishName?.trim()) {
        selectedDishNames.push(dishName.trim());
      }
    }

    return selectedDishNames;
  }

  private async readWholeOrderChargesFromDom(
    fallbackWholeOrderCharges: ChargeOptionDraft[],
  ): Promise<WholeOrderChargeInfo[]> {
    const rows = this.chargeDialog.locator('[class*="_wholeOrderDiscountRow_"]');
    const rowCount = await rows.count().catch(() => 0);

    if (rowCount === 0) {
      return fallbackWholeOrderCharges.map((option) => ({
        amountText: this.resolveDraftAmountText(option),
        name: option.name,
      }));
    }

    const charges: WholeOrderChargeInfo[] = [];

    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      const nameText = await row
        .locator('[class*="_wholeOrderDiscountName_"]')
        .innerText()
        .catch(async () => await row.textContent());
      const amountText = await row
        .locator('[class*="_wholeOrderDiscountAmount_"]')
        .innerText()
        .catch(async () => await row.textContent());

      charges.push({
        amountText: this.normalizeAmountText(amountText),
        name: this.normalizeVisibleText(nameText),
      });
    }

    return charges.filter((charge) => charge.name);
  }

  private buildItemChargeSnapshot(state: ChargeState): ItemChargeInfo[] {
    return Object.entries(state.itemCharges)
      .map(([dishName, option]) => ({
        dishName,
        optionName: option.name,
      }))
      .sort((left, right) => left.dishName.localeCompare(right.dishName));
  }

  private resolveDraftAmountText(option: ChargeOptionDraft): string | null {
    if (option.kind === 'fixed' && typeof option.value === 'number') {
      return `$${option.value.toFixed(2)}`;
    }

    return null;
  }

  private formatCustomChargeName(type: ChargeCustomType, value: number): string {
    return type === 'percentage' ? `Add ${value}%` : `Add $${value.toFixed(2)}`;
  }

  private normalizeVisibleText(value: string | null | undefined): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeAmountText(value: string | null | undefined): string | null {
    const normalizedText = this.normalizeVisibleText(value);
    const matchedAmount = normalizedText.match(/\$[\d,.]+/);
    return matchedAmount?.[0] ?? null;
  }

  private async readPressedState(locator: Locator): Promise<boolean | null> {
    const ariaPressed = await locator.getAttribute('aria-pressed').catch(() => null);

    if (ariaPressed === 'true' || ariaPressed === 'false') {
      return ariaPressed === 'true';
    }

    const ariaSelected = await locator.getAttribute('aria-selected').catch(() => null);

    if (ariaSelected === 'true' || ariaSelected === 'false') {
      return ariaSelected === 'true';
    }

    const ariaChecked = await locator.getAttribute('aria-checked').catch(() => null);

    if (ariaChecked === 'true' || ariaChecked === 'false') {
      return ariaChecked === 'true';
    }

    return null;
  }

  private async resolveChargeScopeLocator(scope: ChargeScope): Promise<Locator> {
    const buttonNames =
      scope === 'whole' ? WHOLE_ORDER_BUTTON_NAMES : ITEM_CHARGE_BUTTON_NAMES;
    const scopeKey = scope === 'whole' ? 'whole' : 'item';

    return await this.resolveVisibleLocator(
      [
        this.chargeDialog
          .locator(
            `[data-testid="charge-scope-${scopeKey}"], [data-test-id="charge-scope-${scopeKey}"]`,
          )
          .first(),
        this.chargeDialog.getByRole('radio', { name: buttonNames }).first(),
        this.chargeDialog.getByRole('button', { name: buttonNames }).first(),
      ],
      `Unable to find the ${scopeKey} charge scope control.`,
    );
  }

  private async resolveChargeDishLocator(dishName: string): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.chargeDialog.getByRole('button', { name: dishName, exact: true }).first(),
        this.chargeDialog.locator(`[data-dish-name="${dishName}"]`).first(),
      ],
      `Unable to find charge dish button: ${dishName}.`,
    );
  }

  private async resolveChargeButton(): Promise<Locator> {
    const candidates = [
      this.appFrame
        .locator(
          '[data-testid="icon-button-charge"], [data-test-id="icon-button-charge"], [data-testid="charge-button"], [data-test-id="charge-button"]',
        )
        .first(),
      this.chargeButton,
    ];

    const directChargeButton = await this.findVisibleLocator(candidates);
    if (directChargeButton) {
      return directChargeButton;
    }

    if (await this.moreActionButton.isVisible().catch(() => false)) {
      await this.moreActionButton.click();
      const chargeButtonAfterMore = await this.findVisibleLocator(candidates);

      if (chargeButtonAfterMore) {
        return chargeButtonAfterMore;
      }
    }

    throw new Error('Unable to find the charge button on the order page.');
  }

  private async resolveModifyButton(): Promise<Locator> {
    const candidates = [this.modifyButton];

    const directModifyButton = await this.findVisibleLocator(candidates);
    if (directModifyButton) {
      return directModifyButton;
    }

    if (await this.moreActionButton.isVisible().catch(() => false)) {
      await this.moreActionButton.click();
      const modifyButtonAfterMore = await this.findVisibleLocator(candidates);

      if (modifyButtonAfterMore) {
        return modifyButtonAfterMore;
      }
    }

    throw new Error('Unable to find the Modify button for the selected ordered dish.');
  }

  private async resolveSplitButton(): Promise<Locator> {
    if (await this.splitButton.isVisible().catch(() => false)) {
      return this.splitButton;
    }

    throw new Error('Unable to find visible Split button on the order page.');
  }

  private async resolveChargeOptionLocator(optionName: string): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.chargeDialog.getByRole('button', { name: optionName, exact: true }).first(),
        this.chargeDialog.locator(`[data-option-name="${optionName}"]`).first(),
      ],
      `Unable to find charge option button: ${optionName}.`,
    );
  }

  private async resolveCustomChargeButton(): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.chargeDialog.getByRole('button', {
          name: /^(Custom Charge|自定义加费|自定义加收)$/,
        }).first(),
        this.chargeDialog.locator('[data-action="custom-charge"]').first(),
      ],
      'Unable to find the custom charge button.',
    );
  }

  private async resolveCustomTaxedLocator(): Promise<Locator | null> {
    const candidates = [
      this.customChargeDialog.getByLabel(CUSTOM_TAXED_LABELS).first(),
      this.customChargeDialog.locator('[data-action="taxed"]').first(),
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    return null;
  }

  private async resolveCustomChargeTypeLocator(type: ChargeCustomType): Promise<Locator> {
    const buttonNames =
      type === 'percentage' ? CUSTOM_PERCENTAGE_BUTTON_NAMES : CUSTOM_FIXED_BUTTON_NAMES;
    const typeKey = type === 'percentage' ? 'percentage' : 'fixed';

    return await this.resolveVisibleLocator(
      [
        this.customChargeDialog
          .locator(
            `[data-testid="custom-charge-type-${typeKey}"], [data-test-id="custom-charge-type-${typeKey}"]`,
          )
          .first(),
        this.customChargeDialog.getByRole('radio', { name: buttonNames }).first(),
        this.customChargeDialog.getByRole('button', { name: buttonNames }).first(),
      ],
      `Unable to find the ${typeKey} custom charge type control.`,
    );
  }

  private async enterCustomChargeValueByKeypad(value: number): Promise<void> {
    const keypadValueText =
      this.customChargeDraft.type === 'fixed'
        ? Number(value)
            .toFixed(2)
            .replace('.', '')
            .replace(/^0+(?=\d)/, '')
        : String(value);
    const clearButton = this.customChargeDialog
      .getByRole('button', { name: 'C', exact: true })
      .first();
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
    }

    for (const char of keypadValueText) {
      await this.customChargeDialog
        .getByRole('button', { name: char, exact: true })
        .first()
        .click();
    }
  }

  private async resolveVisibleLocator(
    candidates: Locator[],
    message: string,
  ): Promise<Locator> {
    const resolvedLocator = await waitUntil(
      async () => {
        for (const candidate of candidates) {
          if (await candidate.isVisible().catch(() => false)) {
            return candidate;
          }
        }

        return null;
      },
      (locator): locator is Locator => locator !== null,
      {
        timeout: 5_000,
        message,
      },
    );

    if (!resolvedLocator) {
      throw new Error(message);
    }

    return resolvedLocator;
  }

  private async findVisibleLocator(candidates: Locator[]): Promise<Locator | null> {
    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    return null;
  }

  private resolveModifySection(sectionName: string): Locator {
    const escapedSectionName = this.escapeRegExp(sectionName);

    return this.modifyPanel
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
    const escapedButtonName = this.escapeRegExp(buttonName);

    return await this.resolveVisibleLocator(
      [
        section.getByRole('button', { name: buttonName, exact: true }).first(),
        section
          .locator('button')
          .filter({
            hasText: new RegExp(`^\\s*${escapedButtonName}\\s*$`),
          })
          .first(),
      ],
      `Unable to find Modify ${sectionName} button: ${buttonName}.`,
    );
  }

  private async resolveModifyOptionButton(optionName: string): Promise<Locator> {
    const optionSection = this.resolveModifySection('Option');
    const escapedOptionName = this.escapeRegExp(optionName);
    const optionNamePattern = new RegExp(`^\\s*${escapedOptionName}\\s*(?:\\$[\\d,.]+)?\\s*$`);

    return await this.resolveVisibleLocator(
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

    return await this.resolveVisibleLocator(
      [
        priceSection
          .locator(
            '[data-testid="modifier-custom-price-input"], [data-test-id="modifier-custom-price-input"]',
          )
          .first(),
        priceSection.locator('input').first(),
        this.appFrame
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

  private resolveTableNumberButton(tableNumber: string): Locator {
    return this.appFrame.getByRole('button', {
      name: new RegExp(`TableIcon\\s*${this.escapeRegExp(tableNumber)}`),
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

  private async resolveMenuGroupCard(groupName: string): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.menuGroupCards
          .filter({
            hasText: new RegExp(this.escapeRegExp(groupName)),
          })
          .first(),
        this.appFrame.getByRole('button', { name: groupName, exact: true }).first(),
      ],
      `Unable to find menu group: ${groupName}.`,
    );
  }

  private async resolveMenuCategoryCard(categoryName: string): Promise<Locator> {
    return await this.resolveVisibleLocator(
      [
        this.menuCategoryCards
          .filter({
            hasText: new RegExp(this.escapeRegExp(categoryName)),
          })
          .first(),
        this.appFrame.getByRole('button', { name: categoryName, exact: true }).first(),
      ],
      `Unable to find menu category: ${categoryName}.`,
    );
  }

  private resolveOrderedDishButton(dishName: string): Locator {
    const escapedDishName = this.escapeRegExp(dishName);
    return this.appFrame
      .getByRole('button', {
        name: new RegExp(
          `(?:^|\\s)\\d+\\s+${escapedDishName}(?:\\s+\\d+\\s+sent)?\\s+\\$[\\d,.]+`,
        ),
      })
      .first();
  }

  private async waitUntilWeightDialogReady(): Promise<void> {
    try {
      await waitUntil(
        async () => ({
          isLoading: await this.weightDialogLoadingText.isVisible().catch(() => false),
          hasVisibleInput: await this.weightInput.isVisible().catch(() => false),
          digitButtonCount: await this.weightDialog
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
      const isStillLoading = await this.weightDialogLoadingText.isVisible().catch(() => false);
      const hasVisibleInput = await this.weightInput.isVisible().catch(() => false);
      const digitButtonCount = await this.weightDialog
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
    return this.countDialog.getByRole('button', { name: digit, exact: true });
  }

  private resolveSpecificationButton(spec: string): Locator {
    return this.specificationDialog.getByRole('button', { name: spec, exact: true });
  }

  private async resolveCategoryOptionButton(option: string): Promise<Locator> {
    const escapedOption = this.escapeRegExp(option);
    const optionPattern = new RegExp(`^\\s*${escapedOption}\\s*(?:\\$[\\d,.]+)?\\s*$`);

    return await this.resolveVisibleLocator(
      [
        this.categoryOptionGrid.getByRole('button', { name: optionPattern }).first(),
        this.categoryOptionGrid
          .locator('[data-testid^="category-option-"], [data-test-id^="category-option-"]')
          .filter({ hasText: optionPattern })
          .first(),
        this.categoryOptionGrid.locator('[class*="_card_"]').filter({ hasText: optionPattern }).first(),
      ],
      `Unable to find category option button: ${option}.`,
    );
  }

  private async resolveCategorySubOptionButton(option: string): Promise<Locator> {
    const escapedOption = this.escapeRegExp(option);
    const optionPattern = new RegExp(`^\\s*${escapedOption}\\s*(?:\\$[\\d,.]+)?\\s*$`);

    return await this.resolveVisibleLocator(
      [
        this.categoryOptionSubGrid.getByRole('button', { name: optionPattern }).first(),
        this.categoryOptionSubGrid
          .locator('[data-testid^="category-sub-option-"], [data-test-id^="category-sub-option-"]')
          .filter({ hasText: optionPattern })
          .first(),
        this.categoryOptionSubGrid
          .locator('[class*="_card_"]')
          .filter({ hasText: optionPattern })
          .first(),
      ],
      `Unable to find category sub option button: ${option}.`,
    );
  }

  private async activateComboSection(sectionName: string): Promise<void> {
    const sectionButton = this.comboDialog
      .getByRole('button', {
        name: new RegExp(`^${this.escapeRegExp(sectionName)}$`),
      })
      .first();

    if (await sectionButton.isVisible().catch(() => false)) {
      await sectionButton.click();
    }
  }

  private resolveLegacyComboSection(sectionName: string): Locator {
    return this.comboDialog
      .locator('div[class*="_sectionName_"]')
      .filter({
        hasText: new RegExp(`^${this.escapeRegExp(sectionName)}$`),
      })
      .first()
      .locator('xpath=ancestor::section[1]');
  }

  private resolveComboSectionItemCardShell(sectionName: string, dishName: string): Locator {
    const itemTitle = this.comboDialog.locator('span[class*="_itemTitle_"]', {
      hasText: new RegExp(`^${this.escapeRegExp(dishName)}$`),
    });

    return this.resolveLegacyComboSection(sectionName)
      .locator('span[class*="_itemTitle_"]', {
        hasText: new RegExp(`^${this.escapeRegExp(dishName)}$`),
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

    return await this.resolveVisibleLocator(
      [cardShell.getByRole('button').first()],
      `Unable to find combo item button: ${sectionName} / ${dishName}.`,
    );
  }

  private async resolveComboSectionItemPlusButton(
    sectionName: string,
    dishName: string,
  ): Promise<Locator> {
    const cardShell = this.resolveComboSectionItemCardShell(sectionName, dishName);

    return await this.resolveVisibleLocator(
      [
        cardShell.locator('button[class*="_counterBtnPlus_"]').first(),
        cardShell.getByRole('button', { name: '+', exact: true }).first(),
      ],
      `Unable to find combo item plus button: ${sectionName} / ${dishName}.`,
    );
  }

  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

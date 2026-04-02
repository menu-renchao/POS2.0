import { expect, type Locator, type Page } from '@playwright/test';
import { HomePage } from './home.page';
import { OrderDishesPage } from './order-dishes.page';
import { RecallPage } from './recall.page';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

export type SplitOrderDishSnapshot = {
  name: string;
  proportion: string | null;
};

export type SplitOrderSuborderSnapshot = {
  dishes: SplitOrderDishSnapshot[];
  orderNumber: string;
  paidStatus: string | null;
  seats: string[];
  total: string | null;
};

export type SplitOrderSnapshot = {
  remain: string | null;
  suborders: SplitOrderSuborderSnapshot[];
  title: string;
  total: string | null;
};

export type SplitOrderReturnPage = HomePage | OrderDishesPage | RecallPage;

const CONFIRM_BUTTON_NAME = /^(Confirm|确认)$/;
const CANCEL_BUTTON_NAME = /^(Cancel|取消)$/;
const COMBINE_BUTTON_NAME = /^(Combine|Merge|合并)$/;
const BY_AMOUNT_BUTTON_NAME = /^(By Amount|Amount|按金额分单)$/;
const UNSPLIT_BUTTON_NAME = /^(Unsplit|Cancel Split|取消分单)$/;

export class SplitOrderPage {
  private readonly modal: Locator;
  private readonly title: Locator;
  private readonly evenOrderButton: Locator;
  private readonly bySeatsButton: Locator;
  private readonly evenItemsButton: Locator;
  private readonly byAmountButton: Locator;
  private readonly combineButton: Locator;
  private readonly unsplitButton: Locator;
  private readonly moreButton: Locator;
  private readonly confirmButton: Locator;
  private readonly cancelButton: Locator;
  private readonly addAmountButton: Locator;
  private readonly subordersContainer: Locator;
  private readonly totalValue: Locator;
  private readonly remainValue: Locator;
  private readonly splitInputDialog: Locator;
  private readonly splitInputField: Locator;
  private readonly splitInputConfirmButton: Locator;
  private readonly splitInputCancelButton: Locator;
  private readonly combineDialog: Locator;
  private readonly combineConfirmButton: Locator;

  constructor(private readonly page: Page) {
    this.modal = this.page.locator('[data-testid="splitPanelModal"], .splitPanelModal').first();
    this.title = this.modal.locator('h1, [role="heading"]').first();
    this.evenOrderButton = this.modal.locator('[data-testid="evenOrderBtn"]').first();
    this.bySeatsButton = this.modal.locator('[data-testid="bySeatsBtn"]').first();
    this.evenItemsButton = this.modal.locator('[data-testid="evenItemsBtn"]').first();
    this.byAmountButton = this.modal.locator('[data-testid="byAmountBtn"]').first();
    this.combineButton = this.modal.locator('[data-testid="combineBtn"]').first();
    this.unsplitButton = this.modal.locator('[data-testid="unsplitBtn"]').first();
    this.moreButton = this.modal.locator('[data-testid="moreBtn"]').first();
    this.confirmButton = this.modal.locator('[data-testid="split-panel-confirm"]').first();
    this.cancelButton = this.modal.locator('[data-testid="split-panel-cancel"]').first();
    this.addAmountButton = this.modal.locator('[data-testid="add-amount-suborder"]').first();
    this.subordersContainer = this.modal.locator('[data-testid="suborders-container"]').first();
    this.totalValue = this.modal.locator('._value_1lomb_35').first();
    this.remainValue = this.modal.locator('._remainValue_1lomb_41').first();
    this.splitInputDialog = this.page
      .locator('.splitInputModalOverlay [role="dialog"], [data-testid="split-input-dialog"]')
      .first();
    this.splitInputField = this.splitInputDialog
      .locator('[data-testid="split-input-value"], input')
      .first();
    this.splitInputConfirmButton = this.splitInputDialog
      .locator('[data-testid="split-input-confirm"]')
      .first();
    this.splitInputCancelButton = this.splitInputDialog
      .locator('[data-testid="split-input-cancel"]')
      .first();
    this.combineDialog = this.page.locator('.splitCombineModal').first();
    this.combineConfirmButton = this.combineDialog.locator('[data-testid="combine-confirm"]').first();
  }

  @step((orderNumber?: string) =>
    orderNumber
      ? `页面操作：确认分单页面已加载并显示订单号 ${orderNumber}`
      : '页面操作：确认分单页面已加载',
  )
  async expectLoaded(orderNumber?: string): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.title).toContainText('Split Order');

    if (orderNumber) {
      await expect(this.title).toContainText(orderNumber);
    }
  }

  @step('页面操作：点击平分订单按钮')
  async clickEvenOrder(): Promise<void> {
    await this.expectLoaded();
    await this.evenOrderButton.click();
    await this.expectSplitInputVisible();
  }

  @step('页面操作：点击按座位分单按钮')
  async clickBySeats(): Promise<void> {
    await this.expectLoaded();
    await this.bySeatsButton.click();
  }

  @step('页面操作：点击平分菜品按钮')
  async clickEvenItems(): Promise<void> {
    await this.expectLoaded();
    await this.evenItemsButton.click();
    await this.expectSplitInputVisible();
  }

  @step('页面操作：点击按金额分单按钮')
  async clickByAmount(): Promise<void> {
    await this.expectLoaded();
    await this.resolveActionButton(
      [this.byAmountButton, this.page.getByRole('button', { name: BY_AMOUNT_BUTTON_NAME }).first()],
      async () => {
        await this.openMoreActionsIfNeeded();
      },
      'Unable to find the "By Amount" split action.',
    ).then(async (button) => {
      await button.click();
    });
    await this.expectSplitInputVisible();
  }

  @step('页面操作：点击合并订单按钮')
  async clickCombine(): Promise<void> {
    await this.expectLoaded();
    await this.resolveActionButton(
      [this.combineButton, this.page.getByRole('button', { name: COMBINE_BUTTON_NAME }).first()],
      async () => {
        await this.openMoreActionsIfNeeded();
      },
      'Unable to find the "Combine" split action.',
    ).then(async (button) => {
      await button.click();
    });
    await expect(this.combineDialog).toBeVisible();
  }

  @step('页面操作：点击取消分单按钮')
  async clickCancelSplit(): Promise<void> {
    await this.expectLoaded();
    await this.resolveActionButton(
      [this.unsplitButton, this.page.getByRole('button', { name: UNSPLIT_BUTTON_NAME }).first()],
      async () => {
        await this.openMoreActionsIfNeeded();
      },
      'Unable to find the "Unsplit" split action.',
    ).then(async (button) => {
      await button.click();
    });
  }

  @step((count: number) => `页面操作：输入分单份数 ${count}`)
  async fillSplitCount(count: number): Promise<void> {
    await this.fillSplitInputValue(count);
  }

  @step((amount: number) => `页面操作：输入分单金额 ${amount}`)
  async fillSplitAmount(amount: number): Promise<void> {
    await this.fillSplitInputValue(amount);
  }

  @step('页面操作：确认分单输入弹窗')
  async confirmSplitInput(): Promise<void> {
    await this.expectSplitInputVisible();
    await this.splitInputConfirmButton.click();
    await expect(this.splitInputDialog).toBeHidden();
  }

  @step('页面操作：关闭分单输入弹窗')
  async cancelSplitInput(): Promise<void> {
    if (!(await this.splitInputDialog.isVisible().catch(() => false))) {
      return;
    }

    if (await this.splitInputCancelButton.isVisible().catch(() => false)) {
      await this.splitInputCancelButton.click();
      await expect(this.splitInputDialog).toBeHidden();
      return;
    }

    await this.page.keyboard.press('Escape').catch(() => {});
  }

  @step('页面操作：点击新增金额子单按钮')
  async clickAddAmountSuborder(): Promise<void> {
    await this.expectLoaded();
    await this.addAmountButton.click();
    await this.expectSplitInputVisible();
  }

  @step((orderNumber: string, dishName: string) => `页面操作：切换子单 ${orderNumber} 的菜品 ${dishName} 选中状态`)
  async toggleDishSelection(orderNumber: string, dishName: string): Promise<void> {
    await this.resolveDish(orderNumber, dishName).click();
  }

  @step((orderNumber: string, dishName: string) => `页面操作：点击子单 ${orderNumber} 中的菜品 ${dishName}`)
  async clickDish(orderNumber: string, dishName: string): Promise<void> {
    await this.resolveDish(orderNumber, dishName).click();
  }

  @step((orderNumber: string) => `页面操作：点击子单 ${orderNumber}`)
  async clickSuborder(orderNumber: string): Promise<void> {
    await this.resolveSuborder(orderNumber).click();
  }

  @step((orderNumber: string) => `页面操作：在合并弹窗中切换子单 ${orderNumber}`)
  async toggleCombineOrder(orderNumber: string): Promise<void> {
    await expect(this.combineDialog).toBeVisible();
    await this.resolveCombineOrder(orderNumber).click();
  }

  @step('页面操作：确认合并订单')
  async confirmCombine(): Promise<void> {
    await expect(this.combineDialog).toBeVisible();
    await this.combineConfirmButton.click();
    await expect(this.combineDialog).toBeHidden();
  }

  @step('页面操作：提交分单并返回上一级页面对象')
  async submitAndReturnPage(): Promise<SplitOrderReturnPage> {
    await this.expectLoaded();
    const previousUrl = this.page.url();
    await this.confirmButton.click();

    await waitUntil(
      async () => ({
        isHidden: await this.modal.isHidden().catch(() => false),
        url: this.page.url(),
      }),
      (state) => state.isHidden || state.url !== previousUrl,
      {
        timeout: 5_000,
        message: 'Split order submit did not close the panel or change the page state in time.',
      },
    ).catch(() => null);

    return this.resolveReturnPage();
  }

  @step('页面读取：读取当前分单页面快照')
  async readSnapshot(): Promise<SplitOrderSnapshot> {
    await this.expectLoaded();
    const snapshot = await this.page.evaluate(() => {
      const modal = document.querySelector('[data-testid="splitPanelModal"], .splitPanelModal');

      if (!modal) {
        return null;
      }

      const normalizeText = (value: string | null | undefined): string =>
        String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim();
      const normalizeOptionalText = (value: string | null | undefined): string | null => {
        const normalized = normalizeText(value);
        return normalized ? normalized : null;
      };
      const normalizeNumberText = (value: string | null | undefined): string | null => {
        const normalized = normalizeText(value);
        const matchedNumber = normalized.match(/-?\d+(?:\.\d{1,2})?/);
        return matchedNumber?.[0] ?? null;
      };

      const suborders = Array.from(
        modal.querySelectorAll<HTMLElement>('[data-testid="split-suborder"]'),
      ).map((suborder) => {
        const orderNumber =
          suborder.getAttribute('data-order-number') ??
          normalizeText(suborder.querySelector('[class*="_orderNumber_"]')?.textContent).replace(/^#/, '');
        const total =
          normalizeNumberText(suborder.getAttribute('data-total')) ??
          normalizeNumberText(suborder.querySelector('[class*="_totalPrice_"]')?.textContent) ??
          normalizeNumberText(suborder.querySelector('[class*="_priceModeButtonContent_"]')?.textContent);
        const paidStatus = normalizeOptionalText(
          suborder.querySelector('[class*="_paidStatusSection_"]')?.textContent,
        );
        const seats = Array.from(suborder.querySelectorAll('[class*="_seatHeader_"]'))
          .map((seat) => normalizeText(seat.textContent))
          .filter(Boolean);
        const dishes = Array.from(
          suborder.querySelectorAll<HTMLElement>('[data-testid="split-dish"], [class*="_dishItem_"]'),
        ).map((dishRow) => ({
          name:
            dishRow.getAttribute('data-dish-name') ??
            normalizeText(dishRow.querySelector('[class*="_dishName_"]')?.textContent),
          proportion:
            normalizeOptionalText(dishRow.getAttribute('data-proportion')) ??
            normalizeOptionalText(dishRow.querySelector('[class*="_proportion_"]')?.textContent),
        }));

        return {
          dishes,
          orderNumber: orderNumber.replace(/^#/, ''),
          paidStatus,
          seats,
          total,
        };
      });

      const remainSummary = modal.querySelector('[data-testid="remain-summary"]:not([hidden])');
      const remain =
        normalizeNumberText(remainSummary?.querySelector('._remainValue_1lomb_41')?.textContent) ??
        normalizeNumberText(modal.querySelector('._remainValue_1lomb_41')?.textContent);

      return {
        remain,
        suborders,
        title: normalizeText(modal.querySelector('h1, [role="heading"]')?.textContent),
        total: normalizeNumberText(modal.querySelector('._value_1lomb_35')?.textContent),
      };
    });

    if (!snapshot) {
      throw new Error('Unable to read the split order snapshot because the split panel was not found.');
    }

    return snapshot;
  }

  @step((orderNumber: string, dishName: string) => `页面读取：读取子单 ${orderNumber} 中菜品 ${dishName} 的平分比例`)
  async readDishProportion(orderNumber: string, dishName: string): Promise<string | null> {
    const dishRow = this.resolveDish(orderNumber, dishName);
    const proportionText =
      (await dishRow.getAttribute('data-proportion').catch(() => null)) ??
      (await dishRow.locator('[class*="_proportion_"]').first().textContent().catch(() => null));

    return this.normalizeOptionalText(proportionText);
  }

  @step((orderNumber: string, dishName: string) => `页面读取：检查子单 ${orderNumber} 中是否存在菜品 ${dishName}`)
  async hasDish(orderNumber: string, dishName: string): Promise<boolean> {
    return await this.resolveDish(orderNumber, dishName).isVisible().catch(() => false);
  }

  @step((orderNumber: string, dishName: string) => `页面读取：判断子单 ${orderNumber} 的菜品 ${dishName} 是否允许按菜品平分`)
  async isDishEligibleForEvenSplit(orderNumber: string, dishName: string): Promise<boolean> {
    const dishRow = this.resolveDish(orderNumber, dishName);
    const proportionText =
      (await dishRow.getAttribute('data-proportion').catch(() => null)) ??
      (await dishRow.locator('[class*="_proportion_"]').first().textContent().catch(() => null));
    const normalizedProportion = this.normalizeOptionalText(proportionText);

    return !normalizedProportion || !/^1\/\d+$/.test(normalizedProportion);
  }

  @step('页面读取：读取剩余金额')
  async readRemainAmount(): Promise<string | null> {
    const remainText = await this.remainValue.textContent().catch(() => null);
    return this.normalizeOptionalNumberText(remainText);
  }

  @step('页面读取：检查分单输入弹窗是否可见')
  async expectSplitInputVisible(): Promise<void> {
    await expect(this.splitInputDialog).toBeVisible();
  }

  private async fillSplitInputValue(value: number): Promise<void> {
    await this.expectSplitInputVisible();
    await this.splitInputField.fill(String(value));
  }

  private async openMoreActionsIfNeeded(): Promise<void> {
    if (await this.moreButton.isVisible().catch(() => false)) {
      await this.moreButton.click();
    }
  }

  private async resolveActionButton(
    candidates: Locator[],
    openMoreActions: () => Promise<void>,
    message: string,
  ): Promise<Locator> {
    const directButton = await this.findVisibleLocator(candidates);
    if (directButton) {
      return directButton;
    }

    await openMoreActions();

    const buttonAfterMore = await this.findVisibleLocator(candidates);
    if (buttonAfterMore) {
      return buttonAfterMore;
    }

    throw new Error(message);
  }

  private async findVisibleLocator(candidates: Locator[]): Promise<Locator | null> {
    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    return null;
  }

  private resolveSuborder(orderNumber: string): Locator {
    return this.subordersContainer
      .locator(`[data-testid="split-suborder"][data-order-number="${orderNumber}"], [data-order-number="${orderNumber}"]`)
      .first();
  }

  private resolveDish(orderNumber: string, dishName: string): Locator {
    return this.resolveSuborder(orderNumber)
      .locator(
        `[data-testid="split-dish"][data-dish-name="${dishName}"], [data-dish-name="${dishName}"]`,
      )
      .first();
  }

  private resolveCombineOrder(orderNumber: string): Locator {
    return this.combineDialog
      .locator(
        `[data-testid="combine-order"][data-order-number="${orderNumber}"], [data-order-number="${orderNumber}"]`,
      )
      .first();
  }

  private async readSuborderTotal(suborder: Locator): Promise<string | null> {
    const totalFromAttribute = await suborder.getAttribute('data-total').catch(() => null);
    const normalizedAttributeTotal = this.normalizeOptionalNumberText(totalFromAttribute);

    if (normalizedAttributeTotal) {
      return normalizedAttributeTotal;
    }

    const totalCandidates = [
      suborder.locator('[class*="_totalPrice_"]').first(),
      suborder.locator('[class*="_priceModeButtonContent_"]').first(),
    ];

    for (const candidate of totalCandidates) {
      const text = await candidate.textContent().catch(() => null);
      const normalized = this.normalizeOptionalNumberText(text);

      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private resolveReturnPage(): SplitOrderReturnPage {
    const currentUrl = this.page.url();

    if (/#recall\b/i.test(currentUrl)) {
      return new RecallPage(this.page);
    }

    if (/#orderDishes\b/i.test(currentUrl)) {
      return new OrderDishesPage(this.page);
    }

    return new HomePage(this.page);
  }

  private normalizeOrderNumber(value: string | null | undefined): string {
    return this.normalizeText(value).replace(/^#/, '');
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalized = this.normalizeText(value);
    return normalized ? normalized : null;
  }

  private normalizeOptionalNumberText(value: string | null | undefined): string | null {
    const normalized = this.normalizeText(value);
    const matchedNumber = normalized.match(/-?\d+(?:\.\d{1,2})?/);
    return matchedNumber?.[0] ?? null;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

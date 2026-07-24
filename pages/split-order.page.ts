import { expect, type Locator, type Page } from '@playwright/test';
import { HomePage } from './home.page';
import { OrderDishesPage } from './order-dishes.page';
import { PaymentPage } from './payment.page';
import { RecallPage } from './recall.page';
import { readVisiblePosAlertText } from './shared/pos-alert';
import { step } from '../utils/step';
import { escapeRegExp, normalizeOrderNumber } from '../utils/text';
import { waitUntil } from '../utils/wait';
import { SplitInputDialog } from './split-order/split-input.dialog';
import { SplitOrderContext } from './split-order/split-order-context';
import { SplitSubordersSection } from './split-order/split-suborders.section';
import { SplitSummarySection } from './split-order/split-summary.section';
import { SplitToolbarSection } from './split-order/split-toolbar.section';
import type {
  SplitOrderDishDisplay,
  SplitOrderSnapshot,
} from './split-order/split-order.types';
export type {
  SplitOrderDishDisplay,
  SplitOrderDishSnapshot,
  SplitOrderSnapshot,
  SplitOrderSuborderSnapshot,
} from './split-order/split-order.types';

export type SplitOrderReturnPage = HomePage | OrderDishesPage | RecallPage;
export type SplitOrderReturnDestination = 'home' | 'orderDishes' | 'recall';

export function classifySplitOrderReturnUrl(
  urlText: string,
): SplitOrderReturnDestination | null {
  try {
    const url = new URL(urlText);

    if (
      url.pathname.endsWith('/kpos/front/myhome.html') &&
      url.hash === ''
    ) {
      return 'home';
    }

    if (/#recall\b/i.test(url.hash)) {
      return 'recall';
    }

    if (/#orderDishes\b/i.test(url.hash)) {
      return 'orderDishes';
    }

    return null;
  } catch {
    return null;
  }
}

export function isSplitOrderReturnStateSettled(
  previousUrl: string,
  currentUrl: string,
  splitPanelHidden: boolean,
): boolean {
  const destination = classifySplitOrderReturnUrl(currentUrl);

  if (!splitPanelHidden || destination === null) {
    return false;
  }

  // 从点单页打开分单时，关闭面板会先短暂恢复原点单页，再完成真正的返回导航。
  // 不能把这个过渡态当成最终的 Order Dishes destination。
  return destination !== 'orderDishes' || currentUrl !== previousUrl;
}

const CONFIRM_BUTTON_NAME = /^(Confirm|确认)$/;
const CANCEL_BUTTON_NAME = /^(Cancel|取消)$/;
const SPLIT_ADD_TO_SUBORDER_BUTTON_TEST_ID = 'button-default';
const REMOVE_DISH_ITEM_BUTTON_NAME = /^Remove dish item$/;

export class SplitOrderPage {
  readonly toolbar: SplitToolbarSection;
  readonly suborders: SplitSubordersSection;
  readonly input: SplitInputDialog;
  readonly summary: SplitSummarySection;
  private readonly ctx: SplitOrderContext;
  private readonly splitFrame: ReturnType<Page['frameLocator']>;
  private readonly modal: Locator;
  private readonly title: Locator;
  private readonly evenOrderButton: Locator;
  private readonly bySeatsButton: Locator;
  private readonly evenItemsButton: Locator;
  private readonly byAmountMenuItem: Locator;
  private readonly byAmountButton: Locator;
  private readonly combineMenuItem: Locator;
  private readonly combineButton: Locator;
  private readonly unsplitMenuItem: Locator;
  private readonly unsplitButton: Locator;
  private readonly moreButton: Locator;
  private readonly confirmButton: Locator;
  private readonly cancelButton: Locator;
  private readonly addSuborderButton: Locator;
  private readonly suborderPayButton: (suborderIndex: number) => Locator;
  private readonly splitPanelModal: Locator;
  private readonly totalValue: Locator;
  private readonly remainValue: Locator;
  private readonly combineDialog: Locator;
  private readonly combineConfirmButton: Locator;
  private readonly blankOrdersDialog: Locator;
  private readonly removeBlankOrdersButton: Locator;
  private readonly posToast: Locator;

  constructor(private readonly page: Page) {
    this.ctx = new SplitOrderContext(page);
    this.toolbar = new SplitToolbarSection(this.ctx);
    this.suborders = new SplitSubordersSection(this.ctx);
    this.input = new SplitInputDialog(this.ctx);
    this.summary = new SplitSummarySection(this.ctx);
    this.splitFrame = this.page.frameLocator('#splitPanelContainer iframe');

    this.modal = this.splitFrame.getByRole('dialog').first();
    this.title = this.modal.getByRole('heading').first();
    this.evenOrderButton = this.modal.getByTestId('evenOrderBtn');
    this.bySeatsButton = this.modal.getByRole('button', { name: /By Seats|按座位分单/ }).first();
    this.evenItemsButton = this.modal.getByRole('button', { name: /Even Item|Even Items|平分菜品/ }).first();
    this.byAmountMenuItem = this.splitFrame.getByRole('menuitem', { name: /^By Amount$/ }).first();
    this.byAmountButton = this.modal.getByRole('button', { name: /^By Amount$|按金额分单$/ }).first();
    this.combineMenuItem = this.splitFrame.getByRole('menuitem', { name: /^Combine suborders$/ }).first();
    this.combineButton = this.modal
      .getByRole('button', { name: /^Combine suborders$|^Combine$|^Merge$|合并$/ })
      .first();
    this.unsplitMenuItem = this.splitFrame.getByTestId('dropdown-item-unsplitBtn');
    this.unsplitButton = this.modal.getByRole('button', { name: /^Unsplit$|取消分单$/ }).first();
    this.moreButton = this.splitFrame.getByTestId('moreBtn');
    this.confirmButton = this.splitFrame.getByTestId('splitPanelModal-confirm-button');
    this.cancelButton = this.modal.getByRole('button', { name: CANCEL_BUTTON_NAME }).first();
    this.addSuborderButton = this.splitFrame
      .getByTestId('button-default')
      .filter({ hasText: 'Add Suborder' })
      .first();
    this.suborderPayButton = (suborderIndex: number) =>
      this.splitFrame.getByTestId(`payBtn-${suborderIndex}`);
    this.splitPanelModal = this.splitFrame.getByTestId('splitPanelModal');
    this.totalValue = this.modal.locator('._value_1lomb_35, [class*="_value_"]').first();
    this.remainValue = this.modal.locator('._remainValue_1lomb_41, [class*="_remainValue_"]').first();
    this.combineDialog = this.splitFrame.getByRole('dialog').filter({
      has: this.splitFrame.getByRole('heading', {
        name: 'Combine Suborders',
        exact: true,
      }),
    });
    this.combineConfirmButton = this.combineDialog
      .getByRole('button', { name: CONFIRM_BUTTON_NAME })
      .first();
    this.blankOrdersDialog = this.splitFrame.getByRole('alertdialog', {
      name: 'Blank Orders Detected',
      exact: true,
    });
    this.removeBlankOrdersButton = this.blankOrdersDialog.getByRole('button', {
      name: 'Remove & Proceed',
      exact: true,
    });
    this.posToast = this.page.locator('[data-testid^="pos-ui-toast-toast-"]').last();
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

  @step('页面读取：读取分单操作阻断提示')
  async readBlockingMessage(): Promise<string> {
    return await readVisiblePosAlertText(this.page);
  }

  @step('页面读取：读取当前分单面板文本')
  async readPanelText(): Promise<string> {
    await this.expectLoaded();
    return (await this.modal.innerText()).replace(/\s+/g, ' ').trim();
  }

  @step('页面操作：点击平分订单按钮')
  async clickEvenOrder(): Promise<void> {
    await this.expectLoaded();
    await this.toolbar.clickEvenOrder();
    await this.expectSplitInputVisible();
  }

  @step('页面操作：点击按座位分单按钮')
  async clickBySeats(): Promise<void> {
    await this.expectLoaded();
    await this.toolbar.clickBySeats();
  }

  @step('页面操作：点击平分菜品按钮')
  async clickEvenItems(): Promise<void> {
    await this.expectLoaded();
    await this.toolbar.clickEvenItems();
    await this.expectSplitInputVisible();
  }

  @step('页面操作：点击按金额分单按钮')
  async clickByAmount(): Promise<void> {
    await this.expectLoaded();
    await this.clickSplitAction(this.byAmountMenuItem, this.byAmountButton, 'By Amount');
    await this.expectSplitInputVisible();
  }

  @step('页面操作：点击合并订单按钮')
  async clickCombine(): Promise<void> {
    await this.expectLoaded();
    await this.clickSplitAction(this.combineMenuItem, this.combineButton, 'Combine suborders');
    await expect(this.combineDialog).toBeVisible();
  }

  @step('页面操作：点击取消分单按钮')
  async clickCancelSplit(): Promise<void> {
    await this.expectLoaded();
    await this.clickSplitAction(this.unsplitMenuItem, this.unsplitButton, 'Unsplit');
  }

  @step('页面操作：确认当前分单面板操作')
  async confirmCurrentSplitPanel(): Promise<void> {
    await this.expectLoaded();
    await this.confirmButton.click();
  }

  @step('页面操作：再次撤销分单并立即读取短暂 Toast')
  async retryCancelSplitAndReadToast(): Promise<string> {
    await this.clickCancelSplit();
    await expect(this.posToast).toBeVisible({ timeout: 2_000 });
    return (await this.posToast.innerText()).replace(/\s+/g, ' ').trim();
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
    await this.input.confirm();
  }

  @step('页面操作：关闭分单输入弹窗')
  async cancelSplitInput(): Promise<void> {
    if (!(await this.input.dialog.isVisible().catch(() => false))) {
      return;
    }
    await this.input.cancel();
  }

  @step((label: string) => `页面断言：新增子单按钮展示文案 ${label}`)
  async expectAddSuborderLabel(label: string): Promise<void> {
    await this.expectLoaded();
    await expect(this.addSuborderButton).toContainText(label);
  }

  @step('页面操作：点击新增子单按钮')
  async clickAddSuborder(): Promise<void> {
    await this.expectLoaded();
    await this.addSuborderButton.click();
  }

  @step((suborderIndex: number) => `页面操作：点击第 ${suborderIndex} 个子单的 Pay 并进入支付页面`)
  async openSuborderPayment(suborderIndex: number): Promise<PaymentPage> {
    await this.expectLoaded();
    const payButton = this.suborderPayButton(suborderIndex);
    await expect(payButton).toBeVisible();
    await payButton.click();

    const paymentPage = new PaymentPage(this.page);
    await paymentPage.expectLoaded();
    return paymentPage;
  }

  @step((suborderIndex: number) => `页面断言：分单面板展示第 ${suborderIndex} 个子单`)
  async expectSuborderIndexVisible(suborderIndex: number): Promise<void> {
    await expect(
      this.splitPanelModal.getByText(new RegExp(`^#\\d+-${suborderIndex}$`), { exact: true }),
    ).toBeVisible();
  }

  @step('页面操作：点击新增金额子单按钮')
  async clickAddAmountSuborder(): Promise<void> {
    await this.expectLoaded();
    await this.addSuborderButton.click();
    await this.expectSplitInputVisible();
  }

  @step((orderNumber: string, dishName: string) => `页面操作：切换子单 ${orderNumber} 的菜品 ${dishName} 选中状态`)
  async toggleDishSelection(orderNumber: string, dishName: string): Promise<void> {
    await this.clickDish(orderNumber, dishName);
    await this.expectEvenItemsActionEnabled();
  }

  @step('页面操作：确认 Even Item 按钮已可用')
  async expectEvenItemsActionEnabled(): Promise<void> {
    await waitUntil(
      async () => this.evenItemsButton.isEnabled().catch(() => false),
      (isEnabled) => isEnabled,
      {
        timeout: 10_000,
        message: 'Even Item 按钮在选中菜品后仍未可用。',
      },
    );
  }

  @step((targetOrderNumber: string) => `页面操作：点击 Add to #${targetOrderNumber} 将已选菜品加入目标子单`)
  async clickAddToSuborder(targetOrderNumber: string): Promise<void> {
    const clicked = await this.clickAddToSuborderIfVisible(targetOrderNumber);

    if (!clicked) {
      throw new Error(`Unable to find the "Add to #${targetOrderNumber}" split action.`);
    }
  }

  @step((targetOrderNumber: string) => `页面操作：若可见则点击 Add to #${targetOrderNumber}`)
  async clickAddToSuborderIfVisible(targetOrderNumber: string): Promise<boolean> {
    const addToButton = this.resolveAddToSuborderButton(targetOrderNumber);

    try {
      await waitUntil(
        async () => addToButton.isVisible().catch(() => false),
        (isVisible) => isVisible,
        {
          timeout: 5_000,
          message: `选中菜品后未出现 Add to #${targetOrderNumber} 按钮。`,
        },
      );
    } catch {
      return false;
    }

    await addToButton.click();
    return true;
  }

  @step((targetOrderNumber: string) => `页面操作：将已选菜品移动到目标子单（Add to 或子单卡片）`)
  async receiveDishOnSuborder(targetOrderNumber: string): Promise<void> {
    const normalizedTargetOrderNumber = normalizeOrderNumber(targetOrderNumber);
    const movedByAddToButton = await this.clickAddToSuborderIfVisible(normalizedTargetOrderNumber);

    if (!movedByAddToButton) {
      await this.clickSuborder(normalizedTargetOrderNumber);
    }
  }

  @step((orderNumber: string, dishName: string) => `页面操作：点击子单 ${orderNumber} 中的菜品 ${dishName}`)
  async clickDish(orderNumber: string, dishName: string): Promise<void> {
    await this.expectLoaded();
    await this.suborders.clickDish(orderNumber, dishName);
  }

  @step((orderNumber: string, dishName: string) =>
    `页面读取：读取子单 ${orderNumber} 中菜品 ${dishName} 的展示值`,
  )
  async readDishDisplay(orderNumber: string, dishName: string): Promise<SplitOrderDishDisplay> {
    await this.expectLoaded();
    return await this.suborders.readDishDisplay(orderNumber, dishName);
  }

  @step((orderNumber: string, dishName: string) => `页面操作：点击子单 ${orderNumber} 中菜品 ${dishName} 的删除按钮`)
  async clickRemoveDish(orderNumber: string, dishName: string): Promise<void> {
    await this.expectLoaded();
    const dishItem = this.resolveDish(normalizeOrderNumber(orderNumber), dishName);
    await dishItem.getByRole('button', { name: REMOVE_DISH_ITEM_BUTTON_NAME }).click();
  }

  @step((orderNumber: string) => `页面操作：点击子单 ${orderNumber} 卡片`)
  async clickSuborder(orderNumber: string): Promise<void> {
    await this.suborders.clickCard(orderNumber);
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

    const submitState = await waitUntil(
      async () => ({
        blankOrdersVisible: await this.blankOrdersDialog.isVisible().catch(() => false),
        isHidden: await this.modal.isHidden().catch(() => false),
        url: this.page.url(),
      }),
      (state) => state.blankOrdersVisible || state.isHidden || state.url !== previousUrl,
      {
        timeout: 5_000,
        message: '提交分单后未出现空子单确认，也未关闭分单面板或切换页面。',
      },
    );

    if (submitState.blankOrdersVisible) {
      await expect(this.removeBlankOrdersButton).toBeVisible();
      await this.removeBlankOrdersButton.click();
      await expect(this.blankOrdersDialog).toBeHidden({ timeout: 10_000 });
    }

    return await this.waitForReturnPageState(previousUrl);
  }

  @step('页面读取：读取当前分单页面快照')
  async readSnapshot(): Promise<SplitOrderSnapshot> {
    await this.expectLoaded();
    const [remain, suborders, title, total] = await Promise.all([
      this.summary.readRemain(),
      this.suborders.readSnapshots(),
      this.title.innerText(),
      this.summary.readTotal(),
    ]);
    return {
      remain,
      suborders,
      title: title.replace(/\s+/g, ' ').trim(),
      total,
    };
  }

  @step((orderNumber: string, dishName: string) =>
    `页面读取：读取子单 ${orderNumber} 中菜品 ${dishName} 的平分比例`,
  )
  async readDishProportion(orderNumber: string, dishName: string): Promise<string | null> {
    await this.expectLoaded();
    return await this.suborders.readDishProportion(orderNumber, dishName);
  }

  @step((orderNumber: string, dishName: string) =>
    `页面读取：检查子单 ${orderNumber} 中是否存在菜品 ${dishName}`,
  )
  async hasDish(orderNumber: string, dishName: string): Promise<boolean> {
    return await this.suborders.hasDish(orderNumber, dishName);
  }

  @step((orderNumber: string, dishName: string) => `页面读取：判断子单 ${orderNumber} 的菜品 ${dishName} 是否允许按菜品平分`)
  async isDishEligibleForEvenSplit(orderNumber: string, dishName: string): Promise<boolean> {
    const snapshot = await this.readSnapshot();
    const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
    const suborder = snapshot.suborders.find(
      (currentSuborder) =>
        normalizeOrderNumber(currentSuborder.orderNumber) === normalizedOrderNumber,
    );
    const dish = suborder?.dishes.find((currentDish) => currentDish.name === dishName);
    const normalizedProportion = this.normalizeOptionalText(dish?.proportion);

    return !normalizedProportion || !/^1\/\d+$/.test(normalizedProportion);
  }

  @step((suborderIndex: string) =>
    `页面读取：读取分单索引 ${suborderIndex} 对应的子单号`,
  )
  async readSuborderOrderNumberByIndex(suborderIndex: string): Promise<string | null> {
    return await this.suborders.readOrderNumberByIndex(suborderIndex);
  }

  private resolveParentOrderNumber(orderNumbers: string[]): string | null {
    const parentPrefixes = orderNumbers
      .map((orderNumber) => {
        const matchedParts = orderNumber.match(/^(.+)-(\d+)$/);
        return matchedParts?.[1] ?? null;
      })
      .filter((prefix): prefix is string => Boolean(prefix));

    if (parentPrefixes.length === 0) {
      return null;
    }

    const [firstPrefix] = parentPrefixes;

    if (parentPrefixes.every((prefix) => prefix === firstPrefix)) {
      return firstPrefix;
    }

    return firstPrefix;
  }

  @step('页面读取：读取剩余金额')
  async readRemainAmount(): Promise<string | null> {
    const remainText = await this.remainValue.textContent().catch(() => null);
    return this.normalizeOptionalNumberText(remainText);
  }

  @step('页面读取：检查分单输入弹窗是否可见')
  async expectSplitInputVisible(): Promise<void> {
    await this.input.expectVisible();
  }

  private async fillSplitInputValue(value: number): Promise<void> {
    await this.input.fill(value);
  }

  private async isMoreMenuOpen(): Promise<boolean> {
    return (
      (await this.byAmountMenuItem.isVisible().catch(() => false)) ||
      (await this.unsplitMenuItem.isVisible().catch(() => false)) ||
      (await this.combineMenuItem.isVisible().catch(() => false))
    );
  }

  private async openMoreActionsIfNeeded(): Promise<void> {
    if (await this.isMoreMenuOpen()) {
      return;
    }

    const isMoreExpanded = (await this.moreButton.getAttribute('aria-expanded').catch(() => null)) === 'true';

    if (isMoreExpanded) {
      return;
    }

    if (await this.moreButton.isVisible().catch(() => false)) {
      await this.moreButton.click();
    }
  }

  private async clickSplitAction(
    menuItem: Locator,
    toolbarButton: Locator,
    actionLabel: string,
  ): Promise<void> {
    if (await menuItem.isVisible().catch(() => false)) {
      await menuItem.click();
      return;
    }

    if (await toolbarButton.isVisible().catch(() => false)) {
      await toolbarButton.click();
      return;
    }

    await this.openMoreActionsIfNeeded();
    await waitUntil(
      async () => ({
        isMenuItemVisible: await menuItem.isVisible().catch(() => false),
        isToolbarButtonVisible: await toolbarButton.isVisible().catch(() => false),
      }),
      (state) => state.isMenuItemVisible || state.isToolbarButtonVisible,
      {
        timeout: 5_000,
        message: `Split action "${actionLabel}" did not become visible after opening More.`,
      },
    );

    if (await menuItem.isVisible().catch(() => false)) {
      await menuItem.click();
      return;
    }

    if (await toolbarButton.isVisible().catch(() => false)) {
      await toolbarButton.click();
      return;
    }

    throw new Error(`Unable to find the "${actionLabel}" split action.`);
  }

  private resolveSuborder(orderNumber: string): Locator {
    return this.suborders.card(orderNumber);
  }

  private resolveAddToSuborderButton(targetOrderNumber: string): Locator {
    const normalizedTargetOrderNumber = normalizeOrderNumber(targetOrderNumber);

    return this.modal
      .getByTestId(SPLIT_ADD_TO_SUBORDER_BUTTON_TEST_ID)
      .filter({
        hasText: new RegExp(`^Add to #${escapeRegExp(normalizedTargetOrderNumber)}$`, 'i'),
      })
      .first();
  }

  private resolveDish(orderNumber: string, dishName: string): Locator {
    return this.suborders.dish(orderNumber, dishName);
  }

  private resolveCombineOrder(orderNumber: string): Locator {
    const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
    const buttonName = new RegExp(
      `^#${escapeRegExp(normalizedOrderNumber)}\\s+Total\\s+\\$`,
    );

    return this.combineDialog.getByRole('button', { name: buttonName });
  }

  private async readSuborderTotal(suborder: Locator): Promise<string | null> {
    const totalFromAttribute = await suborder.getAttribute('data-total').catch(() => null);
    return this.normalizeOptionalNumberText(totalFromAttribute);
  }

  private async waitForReturnPageState(
    previousUrl: string,
  ): Promise<SplitOrderReturnPage> {
    const settledState = await waitUntil(
      async () => {
        const currentUrl = this.page.url();

        return {
          currentUrl,
          destination: classifySplitOrderReturnUrl(currentUrl),
          splitPanelHidden: await this.modal.isHidden().catch(() => false),
        };
      },
      (state) =>
        isSplitOrderReturnStateSettled(
          previousUrl,
          state.currentUrl,
          state.splitPanelHidden,
        ),
      {
        timeout: 5_000,
        interval: 100,
        message:
          `提交分单后返回页未稳定。提交前 URL=${previousUrl}；` +
          '预期 Home、Recall 或 Order Dishes 页面且分单面板已关闭。',
      },
    );

    switch (settledState.destination) {
      case 'home': {
        const homePage = new HomePage(this.page);
        await homePage.expectPrimaryFunctionCardsVisible();
        return homePage;
      }
      case 'recall': {
        const recallPage = new RecallPage(this.page);
        await recallPage.expectLoaded();
        return recallPage;
      }
      case 'orderDishes': {
        const orderDishesPage = new OrderDishesPage(this.page);
        await orderDishesPage.expectLoaded();
        return orderDishesPage;
      }
      default:
        throw new Error(
          `无法识别分单返回页：提交前 URL=${previousUrl}，当前 URL=${settledState.currentUrl}。`,
        );
    }
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

}

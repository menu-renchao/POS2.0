import { expect, type Locator, type Page } from '@playwright/test';
import { HomePage } from './home.page';
import { OrderDishesPage } from './order-dishes.page';
import { RecallPage } from './recall.page';
import { waitForInputSettled } from '../utils/input-stability';
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
const SPLIT_DISH_ITEM_TEST_ID = 'pos-ui-dish-item';
const SPLIT_ADD_TO_SUBORDER_BUTTON_TEST_ID = 'button-default';
const REMOVE_DISH_ITEM_BUTTON_NAME = /^Remove dish item$/;

export class SplitOrderPage {
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
    this.splitFrame = this.page.frameLocator('iframe[data-wujie-id="splitPanel"]');

    this.modal = this.splitFrame.getByRole('dialog').first();
    this.title = this.modal.getByRole('heading').first();
    this.evenOrderButton = this.modal.getByRole('button', { name: /Even Order|平分订单/ }).first();
    this.bySeatsButton = this.modal.getByRole('button', { name: /By Seats|按座位分单/ }).first();
    this.evenItemsButton = this.modal.getByRole('button', { name: /Even Item|Even Items|平分菜品/ }).first();
    this.byAmountMenuItem = this.splitFrame.getByRole('menuitem', { name: /^By Amount$/ }).first();
    this.byAmountButton = this.modal.getByRole('button', { name: /^By Amount$|按金额分单$/ }).first();
    this.combineMenuItem = this.splitFrame.getByRole('menuitem', { name: /^Combine suborders$/ }).first();
    this.combineButton = this.modal
      .getByRole('button', { name: /^Combine suborders$|^Combine$|^Merge$|合并$/ })
      .first();
    this.unsplitMenuItem = this.splitFrame.getByRole('menuitem', { name: /^Unsplit$/ }).first();
    this.unsplitButton = this.modal.getByRole('button', { name: /^Unsplit$|取消分单$/ }).first();
    this.moreButton = this.modal.getByRole('button', { name: /^More$/ }).first();
    this.confirmButton = this.modal
      .locator('[data-testid="splitPanelModal-confirm-button"], [data-testid="split-panel-confirm"]')
      .or(this.modal.getByRole('button', { name: CONFIRM_BUTTON_NAME }).first())
      .first();
    this.cancelButton = this.modal.getByRole('button', { name: CANCEL_BUTTON_NAME }).first();
    this.addAmountButton = this.modal.getByRole('button', { name: /^(Add Suborder|新增子单)$/ }).first();
    this.subordersContainer = this.modal;
    this.totalValue = this.modal.locator('._value_1lomb_35, [class*="_value_"]').first();
    this.remainValue = this.modal.locator('._remainValue_1lomb_41, [class*="_remainValue_"]').first();
    this.splitInputDialog = this.splitFrame
      .getByRole('dialog')
      .filter({
        has: this.splitFrame.getByRole('heading', { name: /Even order|Even Item|平分订单|平分菜品|Split Input/i }),
      })
      .or(this.splitFrame.locator('.splitInputModalOverlay [role="dialog"], [data-testid="split-input-dialog"]'))
      .first();
    this.splitInputField = this.splitInputDialog
      .locator('[data-testid="split-input-value"]')
      .or(this.splitInputDialog.getByRole('textbox'))
      .first();
    this.splitInputConfirmButton = this.splitInputDialog
      .getByRole('button', { name: CONFIRM_BUTTON_NAME })
      .first();
    this.splitInputCancelButton = this.splitInputDialog
      .getByRole('button', { name: CANCEL_BUTTON_NAME })
      .first();
    this.combineDialog = this.splitFrame.locator('.splitCombineModal, [role="dialog"]').last();
    this.combineConfirmButton = this.combineDialog
      .getByRole('button', { name: CONFIRM_BUTTON_NAME })
      .first();
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
    await waitForInputSettled();
    await this.splitInputConfirmButton.click();
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
    const normalizedTargetOrderNumber = this.normalizeOrderNumber(targetOrderNumber);
    const movedByAddToButton = await this.clickAddToSuborderIfVisible(normalizedTargetOrderNumber);

    if (!movedByAddToButton) {
      await this.clickSuborder(normalizedTargetOrderNumber);
    }
  }

  @step((orderNumber: string, dishName: string) => `页面操作：点击子单 ${orderNumber} 中的菜品 ${dishName}`)
  async clickDish(orderNumber: string, dishName: string): Promise<void> {
    await this.expectLoaded();
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    const dishLocator = this.resolveDish(normalizedOrderNumber, dishName);

    if (await dishLocator.isVisible().catch(() => false)) {
      await dishLocator.click();
      return;
    }

    await this.modal.evaluate(
      (modalElement, payload: { dishName: string; orderNumber: string }) => {
        const normalizeText = (value: string | null | undefined): string =>
          String(value ?? '')
            .replace(/\s+/g, ' ')
            .trim();
        const orderLabelText = `#${payload.orderNumber}`;
        const findSuborderElement = (): HTMLElement | null => {
          const allElements = Array.from(modalElement.querySelectorAll<HTMLElement>('*'));
          const orderLabel = allElements.find(
            (element) => normalizeText(element.textContent) === orderLabelText,
          );

          if (!orderLabel) {
            return null;
          }

          let currentElement: HTMLElement | null = orderLabel;
          while (currentElement) {
            const currentText = normalizeText(currentElement.textContent);
            if (currentText.includes(orderLabelText) && currentText.includes('Print') && currentText.includes('Pay')) {
              return currentElement;
            }

            currentElement = currentElement.parentElement;
          }

          return null;
        };

        const suborderElement = findSuborderElement();
        if (!suborderElement) {
          throw new Error(`Unable to find split suborder: ${payload.orderNumber}`);
        }

        const dishItemElement = Array.from(
          suborderElement.querySelectorAll<HTMLElement>('[data-testid="pos-ui-dish-item"]'),
        ).find((element) => {
          const dishNameElement = element.querySelector('[class*="_dishName_"]');
          return normalizeText(dishNameElement?.textContent) === payload.dishName;
        });

        if (dishItemElement) {
          dishItemElement.click();
          return;
        }

        const dishTextElement = Array.from(suborderElement.querySelectorAll<HTMLElement>('*')).find(
          (element) => normalizeText(element.textContent) === payload.dishName,
        );

        if (!dishTextElement) {
          throw new Error(`Unable to find dish ${payload.dishName} in suborder ${payload.orderNumber}`);
        }

        const clickableElement =
          dishTextElement.closest<HTMLElement>(
            '[data-testid="pos-ui-dish-item"], button, [role="button"]',
          ) ?? dishTextElement;

        clickableElement.click();
      },
      { dishName, orderNumber: normalizedOrderNumber },
    );
  }

  @step((orderNumber: string, dishName: string) => `页面操作：点击子单 ${orderNumber} 中菜品 ${dishName} 的删除按钮`)
  async clickRemoveDish(orderNumber: string, dishName: string): Promise<void> {
    await this.expectLoaded();
    const dishItem = this.resolveDish(this.normalizeOrderNumber(orderNumber), dishName);
    await dishItem.getByRole('button', { name: REMOVE_DISH_ITEM_BUTTON_NAME }).click();
  }

  @step((orderNumber: string) => `页面操作：点击子单 ${orderNumber} 卡片`)
  async clickSuborder(orderNumber: string): Promise<void> {
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    const suborder = this.resolveSuborder(normalizedOrderNumber);
    const suborderBody = suborder.locator('[class*="_suborderBody_"]').first();
    const suborderHeader = suborder.locator('[class*="_suborderHeader_"]').first();

    if (await suborderBody.isVisible().catch(() => false)) {
      await suborderBody.click({ position: { x: 8, y: 8 } });
      return;
    }

    if (await suborderHeader.isVisible().catch(() => false)) {
      await suborderHeader.click();
      return;
    }

    await this.modal.evaluate((modalElement, targetOrderNumber: string) => {
      const normalizeText = (value: string | null | undefined): string =>
        String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim();
      const orderLabelText = `#${targetOrderNumber}`;
      const attributedSuborder = modalElement.querySelector<HTMLElement>(
        `[data-testid="split-suborder"][data-order-number="${targetOrderNumber}"], [class*="_suborderContainer_"][data-order-number="${targetOrderNumber}"], [class*="_suborderCard_"][data-order-number="${targetOrderNumber}"]`,
      );

      if (attributedSuborder) {
        const clickTarget =
          attributedSuborder.querySelector<HTMLElement>('[class*="_suborderBody_"]') ??
          attributedSuborder;

        clickTarget.click();
        return;
      }

      const allElements = Array.from(modalElement.querySelectorAll<HTMLElement>('*'));
      const orderLabel = allElements.find(
        (element) => normalizeText(element.textContent) === orderLabelText,
      );

      if (!orderLabel) {
        throw new Error(`Unable to find split suborder: ${targetOrderNumber}`);
      }

      let currentElement: HTMLElement | null = orderLabel;
      while (currentElement) {
        const currentText = normalizeText(currentElement.textContent);

        if (
          currentElement.matches('[data-testid="split-suborder"], [class*="_suborderContainer_"], [class*="_suborderCard_"]')
        ) {
          const clickTarget =
            currentElement.querySelector<HTMLElement>('[class*="_suborderBody_"]') ?? currentElement;

          clickTarget.click();
          return;
        }

        if (
          currentText.includes(orderLabelText) &&
          currentText.includes('Print') &&
          currentText.includes('Pay')
        ) {
          currentElement.click();
          return;
        }

        currentElement = currentElement.parentElement;
      }

      throw new Error(`Unable to find clickable split suborder container: ${targetOrderNumber}`);
    }, normalizedOrderNumber);
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
    const snapshot = await this.modal.evaluate((modal) => {
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

      const findSuborderElements = (): HTMLElement[] => {
        const attributedSuborders = Array.from(
          modal.querySelectorAll<HTMLElement>(
            '[data-testid="split-suborder"], [class*="_suborderContainer_"], [class*="_suborderCard_"]',
          ),
        );

        if (attributedSuborders.length > 0) {
          return attributedSuborders;
        }

        const orderLabels = Array.from(modal.querySelectorAll<HTMLElement>('*')).filter((element) =>
          /^#\d+-\d+$/.test(normalizeText(element.textContent)),
        );

        return orderLabels
          .map((orderLabel) => {
            let currentElement: HTMLElement | null = orderLabel;

            while (currentElement) {
              const currentText = normalizeText(currentElement.textContent);

              if (
                currentText.includes(normalizeText(orderLabel.textContent)) &&
                currentText.includes('Print') &&
                currentText.includes('Pay')
              ) {
                return currentElement;
              }

              currentElement = currentElement.parentElement;
            }

            return orderLabel.parentElement;
          })
          .filter((suborder): suborder is HTMLElement => suborder !== null);
      };

      const suborders = findSuborderElements().map((suborder) => {
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
        const parseAttributedDish = (dishElement: HTMLElement) => {
          const dishName =
            normalizeOptionalText(dishElement.getAttribute('data-dish-name')) ??
            normalizeOptionalText(dishElement.querySelector('[class*="_dishName_"]')?.textContent);

          if (!dishName) {
            return null;
          }

          return {
            name: dishName,
            proportion:
              normalizeOptionalText(dishElement.getAttribute('data-proportion')) ??
              normalizeOptionalText(dishElement.querySelector('[class*="_proportion_"]')?.textContent),
          };
        };

        const parseSplitProportion = (
          ariaLabel: string,
          buttonText: string,
          proportionElementText: string | null | undefined,
        ): string | null => {
          const normalizedProportionElement = normalizeOptionalText(proportionElementText);

          if (normalizedProportionElement && /^1\/\d+$/.test(normalizedProportionElement)) {
            return normalizedProportionElement;
          }

          for (const sourceText of [ariaLabel, buttonText]) {
            const matchedProportion = sourceText.match(/(?:^|\s)(1\/\d+)(?!\d)/);

            if (matchedProportion?.[1]) {
              return matchedProportion[1];
            }
          }

          return null;
        };

        const parseSplitDishName = (
          ariaLabel: string,
          buttonText: string,
          dataDishName: string | null,
          dishNameElementText: string | null | undefined,
        ): string | null => {
          return (
            normalizeOptionalText(dataDishName) ??
            normalizeOptionalText(dishNameElementText) ??
            normalizeOptionalText(ariaLabel.match(/\d+\/\d+\s+\d+\s+(.+?)\s+\$/)?.[1]) ??
            normalizeOptionalText(buttonText.match(/\d+\/\d+\s+\d+\s+(.+?)\s+\$/)?.[1])
          );
        };

        const parseButtonDish = (button: HTMLButtonElement) => {
          const buttonText = normalizeText(button.textContent);
          const ariaLabel = normalizeText(button.getAttribute('aria-label'));
          const labelText = ariaLabel || buttonText;

          if (!labelText || /^(Print|Pay|Remove|Add to)/i.test(labelText)) {
            return null;
          }

          const dishName = parseSplitDishName(
            ariaLabel,
            buttonText,
            button.getAttribute('data-dish-name'),
            button.querySelector('[class*="_dishName_"]')?.textContent,
          );

          if (!dishName) {
            return null;
          }

          return {
            name: dishName,
            proportion: parseSplitProportion(
              ariaLabel,
              buttonText,
              button.querySelector('[class*="_proportion_"]')?.textContent,
            ),
          };
        };

        const liveDishes = Array.from(
          suborder.querySelectorAll<HTMLElement>('[data-testid="pos-ui-dish-item"]'),
        )
          .map(parseAttributedDish)
          .filter((dish): dish is SplitOrderDishSnapshot => dish !== null);
        const attributedDishes = Array.from(
          suborder.querySelectorAll<HTMLElement>(
            '[data-testid="split-dish"], [class*="_dishItem_"][data-dish-name]',
          ),
        )
          .map(parseAttributedDish)
          .filter((dish): dish is SplitOrderDishSnapshot => dish !== null);
        const dishes =
          liveDishes.length > 0
            ? liveDishes
            : attributedDishes.length > 0
              ? attributedDishes
              : Array.from(suborder.querySelectorAll<HTMLButtonElement>('button'))
                  .map(parseButtonDish)
                  .filter((dish): dish is SplitOrderDishSnapshot => dish !== null);

        const resolvedOrderNumber =
          orderNumber ||
          (Array.from(suborder.querySelectorAll<HTMLElement>('*'))
            .map((element) => normalizeText(element.textContent))
            .find((text) => /^#\d+-\d+$/.test(text))
            ?.replace(/^#/, '') ??
            '');

        return {
          dishes,
          orderNumber: resolvedOrderNumber.replace(/^#/, ''),
          paidStatus,
          seats,
          total,
        };
      });

      const remainSummary = modal.querySelector('[data-testid="remain-summary"]:not([hidden])');
      const remain =
        normalizeNumberText(remainSummary?.querySelector('._remainValue_1lomb_41')?.textContent) ??
        normalizeNumberText(modal.querySelector('._remainValue_1lomb_41, [class*="_remainValue_"]')?.textContent);

      return {
        remain,
        suborders,
        title: normalizeText(modal.querySelector('h1, h2, h3, [role="heading"]')?.textContent),
        total: normalizeNumberText(modal.querySelector('._value_1lomb_35, [class*="_value_"]')?.textContent),
      };
    });

    if (!snapshot) {
      throw new Error('Unable to read the split order snapshot because the split panel was not found.');
    }

    return snapshot;
  }

  @step((orderNumber: string, dishName: string) => `页面读取：读取子单 ${orderNumber} 中菜品 ${dishName} 的平分比例`)
  async readDishProportion(orderNumber: string, dishName: string): Promise<string | null> {
    await this.expectLoaded();

    const proportion = await this.modal.evaluate(
      (modalElement, payload: { dishName: string; orderNumber: string }) => {
        const normalizeText = (value: string | null | undefined): string =>
          String(value ?? '')
            .replace(/\s+/g, ' ')
            .trim();
        const orderLabelText = `#${payload.orderNumber}`;

        const findSuborderElement = (): HTMLElement | null => {
          const attributedSuborder = modalElement.querySelector<HTMLElement>(
            `[data-testid="split-suborder"][data-order-number="${payload.orderNumber}"], [class*="_suborderContainer_"][data-order-number="${payload.orderNumber}"], [class*="_suborderCard_"][data-order-number="${payload.orderNumber}"]`,
          );

          if (attributedSuborder) {
            return attributedSuborder;
          }

          const orderLabel = Array.from(modalElement.querySelectorAll<HTMLElement>('*')).find(
            (element) => normalizeText(element.textContent) === orderLabelText,
          );

          if (!orderLabel) {
            return null;
          }

          let currentElement: HTMLElement | null = orderLabel;
          while (currentElement) {
            const currentText = normalizeText(currentElement.textContent);

            if (
              currentElement.matches(
                '[data-testid="split-suborder"], [class*="_suborderContainer_"], [class*="_suborderCard_"]',
              )
            ) {
              return currentElement;
            }

            if (
              currentText.includes(orderLabelText) &&
              currentText.includes('Print') &&
              currentText.includes('Pay')
            ) {
              return currentElement;
            }

            currentElement = currentElement.parentElement;
          }

          return orderLabel.parentElement;
        };

        const readProportionFromDishElement = (dishElement: HTMLElement): string | null => {
          const proportionText = normalizeText(
            dishElement.getAttribute('data-proportion') ??
              dishElement.querySelector('[class*="_proportion_"]')?.textContent,
          );

          if (proportionText && /^1\/\d+$/.test(proportionText)) {
            return proportionText;
          }

          return null;
        };

        const suborderElement = findSuborderElement();

        if (!suborderElement) {
          return null;
        }

        const dishElements = Array.from(
          suborderElement.querySelectorAll<HTMLElement>(
            '[data-testid="pos-ui-dish-item"], [data-testid="split-dish"], [class*="_dishItem_"]',
          ),
        );

        for (const dishElement of dishElements) {
          const dishNameText = normalizeText(
            dishElement.getAttribute('data-dish-name') ??
              dishElement.querySelector('[class*="_dishName_"]')?.textContent,
          );

          if (dishNameText !== payload.dishName) {
            continue;
          }

          const proportion = readProportionFromDishElement(dishElement);

          if (proportion) {
            return proportion;
          }
        }

        const dishButtons = Array.from(
          suborderElement.querySelectorAll<HTMLElement>('[role="button"]'),
        ).filter((button) => normalizeText(button.getAttribute('aria-label')) !== 'Remove dish item');

        for (const dishButton of dishButtons) {
          const dishNameText = normalizeText(
            dishButton.querySelector('[class*="_dishName_"]')?.textContent,
          );

          if (dishNameText !== payload.dishName) {
            continue;
          }

          const proportion = readProportionFromDishElement(dishButton);

          if (proportion) {
            return proportion;
          }
        }

        return null;
      },
      { dishName, orderNumber: this.normalizeOrderNumber(orderNumber) },
    );

    return proportion;
  }

  @step((orderNumber: string, dishName: string) => `页面读取：检查子单 ${orderNumber} 中是否存在菜品 ${dishName}`)
  async hasDish(orderNumber: string, dishName: string): Promise<boolean> {
    const snapshot = await this.readSnapshot();
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);

    return (
      snapshot.suborders
        .find(
          (suborder) => this.normalizeOrderNumber(suborder.orderNumber) === normalizedOrderNumber,
        )
        ?.dishes.some((dish) => dish.name === dishName) ?? false
    );
  }

  @step((orderNumber: string, dishName: string) => `页面读取：判断子单 ${orderNumber} 的菜品 ${dishName} 是否允许按菜品平分`)
  async isDishEligibleForEvenSplit(orderNumber: string, dishName: string): Promise<boolean> {
    const snapshot = await this.readSnapshot();
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    const suborder = snapshot.suborders.find(
      (currentSuborder) =>
        this.normalizeOrderNumber(currentSuborder.orderNumber) === normalizedOrderNumber,
    );
    const dish = suborder?.dishes.find((currentDish) => currentDish.name === dishName);
    const normalizedProportion = this.normalizeOptionalText(dish?.proportion);

    return !normalizedProportion || !/^1\/\d+$/.test(normalizedProportion);
  }

  @step((suborderIndex: string) => `页面读取：根据子单序号 ${suborderIndex} 解析子单单号（母单 x 对应 x-1、x-2…）`)
  async readSuborderOrderNumberByIndex(suborderIndex: string): Promise<string | null> {
    const snapshot = await this.readSnapshot();
    const normalizedIndex = this.normalizeOrderNumber(suborderIndex);
    const orderNumbers = snapshot.suborders.map((suborder) =>
      this.normalizeOrderNumber(suborder.orderNumber),
    );

    // 进入分单页初始态通常仅有一个子单，展示为 x-1，业务上视同母单；序号 1 即对应该子单。
    if (orderNumbers.length === 1 && normalizedIndex === '1') {
      return orderNumbers[0];
    }

    const parentOrderNumber = this.resolveParentOrderNumber(orderNumbers);

    if (parentOrderNumber) {
      const resolvedOrderNumber = `${parentOrderNumber}-${normalizedIndex}`;

      if (orderNumbers.includes(resolvedOrderNumber)) {
        return resolvedOrderNumber;
      }
    }

    for (const orderNumber of orderNumbers) {
      if (orderNumber === normalizedIndex) {
        return orderNumber;
      }

      if (orderNumber.endsWith(`-${normalizedIndex}`)) {
        return orderNumber;
      }
    }

    return null;
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
    await expect(this.splitInputDialog).toBeVisible();
  }

  private async fillSplitInputValue(value: number): Promise<void> {
    await this.expectSplitInputVisible();

    const filledByInput = await this.splitInputField
      .fill(String(value))
      .then(() => true)
      .catch(() => false);

    if (filledByInput) {
      return;
    }

    for (const digit of String(value)) {
      await this.splitInputDialog.getByRole('button', { name: digit, exact: true }).click();
    }
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
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);
    const orderLabel = `#${normalizedOrderNumber}`;
    const escapedOrderNumber = this.escapeCssAttribute(normalizedOrderNumber);

    const attributedSuborder = this.subordersContainer
      .locator(
        [
          `[data-testid="split-suborder"][data-order-number="${escapedOrderNumber}"]`,
          `[class*="_suborderContainer_"][data-order-number="${escapedOrderNumber}"]`,
          `[class*="_suborderCard_"][data-order-number="${escapedOrderNumber}"]`,
        ].join(', '),
      )
      .first();

    return attributedSuborder.or(
      this.subordersContainer
        .locator('[class*="_suborderContainer_"], [class*="_suborderCard_"], [data-testid="split-suborder"]')
        .filter({ hasText: orderLabel })
        .first(),
    );
  }

  private resolveAddToSuborderButton(targetOrderNumber: string): Locator {
    const normalizedTargetOrderNumber = this.normalizeOrderNumber(targetOrderNumber);

    return this.modal
      .getByTestId(SPLIT_ADD_TO_SUBORDER_BUTTON_TEST_ID)
      .filter({
        hasText: new RegExp(`^Add to #${this.escapeRegExp(normalizedTargetOrderNumber)}$`, 'i'),
      })
      .first();
  }

  private resolveDish(orderNumber: string, dishName: string): Locator {
    const suborder = this.resolveSuborder(orderNumber);
    const escapedDishName = this.escapeCssAttribute(dishName);
    const dishNamePattern = new RegExp(`^${this.escapeRegExp(dishName)}$`);
    const dishNameLocator = suborder.locator('[class*="_dishName_"]').filter({ hasText: dishNamePattern });

    return suborder
      .getByTestId(SPLIT_DISH_ITEM_TEST_ID)
      .filter({ has: dishNameLocator })
      .first()
      .or(
        suborder
          .getByRole('button')
          .filter({ has: dishNameLocator })
          .filter({ hasNot: suborder.getByRole('button', { name: REMOVE_DISH_ITEM_BUTTON_NAME }) })
          .first(),
      )
      .or(
        suborder
          .locator(
            `[data-testid="split-dish"][data-dish-name="${escapedDishName}"], [class*="_dishItem_"][data-dish-name="${escapedDishName}"]`,
          )
          .first(),
      );
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

  private parseSplitDishProportionFromText(text: string): string | null {
    const matchedProportion = text.match(/(?:^|\s)(1\/\d+)(?!\d)/);
    return matchedProportion?.[1] ?? null;
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

  private escapeCssAttribute(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

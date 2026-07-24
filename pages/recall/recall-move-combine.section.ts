import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import { formatOrderNumber } from '../../utils/text';
import { waitUntil } from '../../utils/wait';
import type { OrderDetailsContext } from '../shared/order-details/order-details-context';
import type { RecallOrderActionsSection } from './recall-order-actions.section';

export class RecallMoveCombineSection {
  private readonly combineChargeConfirmButton: Locator;
  private readonly combineChargeWarning: Locator;
  private readonly combineSelectionPrompt: Locator;
  private readonly firstOrderDishItem: Locator;
  private readonly moveDishesTargetSelectionPrompt: Locator;
  private readonly moveDishesToExistingOrderButton: Locator;
  private readonly moveDishesToNewOrderButton: Locator;

  constructor(
    private readonly page: Page,
    private readonly ctx: OrderDetailsContext,
    private readonly actions: RecallOrderActionsSection,
    private readonly orderListContainer: Locator,
  ) {
    this.firstOrderDishItem = ctx.dialog.getByTestId('pos-ui-dish-item').first();
    this.moveDishesToExistingOrderButton = page.getByTestId(
      'shared-order-detail-move-dishes-to-existing-order',
    );
    this.moveDishesToNewOrderButton = page.getByTestId(
      'shared-order-detail-move-dishes-to-new-order',
    );
    this.moveDishesTargetSelectionPrompt = page
      .getByText('Select an order in Recall to', { exact: false })
      .first();
    this.combineSelectionPrompt = page.getByText(
      'Please select another order to combine',
      { exact: true },
    );
    this.combineChargeWarning = page
      .getByTestId('notification')
      .filter({ hasText: 'There are charge in this order' })
      .first();
    this.combineChargeConfirmButton = page.getByTestId(
      'shared-order-detail-combine-confirm-yes',
    );
  }

  @step('页面操作：打开订单详情的移菜操作')
  async openMoveItem(): Promise<void> {
    await this.actions.clickMore('moveItem');
  }

  @step('页面操作：选择订单详情中的第一道菜')
  async selectFirstDish(): Promise<void> {
    await expect(this.firstOrderDishItem).toBeVisible({ timeout: 10_000 });
    await this.firstOrderDishItem.click();
  }

  @step('页面校验：移菜操作面板已显示')
  async expectMoveOutReady(): Promise<void> {
    await expect(this.moveDishesToExistingOrderButton).toBeVisible({
      timeout: 10_000,
    });
  }

  @step('页面操作：选择将菜品移动到已有订单')
  async chooseExistingOrder(): Promise<void> {
    await expect(this.moveDishesToExistingOrderButton).toBeVisible({
      timeout: 10_000,
    });
    await this.moveDishesToExistingOrderButton.click();
  }

  @step('页面校验：可以将菜品移动到新订单')
  async expectNewOrderReady(): Promise<void> {
    await expect(this.moveDishesToNewOrderButton).toBeVisible({
      timeout: 10_000,
    });
  }

  @step('页面操作：选择将菜品移动到新订单')
  async chooseNewOrder(): Promise<void> {
    await expect(this.moveDishesToNewOrderButton).toBeVisible({
      timeout: 10_000,
    });
    await this.moveDishesToNewOrderButton.click();
  }

  @step('页面校验：Recall 已进入移菜目标订单选择状态')
  async expectTargetSelectionReady(): Promise<void> {
    await expect(this.moveDishesTargetSelectionPrompt).toBeVisible({
      timeout: 10_000,
    });
  }

  @step((orderNumber: string) => `页面操作：选择订单 ${orderNumber} 作为移菜目标订单`)
  async selectMoveTarget(orderNumber: string): Promise<void> {
    await this.clickOrderListTarget(orderNumber);
  }

  @step((targetOrderNumber: string) =>
    `页面校验：移菜后的目标订单 ${targetOrderNumber} 详情已显示`,
  )
  async expectMovedOrderReady(targetOrderNumber: string): Promise<void> {
    await this.expectDetailsReady({
      expectedOrderNumber: formatOrderNumber(targetOrderNumber),
      message: 'Recall 移菜后的目标订单详情未完成加载。',
    });
  }

  @step((sourceOrderNumber: string) =>
    `页面校验：从订单 ${sourceOrderNumber} 移出的菜品已显示在新订单详情中`,
  )
  async expectMovedToNewOrderReady(sourceOrderNumber: string): Promise<void> {
    const sourceOrderNumberText = formatOrderNumber(sourceOrderNumber);

    await waitUntil(
      async () => {
        const detailsText = await this.readActiveDetailsText();
        const visibleOrderNumber = detailsText.match(/#\d+/)?.[0] ?? null;
        return {
          hasItems: await this.hasReadableItems(),
          hasNewOrderNumber:
            visibleOrderNumber !== null &&
            visibleOrderNumber !== sourceOrderNumberText,
          hasPriceSummary: await this.ctx.priceSummaryToggle
            .isVisible()
            .catch(() => false),
        };
      },
      (state) =>
        state.hasItems && state.hasNewOrderNumber && state.hasPriceSummary,
      {
        timeout: 15_000,
        interval: 100,
        message: 'Recall 移菜后的新订单详情未完成加载。',
      },
    );
  }

  @step('页面操作：打开订单详情的合单操作')
  async openCombine(): Promise<void> {
    await this.actions.clickMore('combine');
  }

  @step('页面校验：Recall 已进入合单目标订单选择状态')
  async expectCombineTargetSelectionReady(): Promise<void> {
    await expect(this.combineSelectionPrompt).toBeVisible({
      timeout: 10_000,
    });
  }

  @step((orderNumber: string) => `页面操作：选择订单 ${orderNumber} 作为合单目标订单`)
  async selectCombineTarget(orderNumber: string): Promise<void> {
    await this.clickOrderListTarget(orderNumber);
  }

  @step('页面操作：存在加收合单警告时确认继续')
  async confirmChargeWarningIfNeeded(): Promise<void> {
    const warningVisible = await waitUntil(
      async () => await this.combineChargeWarning.isVisible().catch(() => false),
      (isVisible) => isVisible,
      {
        timeout: 3_000,
        interval: 100,
        message: 'Recall 合单加收警告未出现。',
      },
    ).catch(() => false);

    if (!warningVisible) {
      return;
    }

    await expect(this.combineChargeConfirmButton).toBeVisible({
      timeout: 10_000,
    });
    await this.combineChargeConfirmButton.click();
  }

  @step((retainedOrderNumber: string) =>
    `页面校验：Recall 合单后保留的订单 ${retainedOrderNumber} 详情已显示`,
  )
  async expectCombinedOrderReady(retainedOrderNumber: string): Promise<void> {
    await this.expectDetailsReady({
      expectedOrderNumber: formatOrderNumber(retainedOrderNumber),
      message: 'Recall 合单后的订单详情未完成加载。',
    });
  }

  private async clickOrderListTarget(orderNumber: string): Promise<void> {
    const targetOrderLabel = this.orderListContainer
      .getByText(formatOrderNumber(orderNumber), { exact: true })
      .first();
    await expect(targetOrderLabel).toBeVisible({ timeout: 10_000 });
    await targetOrderLabel.click();
  }

  private async expectDetailsReady(options: {
    expectedOrderNumber: string;
    message: string;
  }): Promise<void> {
    await waitUntil(
      async () => {
        const detailsText = await this.readActiveDetailsText();
        return {
          hasItems: await this.hasReadableItems(),
          hasTargetOrderNumber: detailsText.includes(
            options.expectedOrderNumber,
          ),
          hasPriceSummary: await this.ctx.priceSummaryToggle
            .isVisible()
            .catch(() => false),
        };
      },
      (state) =>
        state.hasItems &&
        state.hasTargetOrderNumber &&
        state.hasPriceSummary,
      {
        timeout: 15_000,
        interval: 100,
        message: options.message,
      },
    );
  }

  private async hasReadableItems(): Promise<boolean> {
    return await this.ctx.dishItems.first().isVisible().catch(() => false);
  }

  private async readActiveDetailsText(): Promise<string> {
    return (await this.ctx.dialog.innerText())
      .replace(/\s+/g, ' ')
      .trim();
  }
}

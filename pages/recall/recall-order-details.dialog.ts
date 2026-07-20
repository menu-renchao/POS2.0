import {
  expect,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  findFirstVisibleLocator,
  resolveFirstVisibleLocator,
} from '../shared/locator-scope';
import { step } from '../../utils/step';
import { waitForInputSettled } from '../../utils/input-stability';
import { waitUntil } from '../../utils/wait';
import { OrderDishesPage } from '../order-dishes.page';
import { PaymentPage } from '../payment.page';
import { SplitOrderPage } from '../split-order.page';
import type { RecallFilterBarSection } from './recall-filter-bar.section';
import {
  escapeRegExp,
  normalizeOrderNumber,
  recallScopedTestId,
} from './recall-reads.section';
import type {
  RecallCustomerInfo,
  RecallMemberInfo,
  RecallOrderContext,
  RecallOrderDetailAction,
  RecallOrderDetailsMoreAction,
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderItemAddition,
  RecallOrderPaymentRecord,
} from './recall.types';

const recallOrderDetailActionNames = {
  edit: 'Edit',
  send: 'Send',
  print: 'Print',
  pay: 'Pay',
  split: 'Split',
  discount: 'Discount',
  reopen: 'Reopen',
  more: 'More',
} as const satisfies Record<RecallOrderDetailAction, string>;

const recallOrderDetailActionTestIds: Partial<Record<RecallOrderDetailAction, string>> = {
  edit: 'shared-order-detail-side-action-editod',
  pay: 'shared-order-detail-side-action-pay',
  more: 'shared-order-detail-more-trigger',
};

const recallOrderDetailsMoreActionNames = {
  charge: 'Charge',
  moveItem: 'Move Item',
  combine: 'Combine',
  tips: 'Tips',
  paging: 'Paging',
  callOff: 'Call Off',
  clearTable: 'Clear Table',
  copy: 'Copy',
  void: 'Void',
  sort: 'Sort',
} as const satisfies Record<RecallOrderDetailsMoreAction, string>;

const recallOrderDetailsMoreActionTestIds: Partial<
  Record<RecallOrderDetailsMoreAction, string>
> = {
  moveItem: 'shared-order-detail-more-action-movedishesout',
  combine: 'shared-order-detail-more-action-combinOd',
};

type SplitChargePromptAction = 'remove' | 'keep';

const splitTargetReferencePrefix = 'target-order-id:';

function decodeSplitTargetReference(targetOrderNumber: string): string | null {
  return targetOrderNumber.startsWith(splitTargetReferencePrefix)
    ? targetOrderNumber.slice(splitTargetReferencePrefix.length)
    : null;
}

export class RecallOrderDetailsDialog {
  private readonly openOrderCards: Locator;
  private readonly visibleOrderDetailsDialogs: Locator;
  readonly orderDetailsDialog: Locator;
  private readonly orderDetailsEditButton: Locator;
  private readonly orderDetailsPayButton: Locator;
  readonly orderDetailsMoreButton: Locator;
  private readonly sharedOrderDetailsMoreButton: Locator;
  private readonly legacyOrderDetailsMoreButton: Locator;
  private readonly namedOrderDetailsMoreButton: Locator;
  private readonly orderDetailsTipsButton: Locator;
  private readonly splitChargePromptDialog: Locator;
  private readonly splitChargePromptKeepButton: Locator;
  private readonly splitChargePromptRemoveButton: Locator;
  private readonly combineSelectionPrompt: Locator;
  private readonly combineChargeWarning: Locator;
  private readonly combineChargeConfirmButton: Locator;
  private readonly combineResultPriceSummaryToggle: Locator;
  private readonly firstOrderDishItem: Locator;
  private readonly orderDishItemByName: (dishName: string) => Locator;
  private readonly moveDishesToExistingOrderButton: Locator;
  private readonly moveDishesToNewOrderButton: Locator;
  private readonly moveDishesTargetSelectionPrompt: Locator;
  private readonly globalLoadingOverlay: Locator;
  private readonly globalLoadingBackdrops: Locator;
  private readonly orderDetailsServerButton: Locator;
  private readonly splitTargetOrderCards: Locator;
  private readonly splitTargetOrderCardById: (targetOrderId: string) => Locator;
  private readonly splitTargetOrderCardByNumber: (targetOrderNumber: string) => Locator;

  constructor(
    readonly page: Page,
    private readonly filterBar: RecallFilterBarSection,
  ) {
    this.openOrderCards = this.page.locator(
      '[data-test-id^="shared-order-card-open-"], [data-testid^="shared-order-card-open-"]',
    );
    this.visibleOrderDetailsDialogs = this.page.locator(
      '[role="dialog"][data-testid="pos-ui-modal"]:visible',
    );
    this.orderDetailsDialog = this.page
      .locator('[role="dialog"][data-testid="pos-ui-modal"]:visible')
      .last();
    this.splitTargetOrderCards = this.page.locator(
      '[data-test-id^="shared-order-detail-select-target-order-"]',
    );
    this.splitTargetOrderCardById = (targetOrderId: string) =>
      this.page
        .locator(
          `[data-test-id="shared-order-detail-select-target-order-${targetOrderId}"]`,
        )
        .first();
    this.splitTargetOrderCardByNumber = (targetOrderNumber: string) =>
      this.splitTargetOrderCards
        .filter({ has: this.page.getByText(targetOrderNumber, { exact: true }) })
        .first();
    this.orderDetailsEditButton = recallScopedTestId(
      this.orderDetailsDialog,
      'shared-order-detail-side-action-editod',
    );
    this.orderDetailsPayButton = recallScopedTestId(
      this.orderDetailsDialog,
      'shared-order-detail-side-action-pay',
    );
    this.orderDetailsMoreButton = recallScopedTestId(
      this.orderDetailsDialog,
      'recall2-order-detail-more',
    );
    this.sharedOrderDetailsMoreButton = recallScopedTestId(
      this.page,
      'shared-order-detail-more-trigger',
    );
    this.legacyOrderDetailsMoreButton = this.page.locator('#odsmymoreicon');
    this.namedOrderDetailsMoreButton = this.page.getByRole('button', { name: /^MoreIcon More$/i });
    this.orderDetailsTipsButton = recallScopedTestId(this.page, 'recall2-order-detail-tips');
    this.orderDetailsServerButton = recallScopedTestId(
      this.orderDetailsDialog,
      'shared-order-detail-action-server',
    );
    this.splitChargePromptDialog = this.page
      .getByRole('alertdialog', { name: 'Notification' })
      .filter({ hasText: 'inconsistent split amounts' })
      .first();
    this.splitChargePromptKeepButton = recallScopedTestId(
      this.splitChargePromptDialog,
      'button-keep',
    );
    this.splitChargePromptRemoveButton = recallScopedTestId(
      this.splitChargePromptDialog,
      'button-remove',
    );
    this.combineSelectionPrompt = this.page.getByText(
      'Please select another order to combine',
      { exact: true },
    );
    this.combineChargeWarning = this.page
      .locator('[data-testid="notification"], [data-test-id="notification"]')
      .filter({ hasText: 'There are charge in this order' })
      .first();
    this.combineChargeConfirmButton = recallScopedTestId(
      this.page,
      'shared-order-detail-combine-confirm-yes',
    );
    this.combineResultPriceSummaryToggle = recallScopedTestId(
      this.orderDetailsDialog,
      'shared-order-price-summary-toggle',
    );
    this.firstOrderDishItem = recallScopedTestId(this.orderDetailsDialog, 'pos-ui-dish-item');
    this.orderDishItemByName = (dishName: string) =>
      this.orderDetailsDialog
        .getByRole('button', { name: new RegExp(escapeRegExp(dishName)) })
        .first();
    this.moveDishesToExistingOrderButton = recallScopedTestId(
      this.page,
      'shared-order-detail-move-dishes-to-existing-order',
    );
    this.moveDishesToNewOrderButton = recallScopedTestId(
      this.page,
      'shared-order-detail-move-dishes-to-new-order',
    );
    this.moveDishesTargetSelectionPrompt = this.page
      .getByText('Select an order in Recall to', { exact: false })
      .first();
    this.globalLoadingOverlay = this.page.locator('#floatmsgbx');
    this.globalLoadingBackdrops = this.page
      .getByTestId('pos-ui-loading-overlay')
      .filter({ visible: true });
  }

  @step((orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `页面操作：打开订单 ${orderNumber} 的详情弹窗并进入子单 ${targetOrderNumber}`
      : `页面操作：打开订单 ${orderNumber} 的详情弹窗`,
  )
  async openOrderDetails(orderNumber: string, targetOrderNumber?: string): Promise<void> {
    const normalizedOrderNumber = normalizeOrderNumber(orderNumber);

    await this.dismissOrderDetailsDialogIfNeeded();
    await this.clickVisibleOrderNumber(normalizedOrderNumber);
    await this.waitForOrderDetailsDialogReady();
    await this.waitForParentOrderDetailsReady(normalizedOrderNumber);
    await this.selectSplitTargetOrderIfNeeded(targetOrderNumber);
  }

  @step('页面读取：读取当前 Recall 订单详情中的可选子单号')
  async readTargetOrderNumbers(): Promise<string[]> {
    await this.waitForOrderDetailsDialogReady();
    return await this.splitTargetOrderCards.evaluateAll((cardElements, referencePrefix) => {
      const isVisible = (element: Element): boolean => {
        const computedStyle = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          computedStyle.display !== 'none' &&
          computedStyle.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      return cardElements.filter(isVisible).map((cardElement) => {
        const targetOrderId = (cardElement.getAttribute('data-test-id') ?? '').match(
          /^shared-order-detail-select-target-order-(\d+)$/,
        )?.[1];

        if (!targetOrderId) {
          throw new Error('Recall 子单选择卡缺少合法的 data-test-id 订单 ID。');
        }

        return `${referencePrefix}${targetOrderId}`;
      });
    }, splitTargetReferencePrefix);
  }

  @step((targetOrderNumber: string) => `页面操作：在当前 Recall 订单详情中切换到子单 ${targetOrderNumber}`)
  async selectTargetOrder(targetOrderNumber: string): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.selectSplitTargetOrderIfNeeded(targetOrderNumber);
  }

  @step('页面操作：打开 Recall 列表第一张可见订单卡片的详情弹窗')
  async openFirstVisibleOrderDetails(): Promise<void> {
    if (await this.orderDetailsDialog.isVisible().catch(() => false)) {
      return;
    }

    await this.clickFirstVisibleOrderCard();
    await this.waitForOrderDetailsDialogReady();
  }

  @step((orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `页面操作：打开 Recall 订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击编辑`
      : `页面操作：打开 Recall 订单 ${orderNumber} 并点击编辑`,
  )
  async openOrderForEditing(
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<OrderDishesPage> {
    await this.openOrderDetails(orderNumber, targetOrderNumber);
    await this.clickEditInOrderDetails();

    const orderDishesPage = new OrderDishesPage(this.page);
    await orderDishesPage.expectLoaded();

    return orderDishesPage;
  }

  @step('页面操作：打开 Recall 第一张可见订单卡片并点击编辑')
  async openFirstVisibleOrderForEditing(): Promise<OrderDishesPage> {
    if (!(await this.orderDetailsEditButton.isVisible().catch(() => false))) {
      await this.openFirstVisibleOrderDetails();
    }

    await this.clickEditInOrderDetails();

    const orderDishesPage = new OrderDishesPage(this.page);
    await orderDishesPage.expectLoaded();

    return orderDishesPage;
  }

  @step('页面操作：打开 Recall 最近一笔订单详情')
  async openRecentOrderDetails(): Promise<void> {
    await this.filterBar.clearAllSearchConditions();
    const latestOrderNumber = await this.filterBar.readLatestVisibleOrderNumber();
    await this.openOrderDetails(latestOrderNumber);
  }

  @step('页面操作：打开 Recall 最近一笔订单并进入编辑点单页')
  async openRecentOrderForEditing(): Promise<OrderDishesPage> {
    await this.openRecentOrderDetails();
    await this.clickEditInOrderDetails();

    const orderDishesPage = new OrderDishesPage(this.page);
    await orderDishesPage.expectLoaded();

    return orderDishesPage;
  }

  @step('页面操作：从 Recall 订单详情点击 Pay 并进入支付页面')
  async openPayment(): Promise<PaymentPage> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickOrderDetailsAction('pay');

    const paymentPage = new PaymentPage(this.page);
    await paymentPage.expectLoaded();

    return paymentPage;
  }

  @step('页面操作：点击 Recall 订单详情中的 Send 按钮')
  async clickSendInOrderDetails(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickOrderDetailsAction('send');
  }

  @step('页面操作：点击 Recall 订单详情中的 Send 按钮并等待送厨接口成功')
  async clickSendInOrderDetailsAndReadKitchenTicketStatus(): Promise<number> {
    await this.waitForOrderDetailsDialogReady();
    const [kitchenTicketResponse] = await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname.endsWith('/kpos/api/print/kitchen/ticket'),
        { timeout: 15_000 },
      ),
      this.clickOrderDetailsAction('send'),
    ]);

    if (!kitchenTicketResponse.ok()) {
      throw new Error(
        `Recall 订单送厨接口失败：${kitchenTicketResponse.status()} ${kitchenTicketResponse.url()}`,
      );
    }

    return kitchenTicketResponse.status();
  }

  @step('页面操作：点击 Recall 订单详情中的 Print 按钮')
  async clickPrintInOrderDetails(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickOrderDetailsAction('print');
  }

  @step('页面操作：从 Recall 订单详情点击 Split 并进入分单面板')
  async openSplitInOrderDetails(options: {
    chargePromptAction?: SplitChargePromptAction;
  } = {}): Promise<SplitOrderPage> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickOrderDetailsAction('split');
    await this.dismissSplitChargePromptIfNeeded(options.chargePromptAction);

    const splitOrderPage = new SplitOrderPage(this.page);
    await splitOrderPage.expectLoaded();

    return splitOrderPage;
  }

  @step((action?: SplitChargePromptAction) =>
    action === 'remove'
      ? '页面操作：分单前置弹窗选择移除加收折扣小费'
      : '页面操作：分单前置弹窗选择保留加收折扣小费',
  )
  private async dismissSplitChargePromptIfNeeded(action?: SplitChargePromptAction): Promise<void> {
    if (!action) {
      return;
    }

    await waitUntil(
      async () => await this.splitChargePromptDialog.isVisible().catch(() => false),
      (isVisible) => isVisible,
      {
        timeout: 3_000,
        interval: 100,
        message: 'Split charge prompt did not appear.',
      },
    ).catch(() => undefined);

    if (!(await this.splitChargePromptDialog.isVisible().catch(() => false))) {
      return;
    }

    if (action === 'remove') {
      await this.splitChargePromptRemoveButton.click();
      return;
    }

    await this.splitChargePromptKeepButton.click();
  }

  @step('页面操作：点击 Recall 订单详情中的 Discount 按钮')
  async clickDiscountInOrderDetails(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickOrderDetailsAction('discount');
  }

  @step('页面读取：读取 Recall 订单详情可用操作')
  async readOrderDetailAvailableActions(): Promise<Record<RecallOrderDetailAction, boolean>> {
    await this.waitForOrderDetailsDialogReady();
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await this.readAvailableActionsFromDialog(orderDetailsDialog);
  }

  private async readAvailableActionsFromDialog(
    orderDetailsDialog: Locator,
  ): Promise<Record<RecallOrderDetailAction, boolean>> {
    return {
      edit: await this.isOrderDetailsActionVisible(orderDetailsDialog, 'edit'),
      send: await this.isOrderDetailsActionVisible(orderDetailsDialog, 'send'),
      print: await this.isOrderDetailsActionVisible(orderDetailsDialog, 'print'),
      pay: await this.isOrderDetailsActionVisible(orderDetailsDialog, 'pay'),
      split: await this.isOrderDetailsActionVisible(orderDetailsDialog, 'split'),
      discount: await this.isOrderDetailsActionVisible(orderDetailsDialog, 'discount'),
      reopen: await this.isOrderDetailsActionVisible(orderDetailsDialog, 'reopen'),
      more: await this.isOrderDetailsActionVisible(orderDetailsDialog, 'more'),
    };
  }

  @step('页面操作：点击 Recall 订单详情中的 More 按钮')
  async clickOrderDetailsMoreButton(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await expect(this.sharedOrderDetailsMoreButton).toBeVisible({ timeout: 10_000 });
    await this.sharedOrderDetailsMoreButton.click();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Charge 按钮')
  async clickChargeInMoreMenu(): Promise<void> {
    await this.clickOrderDetailsMoreMenuAction('charge');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Move Item 按钮')
  async clickMoveItemInMoreMenu(): Promise<void> {
    await this.clickOrderDetailsMoreMenuAction('moveItem');
  }

  @step('页面操作：选择 Recall 订单详情中的第一个菜品')
  async selectFirstOrderDishItem(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await expect(this.firstOrderDishItem).toBeVisible({ timeout: 10_000 });
    await this.firstOrderDishItem.click();
  }

  @step('页面校验：Move Dishes Out 操作面板已显示')
  async expectMoveDishesOutReady(): Promise<void> {
    await expect(this.moveDishesToExistingOrderButton).toBeVisible({ timeout: 10_000 });
  }

  @step('页面操作：选择将菜品移动到已有订单')
  async clickMoveDishesToExistingOrder(): Promise<void> {
    await expect(this.moveDishesToExistingOrderButton).toBeVisible({ timeout: 10_000 });
    await this.moveDishesToExistingOrderButton.click();
  }

  @step('页面校验：Move Dishes Out 可移动到新订单')
  async expectMoveDishesToNewOrderReady(): Promise<void> {
    await expect(this.moveDishesToNewOrderButton).toBeVisible({ timeout: 10_000 });
  }

  @step('页面操作：选择将菜品移动到新订单')
  async clickMoveDishesToNewOrder(): Promise<void> {
    await expect(this.moveDishesToNewOrderButton).toBeVisible({ timeout: 10_000 });
    await this.moveDishesToNewOrderButton.click();
  }

  @step('页面校验：Recall 已进入移菜目标订单选择状态')
  async expectMoveDishesTargetSelectionReady(): Promise<void> {
    await expect(this.moveDishesTargetSelectionPrompt).toBeVisible({ timeout: 10_000 });
  }

  @step((orderNumber: string) => `页面操作：选择订单 ${orderNumber} 作为移菜目标订单`)
  async clickMoveDishesTargetOrder(orderNumber: string): Promise<void> {
    const targetOrderNumber = normalizeOrderNumber(orderNumber);
    const targetOrderLabel = this.filterBar.orderListContainer
      .getByText(targetOrderNumber, { exact: true })
      .first();

    await expect(targetOrderLabel).toBeVisible({ timeout: 10_000 });
    await targetOrderLabel.click();
  }

  @step((targetOrderNumber: string) =>
    `页面校验：移菜后的目标订单 ${targetOrderNumber} 详情已显示`,
  )
  async expectMovedOrderDetailsReady(targetOrderNumber: string): Promise<void> {
    const expectedOrderNumber = normalizeOrderNumber(targetOrderNumber);

    await waitUntil(
      async () => {
        const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
        const detailsText = (await orderDetailsDialog.innerText().catch(() => ''))
          .replace(/\s+/g, ' ')
          .trim();

        return {
          hasItems: await this.orderDetailsDialogHasReadableItems(),
          hasTargetOrderNumber: detailsText.includes(expectedOrderNumber),
          hasPriceSummary: await this.combineResultPriceSummaryToggle
            .isVisible()
            .catch(() => false),
        };
      },
      (state) => state.hasItems && state.hasTargetOrderNumber && state.hasPriceSummary,
      {
        timeout: 15_000,
        interval: 100,
        message: 'Recall 移菜后的目标订单详情未完成加载。',
      },
    );
  }

  @step((sourceOrderNumber: string) =>
    `页面校验：从订单 ${sourceOrderNumber} 移出的菜品已显示在新订单详情中`,
  )
  async expectMovedToNewOrderDetailsReady(sourceOrderNumber: string): Promise<void> {
    const sourceOrderNumberText = normalizeOrderNumber(sourceOrderNumber);

    await waitUntil(
      async () => {
        const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
        const detailsText = (await orderDetailsDialog.innerText().catch(() => ''))
          .replace(/\s+/g, ' ')
          .trim();
        const visibleOrderNumber = detailsText.match(/#\d+/)?.[0] ?? null;

        return {
          hasItems: await this.orderDetailsDialogHasReadableItems(),
          hasNewOrderNumber:
            visibleOrderNumber !== null && visibleOrderNumber !== sourceOrderNumberText,
          hasPriceSummary: await this.combineResultPriceSummaryToggle
            .isVisible()
            .catch(() => false),
        };
      },
      (state) => state.hasItems && state.hasNewOrderNumber && state.hasPriceSummary,
      {
        timeout: 15_000,
        interval: 100,
        message: 'Recall 移菜后新订单详情未完成加载。',
      },
    );
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Combine 按钮')
  async clickCombineInMoreMenu(): Promise<void> {
    await this.clickOrderDetailsMoreMenuAction('combine');
  }

  @step('页面校验：Recall 已进入合单目标订单选择状态')
  async expectCombineTargetSelectionReady(): Promise<void> {
    await expect(this.combineSelectionPrompt).toBeVisible({ timeout: 10_000 });
  }

  @step((orderNumber: string) => `页面操作：选择订单 ${orderNumber} 作为合单目标订单`)
  async clickCombineTargetOrder(orderNumber: string): Promise<void> {
    const targetOrderNumber = normalizeOrderNumber(orderNumber);
    const targetOrderLabel = this.filterBar.orderListContainer
      .getByText(targetOrderNumber, { exact: true })
      .first();

    await expect(targetOrderLabel).toBeVisible({ timeout: 10_000 });
    await targetOrderLabel.click();
  }

  @step('页面操作：存在加收合单警告时确认继续')
  async confirmCombineChargeWarningIfNeeded(): Promise<void> {
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

    await expect(this.combineChargeConfirmButton).toBeVisible({ timeout: 10_000 });
    await this.combineChargeConfirmButton.click();
  }

  @step((targetOrderNumber: string) =>
    `页面校验：Recall 合单后的目标订单 ${targetOrderNumber} 详情已显示`,
  )
  async expectCombinedOrderDetailsReady(targetOrderNumber: string): Promise<void> {
    const expectedOrderNumber = normalizeOrderNumber(targetOrderNumber);

    await waitUntil(
      async () => {
        const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
        const detailsText = (await orderDetailsDialog.innerText().catch(() => ''))
          .replace(/\s+/g, ' ')
          .trim();

        return {
          hasItems: await this.orderDetailsDialogHasReadableItems(),
          hasTargetOrderNumber: detailsText.includes(expectedOrderNumber),
          hasPriceSummary: await this.combineResultPriceSummaryToggle
            .isVisible()
            .catch(() => false),
        };
      },
      (state) => state.hasItems && state.hasTargetOrderNumber && state.hasPriceSummary,
      {
        timeout: 15_000,
        interval: 100,
        message: 'Recall 合单后的订单详情未完成加载。',
      },
    );
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Tips 按钮')
  async clickTipsInMoreMenu(): Promise<void> {
    await this.clickOrderDetailsMoreMenuAction('tips');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Paging 按钮')
  async clickPagingInMoreMenu(): Promise<void> {
    await this.clickOrderDetailsMoreMenuAction('paging');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Call Off 按钮')
  async clickCallOffInMoreMenu(): Promise<void> {
    await this.clickOrderDetailsMoreMenuAction('callOff');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Clear Table 按钮')
  async clickClearTableInMoreMenu(): Promise<void> {
    const clearedOrderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    await this.clickOrderDetailsMoreMenuAction('clearTable');
    await expect(clearedOrderDetailsDialog).toBeHidden({ timeout: 15_000 });
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Copy 按钮')
  async clickCopyInMoreMenu(): Promise<void> {
    await this.clickOrderDetailsMoreMenuAction('copy');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Void 按钮')
  async clickVoidInMoreMenu(): Promise<void> {
    await this.clickOrderDetailsMoreMenuAction('void');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Sort 按钮')
  async clickSortInMoreMenu(): Promise<void> {
    await this.clickOrderDetailsMoreMenuAction('sort');
  }

  @step('页面操作：展开 Recall 订单详情价格汇总')
  async expandOrderDetailsPriceSummary(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();

    if (!(await this.orderDetailsDialogHasReadableItems())) {
      return;
    }

    if (await this.isOrderDetailsPriceSummaryExpanded()) {
      return;
    }

    if (await this.isOrderDetailsPriceSummaryReadableWithoutSubtotal()) {
      return;
    }

    await this.waitForGlobalLoadingOverlayHidden();
    await this.clickOrderDetailsPriceSummaryHeaderRow();

    await waitUntil(
      async () =>
        (await this.isOrderDetailsPriceSummaryExpanded()) ||
        (await this.isOrderDetailsPriceSummaryReadableWithoutSubtotal()),
      (expanded) => expanded,
      {
        timeout: 10_000,
        probeTimeout: 3_000,
        message: 'Recall 订单详情价格汇总未在点击后展开。',
      },
    );
  }

  private async isOrderDetailsPriceSummaryExpanded(): Promise<boolean> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const subtotalLabel = orderDetailsDialog.getByText('Subtotal', { exact: true }).first();

    if (await subtotalLabel.isVisible().catch(() => false)) {
      return true;
    }

    const priceSummaryToggle = await this.resolveVisibleOrderDetailsPriceSummaryToggle();

    if (!priceSummaryToggle) {
      return false;
    }

    const ariaExpanded = await priceSummaryToggle.getAttribute('aria-expanded').catch(() => null);

    if (ariaExpanded === 'true') {
      return true;
    }

    if (ariaExpanded === 'false') {
      return false;
    }

    const toggleText = (await priceSummaryToggle.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

    return /\bSubtotal\b/i.test(toggleText);
  }

  private async isOrderDetailsPriceSummaryReadableWithoutSubtotal(): Promise<boolean> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await orderDetailsDialog.evaluate((dialogElement) => {
      const cleanText = (value: string | null | undefined): string =>
        value?.replace(/\s+/g, ' ').trim() ?? '';
      const hasPaymentRecord =
        dialogElement.querySelector('[class*="_methodLabel_"], [class*="_paymentText_"]') !== null;
      const hasCustomerInfo =
        dialogElement.querySelector(
          '[class*="_customerPrimaryText_"], [class*="_customerAddressText_"], [class*="_customerNoteText_"]',
        ) !== null;
      const headerChipTexts = Array.from(
        dialogElement.querySelectorAll('[class*="_header_1ej2d_"] button, [class*="_actionButtons_"] button'),
      )
        .map((buttonElement) => cleanText(buttonElement.textContent))
        .filter(Boolean);
      const hasDeliveryOrderType = headerChipTexts.some((text) => /^delivery$/i.test(text));
      const hasTotal = /\bTotal\s*\$[\d,.]+/i.test(cleanText(dialogElement.textContent));

      return hasTotal && (hasPaymentRecord || (hasCustomerInfo && hasDeliveryOrderType));
    });
  }

  @step('页面操作：点击 Recall 订单详情价格汇总折叠头')
  private async clickOrderDetailsPriceSummaryHeaderRow(): Promise<void> {
    const priceSummaryToggle = await this.resolveVisibleOrderDetailsPriceSummaryToggle();

    if (priceSummaryToggle) {
      await priceSummaryToggle.click();
      return;
    }

    const headerRow = await this.resolveVisibleOrderDetailsPriceSummaryHeaderRow();

    if (!headerRow) {
      throw new Error('Recall 订单详情未找到价格汇总折叠区域。');
    }

    await headerRow.click();
  }

  private async orderDetailsDialogHasReadableItems(): Promise<boolean> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await orderDetailsDialog.evaluate((dialogElement) => {
      const cleanText = (value: string | null | undefined): string =>
        value?.replace(/\s+/g, ' ').trim() ?? '';
      const dishItemPattern = /^\d+(?:\.\d+)?\s+.+\s+\$[\d,.]+$/;

      if (
        dialogElement.querySelector('[data-testid="pos-ui-dish-item"], [class*="_dishItem_"]') !==
        null
      ) {
        return true;
      }

      return Array.from(dialogElement.querySelectorAll('button')).some((buttonElement) =>
        dishItemPattern.test(cleanText(buttonElement.textContent)),
      );
    });
  }

  private async resolveOrderDetailsPriceSummaryRoot(): Promise<Locator | null> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const expandedPriceSummaryButton = orderDetailsDialog
      .locator('[role="button"][aria-expanded="true"]')
      .filter({ has: orderDetailsDialog.getByText('Subtotal', { exact: true }) })
      .last();

    if (await expandedPriceSummaryButton.isVisible().catch(() => false)) {
      return expandedPriceSummaryButton;
    }

    const priceSummaryButtonWithSubtotal = orderDetailsDialog
      .getByRole('button', { name: /\bSubtotal\b/i })
      .last();

    if (await priceSummaryButtonWithSubtotal.isVisible().catch(() => false)) {
      return priceSummaryButtonWithSubtotal;
    }

    return await this.resolveVisibleOrderDetailsPriceSummaryToggle();
  }

  private async readOrderDetailsPriceSummaryFromLabels(): Promise<Record<string, number>> {
    const priceSummaryRoot = await this.resolveOrderDetailsPriceSummaryRoot();

    if (!priceSummaryRoot) {
      return await this.readOrderDetailsPriceSummaryFromText();
    }

    const summaryLabels = ['Count', 'Subtotal', 'Charge', 'Tax', 'Total Before Tips', 'Tips', 'Total'] as const;
    const summary: Record<string, number> = {};

    for (const label of summaryLabels) {
      const labelLocator = priceSummaryRoot.getByText(label, { exact: true }).first();

      if (!(await labelLocator.isVisible().catch(() => false))) {
        continue;
      }

      const valueText = await labelLocator.evaluate((labelElement) => {
        const cleanText = (value: string | null | undefined): string =>
          value?.replace(/\s+/g, ' ').trim() ?? '';
        const readMoneyValue = (text: string): string | null => {
          const moneyMatches = cleanText(text).match(/\$[\d,.]+/g);
          return moneyMatches?.at(-1) ?? null;
        };

        let currentElement: Element | null = labelElement.nextElementSibling;

        while (currentElement) {
          const currentText = cleanText(currentElement.textContent);
          const moneyValue = readMoneyValue(currentText);

          if (moneyValue) {
            return moneyValue;
          }

          currentElement = currentElement.nextElementSibling;
        }

        const rowElement = labelElement.parentElement;

        if (!rowElement) {
          return '';
        }

        const spanTexts = Array.from(rowElement.querySelectorAll('span'))
          .map((node) => cleanText(node.textContent))
          .filter(Boolean);
        const moneyValues = spanTexts
          .map((text) => readMoneyValue(text))
          .filter((value): value is string => Boolean(value));

        return moneyValues.at(-1) ?? '';
      });
      const normalizedValue = valueText.replace(/\s+/g, ' ').trim();
      const parsedValue = Number(normalizedValue.replace(/[$,]/g, ''));

      if (!normalizedValue || Number.isNaN(parsedValue)) {
        continue;
      }

      summary[label] = parsedValue;
    }

    const cashTotalLabel = priceSummaryRoot.getByText(/^Total\s*\(\s*Cash\s*\)$/i).first();

    if (await cashTotalLabel.isVisible().catch(() => false)) {
      const cashValueText = await cashTotalLabel.evaluate((labelElement) => {
        const moneyMatches =
          labelElement.parentElement?.textContent?.match(/\$[\d,.]+/g) ??
          labelElement.textContent?.match(/\$[\d,.]+/g);

        return moneyMatches?.at(-1) ?? '';
      });
      const parsedCashTotal = Number(cashValueText.replace(/[$,]/g, ''));

      if (!Number.isNaN(parsedCashTotal)) {
        summary['Total(Cash)'] = parsedCashTotal;
      }
    }

    const cardTotalLabel = priceSummaryRoot.getByText(/^Total\s*\(\s*Card\s*\)$/i).first();

    if (await cardTotalLabel.isVisible().catch(() => false)) {
      const cardValueText = await cardTotalLabel.evaluate((labelElement) => {
        const moneyMatches =
          labelElement.parentElement?.textContent?.match(/\$[\d,.]+/g) ??
          labelElement.textContent?.match(/\$[\d,.]+/g);

        return moneyMatches?.at(-1) ?? '';
      });
      const parsedCardTotal = Number(cardValueText.replace(/[$,]/g, ''));

      if (!Number.isNaN(parsedCardTotal)) {
        summary['Total(Card)'] = parsedCardTotal;
      }
    }

    return {
      ...(await this.readOrderDetailsPriceSummaryFromText()),
      ...summary,
    };
  }

  private async readOrderDetailsPriceSummaryFromText(): Promise<Record<string, number>> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const detailsText = (await orderDetailsDialog.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const summary: Record<string, number> = {};
    const countMatch = detailsText.match(/(?:^|\s)Count\s+(\d+(?:\.\d+)?)/i);
    const moneyLabels = [
      ['Subtotal', /(?:^|\s)Subtotal\s+\$([\d,.]+)/i],
      ['Charge', /(?:^|\s)Charge\s+\$([\d,.]+)/i],
      ['Tax', /(?:^|\s)Tax\s+\$([\d,.]+)/i],
      ['Total Before Tips', /(?:^|\s)Total\s+Before\s+Tips\s+\$([\d,.]+)/i],
      ['Tips', /(?:^|\s)(?<!Before\s)Tips\s+\$([\d,.]+)/i],
      ['Total', /(?:^|\s)Total(?!\s+Before\s+Tips|\s*\()\s+\$([\d,.]+)/i],
      ['Total(Cash)', /(?:^|\s)Total\s*\(\s*Cash\s*\)\s+\$([\d,.]+)/i],
      ['Total(Card)', /(?:^|\s)Total\s*\(\s*Card\s*\)\s+\$([\d,.]+)/i],
    ] as const;

    if (countMatch) {
      summary.Count = Number(countMatch[1]);
    }

    for (const [label, pattern] of moneyLabels) {
      const match = detailsText.match(pattern);
      const parsedValue = Number(match?.[1]?.replace(/,/g, '') ?? NaN);

      if (!Number.isNaN(parsedValue)) {
        summary[label] = parsedValue;
      }
    }

    return summary;
  }

  private isCollapsedTotalOnlySnapshotReady(snapshot: RecallOrderDetails): boolean {
    const hasSubtotal = snapshot.priceSummary.Subtotal !== undefined;
    const hasItems = snapshot.items.length > 0;
    const hasCollapsedTotalOnly =
      snapshot.priceSummary.Total !== undefined && !hasSubtotal;
    const hasDeliveryCustomerContext =
      snapshot.customerInfo !== null && /^delivery$/i.test(snapshot.orderContext.orderType ?? '');

    if (!hasItems || !hasCollapsedTotalOnly) {
      return false;
    }

    return snapshot.payments.length > 0 || hasDeliveryCustomerContext;
  }

  @step('页面读取：读取订单详情中的客户信息')
  async readOrderCustomerInfo(): Promise<RecallCustomerInfo | null> {
    return (await this.readOrderDetailsSnapshot()).customerInfo;
  }

  @step('页面读取：读取订单详情中的会员信息')
  async readOrderMemberInfo(): Promise<RecallMemberInfo | null> {
    return (await this.readOrderDetailsSnapshot()).memberInfo;
  }

  @step('页面读取：读取订单详情中的支付状态')
  async readOrderPaymentStatus(): Promise<string | null> {
    return (await this.readOrderDetailsSnapshot()).paymentStatus;
  }

  @step('页面读取：读取订单详情中的菜品明细')
  async readOrderItems(): Promise<RecallOrderItem[]> {
    return (await this.readOrderDetailsSnapshot()).items;
  }

  @step((dishName: string) => `页面读取：读取 Recall 订单详情中菜品 ${dishName} 的数值价格`)
  async readOrderItemPrice(dishName: string): Promise<number> {
    const item = (await this.readOrderDetailsSnapshot()).items.find(
      (orderItem) => orderItem.name === dishName,
    );
    const priceText = item?.price;

    if (!priceText) {
      throw new Error(`Recall 订单详情未读取到菜品 ${dishName} 的价格。`);
    }

    const price = Number(priceText.replace(/[$,]/g, ''));
    if (Number.isNaN(price)) {
      throw new Error(`Recall 菜品 ${dishName} 的价格无法解析为数值：${priceText}`);
    }

    return price;
  }

  @step(
    (dishName: string, detailText: string) =>
      `页面读取：检查 Recall 菜品 ${dishName} 是否展示明细 ${detailText}`,
  )
  async isOrderItemDetailVisible(dishName: string, detailText: string): Promise<boolean> {
    return await this.orderDishItemByName(dishName)
      .getByText(detailText, { exact: true })
      .isVisible()
      .catch(() => false);
  }

  @step('页面读取：读取订单详情中的价格汇总')
  async readOrderPriceSummary(): Promise<Record<string, number>> {
    return (await this.readOrderDetailsSnapshot()).priceSummary;
  }

  @step('页面读取：仅读取订单详情价格汇总区域中当前展示的金额标签')
  async readDisplayedOrderPriceSummary(): Promise<Record<string, number>> {
    await this.waitForOrderDetailsDialogReady();
    await this.expandOrderDetailsPriceSummary();
    return await this.readOrderDetailsPriceSummaryFromLabels();
  }

  @step('页面读取：读取订单详情价格汇总区域当前展示的完整文本')
  async readDisplayedOrderPriceSummaryText(): Promise<string> {
    await this.waitForOrderDetailsDialogReady();
    await this.expandOrderDetailsPriceSummary();
    const priceSummaryRoot = await this.resolveOrderDetailsPriceSummaryRoot();

    if (!priceSummaryRoot) {
      throw new Error('订单详情中未找到可读取的价格汇总区域。');
    }

    return (await priceSummaryRoot.innerText()).replace(/\s+/g, ' ').trim();
  }

  @step('页面读取：读取订单详情中的订单类型、桌号、人数与服务员信息')
  async readOrderContext(): Promise<RecallOrderContext> {
    return (await this.readOrderDetailsSnapshot()).orderContext;
  }

  @step('页面读取：读取订单详情中的支付记录')
  async readOrderPayments(): Promise<RecallOrderPaymentRecord[]> {
    return (await this.readOrderDetailsSnapshot()).payments;
  }

  @step('页面读取：读取订单详情中的支付流水金额数值')
  async readOrderPaymentAmounts(): Promise<number[]> {
    return (await this.readOrderPayments())
      .map((payment) => payment.amount)
      .filter((amount): amount is string => Boolean(amount))
      .map((amount) => this.parseMoneyAmount(amount));
  }

  @step('页面读取：读取 Recall 订单详情弹窗完整文本')
  async readOrderDetailsText(): Promise<string> {
    await this.waitForOrderDetailsDialogReady();
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return (await orderDetailsDialog.innerText()).replace(/\s+/g, ' ').trim();
  }

  @step((paymentIndex: number) => `页面操作：对 Recall 订单详情第 ${paymentIndex + 1} 笔支付流水发起退款`)
  async refundPaymentRecord(paymentIndex: number): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    const paymentSection = this.resolvePaymentSection(await this.resolveActiveOrderDetailsDialog());
    const refundableCards = await this.resolveRefundablePaymentCards(paymentSection).catch(() => null);

    if (refundableCards) {
      const paymentCard = refundableCards.nth(paymentIndex);

      await expect(paymentCard).toBeVisible({ timeout: 10_000 });
      await paymentCard.scrollIntoViewIfNeeded();
      await this.clickPaymentCardRefundButton(paymentCard);
    } else {
      await this.clickPaymentSectionRefundButton(paymentSection, paymentIndex);
    }

    await this.confirmPaymentRefundDialog();
    await this.waitForGlobalLoadingOverlayHidden();
  }

  @step((amountInCents: number) => `页面操作：在 Recall 订单详情中添加 Tips ${amountInCents} 分`)
  async addOrderDetailsTip(amountInCents: number): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickOrderDetailsMoreButton();
    await (await this.resolveOrderDetailsTipsButton()).click();
    await this.fillTipDialogAmount(amountInCents, false);
    await this.confirmTipDialog(false);

    if (await this.isBigTipConfirmDialogVisible()) {
      const message = await this.confirmBigTipDialog();
      await this.waitForGlobalLoadingOverlayAfterTipMutation();
      return message;
    }

    await this.waitForGlobalLoadingOverlayAfterTipMutation();
    return null;
  }

  @step((amountInCents: number, paymentMethod?: string) =>
    paymentMethod
      ? `页面操作：在 Recall 订单详情的 PAYMENT 卡片 ${paymentMethod} 中添加 Tips ${amountInCents} 分`
      : `页面操作：在 Recall 订单详情的 PAYMENT 卡片中添加 Tips ${amountInCents} 分`,
  )
  async addPaymentCardTip(amountInCents: number, paymentMethod?: string): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickPaymentCardTipsButton(paymentMethod);
    await this.fillTipDialogAmount(amountInCents, true);
    await this.confirmTipDialog(true);

    if (await this.isBigTipConfirmDialogVisible()) {
      const message = await this.confirmBigTipDialog();
      await this.waitForGlobalLoadingOverlayAfterTipMutation();
      return message;
    }

    await this.waitForGlobalLoadingOverlayAfterTipMutation();
    return null;
  }

  @step((serverName: string) => `页面操作：将 Recall 订单服务员切换为 ${serverName}`)
  async changeOrderServer(serverName: string): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await expect(this.orderDetailsServerButton).toBeVisible();
    await this.orderDetailsServerButton.click();

    const serverOption = this.resolveServerOption(serverName);
    await expect(serverOption).toBeVisible();
    await serverOption.click();
    await expect(this.orderDetailsServerButton).toContainText(serverName);
  }

  @step('页面读取：读取当前详情弹窗中的完整订单信息')
  async readOrderDetailsSnapshot(): Promise<RecallOrderDetails> {
    await this.waitForOrderDetailsDialogReady();
    await this.expandOrderDetailsPriceSummary();

    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await waitUntil(
      async () => {
        const snapshot = await orderDetailsDialog.evaluate((dialogElement) => {
        const cleanText = (value: string | null | undefined): string => value?.replace(/\s+/g, ' ').trim() ?? '';
        const normalizeOptionalText = (value: string | null | undefined): string | null => {
          const normalized = cleanText(value);
          return normalized && normalized !== '-' ? normalized : null;
        };
        const parseNumericText = (value: string | null | undefined): number => {
          const normalized = cleanText(value);
          const parsedValue = Number(normalized.replace(/[$,]/g, ''));

          if (Number.isNaN(parsedValue)) {
            throw new Error(`Unable to parse numeric value from order details: ${normalized}`);
          }

          return parsedValue;
        };
      const selectText = (scope: Element, selector: string): string | null =>
        normalizeOptionalText(scope.querySelector(selector)?.textContent);
      const readTexts = (scope: Element, selector: string): string[] =>
        Array.from(scope.querySelectorAll(selector))
          .map((node) => cleanText(node.textContent))
          .filter(Boolean);
      const dedupeElements = <T extends Element>(elements: T[]): T[] => {
        const uniqueElements: T[] = [];

        for (const element of elements) {
          if (!uniqueElements.includes(element)) {
            uniqueElements.push(element);
          }
        }

        return uniqueElements;
      };
      const getSection = (title: string): Element | null => {
        const normalizedTitle = title.toUpperCase();
        const headings = Array.from(dialogElement.querySelectorAll('h1,h2,h3,h4,h5,h6'));
        const heading = headings.find((node) => cleanText(node.textContent).toUpperCase() === normalizedTitle);
        return heading?.closest('[class*="_section_"]') ?? heading?.parentElement?.parentElement ?? null;
      };
      const uniqueValues = (values: string[]): string[] => {
        const uniqueTexts: string[] = [];

        for (const value of values) {
          if (value && !uniqueTexts.includes(value)) {
            uniqueTexts.push(value);
          }
        }

        return uniqueTexts;
      };
      const isOrderTypeText = (text: string): boolean =>
        /^(dine in|delivery|pick up|pickup|take out|to go|togo|bar|drive thru|drive-thru|online delivery|online pickup)$/i.test(
          text,
        );
      const parseTableAndGuestCount = (
        text: string,
      ): {
        tableName: string;
        guestCount: string;
      } | null => {
        const matchedGroups = text.match(/^(.+?)\s*\((\d+)\)$/);

        if (!matchedGroups) {
          return null;
        }

        return {
          tableName: matchedGroups[1].trim(),
          guestCount: matchedGroups[2],
        };
      };
      const isGuestCountText = (text: string): boolean => /^\d+(?:\(\d+\))?$/.test(text);
      const isTableText = (text: string): boolean =>
        /\b(table|tbl|tab|booth|room|patio|bar seat)\b/i.test(text);
      const findSeatHeader = (dishElement: Element): Element | null => {
        let currentAncestor: Element | null = dishElement.parentElement;

        while (currentAncestor && currentAncestor !== dialogElement) {
          const seatHeader =
            currentAncestor.querySelector('[data-test-id^="shared-order-seat-dish-list-seat-header-"]') ??
            currentAncestor.querySelector('[data-testid^="shared-order-seat-dish-list-seat-header-"]') ??
            currentAncestor.querySelector('[class*="_seatHeader_"]');

          if (seatHeader) {
            return seatHeader;
          }

          currentAncestor = currentAncestor.parentElement;
        }

        return null;
      };
      const readDishName = (
        dishElement: Element,
        sentTime: string | null,
        quantity: string | null,
        price: string | null,
      ): string | null => {
        const explicitName =
          selectText(dishElement, '[data-testid="dish-item-name"]') ??
          selectText(dishElement, '[data-test-id="dish-item-name"]') ??
          selectText(dishElement, '[class*="_dishName_"]');

        if (explicitName) {
          return explicitName;
        }

        const directChildren = Array.from(dishElement.children);
        const mainRow =
          directChildren.find((childElement) => {
            const childText = cleanText(childElement.textContent);

            if (!childText || childText === sentTime) {
              return false;
            }

            return Boolean((price && childText.includes(price)) || (quantity && childText.includes(quantity)));
          }) ?? directChildren[0] ?? null;

        if (!mainRow) {
          return null;
        }

        const spanTexts = uniqueValues(
          Array.from(mainRow.querySelectorAll('span'))
            .map((node) => cleanText(node.textContent))
            .filter(Boolean),
        );

        return (
          spanTexts.find(
            (text) =>
              text !== sentTime &&
              text !== quantity &&
              text !== price &&
              !/^\$[\d,.]+$/.test(text) &&
              !/^\d+$/.test(text),
          ) ?? null
        );
      };

      const orderNumber =
        selectText(dialogElement, '[class*="_number_"]') ??
        normalizeOptionalText(dialogElement.textContent?.match(/#\d+/)?.[0]) ??
        '';
      const paymentStatus = selectText(dialogElement, '[class*="_statusTag_"]');

      const headerChipTexts = uniqueValues(
        Array.from(dialogElement.querySelectorAll('[class*="_header_1ej2d_"] button, [class*="_actionButtons_"] button'))
          .map((button) => cleanText(button.textContent))
          .filter(Boolean),
      );

      let orderType: string | null = null;
      let tableName: string | null = null;
      let guestCount: string | null = null;
      let serverName: string | null = null;

      for (const chipText of headerChipTexts) {
        const parsedTableAndGuestCount = parseTableAndGuestCount(chipText);

        if (parsedTableAndGuestCount) {
          tableName ??= parsedTableAndGuestCount.tableName;
          guestCount ??= parsedTableAndGuestCount.guestCount;
          continue;
        }

        if (!orderType && isOrderTypeText(chipText)) {
          orderType = chipText;
          continue;
        }

        if (!guestCount && isGuestCountText(chipText)) {
          guestCount = chipText;
          continue;
        }

        if (!tableName && isTableText(chipText)) {
          tableName = chipText;
          continue;
        }

        if (!serverName) {
          serverName = chipText;
        }
      }

      const customerSection = getSection('CUSTOMER INFO');
      const customerPrimaryTexts = customerSection
        ? Array.from(customerSection.querySelectorAll('[class*="_customerPrimaryText_"]'))
            .map((node) => cleanText(node.textContent))
            .filter(Boolean)
        : [];
      const customerAddress = customerSection
        ? selectText(customerSection, '[class*="_customerAddressText_"]')
        : null;
      const customerNote = customerSection ? selectText(customerSection, '[class*="_customerNoteText_"]') : null;
      const customerName = normalizeOptionalText(customerPrimaryTexts[0]);
      const customerPhone = normalizeOptionalText(customerPrimaryTexts[1]);
      const customerInfo =
        customerName || customerPhone || customerAddress || customerNote
          ? {
              name: customerName ?? '',
              phone: customerPhone ?? '',
              address: customerAddress,
              note: customerNote,
            }
          : null;

      const memberSection = getSection('MEMBER INFO');
      const memberEntries = memberSection
        ? Array.from(memberSection.querySelectorAll('[class*="_memberInfoText_"]'))
            .map((node) => cleanText(node.textContent))
            .filter(Boolean)
        : [];
      const memberInfo = memberEntries.length > 0 ? { entries: memberEntries } : null;

      const paymentSection = getSection('PAYMENT');
      const payments = paymentSection
        ? dedupeElements(
            Array.from(
              paymentSection.querySelectorAll('[class*="_methodLabel_"], [class*="_paymentText_"]'),
            ).map(
              (methodElement) =>
                methodElement.closest('[class*="_card_"]') ??
                methodElement.parentElement?.parentElement ??
                methodElement.parentElement,
            ).filter((cardElement): cardElement is Element => Boolean(cardElement)),
          ).reduce<RecallOrderPaymentRecord[]>((records, cardElement) => {
              const method =
                selectText(cardElement, '[class*="_methodLabel_"]') ??
                selectText(cardElement, '[class*="_paymentText_"]');
              const amount = selectText(cardElement, '[class*="_amount_"]');
              const details = Array.from(cardElement.querySelectorAll('[class*="_contentItem_"]')).reduce<Record<string, string>>(
                (detailMap, detailRow) => {
                  const label = normalizeOptionalText(
                    detailRow.querySelector('[class*="_detailLabel_"]')?.textContent?.replace(/:\s*$/, ''),
                  );
                  const value = selectText(detailRow, '[class*="_detailAmount_"]');

                  if (label && value) {
                    detailMap[label] = value;
                  }

                  return detailMap;
                },
                {},
              );

              if (method) {
                records.push({ method, amount, details });
              }

              return records;
            }, [])
        : [];

      const parsedItems = Array.from(
        dialogElement.querySelectorAll('[data-testid="pos-ui-dish-item"], [class*="_dishItem_"]'),
      ).reduce<RecallOrderItem[]>(
        (records, dishElement) => {
          const sentTime =
            selectText(dishElement, '[class*="_sentText_"]') ??
            readTexts(dishElement, 'span').find((text) => /^Sent in /i.test(text)) ??
            null;
          const quantity =
            selectText(dishElement, '[class*="_quantity_"]') ??
            readTexts(dishElement, 'span').find((text) => /^\d+$/.test(text)) ??
            null;
          const price =
            selectText(dishElement, '[class*="_dishPrice_"]') ??
            readTexts(dishElement, 'span').find((text) => /^\$[\d,.]+$/.test(text)) ??
            null;
          const seatHeader = findSeatHeader(dishElement);
          const seat =
            (seatHeader ? selectText(seatHeader, '[class*="_seatTitle_"]') : null) ??
            normalizeOptionalText(seatHeader?.textContent);
          const name = readDishName(dishElement, sentTime, quantity, price);

          if (!name) {
            return records;
          }

          const additionSelectors = [
            '[class*="_extraItem_"]',
            '[data-testid^="dish-item-subitem-"]',
            '[data-test-id^="dish-item-subitem-"]',
            '[class*="_optionItemContainer_"]',
          ].join(', ');
          const additionElements = dedupeElements(Array.from(dishElement.querySelectorAll(additionSelectors)));
          const additionElementSet = new Set(additionElements);
          const childMap = new Map<Element, Element[]>();
          const topLevelAdditionElements: Element[] = [];

          const parseAdditionElement = (
            additionElement: Element,
          ): RecallOrderItemAddition | null => {
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
              .map((childElement) => parseAdditionElement(childElement))
              .filter((addition): addition is RecallOrderItemAddition => addition !== null);

            return {
              ...(additionPrice ? { price: additionPrice } : {}),
              ...(subAdditions.length > 0 ? { subAdditions } : {}),
              name: additionName,
            };
          };

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
            .map((additionElement) => parseAdditionElement(additionElement))
            .filter((addition): addition is RecallOrderItemAddition => addition !== null);

          records.push({
            seat,
            sentTime,
            quantity,
            name,
            price,
            additions,
          });

          return records;
        },
        [],
      );
      const items =
        parsedItems.length > 0
          ? parsedItems
          : uniqueValues(
              Array.from(dialogElement.querySelectorAll('button'))
                .map((buttonElement) => cleanText(buttonElement.textContent))
                .filter(Boolean),
            ).reduce<RecallOrderItem[]>((records, buttonText) => {
              const matchedItem = buttonText.match(
                /^(\d+(?:\.\d+)?)\s+(.+?)\s+(\$[\d,.]+)$/,
              );

              if (!matchedItem) {
                return records;
              }

              const [, quantity, name, price] = matchedItem;

              records.push({
                seat: null,
                sentTime: null,
                quantity,
                name,
                price,
                additions: [],
              });

              return records;
            }, []);

      const priceSummaryContainer =
        dialogElement.querySelector('[data-test-id="shared-order-price-summary-toggle"]') ??
        dialogElement.querySelector('[data-testid="shared-order-price-summary-toggle"]') ??
        dialogElement.querySelector('[class*="_container_"][class*="1w05p"]') ??
        dialogElement.querySelector('[class*="_container_1jzox_"]') ??
        dialogElement.querySelector('[class*="_container_"][class*="1jzox"]') ??
        Array.from(dialogElement.querySelectorAll('[class*="_headerRow_"]'))
          .map((headerRow) => headerRow.closest('[class*="_container_"]'))
          .find((container): container is Element => container instanceof Element) ??
        dialogElement.querySelector('button');
      const priceSummaryRowSelectors = [
        '[class*="_row_"]',
        '[class*="_totalRow_"]',
        '[data-testid="shared-order-price-summary-row"]',
        '[data-test-id="shared-order-price-summary-row"]',
      ].join(', ');
      const normalizePriceSummaryLabel = (value: string | null | undefined): string | null => {
        const normalized = cleanText(value).replace(/\s+/g, ' ');

        if (/^Count$/i.test(normalized)) {
          return 'Count';
        }

        if (/^Subtotal$/i.test(normalized)) {
          return 'Subtotal';
        }

        if (/^Tax$/i.test(normalized)) {
          return 'Tax';
        }

        if (/^Total Before Tips$/i.test(normalized)) {
          return 'Total Before Tips';
        }

        if (/^Tips$/i.test(normalized)) {
          return 'Tips';
        }

        const totalMatch = normalized.match(/^Total\s*(?:\(\s*(Cash|Card)\s*\))?$/i);

        if (!totalMatch) {
          return null;
        }

        if (!totalMatch[1]) {
          return 'Total';
        }

        return `Total(${totalMatch[1]})`;
      };
      const priceSummaryRoots = dedupeElements(
        priceSummaryContainer
          ? [
              priceSummaryContainer,
              priceSummaryContainer.parentElement,
              priceSummaryContainer.nextElementSibling,
            ].filter((root): root is Element => Boolean(root))
          : [],
      );
      const priceSummaryRows = dedupeElements(
        priceSummaryRoots.flatMap((root) => {
          const matchedRows = Array.from(root.querySelectorAll(priceSummaryRowSelectors));
          return matchedRows.length > 0 ? matchedRows : Array.from(root.children);
        }),
      );
      const priceSummary = priceSummaryRows.reduce<Record<string, number>>((summary, rowElement) => {
        const spanTexts = Array.from(rowElement.querySelectorAll('span'))
          .map((node) => cleanText(node.textContent))
          .filter(Boolean);

        if (spanTexts.length < 2 || spanTexts.length > 3) {
          return summary;
        }

        const label =
          spanTexts[0] ??
          selectText(rowElement, '[class*="_label_1jzox_"]') ??
          selectText(rowElement, '[class*="_totalLabel_1jzox_"]');
        const value = spanTexts.length > 1 ? spanTexts[spanTexts.length - 1] : null;
        const normalizedLabel = normalizePriceSummaryLabel(label);

        if (normalizedLabel && value && normalizedLabel !== value) {
          summary[normalizedLabel] = parseNumericText(value);
        }

        return summary;
      }, {});

      return {
        orderNumber,
        paymentStatus,
        customerInfo,
        memberInfo,
        orderContext: {
          orderType,
          tableName,
          guestCount,
          serverName,
        },
        payments,
        items,
        priceSummary,
      };
    });
        const labelPriceSummary = await this.readOrderDetailsPriceSummaryFromLabels();
        const availableActions = await this.readAvailableActionsFromDialog(orderDetailsDialog);

        return {
          ...snapshot,
          availableActions,
          priceSummary: {
            ...snapshot.priceSummary,
            ...labelPriceSummary,
          },
        };
      },
      (snapshot) => {
        const hasSubtotal = snapshot.priceSummary.Subtotal !== undefined;
        const hasItems = snapshot.items.length > 0;

        if (hasItems && hasSubtotal) {
          return true;
        }

        if (this.isCollapsedTotalOnlySnapshotReady(snapshot)) {
          return true;
        }

        if (hasItems) {
          return false;
        }

        // 无菜品时仅允许已确认的空订单（Total 为 0）通过，避免折叠态 Total 在菜品加载前误判就绪。
        return snapshot.priceSummary.Total === 0;
      },
      {
        timeout: 10_000,
        probeTimeout: 2_000,
        message: 'Order details dialog did not expose Subtotal in time.',
      },
    );
  }
  @step('页面操作：关闭当前订单详情弹窗')
  async closeOrderDetailsDialog(): Promise<void> {
    await this.dismissOrderDetailsDialogIfNeeded();
  }

  @step('页面操作：如 Recall 订单详情仍停留在页面上，则关闭详情并返回 Recall 列表')
  async dismissOrderDetailsDialogIfNeeded(): Promise<void> {
    const initialDialogCount = await this.visibleOrderDetailsDialogs.count();
    if (initialDialogCount === 0) {
      return;
    }

    const maxDismissalAttempts = Math.min(initialDialogCount + 2, 10);
    for (let attempt = 0; attempt < maxDismissalAttempts; attempt += 1) {
      let loadingHiddenSince: number | null = null;
      await waitUntil(
        async () => await this.globalLoadingBackdrops.count(),
        (loadingBackdropCount) => {
          if (loadingBackdropCount > 0) {
            loadingHiddenSince = null;
            return false;
          }

          loadingHiddenSince ??= Date.now();
          return Date.now() - loadingHiddenSince >= 750;
        },
        {
          timeout: 15_000,
          interval: 50,
          message: 'Recall 全局 Loading 遮罩未在关闭订单详情前稳定消失。',
        },
      );

      const visibleDialogCount = await this.visibleOrderDetailsDialogs.count();
      if (visibleDialogCount === 0) {
        break;
      }

      const orderDetailsDialog = this.visibleOrderDetailsDialogs.last();
      const orderDetailsBackdrop = this.orderDetailsBackdrop(orderDetailsDialog);
      const dialogBox = await orderDetailsDialog.boundingBox();
      const backdropBox = await orderDetailsBackdrop.boundingBox();
      if (!dialogBox || !backdropBox) {
        throw new Error('Recall 订单详情弹窗或遮罩缺少可点击的页面位置');
      }

      const dialogRight = dialogBox.x + dialogBox.width;
      const dialogBottom = dialogBox.y + dialogBox.height;
      const backdropRight = backdropBox.x + backdropBox.width;
      const backdropBottom = backdropBox.y + backdropBox.height;
      const outsideRegions = [
        {
          size: dialogBox.x - backdropBox.x,
          point: { x: (backdropBox.x + dialogBox.x) / 2, y: dialogBox.y + dialogBox.height / 2 },
        },
        {
          size: backdropRight - dialogRight,
          point: { x: (dialogRight + backdropRight) / 2, y: dialogBox.y + dialogBox.height / 2 },
        },
        {
          size: dialogBox.y - backdropBox.y,
          point: { x: dialogBox.x + dialogBox.width / 2, y: (backdropBox.y + dialogBox.y) / 2 },
        },
        {
          size: backdropBottom - dialogBottom,
          point: { x: dialogBox.x + dialogBox.width / 2, y: (dialogBottom + backdropBottom) / 2 },
        },
      ];
      const largestOutsideRegion = outsideRegions.reduce((largestRegion, region) =>
        region.size > largestRegion.size ? region : largestRegion,
      );
      const backdropPoint = largestOutsideRegion.point;
      const pointIsOutsideDialog =
        largestOutsideRegion.size > 0 &&
        (backdropPoint.x < dialogBox.x ||
          backdropPoint.x > dialogRight ||
          backdropPoint.y < dialogBox.y ||
          backdropPoint.y > dialogBottom);
      if (!pointIsOutsideDialog) {
        throw new Error('Recall 订单详情弹窗外未找到可点击的遮罩区域');
      }

      await orderDetailsBackdrop.click({
        position: {
          x: backdropPoint.x - backdropBox.x,
          y: backdropPoint.y - backdropBox.y,
        },
      });
      await waitUntil(
        async () => await this.visibleOrderDetailsDialogs.count(),
        (remainingDialogCount) => remainingDialogCount < visibleDialogCount,
        {
          timeout: 5_000,
          message: 'Recall 订单详情遮罩点击后，可见详情弹窗数量未减少。',
        },
      );
    }

    await expect(this.visibleOrderDetailsDialogs).toHaveCount(0, { timeout: 1_000 });
  }

  private orderDetailsBackdrop(orderDetailsDialog: Locator): Locator {
    return this.page
      .locator('div[class*="_overlay_"]:has(> [role="dialog"][data-testid="pos-ui-modal"])', {
        has: orderDetailsDialog,
      })
      .last();
  }

  @step('页面操作：在 Recall 订单详情中点击 Edit')
  private async clickEditInOrderDetails(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickOrderDetailsAction('edit');
  }

  @step((action: RecallOrderDetailAction) =>
    `页面操作：点击 Recall 订单详情中的 ${recallOrderDetailActionNames[action]} 按钮`,
  )
  private async clickOrderDetailsAction(action: RecallOrderDetailAction): Promise<void> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const actionButton = await this.resolveOrderDetailsActionButton(orderDetailsDialog, action);

    await expect(actionButton).toBeVisible({ timeout: 10_000 });
    await actionButton.click();
  }

  private orderDetailsActionTestIdButton(
    orderDetailsDialog: Locator,
    action: RecallOrderDetailAction,
  ): Locator | null {
    const actionTestId = recallOrderDetailActionTestIds[action];

    return actionTestId ? recallScopedTestId(orderDetailsDialog, actionTestId) : null;
  }

  private orderDetailsActionNamedButton(
    orderDetailsDialog: Locator,
    action: RecallOrderDetailAction,
  ): Locator {
    return orderDetailsDialog.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(recallOrderDetailActionNames[action])}$`, 'i'),
    });
  }

  private async resolveOrderDetailsActionButton(
    orderDetailsDialog: Locator,
    action: RecallOrderDetailAction,
  ): Promise<Locator> {
    const actionTestIdButton = this.orderDetailsActionTestIdButton(orderDetailsDialog, action);

    if (actionTestIdButton && (await actionTestIdButton.isVisible().catch(() => false))) {
      return actionTestIdButton;
    }

    if (action === 'more' && (await this.namedOrderDetailsMoreButton.isVisible().catch(() => false))) {
      return this.namedOrderDetailsMoreButton;
    }

    return this.orderDetailsActionNamedButton(orderDetailsDialog, action);
  }

  private async isOrderDetailsActionVisible(
    orderDetailsDialog: Locator,
    action: RecallOrderDetailAction,
  ): Promise<boolean> {
    const actionTestIdButton = this.orderDetailsActionTestIdButton(orderDetailsDialog, action);

    if (actionTestIdButton && (await actionTestIdButton.isVisible().catch(() => false))) {
      return true;
    }

    if (action === 'more' && (await this.namedOrderDetailsMoreButton.isVisible().catch(() => false))) {
      return true;
    }

    const actionButton = this.orderDetailsActionNamedButton(orderDetailsDialog, action);

    return await actionButton.isVisible().catch(() => false);
  }

  @step((action: RecallOrderDetailsMoreAction) =>
    `页面操作：点击 Recall 订单详情 More 菜单中的 ${recallOrderDetailsMoreActionNames[action]} 按钮`,
  )
  private async clickOrderDetailsMoreMenuAction(
    action: RecallOrderDetailsMoreAction,
  ): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    if (action === 'callOff') {
      const directCallOffButton = orderDetailsDialog.getByRole('button', { name: /^Call Off$/i }).last();

      if (await directCallOffButton.isVisible().catch(() => false)) {
        await directCallOffButton.click();
        return;
      }
    }

    await this.clickOrderDetailsMoreButton();

    const actionButton = this.orderDetailsMoreMenuActionButton(action);

    await expect(actionButton).toBeVisible({ timeout: 10_000 });
    await actionButton.click();
  }

  private orderDetailsMoreMenuActionButton(action: RecallOrderDetailsMoreAction): Locator {
    const actionTestId = recallOrderDetailsMoreActionTestIds[action];

    if (actionTestId) {
      return recallScopedTestId(this.page, actionTestId);
    }

    return this.page
      .getByRole('button', {
        name: new RegExp(`^${escapeRegExp(recallOrderDetailsMoreActionNames[action])}$`, 'i'),
      })
      .last();
  }

  @step((orderNumber: string) => `页面操作：点击 Recall 列表中的订单 ${orderNumber}`)
  private async clickVisibleOrderNumber(orderNumber: string): Promise<void> {
    const normalizedOrderNumber = orderNumber.replace(/^#/, '');
    const visibleOrderNumber = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;
    const orderCardTrigger = this.filterBar.orderListContainer
      .locator(
        [
          `[data-test-id="shared-order-card-open-${normalizedOrderNumber}"]`,
          `[data-testid="shared-order-card-open-${normalizedOrderNumber}"]`,
          `[data-test-id="recall2-order-card-${normalizedOrderNumber}"]`,
          `[data-testid="recall2-order-card-${normalizedOrderNumber}"]`,
        ].join(', '),
      )
      .first();

    if (await orderCardTrigger.isVisible().catch(() => false)) {
      await orderCardTrigger.evaluate((triggerElement) => {
        (triggerElement as HTMLElement).click();
      });
      return;
    }

    const orderInContainer = this.filterBar.orderListContainer
      .getByText(visibleOrderNumber, { exact: true })
      .first();

    if (await orderInContainer.isVisible().catch(() => false)) {
      await orderInContainer.click();
      return;
    }

    await this.page.getByText(visibleOrderNumber, { exact: true }).first().click();
  }

  @step('页面操作：点击 Recall 列表第一张可见订单卡片')
  private async clickFirstVisibleOrderCard(): Promise<void> {
    const firstOpenOrderCard = this.openOrderCards.first();

    await firstOpenOrderCard.dispatchEvent('click', undefined, { timeout: 10_000 });
  }
  async waitForOrderDetailsDialogReady(): Promise<void> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    await expect(orderDetailsDialog).toBeVisible({ timeout: 10_000 });
    await waitUntil(
      async () => (await orderDetailsDialog.textContent())?.trim() ?? '',
      (dialogText) => !/^loading\.\.\.$/i.test(dialogText) && !/^loading$/i.test(dialogText),
      {
        timeout: 10_000,
        message: 'Order details dialog did not finish loading in time.',
      },
    );
    await this.waitForGlobalLoadingOverlayHidden();
  }

  @step('页面操作：等待 Recall 全局 Loading 遮罩消失')
  private async waitForGlobalLoadingOverlayHidden(): Promise<void> {
    if (!(await this.globalLoadingOverlay.isVisible().catch(() => false))) {
      return;
    }

    await waitUntil(
      async () => !(await this.globalLoadingOverlay.isVisible().catch(() => false)),
      (hidden) => hidden,
      {
        timeout: 15_000,
        message: 'Recall 全局 Loading 遮罩未在预期时间内消失。',
      },
    );
  }

  @step('页面操作：等待 Recall 加小费后的全局 Loading 遮罩出现并结束')
  private async waitForGlobalLoadingOverlayAfterTipMutation(): Promise<void> {
    await waitUntil(
      async () => await this.globalLoadingOverlay.isVisible().catch(() => false),
      (isVisible) => isVisible,
      {
        timeout: 3_000,
        interval: 50,
        message: 'Recall 加小费后未出现全局 Loading 遮罩。',
      },
    ).catch(() => undefined);

    await this.waitForGlobalLoadingOverlayHidden();
  }

  private async selectSplitTargetOrderIfNeeded(targetOrderNumber?: string): Promise<void> {
    if (!targetOrderNumber) {
      return;
    }

    const splitTargetOrderId = decodeSplitTargetReference(targetOrderNumber);
    const splitOrderNumberText =
      !splitTargetOrderId ? normalizeOrderNumber(targetOrderNumber) : null;
    let splitOrderTargetCard: Locator;

    if (splitTargetOrderId) {
      splitOrderTargetCard = await this.resolveSplitOrderTargetButton(splitTargetOrderId);
    } else if (splitOrderNumberText) {
      splitOrderTargetCard = await this.resolveSplitOrderTargetLabel(splitOrderNumberText);
    } else {
      throw new Error(`Recall 子单引用无效：${targetOrderNumber}`);
    }

    await expect(splitOrderTargetCard).toBeVisible({ timeout: 10_000 });
    const expectedChildOrderNumber =
      splitOrderNumberText ?? (await this.readSplitTargetOrderNumber(splitOrderTargetCard));

    if (await this.isTopmostChildOrderDetailsReady(expectedChildOrderNumber)) {
      return;
    }

    const visibleDialogCount = await this.readVisibleOrderDialogCount();
    await splitOrderTargetCard.click();
    await this.waitForVisibleOrderDialogCount(visibleDialogCount + 1);
    await this.waitForTopmostChildOrderDetailsReady(expectedChildOrderNumber);
    await this.waitForGlobalLoadingOverlayHidden();
  }

  @step('页面读取：读取 Recall 子单目标卡中的精确子单号')
  private async readSplitTargetOrderNumber(splitTargetOrderCard: Locator): Promise<string> {
    const orderNumberText = (
      await splitTargetOrderCard.getByText(/^#\d+-\d+$/, { exact: true }).first().textContent()
    )?.trim();

    if (!orderNumberText || !/^#\d+-\d+$/.test(orderNumberText)) {
      throw new Error('Recall 子单目标卡未展示合法的 #N-M 子单号。');
    }

    return orderNumberText;
  }

  @step((orderNumber: string) => `页面读取：检查 Recall 子单 ${orderNumber} 的顶层详情是否就绪`)
  private async isTopmostChildOrderDetailsReady(orderNumber: string): Promise<boolean> {
    if ((await this.readVisibleOrderDialogCount()) === 0) {
      return false;
    }

    const visibleOrderNumber = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;
    const topmostOrderDetailsDialog = this.visibleOrderDetailsDialogs.last();
    const childTitle = topmostOrderDetailsDialog.getByText(visibleOrderNumber, { exact: true });
    const priceSummaryToggle = topmostOrderDetailsDialog.locator(
      '[data-test-id="shared-order-price-summary-toggle"]',
    );

    return (
      (await childTitle.isVisible().catch(() => false)) &&
      (await priceSummaryToggle.isVisible().catch(() => false))
    );
  }

  @step((orderNumber: string) => `页面操作：等待 Recall 子单 ${orderNumber} 的顶层详情就绪`)
  private async waitForTopmostChildOrderDetailsReady(orderNumber: string): Promise<void> {
    await waitUntil(
      async () => await this.isTopmostChildOrderDetailsReady(orderNumber),
      (isReady) => isReady,
      {
        timeout: 10_000,
        interval: 100,
        message: `Recall 子单 ${orderNumber} 的顶层详情未在点击目标卡后显示。`,
      },
    );
  }

  @step((orderNumber: string) => `页面操作：等待 Recall 母单 ${orderNumber} 的详情就绪`)
  private async waitForParentOrderDetailsReady(orderNumber: string): Promise<void> {
    const visibleOrderNumber = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;

    await waitUntil(
      async () => {
        const visibleDialogCount = await this.readVisibleOrderDialogCount();

        if (visibleDialogCount === 0) {
          return {
            visibleDialogCount,
            standardTitleVisible: false,
            editActionVisible: false,
            splitOverviewTitleVisible: false,
            splitOverviewActionVisible: false,
            splitOverviewPrintVisible: false,
          };
        }

        const topmostOrderDetailsDialog = this.visibleOrderDetailsDialogs.last();
        const contract = await topmostOrderDetailsDialog.evaluate(
          (dialogElement, expectedOrderNumber) => {
            const normalizeText = (value: string | null | undefined): string =>
              String(value ?? '').replace(/\s+/g, ' ').trim();
            const standardTitleVisible = Array.from(
              dialogElement.querySelectorAll('div > span'),
            ).some(
              (titleElement) => normalizeText(titleElement.textContent) === expectedOrderNumber,
            );
            const editActionVisible = Boolean(
              dialogElement.querySelector(
                'button[data-test-id="shared-order-detail-side-action-editod"]',
              ),
            );
            const splitOverviewTitleVisible = Array.from(
              dialogElement.querySelectorAll('h3'),
            ).some((headingElement) => {
              const headingText = normalizeText(headingElement.textContent);

              return (
                headingText.startsWith(`${expectedOrderNumber}(`) &&
                /^\(\d+\)$/.test(headingText.slice(expectedOrderNumber.length))
              );
            });
            const splitOverviewActionVisible = Boolean(
              dialogElement.querySelector(
                'button[data-test-id="shared-order-detail-select-target-split"]',
              ),
            );
            const splitOverviewPrintVisible = Boolean(
              dialogElement.querySelector(
                'button[data-test-id="shared-order-detail-select-target-print-with-printer"]',
              ),
            );

            return {
              standardTitleVisible,
              editActionVisible,
              splitOverviewTitleVisible,
              splitOverviewActionVisible,
              splitOverviewPrintVisible,
            };
          },
          visibleOrderNumber,
        );

        return {
          visibleDialogCount,
          ...contract,
        };
      },
      (state) =>
        (state.standardTitleVisible && state.editActionVisible) ||
        (state.splitOverviewTitleVisible &&
          state.splitOverviewActionVisible &&
          state.splitOverviewPrintVisible),
      {
        timeout: 10_000,
        interval: 100,
        message: `Recall 订单 ${visibleOrderNumber} 的严格详情标题与动作区未显示。`,
      },
    );
  }

  private async resolveSplitOrderTargetButton(splitTargetOrderId: string): Promise<Locator> {
    return this.splitTargetOrderCardById(splitTargetOrderId);
  }

  private async resolveSplitOrderTargetLabel(splitOrderNumberText: string): Promise<Locator> {
    const visibleOrderNumber = splitOrderNumberText.startsWith('#')
      ? splitOrderNumberText
      : `#${splitOrderNumberText}`;

    return this.splitTargetOrderCardByNumber(visibleOrderNumber);
  }

  private async readVisibleOrderDialogCount(): Promise<number> {
    return await this.visibleOrderDetailsDialogs.count();
  }

  private async resolveActiveOrderDetailsDialog(): Promise<Locator> {
    const visibleDialogCount = await this.readVisibleOrderDialogCount();

    if (visibleDialogCount === 0) {
      return this.orderDetailsDialog;
    }

    let resolvedDialog = this.orderDetailsDialog;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < visibleDialogCount; index += 1) {
      const candidate = this.visibleOrderDetailsDialogs.nth(index);
      const text = (await candidate.textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
      const score = (/#\d+/.test(text) ? 1_000 : 0) + text.length;

      if (score > bestScore) {
        bestScore = score;
        resolvedDialog = candidate;
      }
    }

    return resolvedDialog;
  }

  private orderDetailsCollapsedPriceSummaryButton(orderDetailsDialog: Locator): Locator {
    return orderDetailsDialog.getByRole('button', { name: /^Total\s+\$/i }).last();
  }

  private async resolveVisibleOrderDetailsPriceSummaryToggle(): Promise<Locator | null> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const testIdToggles = orderDetailsDialog.locator(
      '[data-test-id="shared-order-price-summary-toggle"], [data-testid="shared-order-price-summary-toggle"]',
    );
    const toggleCandidates: Locator[] = [];
    const testIdToggleCount = await testIdToggles.count().catch(() => 0);

    for (let index = 0; index < testIdToggleCount; index += 1) {
      toggleCandidates.push(testIdToggles.nth(index));
    }

    toggleCandidates.push(this.orderDetailsCollapsedPriceSummaryButton(orderDetailsDialog));

    return findFirstVisibleLocator(toggleCandidates);
  }

  private async resolveVisibleOrderDetailsPriceSummaryHeaderRow(): Promise<Locator | null> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const headerRowCandidates = orderDetailsDialog.locator('[class*="_headerRow_"]');
    const headerRowCount = await headerRowCandidates.count().catch(() => 0);

    for (let index = headerRowCount - 1; index >= 0; index -= 1) {
      const headerRow = headerRowCandidates.nth(index);

      if (await headerRow.isVisible().catch(() => false)) {
        return headerRow;
      }
    }

    const priceSummaryToggle = await this.resolveVisibleOrderDetailsPriceSummaryToggle();

    if (!priceSummaryToggle) {
      return null;
    }

    const headerRowInSummary = priceSummaryToggle.locator('[class*="_headerRow_"]').first();

    if (await headerRowInSummary.isVisible().catch(() => false)) {
      return headerRowInSummary;
    }

    return null;
  }

  private async resolveOrderDetailsTipsButton(): Promise<Locator> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    return await resolveFirstVisibleLocator(
      [
        recallScopedTestId(orderDetailsDialog, 'recall2-order-detail-tips'),
        this.orderDetailsTipsButton,
        orderDetailsDialog.getByRole('button', { name: /^(Tips|小费)$/ }).first(),
        this.page.getByRole('button', { name: /^(Tips|小费)$/ }).first(),
      ],
      'Recall 订单详情 More 菜单未出现 Tips 入口。',
    );
  }

  private resolvePaymentSection(orderDetailsDialog: Locator): Locator {
    return orderDetailsDialog
      .locator('[class*="_section_"]')
      .filter({
        has: orderDetailsDialog.getByRole('heading', { name: /^PAYMENT$/i }),
      })
      .first();
  }

  private buildPaymentMethodHasTextPattern(paymentMethod: string): RegExp {
    const tokens = paymentMethod
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((token) => escapeRegExp(token));

    if (tokens.length === 0) {
      return /.^/;
    }

    if (tokens.length === 1) {
      return new RegExp(tokens[0], 'i');
    }

    return new RegExp(tokens.map((token) => `(?=.*${token})`).join(''), 'i');
  }

  private parseMoneyAmount(value: string): number {
    const normalizedValue = value.replace(/\s+/g, '').replace(/[$,]/g, '');
    const parsedValue = Number(normalizedValue);

    if (!Number.isFinite(parsedValue)) {
      throw new Error(`Unable to parse payment amount from Recall details: ${value}`);
    }

    return parsedValue;
  }

  private async resolvePaymentCardScope(
    paymentSection: Locator,
    paymentMethod?: string,
  ): Promise<Locator> {
    const paymentCards = paymentSection.locator(
      '[data-payment-method], [class*="_card_"], [class*="_paymentInfo_"]',
    );

    if (paymentMethod) {
      const paymentMethodPattern = this.buildPaymentMethodHasTextPattern(paymentMethod);
      const paymentBrand = paymentMethod.replace(/\s+/g, ' ').trim().split(' ')[0] ?? paymentMethod;

      const paymentCardByAttribute = paymentSection
        .locator(`[data-payment-method="${paymentMethod}"], [data-payment-method="${paymentBrand}"]`)
        .first();

      if (await paymentCardByAttribute.isVisible().catch(() => false)) {
        return paymentCardByAttribute;
      }

      const paymentCardByText = paymentCards.filter({ hasText: paymentMethodPattern }).first();

      if (await paymentCardByText.isVisible().catch(() => false)) {
        return paymentCardByText;
      }
    }

    return paymentCards.last();
  }

  private buildPaymentCardTipsButtonCandidates(paymentCard: Locator): Locator[] {
    const actionGrid = paymentCard.locator('[class*="_actionGrid_"]');

    return [
      paymentCard.getByRole('button', { name: /^(Tips|小费)$/ }).first(),
      actionGrid.getByTestId('button-default').filter({ hasText: /^(Tips|小费)$/ }).first(),
      actionGrid.getByRole('button', { name: /^(Tips|小费)$/ }).first(),
    ];
  }

  private async resolveRefundablePaymentCards(paymentSection: Locator): Promise<Locator> {
    const paymentCards = paymentSection
      .locator('[data-payment-method], [class*="_card_"], [class*="_paymentInfo_"]')
      .filter({ hasText: /\$?\d[\d,.]*/ })
      .filter({
        hasNot: paymentSection.getByText(/-\s*\$?\d[\d,.]*/),
      });

    await expect(paymentCards.first()).toBeVisible({ timeout: 10_000 });
    return paymentCards;
  }

  private buildPaymentCardRefundButtonCandidates(paymentCard: Locator): Locator[] {
    const actionGrid = paymentCard.locator('[class*="_actionGrid_"]');

    return [
      paymentCard.getByRole('button', { name: /^(Refund|退款)$/i }).first(),
      actionGrid.getByTestId('button-default').filter({ hasText: /^(Refund|退款)$/i }).first(),
      actionGrid.getByRole('button', { name: /^(Refund|退款)$/i }).first(),
    ];
  }

  private async clickPaymentCardRefundButton(paymentCard: Locator): Promise<void> {
    await this.closePosKeyboardIfVisible();

    const refundButton = await resolveFirstVisibleLocator(
      this.buildPaymentCardRefundButtonCandidates(paymentCard),
      'Recall PAYMENT 卡片的 Refund 操作按钮未在预期时间内出现。',
      10_000,
    );

    await refundButton.click({ timeout: 10_000 });
  }

  private async clickPaymentSectionRefundButton(
    paymentSection: Locator,
    paymentIndex: number,
  ): Promise<void> {
    await this.closePosKeyboardIfVisible();

    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const refundButton = await resolveFirstVisibleLocator(
      [
        paymentSection.getByRole('button', { name: /^(Refund|退款)$/i }).nth(paymentIndex),
        orderDetailsDialog.getByRole('button', { name: /^(Refund|退款)$/i }).nth(paymentIndex),
      ],
      `Recall PAYMENT 第 ${paymentIndex + 1} 笔流水的 Refund 按钮未在预期时间内出现。`,
      10_000,
    );

    await refundButton.scrollIntoViewIfNeeded();
    await refundButton.click({ timeout: 10_000 });
  }

  private async confirmPaymentRefundDialog(): Promise<void> {
    await this.selectAmountRefundModeIfVisible();

    const refundDialog = await resolveFirstVisibleLocator(
      [
        this.page
          .locator('[role="dialog"][data-testid="pos-ui-modal"]:visible')
          .filter({ has: this.page.getByRole('heading', { name: /^Refund$/i }) })
          .filter({ has: this.page.getByTestId('modal-confirm-button') })
          .first(),
        this.page
          .locator('[role="dialog"]:visible')
          .filter({ has: this.page.getByTestId('modal-confirm-button') })
          .filter({ has: this.page.getByTestId('dropdown-item-CUSTOM') })
          .first(),
        this.page
          .locator('[role="dialog"]:visible')
          .filter({ has: this.page.getByTestId('modal-confirm-button') })
          .filter({ hasText: /Refund|退款/i })
          .first(),
        this.page.locator('#responsePopuWin:visible').filter({ hasText: /Refund|退款/i }).first(),
      ],
      '点击 PAYMENT Refund 后未出现退款确认弹窗。',
      10_000,
    );

    const confirmButton = await resolveFirstVisibleLocator(
      [
        refundDialog.getByTestId('modal-confirm-button').first(),
        refundDialog.getByRole('button', { name: /^(Refund|Confirm|Yes|确定|确认)$/i }).first(),
        this.page.getByTestId('modal-confirm-button').first(),
        this.page.getByRole('button', { name: /^(Refund|Confirm|Yes|确定|确认)$/i }).first(),
      ],
      '退款确认弹窗未出现确认按钮。',
      10_000,
    );

    await waitForInputSettled();
    await this.closePosKeyboardIfVisible();
    await confirmButton.evaluate((buttonElement) => {
      (buttonElement as HTMLElement).click();
    });
    await expect(refundDialog).toBeHidden({ timeout: 10_000 });
  }

  private async selectAmountRefundModeIfVisible(): Promise<void> {
    const refundByAmountOption = this.refundByAmountMenuItem();

    await refundByAmountOption.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);

    if (!(await refundByAmountOption.isVisible().catch(() => false))) {
      return;
    }

    await refundByAmountOption.click({ timeout: 10_000 });
    await expect(refundByAmountOption).toBeHidden({ timeout: 5_000 });
  }

  private refundByAmountMenuItem(): Locator {
    return this.page.getByRole('menuitem', { name: 'Refund by Amount' }).first();
  }

  private async closePosKeyboardIfVisible(): Promise<void> {
    const keyboardCloseButton = this.page.getByTestId('pos-keyboard-button-{close}').last();

    if (!(await keyboardCloseButton.isVisible().catch(() => false))) {
      return;
    }

    await keyboardCloseButton.evaluate((buttonElement) => {
      (buttonElement as HTMLElement).click();
    });
  }

  private async clickByDom(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => undefined);
    await locator.evaluate(
      (element) => {
        (element as HTMLElement).click();
      },
      undefined,
      { timeout: 5_000 },
    );
  }

  private paymentCardTipDialogCandidates(): Locator[] {
    const visiblePosUiModals = this.page.locator(
      '[role="dialog"][data-testid="pos-ui-modal"]:visible',
    );
    const hostCreditCardTipsPopup = this.page.locator('#responsePopuWin.creditcardtips-ipt:visible');
    const hostCreditCardTipsPopupWithInput = this.page
      .locator('#responsePopuWin:visible')
      .filter({ has: this.page.locator('#tipsonly') });

    return [
      hostCreditCardTipsPopup.first(),
      hostCreditCardTipsPopupWithInput.first(),
      this.page.locator('#tipsonly:visible').first(),
      this.page.getByTestId('payment-tip-dialog').first(),
      visiblePosUiModals
        .filter({ has: this.page.getByTestId('payment-tip-input-value') })
        .last(),
      visiblePosUiModals
        .filter({ has: this.page.getByRole('heading', { name: /^Credit Card Tips$/i }) })
        .last(),
      visiblePosUiModals
        .filter({ has: this.page.getByRole('heading', { name: /^Payment Tips$/i }) })
        .last(),
      visiblePosUiModals
        .filter({ has: this.page.getByRole('heading', { name: /^Cash Tips$/i }) })
        .last(),
      this.page.getByRole('dialog', { name: /^Credit Card Tips$/i }).first(),
      this.page.getByRole('dialog', { name: /^Payment Tips$/i }).first(),
      this.page.getByRole('dialog', { name: /^Cash Tips$/i }).first(),
    ];
  }

  @step('页面操作：等待 Credit Card Tips 弹窗出现')
  private async expectPaymentCardTipDialogVisible(): Promise<void> {
    await resolveFirstVisibleLocator(
      this.paymentCardTipDialogCandidates(),
      '点击 PAYMENT 区 Tips 后，Credit Card Tips 弹窗未在预期时间内出现。',
      10_000,
    );
  }

  private async clickPaymentCardTipsButton(_paymentMethod?: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Tips' }).click({ timeout: 10_000 });
    await this.expectPaymentCardTipDialogVisible();
  }

  private async clickPaymentCardTipsButtonByCardScope(paymentMethod?: string): Promise<void> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const paymentSection = this.resolvePaymentSection(orderDetailsDialog);

    await paymentSection.scrollIntoViewIfNeeded().catch(() => undefined);
    await this.waitForGlobalLoadingOverlayHidden();

    const paymentCard = await this.resolvePaymentCardScope(paymentSection, paymentMethod);
    await paymentCard.scrollIntoViewIfNeeded().catch(() => undefined);

    const tipsButton = await resolveFirstVisibleLocator(
      this.buildPaymentCardTipsButtonCandidates(paymentCard),
      paymentMethod
        ? `Recall PAYMENT 卡片 ${paymentMethod} 的 Tips 操作按钮未在预期时间内出现。`
        : 'Recall PAYMENT 区的 Tips 操作按钮未在预期时间内出现。',
      15_000,
    );

    await tipsButton.scrollIntoViewIfNeeded().catch(() => undefined);
    await tipsButton.click({ timeout: 5_000 });

    const paymentCardTipDialogVisible = await waitUntil(
      async () => {
        for (const candidate of this.paymentCardTipDialogCandidates()) {
          if (await candidate.isVisible().catch(() => false)) {
            return true;
          }
        }

        return false;
      },
      (isVisible) => isVisible,
      {
        timeout: 3_000,
        message: '点击 PAYMENT Tips 后未检测到 Credit Card Tips 弹窗，准备重试点击。',
      },
    ).catch(() => false);

    if (paymentCardTipDialogVisible) {
      return;
    }

    await tipsButton.click({ force: true, timeout: 5_000 });

    const paymentCardTipDialogVisibleAfterClick = await waitUntil(
      async () => {
        for (const candidate of this.paymentCardTipDialogCandidates()) {
          if (await candidate.isVisible().catch(() => false)) {
            return true;
          }
        }

        return false;
      },
      (isVisible) => isVisible,
      {
        timeout: 3_000,
        message: '点击 PAYMENT Tips 后未检测到 Credit Card Tips 弹窗，准备使用 DOM 点击重试。',
      },
    ).catch(() => false);

    if (paymentCardTipDialogVisibleAfterClick) {
      return;
    }

    await paymentCard.evaluate((cardElement) => {
      const actionGrid = cardElement.querySelector<HTMLElement>('[class*="_actionGrid_"]');

      if (!actionGrid) {
        throw new Error('Unable to find PAYMENT action grid for Tips button.');
      }

      const tipsButtonElement = Array.from(
        actionGrid.querySelectorAll<HTMLButtonElement>('[data-testid="button-default"]'),
      ).find((button) => {
        const label = String(button.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim();

        return /^(Tips|小费)$/.test(label);
      });

      if (!tipsButtonElement) {
        throw new Error('Unable to find PAYMENT Tips action button in action grid.');
      }

      tipsButtonElement.click();
    });

    await this.expectPaymentCardTipDialogVisible();
  }

  private async resolveTipDialog(isPaymentCardDialog: boolean): Promise<Locator> {
    const candidates = isPaymentCardDialog
      ? this.paymentCardTipDialogCandidates()
      : [
          this.page.getByTestId('tip-input-dialog').first(),
          this.page.getByRole('dialog', { name: /^Tips$/i }).first(),
          this.page
            .locator('[role="dialog"]:visible')
            .filter({
              has: this.page.getByRole('heading', { name: /^Tips$/i }),
            })
            .filter({
              has: this.page.getByRole('button', { name: /^(Confirm|确认)$/ }),
            })
            .first(),
        ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    const dialog = await waitUntil(
      async () => {
        for (const candidate of candidates) {
          if (await candidate.isVisible().catch(() => false)) {
            return candidate;
          }
        }

        return null;
      },
      (dialog): dialog is Locator => dialog !== null,
      {
        timeout: 5_000,
        message: isPaymentCardDialog
          ? 'Recall PAYMENT Tips dialog did not appear in time.'
          : 'Recall order-detail Tips dialog did not appear in time.',
      },
    );

    if (!dialog) {
      throw new Error(
        isPaymentCardDialog
          ? 'Recall PAYMENT Tips dialog did not appear in time.'
          : 'Recall order-detail Tips dialog did not appear in time.',
      );
    }

    return dialog;
  }

  private async fillTipDialogAmount(amountInCents: number, isPaymentCardDialog: boolean): Promise<void> {
    const tipDialog = await this.resolveTipDialog(isPaymentCardDialog);
    const input = await this.resolveTipDialogInput(tipDialog, isPaymentCardDialog);
    const valueText = isPaymentCardDialog
      ? this.formatPaymentCardTipInputValue(amountInCents)
      : this.formatTipInputDigits(amountInCents);
    const keypadText = this.formatTipInputDigits(amountInCents);

    if (isPaymentCardDialog) {
      await this.enterTipValueByKeypad(tipDialog, keypadText);
      return;
    }

    await input.fill(valueText).catch(async () => {
      await input.evaluate((inputElement, nextValue) => {
        const htmlInput = inputElement as HTMLInputElement;
        htmlInput.value = String(nextValue);
        htmlInput.dispatchEvent(new Event('input', { bubbles: true }));
        htmlInput.dispatchEvent(new Event('change', { bubbles: true }));
      }, valueText);
    });

    const directInputAccepted = await waitUntil(
      async () => await input.inputValue().catch(() => ''),
      (currentValue) =>
        currentValue === valueText ||
        currentValue.replace(/[^\d.]/g, '') === valueText.replace(/[^\d.]/g, ''),
      {
        timeout: 1_000,
        message: `Recall tip value ${valueText} was not applied through direct input.`,
      },
    ).catch(() => null);

    if (directInputAccepted === valueText) {
      return;
    }

    await this.enterTipValueByKeypad(tipDialog, keypadText);
  }

  private async confirmTipDialog(isPaymentCardDialog: boolean): Promise<void> {
    const tipDialog = await this.resolveTipDialog(isPaymentCardDialog);
    const confirmButton = await this.resolveTipDialogConfirmButton(tipDialog, isPaymentCardDialog);
    await waitForInputSettled(await this.resolveTipDialogInput(tipDialog, isPaymentCardDialog));
    await confirmButton.click();
  }

  private async resolveTipDialogInput(
    tipDialog: Locator,
    isPaymentCardDialog: boolean,
  ): Promise<Locator> {
    const candidates = isPaymentCardDialog
      ? [
          this.page.locator('#tipsonly:visible').first(),
          tipDialog.locator('#tipsonly').first(),
          tipDialog.getByTestId('payment-tip-input-value').first(),
          tipDialog.locator('input[type="text"], input').first(),
          tipDialog.getByRole('textbox').first(),
        ]
      : [
          tipDialog.getByTestId('tip-input-value').first(),
          tipDialog.locator('input[type="text"], input').first(),
          tipDialog.getByRole('textbox').first(),
        ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    throw new Error('Recall Tips 输入框不可见。');
  }

  private async resolveTipDialogConfirmButton(
    tipDialog: Locator,
    isPaymentCardDialog = false,
  ): Promise<Locator> {
    const candidates = isPaymentCardDialog
      ? [
          tipDialog.getByTestId('modal-confirm-button').first(),
          this.page.getByTestId('modal-confirm-button').first(),
          this.page.locator('#smpiptgo:visible').first(),
          tipDialog.locator('#smpiptgo').first(),
          tipDialog.getByRole('button', { name: /^(Confirm|确认)$/ }).first(),
          tipDialog.getByTestId('tip-input-confirm').first(),
        ]
      : [
          tipDialog.getByRole('button', { name: /^(Confirm|确认)$/ }).first(),
          tipDialog.getByTestId('tip-input-confirm').first(),
        ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    throw new Error('Recall Tips 确认按钮不可见。');
  }

  private async resolveBigTipConfirmDialog(): Promise<Locator> {
    const candidates = this.bigTipDialogCandidates();

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private async isBigTipConfirmDialogVisible(): Promise<boolean> {
    for (const candidate of this.bigTipDialogCandidates()) {
      if (await candidate.isVisible().catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  private async confirmBigTipDialog(): Promise<string> {
    const dialog = await this.resolveBigTipConfirmDialog();
    const messageText =
      'The tip is more than 50% of the meal. Confirm to add?';
    const message =
      (
        await dialog
          .getByText(messageText, { exact: true })
          .first()
          .textContent()
          .catch(() => null)
      )
        ?.replace(/\s+/g, ' ')
        .trim() ?? messageText;
    await dialog.getByRole('button', { name: /^Yes$/i }).first().click();
    return message;
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面读取：读取 Recall 订单详情 PAYMENT 卡片 ${paymentMethod} 中的 Tips`
      : '页面读取：读取 Recall 订单详情 PAYMENT 卡片中的 Tips',
  )
  async readPaymentCardTip(paymentMethod?: string): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await orderDetailsDialog.evaluate((dialogElement, targetPaymentMethod) => {
      const cleanText = (value: string | null | undefined): string =>
        value?.replace(/\s+/g, ' ').trim() ?? '';
      const headings = Array.from(dialogElement.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      const paymentHeading = headings.find(
        (headingElement) => cleanText(headingElement.textContent).toUpperCase() === 'PAYMENT',
      );
      const paymentSection =
        paymentHeading?.closest('[class*="_section_"]') ??
        paymentHeading?.parentElement?.parentElement ??
        dialogElement;
      const visibleCards = Array.from(
        paymentSection.querySelectorAll('[data-payment-method], [class*="_card_"], [class*="_paymentInfo_"]'),
      ).filter((element, index, elements) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const computedStyle = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          computedStyle.display !== 'none' &&
          computedStyle.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0 &&
          elements.indexOf(element) === index
        );
      });

      const paymentCard = targetPaymentMethod
        ? visibleCards.find((cardElement) => {
            const cardText = cleanText(cardElement.textContent);
            return cardText.includes(targetPaymentMethod) && /\bTips\b/i.test(cardText);
          }) ??
          visibleCards.find((cardElement) =>
            cleanText(cardElement.textContent).includes(targetPaymentMethod),
          )
        : visibleCards.at(-1);

      if (!paymentCard) {
        return null;
      }

      const cardText = cleanText(paymentCard.textContent);
      const matchedTip = cardText.match(/Tips:?\s*(\$[\d,.]+)/i);
      if (matchedTip) {
        return matchedTip[1];
      }

      const dialogText = cleanText(dialogElement.textContent);
      const paymentTipPattern = targetPaymentMethod
        ? new RegExp(`${targetPaymentMethod}\\s*\\$[\\d,.]+\\s*Tips\\s*(\\$[\\d,.]+)`, 'i')
        : /\bTips\s*(\$[\d,.]+)/i;
      return dialogText.match(paymentTipPattern)?.[1] ?? null;
    }, paymentMethod ?? null);
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面读取：读取 Recall 订单详情 PAYMENT 卡片 ${paymentMethod} 中的 Tips 金额`
      : '页面读取：读取 Recall 订单详情 PAYMENT 卡片中的 Tips 金额',
  )
  async readPaymentCardTipAmount(paymentMethod?: string): Promise<number | null> {
    const tipText = await this.readPaymentCardTip(paymentMethod);
    return tipText === null ? null : this.parseMoneyAmount(tipText);
  }

  private formatTipInputDigits(amountInCents: number): string {
    if (!Number.isFinite(amountInCents) || amountInCents < 0) {
      throw new Error(`Invalid tip amount in cents: ${amountInCents}`);
    }

    return String(Math.round(amountInCents));
  }

  private formatPaymentCardTipInputValue(amountInCents: number): string {
    if (!Number.isFinite(amountInCents) || amountInCents < 0) {
      throw new Error(`Invalid payment-card tip amount in cents: ${amountInCents}`);
    }

    return (Math.round(amountInCents) / 100).toFixed(2);
  }

  private async enterTipValueByKeypad(tipDialog: Locator, valueText: string): Promise<void> {
    for (const digit of valueText) {
      const digitButton = await resolveFirstVisibleLocator(
        [
          this.page.getByTestId(`pos-keyboard-button-${digit}`).first(),
          tipDialog.getByTestId(`pos-keyboard-button-${digit}`).first(),
          tipDialog.getByRole('button', { name: digit, exact: true }).first(),
          this.page.getByRole('button', { name: digit, exact: true }).first(),
        ],
        `Recall Tips 数字键 ${digit} 不可见。`,
        5_000,
      );

      await digitButton.click({ timeout: 2_000 });
    }
  }

  private resolveServerOption(serverName: string): Locator {
    return this.page
      .locator('[data-testid^="dropdown-item-"], [data-test-id^="dropdown-item-"]')
      .filter({ has: this.page.getByText(serverName, { exact: true }) })
      .first();
  }

  private bigTipDialogCandidates(): Locator[] {
    return [
      this.page.getByTestId('big-tip-confirm-dialog').first(),
      this.page
        .getByRole('alertdialog')
        .filter({
          has: this.page.getByText(
            'The tip is more than 50% of the meal. Confirm to add?',
            { exact: true },
          ),
        })
        .first(),
      this.page
        .getByRole('dialog')
        .filter({
          has: this.page.getByText(
            'The tip is more than 50% of the meal. Confirm to add?',
            { exact: true },
          ),
        })
        .first(),
      ];
  }

  private async findVisibleTipsButton(scope: Locator): Promise<Locator | null> {
    return findFirstVisibleLocator(this.buildPaymentCardTipsButtonCandidates(scope));
  }

  private async waitForVisibleOrderDialogCount(expectedCount: number): Promise<void> {
    await waitUntil(
      async () => await this.readVisibleOrderDialogCount(),
      (visibleDialogCount) => visibleDialogCount === expectedCount,
      {
        timeout: 5_000,
        message: `Visible Recall order dialog count did not become ${expectedCount} in time.`,
      },
    );
  }
}

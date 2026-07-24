import {
  expect,
  type Locator,
  type Page,
} from '@playwright/test';
import { step } from '../../utils/step';
import { escapeRegExp, formatOrderNumber } from '../../utils/text';
import { waitUntil } from '../../utils/wait';
import { OrderDishesPage } from '../order-dishes.page';
import { PaymentPage } from '../payment.page';
import { SplitOrderPage } from '../split-order.page';
import { OrderDetailsContext } from '../shared/order-details/order-details-context';
import { OrderDetailsHeaderSection } from '../shared/order-details/order-details-header.section';
import { OrderDetailsItemsSection } from '../shared/order-details/order-details-items.section';
import { OrderDetailsPaymentSection } from '../shared/order-details/order-details-payment.section';
import { OrderDetailsSummarySection } from '../shared/order-details/order-details-summary.section';
import type { RecallFilterBarSection } from './recall-filter-bar.section';
import { RecallAssignmentSection } from './recall-assignment.section';
import { RecallDiscountSection } from './recall-discount.section';
import { RecallMoveCombineSection } from './recall-move-combine.section';
import { RecallOrderActionsSection } from './recall-order-actions.section';
import { RecallPrintingSection } from './recall-printing.section';
import { RecallRefundSection } from './recall-refund.section';
import { recallScopedTestId } from './recall-reads.section';
import { RecallTipsSection } from './recall-tips.section';
import type {
  RecallCustomerInfo,
  RecallDiscountWholeOrderSummary,
  RecallMemberInfo,
  RecallOrderContext,
  RecallOrderDetailAction,
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderItemAddition,
  RecallKitchenTicketResult,
  RecallResendResult,
  RecallOrderPaymentRecord,
} from './recall.types';

type SplitChargePromptAction = 'remove' | 'keep';

export class RecallOrderDetailsDialog {
  readonly header: OrderDetailsHeaderSection;
  readonly items: OrderDetailsItemsSection;
  readonly payment: OrderDetailsPaymentSection;
  readonly summary: OrderDetailsSummarySection;
  readonly actions: RecallOrderActionsSection;
  readonly moveCombine: RecallMoveCombineSection;
  readonly refund: RecallRefundSection;
  readonly tips: RecallTipsSection;
  readonly printing: RecallPrintingSection;
  readonly discount: RecallDiscountSection;
  readonly assignment: RecallAssignmentSection;
  private readonly detailsContext: OrderDetailsContext;
  private readonly visibleOrderDetailsDialogs: Locator;
  readonly orderDetailsDialog: Locator;
  private readonly orderDetailsEditButton: Locator;
  private readonly splitChargePromptDialog: Locator;
  private readonly splitChargePromptKeepButton: Locator;
  private readonly splitChargePromptRemoveButton: Locator;
  private readonly copyConfirmationDialog: Locator;
  private readonly copyStartButton: Locator;
  private readonly copyDetailsDialog: Locator;
  private readonly copyDetailsStartButton: Locator;
  private readonly orderDishItemByName: (dishName: string) => Locator;
  private readonly globalLoadingOverlay: Locator;
  private readonly globalLoadingBackdrops: Locator;
  private readonly splitTargetOrderCards: Locator;
  private readonly splitTargetOrderCardByNumber: (targetOrderNumber: string) => Locator;

  constructor(
    readonly page: Page,
    private readonly filterBar: RecallFilterBarSection,
  ) {
    this.detailsContext = new OrderDetailsContext(page);
    this.header = new OrderDetailsHeaderSection(this.detailsContext);
    this.items = new OrderDetailsItemsSection(this.detailsContext);
    this.payment = new OrderDetailsPaymentSection(this.detailsContext);
    this.summary = new OrderDetailsSummarySection(this.detailsContext);
    this.actions = new RecallOrderActionsSection(page, this.detailsContext.dialog);
    this.moveCombine = new RecallMoveCombineSection(
      page,
      this.detailsContext,
      this.actions,
      filterBar.orderListContainer,
    );
    this.refund = new RecallRefundSection(page, this.detailsContext);
    this.printing = new RecallPrintingSection(page, this.actions);
    this.discount = new RecallDiscountSection(page, this.actions);
    this.assignment = new RecallAssignmentSection(page, this.detailsContext);
    this.tips = new RecallTipsSection(
      page,
      this.detailsContext,
      this.actions,
      this.payment,
    );
    this.visibleOrderDetailsDialogs = this.page.locator(
      '[role="dialog"][data-testid="pos-ui-modal"]:visible',
    );
    this.orderDetailsDialog = this.detailsContext.dialog;
    this.splitTargetOrderCards = this.orderDetailsDialog.getByRole('button', {
      name: /^#\d+-\d+(?:\s|$)/,
    });
    this.splitTargetOrderCardByNumber = (targetOrderNumber: string) =>
      this.orderDetailsDialog.getByRole('button', {
        name: new RegExp(`^${escapeRegExp(targetOrderNumber)}(?:\\s|$)`),
      });
    this.orderDetailsEditButton = recallScopedTestId(
      this.orderDetailsDialog,
      'shared-order-detail-side-action-editod',
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
    this.copyConfirmationDialog = this.page.getByRole('alertdialog', {
      name: 'Do you want to copy this order into a new order?',
      exact: true,
    });
    this.copyStartButton = this.copyConfirmationDialog.getByRole('button', {
      name: 'Start Copy',
      exact: true,
    });
    this.copyDetailsDialog = this.page.getByRole('alertdialog', {
      name: 'Copy Details',
      exact: true,
    });
    this.copyDetailsStartButton = this.copyDetailsDialog.getByRole('button', {
      name: 'Start Copy',
      exact: true,
    });
    this.orderDishItemByName = (dishName: string) =>
      this.orderDetailsDialog
        .getByRole('button', { name: new RegExp(escapeRegExp(dishName)) })
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
    const normalizedOrderNumber = formatOrderNumber(orderNumber);

    await this.dismissOrderDetailsDialogIfNeeded();
    await this.clickVisibleOrderNumber(normalizedOrderNumber);
    await this.waitForOrderDetailsDialogReady();
    await this.waitForParentOrderDetailsReady(normalizedOrderNumber);
    await this.selectSplitTargetOrderIfNeeded(targetOrderNumber);
  }

  @step('页面读取：读取当前 Recall 订单详情中的可选子单号')
  async readTargetOrderNumbers(): Promise<string[]> {
    await this.waitForOrderDetailsDialogReady();
    const cardTexts = await this.splitTargetOrderCards.allInnerTexts();
    return cardTexts.map((cardText) => {
      const orderNumber = cardText.trim().match(/^#\d+-\d+/)?.[0];

      if (!orderNumber) {
        throw new Error(`Recall 子单卡未展示合法的 #N-M 子单号：${cardText}`);
      }

      return orderNumber;
    });
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
    await this.actions.click('pay');

    const paymentPage = new PaymentPage(this.page);
    await paymentPage.expectLoaded();

    return paymentPage;
  }

  @step('页面操作：点击 Recall 订单详情中的 Send 按钮')
  async clickSendInOrderDetails(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.printing.clickSend();
  }

  @step('页面操作：点击 Recall 订单详情中的 Send 按钮并等待送厨接口成功')
  async clickSendInOrderDetailsAndReadKitchenTicketStatus(): Promise<number> {
    await this.waitForOrderDetailsDialogReady();
    return await this.printing.sendAndReadKitchenTicketStatus();
  }

  @step('页面操作：点击 Recall 订单详情中的 Print 按钮')
  async clickPrintInOrderDetails(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.printing.clickPrint();
  }

  @step('页面操作：点击 Recall 订单详情中的 Print 并等待打单接口成功')
  async clickPrintInOrderDetailsAndReadKitchenTicketStatus(): Promise<number> {
    return (await this.clickPrintInOrderDetailsAndReadKitchenTicketResult()).httpStatus;
  }

  @step('页面操作：点击 Recall 订单详情中的 Print 并等待小票打印接口成功')
  async clickPrintInOrderDetailsAndReadReceiptStatus(): Promise<number> {
    await this.waitForOrderDetailsDialogReady();
    return await this.printing.printAndReadReceiptStatus();
  }

  @step('页面操作：点击 Recall 订单详情中的 Reprint 并等待小票打印接口成功')
  async clickReprintInOrderDetailsAndReadReceiptStatus(): Promise<number> {
    await this.waitForOrderDetailsDialogReady();
    return await this.printing.reprintAndReadReceiptStatus();
  }

  @step((dishNames: readonly string[]) =>
    `页面操作：从 Recall 对菜品 ${dishNames.join('、')} 执行 Resend`,
  )
  async resendDishes(dishNames: readonly string[]): Promise<RecallResendResult> {
    await this.waitForOrderDetailsDialogReady();
    return await this.printing.resendDishes(dishNames);
  }

  @step('页面操作：点击 Recall 订单详情中的 Print 并读取打单结果')
  async clickPrintInOrderDetailsAndReadKitchenTicketResult(): Promise<RecallKitchenTicketResult> {
    await this.waitForOrderDetailsDialogReady();
    return await this.printing.printAndReadKitchenTicketResult();
  }

  @step('页面操作：从 Recall 订单详情点击 Split 并进入分单面板')
  async openSplitInOrderDetails(options: {
    chargePromptAction?: SplitChargePromptAction;
  } = {}): Promise<SplitOrderPage> {
    await this.waitForOrderDetailsDialogReady();
    await this.actions.click('split');
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
    await this.discount.open();
  }

  @step('页面读取：读取 Recall 折扣弹窗 Whole Order 的子单号和小计')
  async readDiscountWholeOrderSummary(): Promise<RecallDiscountWholeOrderSummary> {
    return await this.discount.readWholeOrderSummary();
  }

  @step('页面读取：读取 Recall 订单详情可用操作')
  async readOrderDetailAvailableActions(): Promise<Record<RecallOrderDetailAction, boolean>> {
    await this.waitForOrderDetailsDialogReady();
    return await this.actions.readAvailable();
  }

  @step('页面操作：点击 Recall 订单详情中的 More 按钮')
  async clickOrderDetailsMoreButton(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.actions.openMore();
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Charge 按钮')
  async clickChargeInMoreMenu(): Promise<void> {
    await this.actions.clickMore('charge');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Move Item 按钮')
  async clickMoveItemInMoreMenu(): Promise<void> {
    await this.moveCombine.openMoveItem();
  }

  @step('页面操作：选择 Recall 订单详情中的第一个菜品')
  async selectFirstOrderDishItem(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.moveCombine.selectFirstDish();
  }

  @step('页面校验：Move Dishes Out 操作面板已显示')
  async expectMoveDishesOutReady(): Promise<void> {
    await this.moveCombine.expectMoveOutReady();
  }

  @step('页面操作：选择将菜品移动到已有订单')
  async clickMoveDishesToExistingOrder(): Promise<void> {
    await this.moveCombine.chooseExistingOrder();
  }

  @step('页面校验：Move Dishes Out 可移动到新订单')
  async expectMoveDishesToNewOrderReady(): Promise<void> {
    await this.moveCombine.expectNewOrderReady();
  }

  @step('页面操作：选择将菜品移动到新订单')
  async clickMoveDishesToNewOrder(): Promise<void> {
    await this.moveCombine.chooseNewOrder();
  }

  @step('页面校验：Recall 已进入移菜目标订单选择状态')
  async expectMoveDishesTargetSelectionReady(): Promise<void> {
    await this.moveCombine.expectTargetSelectionReady();
  }

  @step((orderNumber: string) => `页面操作：选择订单 ${orderNumber} 作为移菜目标订单`)
  async clickMoveDishesTargetOrder(orderNumber: string): Promise<void> {
    await this.moveCombine.selectMoveTarget(orderNumber);
  }

  @step((targetOrderNumber: string) =>
    `页面校验：移菜后的目标订单 ${targetOrderNumber} 详情已显示`,
  )
  async expectMovedOrderDetailsReady(targetOrderNumber: string): Promise<void> {
    await this.moveCombine.expectMovedOrderReady(targetOrderNumber);
  }

  @step((sourceOrderNumber: string) =>
    `页面校验：从订单 ${sourceOrderNumber} 移出的菜品已显示在新订单详情中`,
  )
  async expectMovedToNewOrderDetailsReady(sourceOrderNumber: string): Promise<void> {
    await this.moveCombine.expectMovedToNewOrderReady(sourceOrderNumber);
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Combine 按钮')
  async clickCombineInMoreMenu(): Promise<void> {
    await this.moveCombine.openCombine();
  }

  @step('页面校验：Recall 已进入合单目标订单选择状态')
  async expectCombineTargetSelectionReady(): Promise<void> {
    await this.moveCombine.expectCombineTargetSelectionReady();
  }

  @step((orderNumber: string) => `页面操作：选择订单 ${orderNumber} 作为合单目标订单`)
  async clickCombineTargetOrder(orderNumber: string): Promise<void> {
    await this.moveCombine.selectCombineTarget(orderNumber);
  }

  @step('页面操作：存在加收合单警告时确认继续')
  async confirmCombineChargeWarningIfNeeded(): Promise<void> {
    await this.moveCombine.confirmChargeWarningIfNeeded();
  }

  @step((retainedOrderNumber: string) =>
    `页面校验：Recall 合单后保留的订单 ${retainedOrderNumber} 详情已显示`,
  )
  async expectCombinedOrderDetailsReady(retainedOrderNumber: string): Promise<void> {
    await this.moveCombine.expectCombinedOrderReady(retainedOrderNumber);
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Tips 按钮')
  async clickTipsInMoreMenu(): Promise<void> {
    await this.actions.clickMore('tips');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Paging 按钮')
  async clickPagingInMoreMenu(): Promise<void> {
    await this.actions.clickMore('paging');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Call Off 按钮')
  async clickCallOffInMoreMenu(): Promise<void> {
    await this.actions.clickMore('callOff');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Clear Table 按钮')
  async clickClearTableInMoreMenu(): Promise<void> {
    const clearedOrderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    await this.actions.clickMore('clearTable');
    await expect(clearedOrderDetailsDialog).toBeHidden({ timeout: 15_000 });
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Copy 按钮')
  async clickCopyInMoreMenu(): Promise<void> {
    await this.actions.clickMore('copy');
  }

  @step('页面操作：确认复制 Recall 订单并进入点单页')
  async confirmCopyAndEnterOrderDishes(): Promise<OrderDishesPage> {
    await expect(this.copyConfirmationDialog).toBeVisible({ timeout: 10_000 });
    await this.copyStartButton.click();
    await expect(this.copyDetailsDialog).toBeVisible({ timeout: 10_000 });
    await this.copyDetailsStartButton.click();

    const orderDishesPage = new OrderDishesPage(this.page);
    await orderDishesPage.expectLoaded();
    return orderDishesPage;
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Void 按钮')
  async clickVoidInMoreMenu(): Promise<void> {
    await this.actions.clickMore('void');
  }

  @step('页面操作：点击 Recall 订单详情 More 菜单中的 Sort 按钮')
  async clickSortInMoreMenu(): Promise<void> {
    await this.actions.clickMore('sort');
  }

  @step('页面操作：展开 Recall 订单详情价格汇总')
  async expandOrderDetailsPriceSummary(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.summary.read();
  }

  @step('页面读取：读取订单详情中的客户信息')
  async readOrderCustomerInfo(): Promise<RecallCustomerInfo | null> {
    await this.waitForOrderDetailsDialogReady();
    return await this.header.readCustomerInfo();
  }

  @step('页面读取：读取订单详情中的会员信息')
  async readOrderMemberInfo(): Promise<RecallMemberInfo | null> {
    await this.waitForOrderDetailsDialogReady();
    return await this.header.readMemberInfo();
  }

  @step('页面读取：读取订单详情中的支付状态')
  async readOrderPaymentStatus(): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    return await this.header.readPaymentStatus();
  }

  @step('页面读取：读取订单详情中的菜品明细')
  async readOrderItems(): Promise<RecallOrderItem[]> {
    await this.waitForOrderDetailsDialogReady();
    return await this.items.readItems();
  }

  @step((dishName: string) => `页面读取：读取 Recall 订单详情中菜品 ${dishName} 的数值价格`)
  async readOrderItemPrice(dishName: string): Promise<number> {
    await this.waitForOrderDetailsDialogReady();
    return await this.items.readPrice(dishName);
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
    await this.waitForOrderDetailsDialogReady();
    return await this.summary.read();
  }

  @step('页面读取：仅读取订单详情价格汇总区域中当前展示的金额标签')
  async readDisplayedOrderPriceSummary(): Promise<Record<string, number>> {
    await this.waitForOrderDetailsDialogReady();
    return await this.summary.read();
  }

  @step('页面读取：读取订单详情价格汇总区域当前展示的完整文本')
  async readDisplayedOrderPriceSummaryText(): Promise<string> {
    await this.waitForOrderDetailsDialogReady();
    await this.summary.read();
    return await this.summary.readText();
  }

  @step('页面读取：读取订单详情中的订单类型、桌号、人数与服务员信息')
  async readOrderContext(): Promise<RecallOrderContext> {
    await this.waitForOrderDetailsDialogReady();
    return await this.header.readOrderContext();
  }

  @step('页面读取：读取订单详情中的支付记录')
  async readOrderPayments(): Promise<RecallOrderPaymentRecord[]> {
    await this.waitForOrderDetailsDialogReady();
    return await this.payment.readPayments();
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

  @step((paymentIndex: number) =>
    `页面操作：对 Recall 订单详情第 ${paymentIndex + 1} 笔支付流水发起退款`,
  )
  async refundPaymentRecord(paymentIndex: number): Promise<void> {
    await this.refund.refundPaymentRecord(paymentIndex);
  }

  @step((paymentIndex: number) =>
    `页面操作：对 Recall 订单详情第 ${paymentIndex + 1} 笔支付流水执行作废`,
  )
  async voidPaymentRecord(paymentIndex: number): Promise<void> {
    await this.refund.voidPaymentRecord(paymentIndex);
  }

  @step((paymentIndex: number, dishName: string) =>
    `页面操作：从 Recall 第 ${paymentIndex + 1} 笔支付流水按菜退款 ${dishName}`,
  )
  async refundOrderItem(paymentIndex: number, dishName: string): Promise<void> {
    await this.refund.refundOrderItem(paymentIndex, dishName);
  }

  @step((paymentIndex: number) =>
    `页面断言：Recall 第 ${paymentIndex + 1} 笔支付流水不提供按菜退款`,
  )
  async expectOrderItemRefundUnavailable(paymentIndex: number): Promise<void> {
    await this.refund.expectOrderItemRefundUnavailable(paymentIndex);
  }

  @step((amountInCents: number) =>
    `页面操作：在 Recall 订单详情中添加 Tips ${amountInCents} 分`,
  )
  async addOrderDetailsTip(amountInCents: number): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    return await this.tips.addOrderTip(amountInCents);
  }

  @step((amountInCents: number, paymentMethod?: string) =>
    paymentMethod
      ? `页面操作：在 Recall PAYMENT 卡片 ${paymentMethod} 中添加 Tips ${amountInCents} 分`
      : `页面操作：在 Recall PAYMENT 卡片中添加 Tips ${amountInCents} 分`,
  )
  async addPaymentCardTip(amountInCents: number, paymentMethod?: string): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    return await this.tips.addPaymentCardTip(amountInCents, paymentMethod);
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面操作：在 Recall PAYMENT 卡片 ${paymentMethod} 的 Tips 弹窗中直接确认空值`
      : '页面操作：在 Recall PAYMENT 卡片的 Tips 弹窗中直接确认空值',
  )
  async confirmEmptyPaymentCardTip(paymentMethod?: string): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.tips.confirmEmptyPaymentCardTip(paymentMethod);
  }

  @step((paymentIndex: number, amountInCents: number) =>
    `页面操作：在 Recall 第 ${paymentIndex + 1} 笔 PAYMENT 流水中添加 Tips ${amountInCents} 分`,
  )
  async addPaymentRecordTip(paymentIndex: number, amountInCents: number): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    return await this.tips.addPaymentRecordTip(paymentIndex, amountInCents);
  }

  @step((serverName: string) => `页面操作：将 Recall 订单服务员切换为 ${serverName}`)
  async changeOrderServer(serverName: string): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.assignment.changeServer(serverName);
  }

  @step((driverName: string) => `页面操作：将 Recall 订单司机切换为 ${driverName}`)
  async changeOrderDriver(driverName: string): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await this.assignment.changeDriver(driverName);
  }

  @step('页面读取：读取 Recall 订单当前司机')
  async readOrderDriverName(): Promise<string> {
    await this.waitForOrderDetailsDialogReady();
    return await this.assignment.readDriverName();
  }

  @step('页面读取：读取当前详情弹窗中的完整订单信息')
  async readOrderDetailsSnapshot(): Promise<RecallOrderDetails> {
    await this.waitForOrderDetailsDialogReady();
    const [
      customerInfo,
      memberInfo,
      orderContext,
      items,
      payments,
      paymentStatus,
      priceSummary,
      availableActions,
    ] = await Promise.all([
      this.header.readCustomerInfo(),
      this.header.readMemberInfo(),
      this.header.readOrderContext(),
      this.items.readItems(),
      this.payment.readPayments(),
      this.header.readPaymentStatus(),
      this.summary.read(),
      this.readOrderDetailAvailableActions(),
    ]);
    const orderNumber = (
      await this.detailsContext.dialog.locator('[class*="_number_"]').innerText()
    )
      .replace(/\s+/g, ' ')
      .trim();

    return {
      orderNumber,
      paymentStatus,
      customerInfo,
      memberInfo,
      orderContext,
      payments,
      items,
      priceSummary,
      availableActions,
    };
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
    await this.actions.click('edit');
  }

  @step((orderNumber: string) => `页面操作：点击 Recall 列表中的订单 ${orderNumber}`)
  private async clickVisibleOrderNumber(orderNumber: string): Promise<void> {
    const orderCardTrigger = this.filterBar.orderCardByNumber(orderNumber);

    await expect(orderCardTrigger).toHaveCount(1, { timeout: 10_000 });
    await expect(orderCardTrigger).toBeVisible({ timeout: 10_000 });
    await orderCardTrigger.click();
  }

  @step('页面操作：点击 Recall 列表第一张可见订单卡片')
  private async clickFirstVisibleOrderCard(): Promise<void> {
    const firstOpenOrderCard = this.filterBar.orderCards.first();

    await expect(firstOpenOrderCard).toBeVisible({ timeout: 10_000 });
    await firstOpenOrderCard.click();
  }

  @step('页面校验：Recall 订单详情弹窗已完成加载')
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

  private async selectSplitTargetOrderIfNeeded(targetOrderNumber?: string): Promise<void> {
    if (!targetOrderNumber) {
      return;
    }

    const splitOrderNumberText = formatOrderNumber(targetOrderNumber);
    const splitOrderTargetCard =
      await this.resolveSplitOrderTargetLabel(splitOrderNumberText);

    await expect(splitOrderTargetCard).toBeVisible({ timeout: 10_000 });
    const expectedChildOrderNumber = splitOrderNumberText;

    if (await this.isTopmostChildOrderDetailsReady(expectedChildOrderNumber)) {
      return;
    }

    const visibleDialogCount = await this.readVisibleOrderDialogCount();
    await splitOrderTargetCard.click();
    await this.waitForVisibleOrderDialogCount(visibleDialogCount + 1);
    await this.waitForTopmostChildOrderDetailsReady(expectedChildOrderNumber);
    await this.waitForGlobalLoadingOverlayHidden();
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
        const splitOverviewTitlePattern = new RegExp(
          `^${escapeRegExp(visibleOrderNumber)}\\(\\d+\\)$`,
        );
        const [
          standardTitleVisible,
          editActionVisible,
          splitOverviewTitleVisible,
          splitOverviewActionVisible,
          splitOverviewPrintVisible,
        ] = await Promise.all([
          topmostOrderDetailsDialog
            .getByText(visibleOrderNumber, { exact: true })
            .first()
            .isVisible()
            .catch(() => false),
          topmostOrderDetailsDialog
            .getByTestId('shared-order-detail-side-action-editod')
            .isVisible()
            .catch(() => false),
          topmostOrderDetailsDialog
            .getByRole('heading', { name: splitOverviewTitlePattern })
            .isVisible()
            .catch(() => false),
          topmostOrderDetailsDialog
            .getByRole('button', { name: 'Split', exact: true })
            .isVisible()
            .catch(() => false),
          topmostOrderDetailsDialog
            .getByRole('button', { name: 'Print', exact: true })
            .isVisible()
            .catch(() => false),
        ]);
        const contract = {
          standardTitleVisible,
          editActionVisible,
          splitOverviewTitleVisible,
          splitOverviewActionVisible,
          splitOverviewPrintVisible,
        };

        return {
          visibleDialogCount,
          ...contract,
        };
      },
      (state) =>
        state.standardTitleVisible ||
        (state.splitOverviewTitleVisible &&
          state.splitOverviewActionVisible &&
          state.splitOverviewPrintVisible),
      {
        timeout: 10_000,
        interval: 100,
        message: `Recall 订单 ${visibleOrderNumber} 的严格详情标题未显示。`,
      },
    );
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

    return this.visibleOrderDetailsDialogs.last();
  }

  private parseMoneyAmount(value: string): number {
    const normalizedValue = value.replace(/\s+/g, '').replace(/[$,]/g, '');
    const parsedValue = Number(normalizedValue);

    if (!Number.isFinite(parsedValue)) {
      throw new Error(`Unable to parse payment amount from Recall details: ${value}`);
    }

    return parsedValue;
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面读取：读取 Recall 订单详情 PAYMENT 卡片 ${paymentMethod} 中的 Tips`
      : '页面读取：读取 Recall 订单详情 PAYMENT 卡片中的 Tips',
  )
  async readPaymentCardTip(paymentMethod?: string): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    return await this.tips.readPaymentCardTip(paymentMethod);
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面读取：读取 Recall 订单详情 PAYMENT 卡片 ${paymentMethod} 中的 Tips 金额`
      : '页面读取：读取 Recall 订单详情 PAYMENT 卡片中的 Tips 金额',
  )
  async readPaymentCardTipAmount(paymentMethod?: string): Promise<number | null> {
    await this.waitForOrderDetailsDialogReady();
    return await this.tips.readPaymentCardTipAmount(paymentMethod);
  }

  @step((paymentIndex: number) =>
    `页面读取：读取 Recall 订单详情第 ${paymentIndex + 1} 笔 PAYMENT 流水的 Tips 金额`,
  )
  async readPaymentRecordTipAmount(paymentIndex: number): Promise<number | null> {
    await this.waitForOrderDetailsDialogReady();
    return await this.tips.readPaymentRecordTipAmount(paymentIndex);
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

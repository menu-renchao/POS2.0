import fs from 'node:fs';

const src = fs.readFileSync('pages/recall.page.ts', 'utf8');
const lines = src.split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function transformMethods(body) {
  return body
    .replaceAll('this.resolveManualSearchTagTestId(', 'resolveManualSearchTagTestId(')
    .replaceAll('this.normalizeOrderNumber(', 'normalizeOrderNumber(')
    .replaceAll('this.escapeRegExp(', 'escapeRegExp(');
}

const filterMethods = transformMethods(slice(262, 406));
const filterPrivate = transformMethods(slice(1635, 1709) + '\n' + slice(1844, 1874));

const orderDetailsMethods = transformMethods(`${slice(408, 1287)}\n${slice(1382, 1392)}`).replaceAll(
  'await this.clearAllSearchConditions()',
  'await this.filterBar.clearAllSearchConditions()',
).replaceAll(
  'await this.readLatestVisibleOrderNumber()',
  'await this.filterBar.readLatestVisibleOrderNumber()',
).replaceAll('this.orderListContainer', 'this.filterBar.orderListContainer');
const orderDetailsPrivate = transformMethods(`${slice(1517, 1633)}\n${slice(1711, 1842)}`)
  .replace(/private async waitForOrderDetailsDialogReady/g, 'async waitForOrderDetailsDialogReady')
  .replace(/private async dismissOrderDetailsDialogIfNeeded/g, 'async dismissOrderDetailsDialogIfNeeded');

const voidMethods = transformMethods(slice(1289, 1321));
const voidPrivate = transformMethods(slice(1394, 1515));

const exitMethods = transformMethods(slice(1323, 1392));
const closeOrderDetails = transformMethods(slice(1382, 1392));

const filterBarFile = `import { expect, type Locator, type Page } from '@playwright/test';
import {
  type RecallManualSearchTag,
  type RecallOrderStatus,
  type RecallOrderType,
  type RecallPaymentStatus,
  type RecallPaymentType,
  type RecallProductLine,
} from '../../test-data/recall-search-options';
import { step } from '../../utils/step';
import { waitForInputSettled } from '../../utils/input-stability';
import { waitUntil } from '../../utils/wait';
import { resolveManualSearchTagTestId } from './recall-reads.section';

export class RecallFilterBarSection {
  private readonly newOrderButton: Locator;
  private readonly paymentStatusButton: Locator;
  private readonly orderStatusButton: Locator;
  private readonly orderTypesButton: Locator;
  private readonly paymentTypesButton: Locator;
  private readonly productLineButton: Locator;
  private readonly searchTriggerButton: Locator;
  private readonly topSearchInput: Locator;
  private readonly searchDialog: Locator;
  private readonly searchDialogDefaultInput: Locator;
  private readonly searchDialogNumberInput: Locator;
  private readonly searchDialogAmountInput: Locator;
  private readonly searchDialogDefaultInputClearButton: Locator;
  private readonly searchDialogNumberInputClearButton: Locator;
  private readonly searchDialogAmountInputClearButton: Locator;
  private readonly searchDialogSubmitButton: Locator;
  private readonly searchDialogKeyboardCloseButton: Locator;
  private readonly activeFilterTags: Locator;
  readonly orderListContainer: Locator;

  constructor(readonly page: Page) {
    this.newOrderButton = this.page.locator('[data-testid="recall2-header-new-order"]:visible');
    this.paymentStatusButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-paymentStatus"]:visible',
    );
    this.orderStatusButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-orderStatus"]:visible',
    );
    this.orderTypesButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-orderType"]:visible',
    );
    this.paymentTypesButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-paymentType"]:visible',
    );
    this.productLineButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-productLine"]:visible',
    );
    this.searchTriggerButton = this.page.locator('[data-testid="recall2-search-trigger"]:visible');
    this.topSearchInput = this.page.getByTestId('recall2-search-input');
    this.searchDialog = this.page.getByTestId('recall2-search-modal');
    this.searchDialogDefaultInput = this.searchDialog.getByTestId('recall2-search-modal-input-default');
    this.searchDialogNumberInput = this.searchDialog.getByTestId('recall2-search-modal-input-number');
    this.searchDialogAmountInput = this.searchDialog.getByTestId('recall2-search-modal-input-amount');
    this.searchDialogDefaultInputClearButton = this.searchDialog.getByTestId(
      'recall2-search-modal-input-default-clear',
    );
    this.searchDialogNumberInputClearButton = this.searchDialog.getByTestId(
      'recall2-search-modal-input-number-clear',
    );
    this.searchDialogAmountInputClearButton = this.searchDialog.getByTestId(
      'recall2-search-modal-input-amount-clear',
    );
    this.searchDialogSubmitButton = this.searchDialog.getByTestId('recall2-search-modal-search-button');
    this.searchDialogKeyboardCloseButton = this.page.getByTestId('pos-keyboard-button-{close}');
    this.activeFilterTags = this.page.locator(
      '[data-testid^="recall2-filter-tag-"]:not([data-testid^="recall2-filter-tag-label"]):not([data-testid^="recall2-filter-tag-value"]):visible',
    );
    this.orderListContainer = this.page.getByTestId('recall2-order-list-container');
  }

${filterMethods}

${filterPrivate}
}
`;

const orderDetailsFile = `import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import { waitForInputSettled } from '../../utils/input-stability';
import { waitUntil } from '../../utils/wait';
import { OrderDishesPage } from '../order-dishes.page';
import { PaymentPage } from '../payment.page';
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
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderItemAddition,
  RecallOrderPaymentRecord,
} from './recall.types';

export class RecallOrderDetailsDialog {
  private readonly openOrderCards: Locator;
  private readonly visibleOrderDetailsDialogs: Locator;
  readonly orderDetailsDialog: Locator;
  private readonly orderDetailsEditButton: Locator;
  private readonly orderDetailsPayButton: Locator;
  readonly orderDetailsMoreButton: Locator;

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
  }

${orderDetailsMethods}

${orderDetailsPrivate}
}
`;

const voidFile = `import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import { waitForInputSettled } from '../../utils/input-stability';
import { waitUntil } from '../../utils/wait';
import type { RecallOrderDetailsDialog } from './recall-order-details.dialog';
import { recallScopedTestId } from './recall-reads.section';

export class RecallVoidDialog {
  private readonly voidOrderButton: Locator;
  private readonly voidAllMoreButton: Locator;
  private readonly voidDialog: Locator;
  private readonly voidRestoreInventoryCheckbox: Locator;
  private readonly voidNoteInput: Locator;
  private readonly voidSubmitButton: Locator;

  constructor(
    readonly page: Page,
    private readonly orderDetails: RecallOrderDetailsDialog,
  ) {
    this.voidOrderButton = recallScopedTestId(this.page, 'recall2-order-detail-void');
    this.voidAllMoreButton = recallScopedTestId(this.page, 'recall2-order-detail-void-all');
    this.voidDialog = this.page
      .locator('[role="dialog"]:visible')
      .filter({ has: this.page.getByText('Void Reason', { exact: true }) })
      .last();
    this.voidRestoreInventoryCheckbox = recallScopedTestId(
      this.voidDialog,
      'shared-void-dialog-restore-inventory-checkbox',
    );
    this.voidNoteInput = this.voidDialog.getByRole('textbox', { name: /^Note$/i });
    this.voidSubmitButton = this.voidDialog.getByRole('button', { name: /^Void$/i });
  }

${voidMethods
  .replaceAll('this.orderDetailsDialog', 'this.orderDetails.orderDetailsDialog')
  .replaceAll('await this.waitForOrderDetailsDialogReady()', 'await this.orderDetails.waitForOrderDetailsDialogReady()')
  .replaceAll('await this.openRecentOrderDetails()', 'await this.orderDetails.openRecentOrderDetails()')
  .replaceAll('await this.dismissOrderDetailsDialogIfNeeded()', 'await this.orderDetails.dismissOrderDetailsDialogIfNeeded()')}

${voidPrivate
  .replaceAll('this.orderDetailsMoreButton', 'this.orderDetails.orderDetailsMoreButton')
  .replaceAll('await this.waitForOrderDetailsDialogReady()', 'await this.orderDetails.waitForOrderDetailsDialogReady()')}
}
`;

const facadeFile = `import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { OrderDishesPage } from './order-dishes.page';
import { PaymentPage } from './payment.page';
import { RecallFilterBarSection } from './recall/recall-filter-bar.section';
import { RecallOrderDetailsDialog } from './recall/recall-order-details.dialog';
import { RecallVoidDialog } from './recall/recall-void.dialog';

export type {
  RecallCustomerInfo,
  RecallMemberInfo,
  RecallOrderContext,
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderItemAddition,
  RecallOrderPaymentRecord,
} from './recall/recall.types';

export class RecallPage {
  private readonly filterBar: RecallFilterBarSection;
  private readonly orderDetails: RecallOrderDetailsDialog;
  private readonly voidDialog: RecallVoidDialog;
  private readonly newOrderButton: Locator;
  private readonly exitRecallButton: Locator;

  constructor(private readonly page: Page) {
    this.filterBar = new RecallFilterBarSection(page);
    this.orderDetails = new RecallOrderDetailsDialog(page, this.filterBar);
    this.voidDialog = new RecallVoidDialog(page, this.orderDetails);
    this.newOrderButton = this.page.locator('[data-testid="recall2-header-new-order"]:visible');
    this.exitRecallButton = this.page
      .locator('.rcreturnbx_bth_exit')
      .or(this.page.getByRole('button', { name: /^Back$/i }))
      .first();
  }

  async expectLoaded(): Promise<void> {
    return this.filterBar.expectLoaded();
  }

  async selectPaymentStatus(
    ...args: Parameters<RecallFilterBarSection['selectPaymentStatus']>
  ): Promise<void> {
    return this.filterBar.selectPaymentStatus(...args);
  }

  async selectOrderStatus(
    ...args: Parameters<RecallFilterBarSection['selectOrderStatus']>
  ): Promise<void> {
    return this.filterBar.selectOrderStatus(...args);
  }

  async selectOrderType(...args: Parameters<RecallFilterBarSection['selectOrderType']>): Promise<void> {
    return this.filterBar.selectOrderType(...args);
  }

  async selectPaymentType(
    ...args: Parameters<RecallFilterBarSection['selectPaymentType']>
  ): Promise<void> {
    return this.filterBar.selectPaymentType(...args);
  }

  async selectProductLine(
    ...args: Parameters<RecallFilterBarSection['selectProductLine']>
  ): Promise<void> {
    return this.filterBar.selectProductLine(...args);
  }

  async openManualSearchDialog(): Promise<void> {
    return this.filterBar.openManualSearchDialog();
  }

  async selectManualSearchTag(
    ...args: Parameters<RecallFilterBarSection['selectManualSearchTag']>
  ): Promise<void> {
    return this.filterBar.selectManualSearchTag(...args);
  }

  async fillManualSearchKeyword(
    ...args: Parameters<RecallFilterBarSection['fillManualSearchKeyword']>
  ): Promise<void> {
    return this.filterBar.fillManualSearchKeyword(...args);
  }

  async submitManualSearch(): Promise<void> {
    return this.filterBar.submitManualSearch();
  }

  async closeManualSearchDialog(): Promise<void> {
    return this.filterBar.closeManualSearchDialog();
  }

  async clearAllSearchConditions(): Promise<void> {
    return this.filterBar.clearAllSearchConditions();
  }

  async readVisibleOrderNumbers(): Promise<string[]> {
    return this.filterBar.readVisibleOrderNumbers();
  }

  async readLatestVisibleOrderNumber(): Promise<string> {
    return this.filterBar.readLatestVisibleOrderNumber();
  }

  async readManualSearchKeyword(): Promise<string> {
    return this.filterBar.readManualSearchKeyword();
  }

  async readActiveFilterTexts(): Promise<string[]> {
    return this.filterBar.readActiveFilterTexts();
  }

  async openOrderDetails(
    ...args: Parameters<RecallOrderDetailsDialog['openOrderDetails']>
  ): Promise<void> {
    return this.orderDetails.openOrderDetails(...args);
  }

  async openFirstVisibleOrderDetails(): Promise<void> {
    return this.orderDetails.openFirstVisibleOrderDetails();
  }

  async openOrderForEditing(
    ...args: Parameters<RecallOrderDetailsDialog['openOrderForEditing']>
  ): Promise<OrderDishesPage> {
    return this.orderDetails.openOrderForEditing(...args);
  }

  async openFirstVisibleOrderForEditing(): Promise<OrderDishesPage> {
    return this.orderDetails.openFirstVisibleOrderForEditing();
  }

  async openRecentOrderDetails(): Promise<void> {
    return this.orderDetails.openRecentOrderDetails();
  }

  async openRecentOrderForEditing(): Promise<OrderDishesPage> {
    return this.orderDetails.openRecentOrderForEditing();
  }

  async openPayment(): Promise<PaymentPage> {
    return this.orderDetails.openPayment();
  }

  async expandOrderDetailsPriceSummary(): Promise<void> {
    return this.orderDetails.expandOrderDetailsPriceSummary();
  }

  async readOrderCustomerInfo(): Promise<import('./recall/recall.types').RecallCustomerInfo | null> {
    return this.orderDetails.readOrderCustomerInfo();
  }

  async readOrderMemberInfo(): Promise<import('./recall/recall.types').RecallMemberInfo | null> {
    return this.orderDetails.readOrderMemberInfo();
  }

  async readOrderPaymentStatus(): Promise<string | null> {
    return this.orderDetails.readOrderPaymentStatus();
  }

  async readOrderItems(): Promise<import('./recall/recall.types').RecallOrderItem[]> {
    return this.orderDetails.readOrderItems();
  }

  async readOrderPriceSummary(): Promise<Record<string, number>> {
    return this.orderDetails.readOrderPriceSummary();
  }

  async readOrderContext(): Promise<import('./recall/recall.types').RecallOrderContext> {
    return this.orderDetails.readOrderContext();
  }

  async readOrderPayments(): Promise<import('./recall/recall.types').RecallOrderPaymentRecord[]> {
    return this.orderDetails.readOrderPayments();
  }

  async readOrderDetailsSnapshot(): Promise<import('./recall/recall.types').RecallOrderDetails> {
    return this.orderDetails.readOrderDetailsSnapshot();
  }

  async voidCurrentOrder(...args: Parameters<RecallVoidDialog['voidCurrentOrder']>): Promise<void> {
    return this.voidDialog.voidCurrentOrder(...args);
  }

  async voidFirstVisibleOrder(...args: Parameters<RecallVoidDialog['voidFirstVisibleOrder']>): Promise<void> {
    return this.voidDialog.voidFirstVisibleOrder(...args);
  }

  async voidRecentVisibleOrder(
    ...args: Parameters<RecallVoidDialog['voidRecentVisibleOrder']>
  ): Promise<void> {
    return this.voidDialog.voidRecentVisibleOrder(...args);
  }

  async closeOrderDetailsDialog(): Promise<void> {
    return this.orderDetails.closeOrderDetailsDialog();
  }

${slice(1323, 1362)
  .replaceAll('await this.dismissOrderDetailsDialogIfNeeded()', 'await this.orderDetails.dismissOrderDetailsDialogIfNeeded()')
  .replaceAll('this.orderDetailsDialog', 'this.orderDetails.orderDetailsDialog')}

  private async waitForLeavingRecallPage(): Promise<boolean> {
    await waitUntil(
      async () => ({
        url: this.page.url(),
        recallHeaderVisible: await this.newOrderButton.isVisible().catch(() => false),
      }),
      ({ url, recallHeaderVisible }) => !/#recall/i.test(url) || !recallHeaderVisible,
      {
        timeout: 5_000,
        interval: 100,
        message: 'Recall 页面在退出操作后仍未离开。',
      },
    );

    return true;
  }
}
`;

fs.writeFileSync('pages/recall/recall-filter-bar.section.ts', filterBarFile);
fs.writeFileSync('pages/recall/recall-order-details.dialog.ts', orderDetailsFile);
fs.writeFileSync('pages/recall/recall-void.dialog.ts', voidFile);
fs.writeFileSync('pages/recall.page.ts', facadeFile);
console.log('built recall split');

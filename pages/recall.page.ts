import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { PagingPage } from './paging.page';
import { RecallFilterBarSection } from './recall/recall-filter-bar.section';
import { RecallDateFilterSection } from './recall/recall-date-filter.section';
import { RecallListSection } from './recall/recall-list.section';
import { RecallSummarySection } from './recall/recall-summary.section';
import { RecallOrderDetailsDialog } from './recall/recall-order-details.dialog';
import { RecallVoidDialog } from './recall/recall-void.dialog';

export type {
  RecallCustomerInfo,
  RecallDiscountWholeOrderSummary,
  RecallMemberInfo,
  RecallOrderContext,
  RecallOrderDetailAction,
  RecallOrderDetailActions,
  RecallOrderDetailsMoreAction,
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderItemAddition,
  RecallKitchenTicketResult,
  RecallOrderPaymentRecord,
} from './recall/recall.types';

export class RecallPage {
  public readonly filterBar: RecallFilterBarSection;
  public readonly dateFilter: RecallDateFilterSection;
  public readonly list: RecallListSection;
  public readonly summary: RecallSummarySection;
  public readonly orderDetails: RecallOrderDetailsDialog;
  public readonly voidDialog: RecallVoidDialog;
  private readonly newOrderButton: Locator;
  private readonly pagingButton: Locator;
  private readonly exitRecallButton: Locator;

  constructor(private readonly page: Page) {
    this.filterBar = new RecallFilterBarSection(page);
    this.dateFilter = new RecallDateFilterSection(page);
    this.list = new RecallListSection(page);
    this.summary = new RecallSummarySection(page);
    this.orderDetails = new RecallOrderDetailsDialog(page, this.filterBar);
    this.voidDialog = new RecallVoidDialog(page, this.orderDetails);
    this.newOrderButton = this.page.locator('[data-testid="recall2-header-new-order"]:visible');
    this.pagingButton = this.page.getByTestId('recall2-header-paging');
    this.exitRecallButton = this.page.getByRole('button', { name: 'Back', exact: true });
  }

  @step('页面校验：Recall 页面已加载')
  async expectLoaded(): Promise<void> {
    return this.filterBar.expectLoaded();
  }

  @step('页面操作：从 Recall 头部进入 Paging 页面')
  async enterPaging(): Promise<PagingPage> {
    await this.pagingButton.click();
    const pagingPage = new PagingPage(this.page);
    await pagingPage.expectLoaded();
    return pagingPage;
  }

  @step('页面操作：退出 Recall 页面')
  async exitRecall(): Promise<void> {
    await this.orderDetails.dismissOrderDetailsDialogIfNeeded();

    const exitButtonState = await waitUntil(
      async () => ({
        exitButtonVisible: await this.exitRecallButton.isVisible().catch(() => false),
        orderDetailsVisible: await this.orderDetails.orderDetailsDialog.isVisible().catch(() => false),
        url: this.page.url(),
      }),
      ({ exitButtonVisible, orderDetailsVisible, url }) =>
        exitButtonVisible || (!/#recall/i.test(url) && !orderDetailsVisible),
      {
        timeout: 5_000,
        interval: 100,
        message: 'Recall 页面退出按钮在关闭订单详情后仍未恢复可用。',
      },
    ).catch(() => null);

    if (!exitButtonState?.exitButtonVisible) {
      return;
    }

    await this.exitRecallButton.click({ timeout: 3_000 });
    await this.waitForLeavingRecallPage();
  }

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

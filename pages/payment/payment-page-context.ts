import type { Locator, Page } from '@playwright/test';

/**
 * Payment 的页面契约固定为支付面板 iframe；宿主页只承载打印小票弹窗。
 * 所有 section 共享该上下文，禁止再为同一控件拼接 host/frame 候选列表。
 */
export class PaymentPageContext {
  readonly frameElement: Locator;
  readonly frame: ReturnType<Page['frameLocator']>;
  readonly surface: Locator;
  readonly balanceDueControl: Locator;
  readonly paymentTypeControl: Locator;
  readonly backButton: Locator;
  readonly paymentFlow: Locator;
  readonly loadingOverlay: Locator;
  readonly failureDialog: Locator;
  readonly successConfirmButton: Locator;
  readonly partialPaidLeaveConfirmButton: Locator;

  constructor(readonly page: Page) {
    this.frameElement = page.locator('#paymentPanelContainer iframe');
    this.frame = page.frameLocator('#paymentPanelContainer iframe');
    this.surface = this.frame.locator('body');
    this.balanceDueControl = this.frame.getByText('Balance due', { exact: true });
    this.paymentTypeControl = this.frame.getByText('Payment type', { exact: true });
    this.backButton = this.frame.getByTestId('payment-panel-header-back');
    this.paymentFlow = this.frame.getByTestId('payment-panel-payment-flow');
    this.loadingOverlay = this.frame.getByTestId('pos-ui-loading-overlay');
    this.failureDialog = this.frame.getByRole('dialog').filter({
      has: this.frame.getByRole('heading', {
        name: 'Payment Failed',
        exact: true,
      }),
    });
    this.successConfirmButton = this.frame.getByTestId('pay-success-status-button-1');
    this.partialPaidLeaveConfirmButton = this.frame.getByRole('button', {
      name: 'Yes',
      exact: true,
    });
  }

  async isPanelVisible(): Promise<boolean> {
    const [frameVisible, paymentTypeVisible] = await Promise.all([
      this.frameElement.isVisible().catch(() => false),
      this.paymentTypeControl.isVisible().catch(() => false),
    ]);
    return frameVisible && paymentTypeVisible;
  }
}

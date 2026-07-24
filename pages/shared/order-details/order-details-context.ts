import type { Locator, Page } from '@playwright/test';

export class OrderDetailsContext {
  readonly visibleDialogs: Locator;
  readonly dialog: Locator;
  readonly dishItems: Locator;
  readonly paymentSection: Locator;
  readonly priceSummaryToggle: Locator;

  constructor(readonly page: Page) {
    this.visibleDialogs = page.locator(
      '[role="dialog"][data-testid="pos-ui-modal"]:visible',
    );
    this.dialog = this.visibleDialogs.last();
    this.dishItems = this.dialog.getByTestId('pos-ui-dish-item');
    this.paymentSection = this.dialog
      .getByRole('heading', { name: 'PAYMENT', exact: true })
      .locator('../..');
    this.priceSummaryToggle = page
      .locator('[data-test-id="shared-order-price-summary-toggle"]:visible')
      .last();
  }

  section(title: string): Locator {
    return this.dialog
      .getByRole('heading', { name: title, exact: true })
      .locator('../..');
  }
}

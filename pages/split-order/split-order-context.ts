import type { Locator, Page } from '@playwright/test';

export class SplitOrderContext {
  readonly frame: ReturnType<Page['frameLocator']>;
  readonly modal: Locator;
  readonly title: Locator;

  constructor(readonly page: Page) {
    this.frame = page.frameLocator('#splitPanelContainer iframe');
    this.modal = this.frame.getByRole('dialog').first();
    this.title = this.modal.getByRole('heading').first();
  }
}

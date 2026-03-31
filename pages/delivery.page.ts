import type { Page } from '@playwright/test';

export class DeliveryPage {
  constructor(private readonly page: Page) {
    void this.page;
  }
}

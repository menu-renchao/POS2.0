import type { Page } from '@playwright/test';

export class PickUpPage {
  constructor(private readonly page: Page) {
    void this.page;
  }
}

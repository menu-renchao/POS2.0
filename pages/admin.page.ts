import type { Page } from '@playwright/test';

export class AdminPage {
  constructor(private readonly page: Page) {
    void this.page;
  }
}

import type { Page } from '@playwright/test';

export class ReportPage {
  constructor(private readonly page: Page) {
    void this.page;
  }
}

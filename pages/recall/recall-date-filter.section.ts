import { expect, type Locator, type Page } from '@playwright/test';
import type {
  RecallDatePreset,
  RecallDateRange,
} from '../../test-data/recall-list';
import { step } from '../../utils/step';

export class RecallDateFilterSection {
  private readonly dateRangeButton: Locator;
  private readonly selectedStartDate: Locator;
  private readonly selectedEndDate: Locator;

  constructor(private readonly page: Page) {
    this.dateRangeButton = this.page.getByTestId('recall2-filter-date-range');
    this.selectedStartDate = this.dateRangeButton.locator('[data-field="start"]');
    this.selectedEndDate = this.dateRangeButton.locator('[data-field="end"]');
  }

  @step((preset: RecallDatePreset) => `页面操作：选择 Recall 日期预设 ${preset}`)
  async selectPreset(preset: RecallDatePreset): Promise<void> {
    await expect(this.dateRangeButton).toBeVisible();
    await this.dateRangeButton.click();
    await this.page.getByTestId(`date-picker-preset-${preset}`).click();
    await expect(this.dateRangeButton).toHaveAttribute('aria-expanded', 'false');
  }

  @step('页面读取：读取 Recall 当前日期范围')
  async readSelectedRange(): Promise<RecallDateRange> {
    await expect(this.selectedStartDate).toBeVisible();
    await expect(this.selectedEndDate).toBeVisible();

    return {
      start: (await this.selectedStartDate.innerText()).trim(),
      end: (await this.selectedEndDate.innerText()).trim(),
    };
  }
}

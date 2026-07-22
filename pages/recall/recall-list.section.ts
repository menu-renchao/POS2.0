import { expect, type Locator, type Page } from '@playwright/test';
import type {
  RecallSortableColumn,
  RecallSortDirection,
} from '../../test-data/recall-list';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';

export class RecallListSection {
  private readonly cardViewButton: Locator;
  private readonly listViewButton: Locator;
  private readonly orderTableContainer: Locator;
  private readonly orderTable: Locator;

  constructor(private readonly page: Page) {
    this.cardViewButton = this.page.getByTestId('recall2-view-mode-card-option');
    this.listViewButton = this.page.getByTestId('recall2-view-mode-list-option');
    this.orderTableContainer = this.page.getByTestId('recall2-order-table-container');
    this.orderTable = this.page.getByTestId('recall2-order-table');
  }

  @step('页面操作：将 Recall 订单切换为卡片视图')
  async switchToCardView(): Promise<void> {
    await expect(this.cardViewButton).toBeVisible();
    await this.cardViewButton.click();
    await expect(this.orderTableContainer).toBeHidden();
  }

  @step('页面操作：将 Recall 订单切换为列表视图')
  async switchToListView(): Promise<void> {
    await expect(this.listViewButton).toBeVisible();
    await this.listViewButton.click();
    await expect(this.orderTableContainer).toBeVisible();
    await expect(this.orderTable).toBeVisible();
  }

  @step((column: RecallSortableColumn) => `页面操作：点击 Recall 列表 ${column} 列排序`)
  async clickSort(column: RecallSortableColumn): Promise<RecallSortDirection> {
    const directionBeforeSort = await this.readSortDirection(column);
    const sortButton = this.sortButton(column);
    await expect(sortButton).toBeVisible();
    await sortButton.click();
    await expect(this.orderTable).toBeVisible();
    const direction = await waitUntil(
      async () => await this.readSortDirection(column),
      (direction): direction is RecallSortDirection =>
        direction !== null && direction !== directionBeforeSort,
      {
        timeout: 10_000,
        message: `Recall 列表 ${column} 列在点击排序后没有切换方向。`,
      },
    );

    if (!direction) {
      throw new Error(`Recall 列表 ${column} 列排序方向为空。`);
    }

    return direction;
  }

  @step((column: RecallSortableColumn) => `页面读取：读取 Recall 列表 ${column} 列排序方向`)
  async readSortDirection(column: RecallSortableColumn): Promise<RecallSortDirection | null> {
    const sortIcon = this.sortButton(column).locator('svg').first();

    if ((await sortIcon.count()) === 0) {
      return null;
    }

    const style = await sortIcon.getAttribute('style');

    if (style?.includes('--pos-ui-sort-primary: var(--pos-ui-primary-color)')) {
      return 'ascending';
    }

    if (style?.includes('--pos-ui-sort-secondary: var(--pos-ui-primary-color)')) {
      return 'descending';
    }

    return null;
  }

  @step((column: RecallSortableColumn) => `页面读取：读取 Recall 列表 ${column} 列可见值`)
  async readVisibleColumnValues(column: RecallSortableColumn): Promise<string[]> {
    return await this.readColumnValues(column);
  }

  private async readColumnValues(column: RecallSortableColumn): Promise<string[]> {
    const columnCells = this.orderTable.locator(
      `[data-testid^="recall2-order-cell-"][data-testid$="-${column}"]`,
    );

    return await waitUntil(
      async () =>
        (await columnCells.allTextContents())
          .map((value) => value.replace(/\s+/g, ' ').trim())
          .filter(Boolean),
      (values) => values.length > 1,
      {
        timeout: 10_000,
        message: `Recall 列表 ${column} 列没有加载出足够的可见值。`,
      },
    );
  }

  private sortButton(column: RecallSortableColumn): Locator {
    return this.orderTable.locator(
      `div:has(> span > span[data-testid="recall2-order-sort-header-${column}"]) > button[aria-label="sort-toggle"]`,
    );
  }
}

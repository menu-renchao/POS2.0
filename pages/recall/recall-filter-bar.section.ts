import { expect, type Locator, type Page } from '@playwright/test';
import {
  type RecallManualSearchTag,
  type RecallOrderStatus,
  type RecallOrderType,
  type RecallPaymentStatus,
  type RecallPaymentType,
  type RecallProductLine,
} from '../../test-data/recall-search-options';
import { step } from '../../utils/step';
import { escapeRegExp } from '../../utils/text';
import { waitForInputSettled } from '../../utils/input-stability';
import { waitUntil } from '../../utils/wait';
import { resolveManualSearchTagTestId } from './recall-reads.section';

export class RecallFilterBarSection {
  private readonly newOrderButton: Locator;
  private readonly paymentStatusButton: Locator;
  private readonly orderStatusButton: Locator;
  private readonly orderTypesButton: Locator;
  private readonly paymentTypesButton: Locator;
  private readonly productLineButton: Locator;
  private readonly searchTriggerButton: Locator;
  private readonly topSearchInput: Locator;
  private readonly searchDialog: Locator;
  private readonly searchDialogInput: Locator;
  private readonly searchDialogSubmitButton: Locator;
  private readonly searchDialogKeyboardCloseButton: Locator;
  private readonly activeFilterTags: Locator;
  private readonly orderCardGrid: Locator;
  readonly orderCards: Locator;
  readonly orderCardByNumber: (orderNumber: string) => Locator;
  readonly orderListContainer: Locator;

  constructor(readonly page: Page) {
    this.newOrderButton = this.page.locator('[data-testid="recall2-header-new-order"]:visible');
    this.paymentStatusButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-paymentStatus"]:visible',
    );
    this.orderStatusButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-orderStatus"]:visible',
    );
    this.orderTypesButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-orderType"]:visible',
    );
    this.paymentTypesButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-paymentType"]:visible',
    );
    this.productLineButton = this.page.locator(
      '[data-testid="recall2-filter-dropdown-productLine"]:visible',
    );
    this.searchTriggerButton = this.page.locator('[data-testid="recall2-search-trigger"]:visible');
    this.topSearchInput = this.page.getByTestId('recall2-search-input');
    this.searchDialog = this.page.getByTestId('recall2-search-modal');
    this.searchDialogInput = this.searchDialog.getByRole('textbox', {
      name: 'Search',
    });
    this.searchDialogSubmitButton = this.searchDialog.getByTestId('recall2-search-modal-search-button');
    this.searchDialogKeyboardCloseButton = this.page.getByTestId('pos-keyboard-button-{close}');
    this.activeFilterTags = this.page.locator(
      '[data-testid^="recall2-filter-tag-"]:not([data-testid^="recall2-filter-tag-label"]):not([data-testid^="recall2-filter-tag-value"]):visible',
    );
    this.orderCardGrid = this.page.getByTestId('recall2-order-card-grid');
    this.orderCards = this.orderCardGrid.locator(
      '[data-testid^="recall2-order-card-"]',
    );
    this.orderCardByNumber = (orderNumber: string) => {
      const normalizedOrderNumber = orderNumber.trim().replace(/^#/, '');
      return this.orderCards.filter({
        has: this.page.getByText(`#${normalizedOrderNumber}`, { exact: true }),
      });
    };
    this.orderListContainer = this.page.getByTestId('recall2-order-list-container');
  }

  @step('页面操作：确认 Recall 页面已经加载完成')
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/#recall/);
    await expect(this.newOrderButton).toBeVisible({ timeout: 15_000 });
    await expect(this.paymentStatusButton).toBeVisible({ timeout: 15_000 });
  }

  @step((paymentStatus: string) => `页面操作：按支付状态筛选 ${paymentStatus}`)
  async selectPaymentStatus(paymentStatus: RecallPaymentStatus): Promise<void> {
    await this.selectTopDropdownOption(this.paymentStatusButton, paymentStatus);
  }

  @step((orderStatus: string) => `页面操作：按订单状态筛选 ${orderStatus}`)
  async selectOrderStatus(orderStatus: RecallOrderStatus): Promise<void> {
    await this.selectTopDropdownOption(this.orderStatusButton, orderStatus);
  }

  @step((orderType: string) => `页面操作：按订单类型筛选 ${orderType}`)
  async selectOrderType(orderType: RecallOrderType): Promise<void> {
    await this.selectTopDropdownOption(this.orderTypesButton, orderType);
  }

  @step((paymentType: string) => `页面操作：按支付方式筛选 ${paymentType}`)
  async selectPaymentType(paymentType: RecallPaymentType): Promise<void> {
    await this.selectTopDropdownOption(this.paymentTypesButton, paymentType);
  }

  @step((productLine: string) => `页面操作：按产品线筛选 ${productLine}`)
  async selectProductLine(productLine: RecallProductLine): Promise<void> {
    await this.selectTopDropdownOption(this.productLineButton, productLine);
  }

  @step('页面操作：打开手动输入搜索弹窗')
  async openManualSearchDialog(): Promise<void> {
    await expect(this.searchTriggerButton).toBeVisible();
    await this.searchTriggerButton.click();
    await expect(this.searchDialog).toBeVisible();
  }

  @step((tag: RecallManualSearchTag) => `页面操作：选择手动输入搜索标签 ${tag}`)
  async selectManualSearchTag(tag: RecallManualSearchTag): Promise<void> {
    await expect(this.searchDialog).toBeVisible();
    await this.searchDialog.getByTestId(resolveManualSearchTagTestId(tag)).click();
  }

  @step((keyword: string) => `页面操作：输入手动搜索关键字 ${keyword}`)
  async fillManualSearchKeyword(keyword: string): Promise<void> {
    await expect(this.searchDialog).toBeVisible();
    await this.searchDialogInput.fill(keyword);
  }

  @step('页面操作：提交手动搜索条件')
  async submitManualSearch(): Promise<void> {
    await expect(this.searchDialog).toBeVisible();
    await waitForInputSettled(this.searchDialogInput);
    await this.searchDialogSubmitButton.click();
    await expect(this.searchDialog).toBeHidden();
  }

  @step('页面操作：关闭手动搜索弹窗')
  async closeManualSearchDialog(): Promise<void> {
    if (await this.searchDialog.isVisible().catch(() => false)) {
      if (await this.searchDialogKeyboardCloseButton.isVisible().catch(() => false)) {
        await this.searchDialogKeyboardCloseButton.click();
      }

      if (await this.searchDialog.isVisible().catch(() => false)) {
        await this.page.keyboard.press('Escape');
      }

      await expect(this.searchDialog).toBeHidden({ timeout: 2_000 });
    }
  }

  @step('页面操作：清空当前所有搜索条件')
  async clearAllSearchConditions(): Promise<void> {
    await this.clearManualSearchConditionIfNeeded();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      if ((await this.readActiveFilterCount()) === 0) {
        return;
      }

      const clearAllButton = this.page.getByRole('button', { name: /^Clear All$/i });
      if (await clearAllButton.isVisible().catch(() => false)) {
        await clearAllButton.click();
        await waitUntil(
          async () => await this.readActiveFilterCount(),
          (filterCount) => filterCount === 0,
          {
            timeout: 3_000,
            message: 'Recall 筛选条件在点击 Clear All 后仍未清空。',
          },
        );
        return;
      }

      if ((await this.activeFilterTags.count().catch(() => 0)) > 0) {
        await this.activeFilterTags.first().click({ timeout: 1_000 });
        continue;
      }

      const removeFilterButton = this.page.getByRole('button', { name: /^Remove filter:/i }).first();
      if (!(await removeFilterButton.isVisible().catch(() => false))) {
        const activeFilters = await this.readActiveFilterTexts();
        throw new Error(
          `Recall 仍有 ${activeFilters.length} 个筛选条件，但未找到可清除控件：${activeFilters.join(' | ')}`,
        );
      }

      await removeFilterButton.click();
    }

    const remainingFilters = await this.readActiveFilterTexts();
    throw new Error(
      `Recall 筛选条件在 10 次清理后仍未清空：${remainingFilters.join(' | ')}`,
    );
  }

  @step('页面操作：移除 Recall 支付状态 Unpaid 筛选标签')
  async removeUnpaidPaymentStatusFilterIfPresent(): Promise<void> {
    const unpaidFilterButton = this.page.getByRole('button', {
      name: /^Remove filter:\s*Payment Status\s+Unpaid$/i,
    });

    if (await unpaidFilterButton.isVisible().catch(() => false)) {
      await unpaidFilterButton.click();
    }
  }

  @step('页面读取：读取当前可见订单号列表')
  async readVisibleOrderNumbers(): Promise<string[]> {
    if (await this.orderCardGrid.isVisible().catch(() => false)) {
      const cardOrderNumbers = await this.orderCardGrid.evaluate((orderCardGridElement) => {
        const matchedOrderNumbers =
          (orderCardGridElement as HTMLElement).innerText.match(/#\d+/g) ?? [];
        return [...new Set<string>(matchedOrderNumbers)];
      });

      if (cardOrderNumbers.length > 0) {
        return cardOrderNumbers;
      }
    }

    if (await this.orderListContainer.isVisible().catch(() => false)) {
      const listOrderNumbers = await this.orderListContainer.evaluate((orderListElement) => {
        const matchedOrderNumbers = (orderListElement as HTMLElement).innerText.match(/#\d+/g) ?? [];
        return [...new Set<string>(matchedOrderNumbers)];
      });

      if (listOrderNumbers.length > 0) {
        return listOrderNumbers;
      }
    }

    return [];
  }

  @step('页面读取：读取当前可见订单中的最新订单号')
  async readLatestVisibleOrderNumber(): Promise<string> {
    const visibleOrderNumbers = await waitUntil(
      async () => await this.readVisibleOrderNumbers(),
      (orderNumbers) => orderNumbers.length > 0,
      {
        timeout: 10_000,
        message: 'Recall order list did not load any order numbers in time.',
      },
    );

    const [latestOrderNumber] = [...visibleOrderNumbers].sort((leftOrderNumber, rightOrderNumber) => {
      const leftValue = Number(leftOrderNumber.replace(/^#/, ''));
      const rightValue = Number(rightOrderNumber.replace(/^#/, ''));
      return rightValue - leftValue;
    });

    if (!latestOrderNumber) {
      throw new Error('Unable to determine the latest visible Recall order number.');
    }

    return latestOrderNumber;
  }

  @step((orderNumber: string) => `页面读取：读取 Recall 订单 ${orderNumber} 的卡片文本`)
  async readOrderCardText(orderNumber: string): Promise<string> {
    const orderCard = this.orderCardByNumber(orderNumber);

    await expect(orderCard).toHaveCount(1);
    return (await orderCard.innerText()).replace(/\s+/g, ' ').trim();
  }

  @step('页面读取：读取当前手动搜索关键字')
  async readManualSearchKeyword(): Promise<string> {
    return await this.topSearchInput.inputValue({ timeout: 1_000 }).catch(() => '');
  }

  @step('页面读取：读取当前激活的筛选条件')
  async readActiveFilterTexts(): Promise<string[]> {
    const filterTexts = await this.activeFilterTags.allTextContents();
    const removeFilterLabels = await this.page
      .getByRole('button', { name: /^Remove filter:/i })
      .evaluateAll((buttons) =>
        buttons
          .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
          .map((label) => label.replace(/\s+/g, ' ').trim())
          .filter(Boolean),
      )
      .catch(() => []);

    return [...filterTexts, ...removeFilterLabels]
      .map((filterText) => filterText.trim())
      .filter(Boolean);
  }

  @step((_filterButton: Locator, optionName: string) => `页面操作：从顶部筛选下拉菜单中选择 ${optionName}`)
  private async selectTopDropdownOption(filterButton: Locator, optionName: string): Promise<void> {
    await this.dismissBlockingOverlaysIfPresent();
    await expect(filterButton).toBeVisible();
    await filterButton.click();
    await this.page
      .getByTestId(/^recall2-filter-option-.+$/)
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(optionName)}\\s*$`, 'i') })
      .first()
      .click();
  }

  @step('页面操作：如有手动搜索关键字则重置 Recall 页面状态')
  private async clearManualSearchConditionIfNeeded(): Promise<void> {
    const currentKeyword = await this.topSearchInput.inputValue({ timeout: 1_000 }).catch(() => '');

    if (!currentKeyword) {
      return;
    }

    await this.openManualSearchDialog();

    await this.searchDialogInput.fill('');
    await expect(this.searchDialogInput).toHaveValue('');
    await this.closeManualSearchDialog();
    await this.topSearchInput.fill('');
    await expect(this.topSearchInput).toHaveValue('');
  }

  @step('页面操作：等待或关闭挡住 Recall 操作的顶层遮罩')
  private async dismissBlockingOverlaysIfPresent(): Promise<void> {
    const blockingOverlay = this.page.locator('[class*="_overlay_"]:visible').first();

    const overlayCleared = await waitUntil(
      async () => !(await blockingOverlay.isVisible().catch(() => false)),
      (cleared) => cleared,
      {
        timeout: 10_000,
        interval: 200,
        message: 'Recall 顶层遮罩仍在阻挡页面操作。',
      },
    )
      .then(() => true)
      .catch(() => false);

    if (overlayCleared) {
      return;
    }

    await this.page.keyboard.press('Escape').catch(() => undefined);

    await waitUntil(
      async () => !(await blockingOverlay.isVisible().catch(() => false)),
      (cleared) => cleared,
      {
        timeout: 5_000,
        interval: 200,
        message: 'Recall 顶层遮罩在按 Escape 后仍未消失。',
      },
    );
  }
  private async readActiveFilterCount(): Promise<number> {
    const tagCount = await this.activeFilterTags.count().catch(() => 0);
    const removeFilterCount = await this.page
      .getByRole('button', { name: /^Remove filter:/i })
      .count()
      .catch(() => 0);

    return tagCount + removeFilterCount;
  }

}

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
  private readonly searchDialogDefaultInput: Locator;
  private readonly searchDialogNumberInput: Locator;
  private readonly searchDialogAmountInput: Locator;
  private readonly searchDialogDefaultInputClearButton: Locator;
  private readonly searchDialogNumberInputClearButton: Locator;
  private readonly searchDialogAmountInputClearButton: Locator;
  private readonly searchDialogSubmitButton: Locator;
  private readonly searchDialogKeyboardCloseButton: Locator;
  private readonly activeFilterTags: Locator;
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
    this.searchDialogDefaultInput = this.searchDialog.getByTestId('recall2-search-modal-input-default');
    this.searchDialogNumberInput = this.searchDialog.getByTestId('recall2-search-modal-input-number');
    this.searchDialogAmountInput = this.searchDialog.getByTestId('recall2-search-modal-input-amount');
    this.searchDialogDefaultInputClearButton = this.searchDialog.getByTestId(
      'recall2-search-modal-input-default-clear',
    );
    this.searchDialogNumberInputClearButton = this.searchDialog.getByTestId(
      'recall2-search-modal-input-number-clear',
    );
    this.searchDialogAmountInputClearButton = this.searchDialog.getByTestId(
      'recall2-search-modal-input-amount-clear',
    );
    this.searchDialogSubmitButton = this.searchDialog.getByTestId('recall2-search-modal-search-button');
    this.searchDialogKeyboardCloseButton = this.page.getByTestId('pos-keyboard-button-{close}');
    this.activeFilterTags = this.page.locator(
      '[data-testid^="recall2-filter-tag-"]:not([data-testid^="recall2-filter-tag-label"]):not([data-testid^="recall2-filter-tag-value"]):visible',
    );
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
    await this.searchTriggerButton.evaluate((searchTrigger) => {
      (searchTrigger as HTMLElement).click();
    });
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
    await (await this.resolveVisibleSearchDialogInput()).fill(keyword);
  }

  @step('页面操作：提交手动搜索条件')
  async submitManualSearch(): Promise<void> {
    await expect(this.searchDialog).toBeVisible();
    await waitForInputSettled();
    await this.searchDialogSubmitButton.click();
    await expect(this.searchDialog).toBeHidden();
  }

  @step('页面操作：关闭手动搜索弹窗')
  async closeManualSearchDialog(): Promise<void> {
    if (await this.searchDialog.isVisible().catch(() => false)) {
      if (await this.searchDialogKeyboardCloseButton.isVisible().catch(() => false)) {
        await this.searchDialogKeyboardCloseButton.evaluate((closeButton) => {
          (closeButton as HTMLElement).click();
        });
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
        await clearAllButton.evaluate((button) => {
          (button as HTMLElement).click();
        });
        await waitUntil(
          async () => await this.readActiveFilterCount(),
          (filterCount) => filterCount === 0,
          {
            timeout: 3_000,
            message: 'Recall 筛选条件在点击 Clear All 后仍未清空。',
          },
        ).catch(() => undefined);

        if ((await this.readActiveFilterCount()) === 0) {
          return;
        }
      }

      if ((await this.activeFilterTags.count().catch(() => 0)) > 0) {
        await this.activeFilterTags.first().click({ timeout: 1_000 }).catch(() => undefined);
        continue;
      }

      const removeFilterButton = this.page.getByRole('button', { name: /^Remove filter:/i }).first();
      if (!(await removeFilterButton.isVisible().catch(() => false))) {
        return;
      }

      await removeFilterButton.evaluate((button) => {
        (button as HTMLElement).click();
      });
    }
  }

  @step('页面操作：移除 Recall 支付状态 Unpaid 筛选标签')
  async removeUnpaidPaymentStatusFilterIfPresent(): Promise<void> {
    const unpaidFilterButton = this.page.getByRole('button', {
      name: /^Remove filter:\s*Payment Status\s+Unpaid$/i,
    });

    if (await unpaidFilterButton.isVisible().catch(() => false)) {
      await unpaidFilterButton.evaluate((button) => {
        (button as HTMLElement).click();
      });
    }
  }

  @step('页面读取：读取当前可见订单号列表')
  async readVisibleOrderNumbers(): Promise<string[]> {
    if (await this.orderListContainer.isVisible().catch(() => false)) {
      return await this.orderListContainer.evaluate((orderListElement) => {
        const matchedOrderNumbers = (orderListElement as HTMLElement).innerText.match(/#\d+/g) ?? [];
        return [...new Set<string>(matchedOrderNumbers)];
      });
    }

    return await this.page.evaluate(() => {
      const matchedOrderNumbers = document.body.innerText.match(/#\d+/g) ?? [];
      return [...new Set<string>(matchedOrderNumbers)];
    });
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

  @step('页面读取：读取当前手动搜索关键字')
  async readManualSearchKeyword(): Promise<string> {
    return await this.topSearchInput.inputValue();
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
      .filter({ hasText: optionName })
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

    const visibleClearButton = await this.resolveVisibleSearchDialogClearButton();

    if (visibleClearButton) {
      await visibleClearButton.evaluate((clearButton) => {
        (clearButton as HTMLElement).click();
      });
    } else {
      await (await this.resolveVisibleSearchDialogInput()).fill('');
    }

    await expect(await this.resolveVisibleSearchDialogInput()).toHaveValue('');
    await this.closeManualSearchDialog();
    await this.topSearchInput.evaluate((inputElement) => {
      const input = inputElement as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
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
    ).catch(() => undefined);
  }
  private async resolveVisibleSearchDialogInput(): Promise<Locator> {
    const inputCandidates = [
      this.searchDialogDefaultInput,
      this.searchDialogNumberInput,
      this.searchDialogAmountInput,
    ];

    for (const inputCandidate of inputCandidates) {
      if (await inputCandidate.isVisible().catch(() => false)) {
        return inputCandidate;
      }
    }

    throw new Error('Unable to find a visible manual search input in the Recall search dialog.');
  }

  private async readActiveFilterCount(): Promise<number> {
    const tagCount = await this.activeFilterTags.count().catch(() => 0);
    const removeFilterCount = await this.page
      .getByRole('button', { name: /^Remove filter:/i })
      .count()
      .catch(() => 0);

    return tagCount + removeFilterCount;
  }

  private async resolveVisibleSearchDialogClearButton(): Promise<Locator | null> {
    const clearButtonCandidates = [
      this.searchDialogDefaultInputClearButton,
      this.searchDialogNumberInputClearButton,
      this.searchDialogAmountInputClearButton,
    ];

    for (const clearButtonCandidate of clearButtonCandidates) {
      if (await clearButtonCandidate.isVisible().catch(() => false)) {
        return clearButtonCandidate;
      }
    }

    return null;
  }
}

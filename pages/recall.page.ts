import { expect, type Locator, type Page } from '@playwright/test';
import {
  type RecallManualSearchTag,
  type RecallOrderStatus,
  type RecallOrderType,
  type RecallPaymentStatus,
  type RecallPaymentType,
  type RecallProductLine,
} from '../test-data/recall-search-options';
import { step } from '../utils/step';

export class RecallPage {
  private readonly newOrderButton: Locator;
  private readonly pagingButton: Locator;
  private readonly paymentStatusButton: Locator;
  private readonly orderStatusButton: Locator;
  private readonly orderTypesButton: Locator;
  private readonly paymentTypesButton: Locator;
  private readonly productLineButton: Locator;
  private readonly moreFiltersButton: Locator;
  private readonly topSearchInput: Locator;
  private readonly orderNumberBadges: Locator;
  private readonly searchDialog: Locator;
  private readonly searchDialogInput: Locator;
  private readonly searchDialogSubmitButton: Locator;
  private readonly searchDialogClearButton: Locator;
  private readonly searchDialogCloseButton: Locator;
  private readonly activeFilterRemoveButtons: Locator;

  constructor(private readonly page: Page) {
    this.newOrderButton = this.page.getByRole('button', { name: /New Order/ });
    this.pagingButton = this.page.getByRole('button', { name: /Paging/ });
    this.paymentStatusButton = this.page.getByRole('button', {
      name: /Payment Status$/,
    });
    this.orderStatusButton = this.page.getByRole('button', {
      name: /Order Status$/,
    });
    this.orderTypesButton = this.page.getByRole('button', {
      name: /Order Types$/,
    });
    this.paymentTypesButton = this.page.getByRole('button', {
      name: /Payment Types$/,
    });
    this.productLineButton = this.page.getByRole('button', {
      name: /Product Line$/,
    });
    this.moreFiltersButton = this.page.getByRole('button', { name: 'More Filters' });
    this.topSearchInput = this.page.getByRole('textbox', { name: 'Search' }).first();
    this.orderNumberBadges = this.page.getByText(/^#\d+$/);
    this.searchDialog = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('heading', { name: 'Search orders' }) });
    this.searchDialogInput = this.searchDialog.getByRole('textbox', { name: 'Search' });
    this.searchDialogSubmitButton = this.searchDialog.getByRole('button', {
      name: 'Search',
      exact: true,
    });
    this.searchDialogClearButton = this.searchDialog.getByRole('button', { name: '清除' });
    this.searchDialogCloseButton = this.searchDialog.getByRole('button', { name: 'Close' });
    this.activeFilterRemoveButtons = this.page.getByRole('button', {
      name: /^Remove filter:/,
    });
  }

  @step('页面操作：确认 Recall 页面已经加载完成')
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/#recall/);
    await expect(this.newOrderButton).toBeVisible({ timeout: 15_000 });
    await expect(this.pagingButton).toBeVisible({ timeout: 15_000 });
    await expect(this.paymentStatusButton).toBeVisible({ timeout: 15_000 });
    await expect(this.orderNumberBadges.first()).toBeVisible({ timeout: 15_000 });
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

  @step((productLine: string) => `页面操作：按产品类型筛选 ${productLine}`)
  async selectProductLine(productLine: RecallProductLine): Promise<void> {
    await this.selectTopDropdownOption(this.productLineButton, productLine);
  }

  @step('页面操作：打开手动输入搜索弹窗')
  async openManualSearchDialog(): Promise<void> {
    await this.topSearchInput.click();
    await expect(this.searchDialog).toBeVisible();
  }

  @step((tag: RecallManualSearchTag) => `页面操作：选择手动输入搜索标签 ${tag}`)
  async selectManualSearchTag(tag: RecallManualSearchTag): Promise<void> {
    await expect(this.searchDialog).toBeVisible();
    await this.searchDialog.getByRole('button', { name: tag, exact: true }).click();
  }

  @step((keyword: string) => `页面操作：输入手动搜索关键词 ${keyword}`)
  async fillManualSearchKeyword(keyword: string): Promise<void> {
    await expect(this.searchDialog).toBeVisible();
    await this.searchDialogInput.fill(keyword);
  }

  @step('页面操作：提交手动输入搜索条件')
  async submitManualSearch(): Promise<void> {
    await expect(this.searchDialog).toBeVisible();
    await this.searchDialogSubmitButton.click();
    await expect(this.searchDialog).toBeHidden();
  }

  @step('页面操作：关闭手动输入搜索弹窗')
  async closeManualSearchDialog(): Promise<void> {
    if (await this.searchDialog.isVisible().catch(() => false)) {
      if (await this.searchDialogCloseButton.isVisible().catch(() => false)) {
        await this.searchDialogCloseButton.evaluate((closeButton) => {
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

    while (await this.activeFilterRemoveButtons.count()) {
      await this.activeFilterRemoveButtons.first().click();
    }
  }

  @step('页面操作：读取当前可见订单号列表')
  async readVisibleOrderNumbers(): Promise<string[]> {
    const orderNumbers = await this.orderNumberBadges.allTextContents();
    return orderNumbers.map((orderNumber) => orderNumber.trim()).filter(Boolean);
  }

  @step('页面操作：读取当前手动搜索关键词')
  async readManualSearchKeyword(): Promise<string> {
    return await this.topSearchInput.inputValue();
  }

  @step('页面操作：读取当前激活的筛选条件')
  async readActiveFilterTexts(): Promise<string[]> {
    const filterTexts = await this.activeFilterRemoveButtons.allTextContents();
    return filterTexts.map((filterText) => filterText.trim()).filter(Boolean);
  }

  @step((_filterButton: Locator, optionName: string) => `页面操作：从顶部筛选下拉菜单中选择 ${optionName}`)
  private async selectTopDropdownOption(
    filterButton: Locator,
    optionName: string,
  ): Promise<void> {
    await expect(filterButton).toBeVisible();
    await filterButton.click();
    await this.page.getByRole('menuitem', { name: optionName, exact: true }).click();
  }

  @step('页面操作：如有手动搜索关键词则重置 Recall 页面状态')
  private async clearManualSearchConditionIfNeeded(): Promise<void> {
    const currentKeyword = await this.topSearchInput.inputValue().catch(() => '');

    if (!currentKeyword) {
      return;
    }

    await this.openManualSearchDialog();

    if (await this.searchDialogClearButton.isVisible().catch(() => false)) {
      await this.searchDialogClearButton.evaluate((clearButton) => {
        (clearButton as HTMLElement).click();
      });
    } else {
      await this.searchDialogInput.fill('');
    }

    await expect(this.searchDialogInput).toHaveValue('');
    await this.closeManualSearchDialog();
    await this.topSearchInput.evaluate((inputElement) => {
      const input = inputElement as HTMLInputElement;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(this.topSearchInput).toHaveValue('');
  }
}

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
import { waitUntil } from '../utils/wait';
import { OrderDishesPage } from './order-dishes.page';

export type RecallCustomerInfo = {
  name: string;
  phone: string;
  address: string | null;
  note: string | null;
};

export type RecallMemberInfo = {
  entries: string[];
};

export type RecallOrderContext = {
  orderType: string | null;
  tableName: string | null;
  guestCount: string | null;
  serverName: string | null;
};

export type RecallOrderPaymentRecord = {
  method: string;
  amount: string | null;
  details: Record<string, string>;
};

export type RecallOrderItemAddition = {
  name: string;
  price?: string;
};

export type RecallOrderItem = {
  seat: string | null;
  sentTime: string | null;
  quantity: string | null;
  name: string;
  price: string | null;
  additions: RecallOrderItemAddition[];
};

export type RecallOrderDetails = {
  orderNumber: string;
  paymentStatus: string | null;
  customerInfo: RecallCustomerInfo | null;
  memberInfo: RecallMemberInfo | null;
  orderContext: RecallOrderContext;
  payments: RecallOrderPaymentRecord[];
  items: RecallOrderItem[];
  priceSummary: Record<string, number>;
};

export class RecallPage {
  private readonly newOrderButton: Locator;
  private readonly pagingButton: Locator;
  private readonly paymentStatusButton: Locator;
  private readonly orderStatusButton: Locator;
  private readonly orderTypesButton: Locator;
  private readonly paymentTypesButton: Locator;
  private readonly productLineButton: Locator;
  private readonly moreFiltersButton: Locator;
  private readonly searchTriggerButton: Locator;
  private readonly topSearchInput: Locator;
  private readonly orderNumberBadges: Locator;
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
  private readonly orderListContainer: Locator;
  private readonly openOrderCards: Locator;
  private readonly visibleOrderDetailsDialogs: Locator;
  private readonly orderDetailsDialog: Locator;
  private readonly orderDetailsEditButton: Locator;
  private readonly orderDetailsPriceSummaryToggle: Locator;
  private readonly orderDetailsPriceSummaryDetailsContainer: Locator;

  constructor(private readonly page: Page) {
    this.newOrderButton = this.page.locator('[data-testid="recall2-header-new-order"]:visible');
    this.pagingButton = this.page.locator('[data-testid="recall2-header-paging"]:visible');
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
    this.moreFiltersButton = this.page.locator('[data-testid="icon-button-More Filters"]:visible');
    this.searchTriggerButton = this.page.locator('[data-testid="recall2-search-trigger"]:visible');
    this.topSearchInput = this.page.getByTestId('recall2-search-input');
    this.orderNumberBadges = this.page.getByText(/^#\d+$/);
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
    this.openOrderCards = this.page.locator(
      [
        '[data-test-id^="shared-order-card-open-"]',
        '[data-testid^="shared-order-card-open-"]',
      ].join(', '),
    );
    this.visibleOrderDetailsDialogs = this.page.locator(
      '[role="dialog"][data-testid="pos-ui-modal"]:visible',
    );
    this.orderDetailsDialog = this.page.locator('[role="dialog"][data-testid="pos-ui-modal"]:visible').last();
    this.orderDetailsEditButton = this.orderDetailsDialog
      .locator(
        [
          '[data-test-id="shared-order-detail-side-action-editod"]',
          '[data-testid="shared-order-detail-side-action-editod"]',
          '[data-test-id="recall2-order-detail-edit"]',
          '[data-testid="recall2-order-detail-edit"]',
        ].join(', '),
      )
      .or(this.orderDetailsDialog.getByRole('button', { name: /^(Edit|编辑)$/ }))
      .first();
    this.orderDetailsPriceSummaryToggle = this.orderDetailsDialog
      .locator(
        [
          '[data-test-id="shared-order-price-summary-toggle"]',
          '[data-testid="shared-order-price-summary-toggle"]',
        ].join(', '),
      )
      .or(this.orderDetailsDialog.getByRole('button', { name: /Total\(Cash\).*Total\(Card\)/ }))
      .first();
    this.orderDetailsPriceSummaryDetailsContainer =
      this.orderDetailsPriceSummaryToggle.locator('xpath=following-sibling::*[1]');
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
    await this.searchDialog.getByTestId(this.resolveManualSearchTagTestId(tag)).click();
  }

  @step((keyword: string) => `页面操作：输入手动搜索关键字 ${keyword}`)
  async fillManualSearchKeyword(keyword: string): Promise<void> {
    await expect(this.searchDialog).toBeVisible();
    await (await this.resolveVisibleSearchDialogInput()).fill(keyword);
  }

  @step('页面操作：提交手动搜索条件')
  async submitManualSearch(): Promise<void> {
    await expect(this.searchDialog).toBeVisible();
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

    let previousFilterCount = Number.POSITIVE_INFINITY;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const currentFilterCount = await this.activeFilterTags.count().catch(() => 0);

      if (currentFilterCount === 0 || currentFilterCount >= previousFilterCount) {
        break;
      }

      previousFilterCount = currentFilterCount;
      await this.activeFilterTags.first().click({ timeout: 1_000 }).catch(() => undefined);
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

  @step('页面读取：读取当前手动搜索关键字')
  async readManualSearchKeyword(): Promise<string> {
    return await this.topSearchInput.inputValue();
  }

  @step('页面读取：读取当前激活的筛选条件')
  async readActiveFilterTexts(): Promise<string[]> {
    const filterTexts = await this.activeFilterTags.allTextContents();
    return filterTexts.map((filterText) => filterText.trim()).filter(Boolean);
  }

  @step((orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `页面操作：打开订单 ${orderNumber} 的详情弹窗并进入子单 ${targetOrderNumber}`
      : `页面操作：打开订单 ${orderNumber} 的详情弹窗`,
  )
  async openOrderDetails(orderNumber: string, targetOrderNumber?: string): Promise<void> {
    const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber);

    await this.closeOrderDetailsDialog();
    await this.clickVisibleOrderNumber(normalizedOrderNumber);
    await this.waitForOrderDetailsDialogReady();
    await this.selectSplitTargetOrderIfNeeded(normalizedOrderNumber, targetOrderNumber);
  }

  @step('页面操作：打开 Recall 列表第一张可见订单卡片的详情弹窗')
  async openFirstVisibleOrderDetails(): Promise<void> {
    if (await this.orderDetailsDialog.isVisible().catch(() => false)) {
      return;
    }

    await this.clickFirstVisibleOrderCard();
    await this.waitForOrderDetailsDialogReady();
  }

  @step((orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `页面操作：打开 Recall 订单 ${orderNumber} 的子单 ${targetOrderNumber} 并点击编辑`
      : `页面操作：打开 Recall 订单 ${orderNumber} 并点击编辑`,
  )
  async openOrderForEditing(
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<OrderDishesPage> {
    await this.openOrderDetails(orderNumber, targetOrderNumber);
    await this.clickEditInOrderDetails();

    const orderDishesPage = new OrderDishesPage(this.page);
    await orderDishesPage.expectLoaded();

    return orderDishesPage;
  }

  @step('页面操作：打开 Recall 第一张可见订单卡片并点击编辑')
  async openFirstVisibleOrderForEditing(): Promise<OrderDishesPage> {
    if (!(await this.orderDetailsEditButton.isVisible().catch(() => false))) {
      await this.openFirstVisibleOrderDetails();
    }

    await this.clickEditInOrderDetails();

    const orderDishesPage = new OrderDishesPage(this.page);
    await orderDishesPage.expectLoaded();

    return orderDishesPage;
  }

  @step('页面操作：展开 Recall 订单详情价格汇总')
  async expandOrderDetailsPriceSummary(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();

    if (await this.isOrderDetailsPriceSummaryExpanded()) {
      return;
    }

    const priceSummaryToggle = await this.resolveVisibleOrderDetailsPriceSummaryToggle();

    if (!priceSummaryToggle) {
      return;
    }

    await priceSummaryToggle.click({ timeout: 10_000 });
    await waitUntil(
      async () => await this.isOrderDetailsPriceSummaryExpanded(),
      (expanded) => expanded,
      {
        timeout: 10_000,
        probeTimeout: 2_000,
        message: 'Recall 订单详情价格汇总未在点击后展开。',
      },
    );
  }

  private async isOrderDetailsPriceSummaryExpanded(): Promise<boolean> {
    const priceSummaryToggle = await this.resolveVisibleOrderDetailsPriceSummaryToggle();

    if (priceSummaryToggle) {
      const expanded = await priceSummaryToggle.getAttribute('aria-expanded').catch(() => null);

      if (expanded === 'true') {
        return true;
      }

      if (expanded === 'false') {
        return false;
      }
    }

    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await orderDetailsDialog.evaluate((dialogElement) => {
      const cleanText = (value: string | null | undefined): string => value?.replace(/\s+/g, ' ').trim() ?? '';
      const isVisibleElement = (element: Element | null): element is HTMLElement => {
        if (!element || !(element instanceof HTMLElement)) {
          return false;
        }

        const computedStyle = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          computedStyle.display !== 'none' &&
          computedStyle.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const priceSummaryText = cleanText(
        Array.from(
          dialogElement.querySelectorAll(
            [
              '[data-test-id="shared-order-price-summary-toggle"]',
              '[data-testid="shared-order-price-summary-toggle"]',
              '[class*="_container_1jzox_"]',
              '[class*="_container_"][class*="1jzox"]',
            ].join(', '),
          ),
        )
          .find((candidate) => {
            if (!(candidate instanceof HTMLElement)) {
              return false;
            }

            const computedStyle = window.getComputedStyle(candidate);
            const rect = candidate.getBoundingClientRect();

            return (
              computedStyle.display !== 'none' &&
              computedStyle.visibility !== 'hidden' &&
              rect.width > 0 &&
              rect.height > 0
            );
          })
          ?.textContent,
      );

      if (/Subtotal/i.test(priceSummaryText) || /Total Before Tips/i.test(priceSummaryText)) {
        return true;
      }

      return false;
    });
  }

  @step('页面读取：读取订单详情中的客户信息')
  async readOrderCustomerInfo(): Promise<RecallCustomerInfo | null> {
    return (await this.readOrderDetailsSnapshot()).customerInfo;
  }

  @step('页面读取：读取订单详情中的会员信息')
  async readOrderMemberInfo(): Promise<RecallMemberInfo | null> {
    return (await this.readOrderDetailsSnapshot()).memberInfo;
  }

  @step('页面读取：读取订单详情中的支付状态')
  async readOrderPaymentStatus(): Promise<string | null> {
    return (await this.readOrderDetailsSnapshot()).paymentStatus;
  }

  @step('页面读取：读取订单详情中的菜品明细')
  async readOrderItems(): Promise<RecallOrderItem[]> {
    return (await this.readOrderDetailsSnapshot()).items;
  }

  @step('页面读取：读取订单详情中的价格汇总')
  async readOrderPriceSummary(): Promise<Record<string, number>> {
    return (await this.readOrderDetailsSnapshot()).priceSummary;
  }

  @step('页面读取：读取订单详情中的订单类型、桌号、人数与服务员信息')
  async readOrderContext(): Promise<RecallOrderContext> {
    return (await this.readOrderDetailsSnapshot()).orderContext;
  }

  @step('页面读取：读取订单详情中的支付记录')
  async readOrderPayments(): Promise<RecallOrderPaymentRecord[]> {
    return (await this.readOrderDetailsSnapshot()).payments;
  }

  @step('页面读取：读取当前详情弹窗中的完整订单信息')
  async readOrderDetailsSnapshot(): Promise<RecallOrderDetails> {
    await this.waitForOrderDetailsDialogReady();

    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await waitUntil(
      async () =>
        await orderDetailsDialog.evaluate((dialogElement) => {
        const cleanText = (value: string | null | undefined): string => value?.replace(/\s+/g, ' ').trim() ?? '';
        const normalizeOptionalText = (value: string | null | undefined): string | null => {
          const normalized = cleanText(value);
          return normalized && normalized !== '-' ? normalized : null;
        };
        const parseNumericText = (value: string | null | undefined): number => {
          const normalized = cleanText(value);
          const parsedValue = Number(normalized.replace(/[$,]/g, ''));

          if (Number.isNaN(parsedValue)) {
            throw new Error(`Unable to parse numeric value from order details: ${normalized}`);
          }

          return parsedValue;
        };
      const selectText = (scope: Element, selector: string): string | null =>
        normalizeOptionalText(scope.querySelector(selector)?.textContent);
      const readTexts = (scope: Element, selector: string): string[] =>
        Array.from(scope.querySelectorAll(selector))
          .map((node) => cleanText(node.textContent))
          .filter(Boolean);
      const dedupeElements = <T extends Element>(elements: T[]): T[] => {
        const uniqueElements: T[] = [];

        for (const element of elements) {
          if (!uniqueElements.includes(element)) {
            uniqueElements.push(element);
          }
        }

        return uniqueElements;
      };
      const getSection = (title: string): Element | null => {
        const normalizedTitle = title.toUpperCase();
        const headings = Array.from(dialogElement.querySelectorAll('h1,h2,h3,h4,h5,h6'));
        const heading = headings.find((node) => cleanText(node.textContent).toUpperCase() === normalizedTitle);
        return heading?.closest('[class*="_section_"]') ?? heading?.parentElement?.parentElement ?? null;
      };
      const uniqueValues = (values: string[]): string[] => {
        const uniqueTexts: string[] = [];

        for (const value of values) {
          if (value && !uniqueTexts.includes(value)) {
            uniqueTexts.push(value);
          }
        }

        return uniqueTexts;
      };
      const isOrderTypeText = (text: string): boolean =>
        /^(dine in|delivery|pick up|pickup|take out|to go|togo|bar|drive thru|drive-thru|online delivery|online pickup)$/i.test(
          text,
        );
      const parseTableAndGuestCount = (
        text: string,
      ): {
        tableName: string;
        guestCount: string;
      } | null => {
        const matchedGroups = text.match(/^(.+?)\s*\((\d+)\)$/);

        if (!matchedGroups) {
          return null;
        }

        return {
          tableName: matchedGroups[1].trim(),
          guestCount: matchedGroups[2],
        };
      };
      const isGuestCountText = (text: string): boolean => /^\d+(?:\(\d+\))?$/.test(text);
      const isTableText = (text: string): boolean =>
        /\b(table|tbl|tab|booth|room|patio|bar seat)\b/i.test(text);
      const findSeatHeader = (dishElement: Element): Element | null => {
        let currentAncestor: Element | null = dishElement.parentElement;

        while (currentAncestor && currentAncestor !== dialogElement) {
          const seatHeader =
            currentAncestor.querySelector('[data-test-id^="shared-order-seat-dish-list-seat-header-"]') ??
            currentAncestor.querySelector('[data-testid^="shared-order-seat-dish-list-seat-header-"]') ??
            currentAncestor.querySelector('[class*="_seatHeader_"]');

          if (seatHeader) {
            return seatHeader;
          }

          currentAncestor = currentAncestor.parentElement;
        }

        return null;
      };
      const readDishName = (
        dishElement: Element,
        sentTime: string | null,
        quantity: string | null,
        price: string | null,
      ): string | null => {
        const explicitName =
          selectText(dishElement, '[data-testid="dish-item-name"]') ??
          selectText(dishElement, '[data-test-id="dish-item-name"]') ??
          selectText(dishElement, '[class*="_dishName_"]');

        if (explicitName) {
          return explicitName;
        }

        const directChildren = Array.from(dishElement.children);
        const mainRow =
          directChildren.find((childElement) => {
            const childText = cleanText(childElement.textContent);

            if (!childText || childText === sentTime) {
              return false;
            }

            return Boolean((price && childText.includes(price)) || (quantity && childText.includes(quantity)));
          }) ?? directChildren[0] ?? null;

        if (!mainRow) {
          return null;
        }

        const spanTexts = uniqueValues(
          Array.from(mainRow.querySelectorAll('span'))
            .map((node) => cleanText(node.textContent))
            .filter(Boolean),
        );

        return (
          spanTexts.find(
            (text) =>
              text !== sentTime &&
              text !== quantity &&
              text !== price &&
              !/^\$[\d,.]+$/.test(text) &&
              !/^\d+$/.test(text),
          ) ?? null
        );
      };

      const orderNumber =
        selectText(dialogElement, '[class*="_number_"]') ??
        normalizeOptionalText(dialogElement.textContent?.match(/#\d+/)?.[0]) ??
        '';
      const paymentStatus = selectText(dialogElement, '[class*="_statusTag_"]');

      const headerChipTexts = uniqueValues(
        Array.from(dialogElement.querySelectorAll('[class*="_header_1ej2d_"] button, [class*="_actionButtons_"] button'))
          .map((button) => cleanText(button.textContent))
          .filter(Boolean),
      );

      let orderType: string | null = null;
      let tableName: string | null = null;
      let guestCount: string | null = null;
      let serverName: string | null = null;

      for (const chipText of headerChipTexts) {
        const parsedTableAndGuestCount = parseTableAndGuestCount(chipText);

        if (parsedTableAndGuestCount) {
          tableName ??= parsedTableAndGuestCount.tableName;
          guestCount ??= parsedTableAndGuestCount.guestCount;
          continue;
        }

        if (!orderType && isOrderTypeText(chipText)) {
          orderType = chipText;
          continue;
        }

        if (!guestCount && isGuestCountText(chipText)) {
          guestCount = chipText;
          continue;
        }

        if (!tableName && isTableText(chipText)) {
          tableName = chipText;
          continue;
        }

        if (!serverName) {
          serverName = chipText;
        }
      }

      const customerSection = getSection('CUSTOMER INFO');
      const customerPrimaryTexts = customerSection
        ? Array.from(customerSection.querySelectorAll('[class*="_customerPrimaryText_"]'))
            .map((node) => cleanText(node.textContent))
            .filter(Boolean)
        : [];
      const customerAddress = customerSection
        ? selectText(customerSection, '[class*="_customerAddressText_"]')
        : null;
      const customerNote = customerSection ? selectText(customerSection, '[class*="_customerNoteText_"]') : null;
      const customerName = normalizeOptionalText(customerPrimaryTexts[0]);
      const customerPhone = normalizeOptionalText(customerPrimaryTexts[1]);
      const customerInfo =
        customerName || customerPhone || customerAddress || customerNote
          ? {
              name: customerName ?? '',
              phone: customerPhone ?? '',
              address: customerAddress,
              note: customerNote,
            }
          : null;

      const memberSection = getSection('MEMBER INFO');
      const memberEntries = memberSection
        ? Array.from(memberSection.querySelectorAll('[class*="_memberInfoText_"]'))
            .map((node) => cleanText(node.textContent))
            .filter(Boolean)
        : [];
      const memberInfo = memberEntries.length > 0 ? { entries: memberEntries } : null;

      const paymentSection = getSection('PAYMENT');
      const payments = paymentSection
        ? dedupeElements(
            Array.from(
              paymentSection.querySelectorAll('[class*="_methodLabel_"], [class*="_paymentText_"]'),
            ).map(
              (methodElement) =>
                methodElement.closest('[class*="_card_"]') ??
                methodElement.parentElement?.parentElement ??
                methodElement.parentElement,
            ).filter((cardElement): cardElement is Element => Boolean(cardElement)),
          ).reduce<RecallOrderPaymentRecord[]>((records, cardElement) => {
              const method =
                selectText(cardElement, '[class*="_methodLabel_"]') ??
                selectText(cardElement, '[class*="_paymentText_"]');
              const amount = selectText(cardElement, '[class*="_amount_"]');
              const details = Array.from(cardElement.querySelectorAll('[class*="_contentItem_"]')).reduce<Record<string, string>>(
                (detailMap, detailRow) => {
                  const label = normalizeOptionalText(
                    detailRow.querySelector('[class*="_detailLabel_"]')?.textContent?.replace(/:\s*$/, ''),
                  );
                  const value = selectText(detailRow, '[class*="_detailAmount_"]');

                  if (label && value) {
                    detailMap[label] = value;
                  }

                  return detailMap;
                },
                {},
              );

              if (method) {
                records.push({ method, amount, details });
              }

              return records;
            }, [])
        : [];

      const items = Array.from(
        dialogElement.querySelectorAll('[data-testid="pos-ui-dish-item"], [class*="_dishItem_"]'),
      ).reduce<RecallOrderItem[]>(
        (records, dishElement) => {
          const sentTime =
            selectText(dishElement, '[class*="_sentText_"]') ??
            readTexts(dishElement, 'span').find((text) => /^Sent in /i.test(text)) ??
            null;
          const quantity =
            selectText(dishElement, '[class*="_quantity_"]') ??
            readTexts(dishElement, 'span').find((text) => /^\d+$/.test(text)) ??
            null;
          const price =
            selectText(dishElement, '[class*="_dishPrice_"]') ??
            readTexts(dishElement, 'span').find((text) => /^\$[\d,.]+$/.test(text)) ??
            null;
          const seatHeader = findSeatHeader(dishElement);
          const seat =
            (seatHeader ? selectText(seatHeader, '[class*="_seatTitle_"]') : null) ??
            normalizeOptionalText(seatHeader?.textContent);
          const name = readDishName(dishElement, sentTime, quantity, price);

          if (!name) {
            return records;
          }

          const additions = dedupeElements(
            Array.from(
              dishElement.querySelectorAll(
                '[class*="_extraItem_"], [data-testid^="dish-item-subitem-"], [data-test-id^="dish-item-subitem-"]',
              ),
            ),
          ).reduce<
            RecallOrderItemAddition[]
          >((lines, extraElement) => {
            const rawAdditionText = normalizeOptionalText(extraElement.textContent);
            const additionPrice =
              selectText(extraElement, '[class*="_optionPrice_"]') ??
              rawAdditionText?.match(/\$[\d,.]+$/)?.[0] ??
              null;
            const additionName =
              selectText(extraElement, '[class*="_extraText_"]') ??
              (rawAdditionText && additionPrice
                ? normalizeOptionalText(rawAdditionText.replace(new RegExp(`\\s*${additionPrice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), ''))
                : rawAdditionText);

            if (additionName) {
              lines.push(additionPrice ? { name: additionName, price: additionPrice } : { name: additionName });
            }

            return lines;
          }, []);

          records.push({
            seat,
            sentTime,
            quantity,
            name,
            price,
            additions,
          });

          return records;
        },
        [],
      );

      const priceSummaryContainer =
        dialogElement.querySelector('[data-test-id="shared-order-price-summary-toggle"]') ??
        dialogElement.querySelector('[data-testid="shared-order-price-summary-toggle"]') ??
        dialogElement.querySelector('[class*="_container_1jzox_"]') ??
        dialogElement.querySelector('[class*="_container_"][class*="1jzox"]');
      const priceSummaryRowSelectors = [
        '[class*="_row_"]',
        '[class*="_totalRow_"]',
        '[data-testid="shared-order-price-summary-row"]',
        '[data-test-id="shared-order-price-summary-row"]',
      ].join(', ');
      const normalizePriceSummaryLabel = (value: string | null | undefined): string | null => {
        const normalized = cleanText(value).replace(/\s+/g, ' ');

        if (/^Count$/i.test(normalized)) {
          return 'Count';
        }

        if (/^Subtotal$/i.test(normalized)) {
          return 'Subtotal';
        }

        if (/^Tax$/i.test(normalized)) {
          return 'Tax';
        }

        if (/^Total Before Tips$/i.test(normalized)) {
          return 'Total Before Tips';
        }

        const totalMatch = normalized.match(/^Total\s*(?:\(\s*(Cash|Card)\s*\))?$/i);

        if (!totalMatch) {
          return null;
        }

        if (!totalMatch[1]) {
          return 'Total';
        }

        return `Total(${totalMatch[1]})`;
      };
      const priceSummaryRoots = dedupeElements(
        priceSummaryContainer
          ? [
              priceSummaryContainer,
              priceSummaryContainer.parentElement,
              priceSummaryContainer.nextElementSibling,
            ].filter((root): root is Element => Boolean(root))
          : [],
      );
      const priceSummaryRows = dedupeElements(
        priceSummaryRoots.flatMap((root) => {
          const matchedRows = Array.from(root.querySelectorAll(priceSummaryRowSelectors));
          return matchedRows.length > 0 ? matchedRows : Array.from(root.children);
        }),
      );
      const priceSummary = priceSummaryRows.reduce<Record<string, number>>((summary, rowElement) => {
        const spanTexts = Array.from(rowElement.querySelectorAll('span'))
          .map((node) => cleanText(node.textContent))
          .filter(Boolean);

        if (spanTexts.length < 2 || spanTexts.length > 3) {
          return summary;
        }

        const label =
          spanTexts[0] ??
          selectText(rowElement, '[class*="_label_1jzox_"]') ??
          selectText(rowElement, '[class*="_totalLabel_1jzox_"]');
        const value = spanTexts.length > 1 ? spanTexts[spanTexts.length - 1] : null;
        const normalizedLabel = normalizePriceSummaryLabel(label);

        if (normalizedLabel && value && normalizedLabel !== value) {
          summary[normalizedLabel] = parseNumericText(value);
        }

        return summary;
      }, {});

      return {
        orderNumber,
        paymentStatus,
        customerInfo,
        memberInfo,
        orderContext: {
          orderType,
          tableName,
          guestCount,
          serverName,
        },
        payments,
        items,
        priceSummary,
      };
    }),
      (snapshot) => snapshot.items.length === 0 || snapshot.priceSummary.Subtotal !== undefined,
      {
        timeout: 10_000,
        probeTimeout: 2_000,
        message: 'Order details dialog did not expose Subtotal in time.',
      },
    );
  }

  @step('页面操作：关闭当前订单详情弹窗')
  async closeOrderDetailsDialog(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!(await this.orderDetailsDialog.isVisible().catch(() => false))) {
        return;
      }

      await this.page.keyboard.press('Escape');
      await expect(this.orderDetailsDialog).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
    }
  }

  @step('页面操作：在 Recall 订单详情中点击 Edit')
  private async clickEditInOrderDetails(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await expect(this.orderDetailsEditButton).toBeVisible({ timeout: 10_000 });
    await this.orderDetailsEditButton.click();
  }

  @step((orderNumber: string) => `页面操作：点击 Recall 列表中的订单 ${orderNumber}`)
  private async clickVisibleOrderNumber(orderNumber: string): Promise<void> {
    const orderInContainer = this.orderListContainer.getByText(orderNumber, { exact: true }).first();

    if (await orderInContainer.isVisible().catch(() => false)) {
      await orderInContainer.click();
      return;
    }

    await this.page.getByText(orderNumber, { exact: true }).first().click();
  }

  @step('页面操作：点击 Recall 列表第一张可见订单卡片')
  private async clickFirstVisibleOrderCard(): Promise<void> {
    const firstOpenOrderCard = this.openOrderCards.first();

    await firstOpenOrderCard.dispatchEvent('click', undefined, { timeout: 10_000 });
  }

  @step((_filterButton: Locator, optionName: string) => `页面操作：从顶部筛选下拉菜单中选择 ${optionName}`)
  private async selectTopDropdownOption(filterButton: Locator, optionName: string): Promise<void> {
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

  private async waitForOrderDetailsDialogReady(): Promise<void> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    await expect(orderDetailsDialog).toBeVisible({ timeout: 10_000 });
    await waitUntil(
      async () => (await orderDetailsDialog.textContent())?.trim() ?? '',
      (dialogText) => !/^loading\.\.\.$/i.test(dialogText) && !/^loading$/i.test(dialogText),
      {
        timeout: 10_000,
        message: 'Order details dialog did not finish loading in time.',
      },
    );
  }

  private async selectSplitTargetOrderIfNeeded(
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    const splitOrderNumberText = targetOrderNumber
      ? this.normalizeOrderNumber(targetOrderNumber)
      : null;
    const splitOrderTargetLabel = splitOrderNumberText
      ? this.orderDetailsDialog.getByText(splitOrderNumberText, { exact: true }).first()
      : this.orderDetailsDialog
          .getByText(new RegExp(`^${this.escapeRegExp(orderNumber)}-\\d+$`))
          .first();

    if (!(await splitOrderTargetLabel.isVisible().catch(() => false))) {
      return;
    }

    const visibleDialogCount = await this.readVisibleOrderDialogCount();
    await splitOrderTargetLabel.evaluate((targetLabelElement) => {
      const clickableElement =
        targetLabelElement.closest<HTMLElement>('button, [role="button"]') ??
        (targetLabelElement as HTMLElement);
      clickableElement.click();
    });
    await this.waitForVisibleOrderDialogCount(visibleDialogCount + 1);
    await this.waitForOrderDetailsDialogReady();
  }

  private async readVisibleOrderDialogCount(): Promise<number> {
    return await this.visibleOrderDetailsDialogs.count();
  }

  private async resolveActiveOrderDetailsDialog(): Promise<Locator> {
    const visibleDialogCount = await this.readVisibleOrderDialogCount();

    if (visibleDialogCount === 0) {
      return this.orderDetailsDialog;
    }

    let resolvedDialog = this.orderDetailsDialog;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < visibleDialogCount; index += 1) {
      const candidate = this.visibleOrderDetailsDialogs.nth(index);
      const text = (await candidate.textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
      const score = (/#\d+/.test(text) ? 1_000 : 0) + text.length;

      if (score > bestScore) {
        bestScore = score;
        resolvedDialog = candidate;
      }
    }

    return resolvedDialog;
  }

  private async resolveVisibleOrderDetailsPriceSummaryToggle(): Promise<Locator | null> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const priceSummaryToggle = orderDetailsDialog
      .locator(
        [
          '[data-test-id="shared-order-price-summary-toggle"]',
          '[data-testid="shared-order-price-summary-toggle"]',
        ].join(', '),
      )
      .first();

    if (await priceSummaryToggle.isVisible().catch(() => false)) {
      return priceSummaryToggle;
    }

    return null;
  }

  private async waitForVisibleOrderDialogCount(expectedCount: number): Promise<void> {
    await waitUntil(
      async () => await this.readVisibleOrderDialogCount(),
      (visibleDialogCount) => visibleDialogCount === expectedCount,
      {
        timeout: 5_000,
        message: `Visible Recall order dialog count did not become ${expectedCount} in time.`,
      },
    );
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

  private normalizeOrderNumber(orderNumber: string): string {
    const normalizedOrderNumber = orderNumber.trim().replace(/^#/, '');
    return `#${normalizedOrderNumber}`;
  }

  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private resolveManualSearchTagTestId(tag: RecallManualSearchTag): string {
    switch (tag) {
      case 'Order No.':
        return 'recall2-search-type-option-orderNo';
      case 'Linked Order No.':
        return 'recall2-search-type-option-linkedNo';
      case 'Phone No.':
        return 'recall2-search-type-option-phoneNo';
      case 'Last 4 Digits':
        return 'recall2-search-type-option-last4Digts';
      case 'Payment Amount':
        return 'recall2-search-type-option-total';
      case 'Card Holder':
        return 'recall2-search-type-option-cardHolder';
      case 'Item Name':
        return 'recall2-search-type-option-itemName';
      case 'Table Name':
        return 'recall2-search-type-option-tableName';
      default:
        throw new Error(`Unsupported Recall manual search tag: ${tag}`);
    }
  }
}

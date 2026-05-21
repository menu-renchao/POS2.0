import { expect, type Locator, type Page } from '@playwright/test';
import {
  findFirstVisibleLocator,
  resolveFirstVisibleLocator,
} from '../shared/locator-scope';
import { step } from '../../utils/step';
import { waitForInputSettled } from '../../utils/input-stability';
import { waitUntil } from '../../utils/wait';
import { OrderDishesPage } from '../order-dishes.page';
import { PaymentPage } from '../payment.page';
import type { RecallFilterBarSection } from './recall-filter-bar.section';
import {
  escapeRegExp,
  normalizeOrderNumber,
  recallScopedTestId,
} from './recall-reads.section';
import type {
  RecallCustomerInfo,
  RecallMemberInfo,
  RecallOrderContext,
  RecallOrderDetails,
  RecallOrderItem,
  RecallOrderItemAddition,
  RecallOrderPaymentRecord,
} from './recall.types';

export class RecallOrderDetailsDialog {
  private readonly openOrderCards: Locator;
  private readonly visibleOrderDetailsDialogs: Locator;
  readonly orderDetailsDialog: Locator;
  private readonly orderDetailsEditButton: Locator;
  readonly orderDetailsMoreButton: Locator;
  private readonly legacyOrderDetailsMoreButton: Locator;
  private readonly namedOrderDetailsMoreButton: Locator;
  private readonly orderDetailsTipsButton: Locator;
  private readonly globalLoadingOverlay: Locator;

  constructor(
    readonly page: Page,
    private readonly filterBar: RecallFilterBarSection,
  ) {
    this.openOrderCards = this.page.locator(
      '[data-test-id^="shared-order-card-open-"], [data-testid^="shared-order-card-open-"]',
    );
    this.visibleOrderDetailsDialogs = this.page.locator(
      '[role="dialog"][data-testid="pos-ui-modal"]:visible',
    );
    this.orderDetailsDialog = this.page
      .locator('[role="dialog"][data-testid="pos-ui-modal"]:visible')
      .last();
    this.orderDetailsEditButton = recallScopedTestId(
      this.orderDetailsDialog,
      'shared-order-detail-side-action-editod',
    );
    this.orderDetailsMoreButton = recallScopedTestId(
      this.orderDetailsDialog,
      'recall2-order-detail-more',
    );
    this.legacyOrderDetailsMoreButton = this.page.locator('#odsmymoreicon');
    this.namedOrderDetailsMoreButton = this.page.getByRole('button', { name: /^MoreIcon More$/i });
    this.orderDetailsTipsButton = recallScopedTestId(this.page, 'recall2-order-detail-tips');
    this.globalLoadingOverlay = this.page.locator('#floatmsgbx');
  }

  @step((orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `页面操作：打开订单 ${orderNumber} 的详情弹窗并进入子单 ${targetOrderNumber}`
      : `页面操作：打开订单 ${orderNumber} 的详情弹窗`,
  )
  async openOrderDetails(orderNumber: string, targetOrderNumber?: string): Promise<void> {
    const normalizedOrderNumber = normalizeOrderNumber(orderNumber);

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

  @step('页面操作：打开 Recall 最近一笔订单详情')
  async openRecentOrderDetails(): Promise<void> {
    await this.filterBar.clearAllSearchConditions();
    const latestOrderNumber = await this.filterBar.readLatestVisibleOrderNumber();
    await this.openOrderDetails(latestOrderNumber);
  }

  @step('页面操作：打开 Recall 最近一笔订单并进入编辑点单页')
  async openRecentOrderForEditing(): Promise<OrderDishesPage> {
    await this.openRecentOrderDetails();
    await this.clickEditInOrderDetails();

    const orderDishesPage = new OrderDishesPage(this.page);
    await orderDishesPage.expectLoaded();

    return orderDishesPage;
  }

  @step('页面操作：从 Recall 订单详情点击 Pay 并进入支付页面')
  async openPayment(): Promise<PaymentPage> {
    await this.waitForOrderDetailsDialogReady();
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const payButton = orderDetailsDialog.getByRole('button', { name: /^Pay$/i });
    await expect(payButton).toBeVisible({ timeout: 10_000 });
    await payButton.click();

    const paymentPage = new PaymentPage(this.page);
    await paymentPage.expectLoaded();

    return paymentPage;
  }

  @step('页面操作：点击 Recall 订单详情中的 More 按钮')
  async clickOrderDetailsMoreButton(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();

    const moreButtonCandidates = [
      this.orderDetailsMoreButton,
      this.legacyOrderDetailsMoreButton,
      this.namedOrderDetailsMoreButton,
    ];

    for (const moreButtonCandidate of moreButtonCandidates) {
      if (!(await moreButtonCandidate.isVisible().catch(() => false))) {
        continue;
      }

      await moreButtonCandidate.click();
      return;
    }

    throw new Error('Recall 订单详情未找到 More 按钮。');
  }

  @step('页面操作：展开 Recall 订单详情价格汇总')
  async expandOrderDetailsPriceSummary(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();

    if (!(await this.orderDetailsDialogHasReadableItems())) {
      return;
    }

    if (await this.isOrderDetailsPriceSummaryExpanded()) {
      return;
    }

    await waitUntil(
      async () => {
        await this.waitForGlobalLoadingOverlayHidden();

        if (await this.isOrderDetailsPriceSummaryExpanded()) {
          return true;
        }

        await this.clickOrderDetailsPriceSummaryHeaderRow();

        return await this.isOrderDetailsPriceSummaryExpanded();
      },
      (expanded) => expanded,
      {
        timeout: 10_000,
        probeTimeout: 3_000,
        message: 'Recall 订单详情价格汇总未在点击后展开。',
      },
    );
  }

  private async isOrderDetailsPriceSummaryExpanded(): Promise<boolean> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const subtotalLabel = orderDetailsDialog.getByText('Subtotal', { exact: true }).first();

    if (await subtotalLabel.isVisible().catch(() => false)) {
      return true;
    }

    const priceSummaryToggle = await this.resolveVisibleOrderDetailsPriceSummaryToggle();

    if (!priceSummaryToggle) {
      return false;
    }

    const ariaExpanded = await priceSummaryToggle.getAttribute('aria-expanded').catch(() => null);

    if (ariaExpanded === 'true') {
      return true;
    }

    if (ariaExpanded === 'false') {
      return false;
    }

    const toggleText = (await priceSummaryToggle.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

    return /\bSubtotal\b/i.test(toggleText);
  }

  @step('页面操作：点击 Recall 订单详情价格汇总折叠头')
  private async clickOrderDetailsPriceSummaryHeaderRow(): Promise<void> {
    const priceSummaryToggle = await this.resolveVisibleOrderDetailsPriceSummaryToggle();

    if (priceSummaryToggle) {
      await priceSummaryToggle.click();
      return;
    }

    const headerRow = await this.resolveVisibleOrderDetailsPriceSummaryHeaderRow();

    if (!headerRow) {
      throw new Error('Recall 订单详情未找到价格汇总折叠区域。');
    }

    await headerRow.click();
  }

  private async orderDetailsDialogHasReadableItems(): Promise<boolean> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await orderDetailsDialog.evaluate((dialogElement) => {
      const cleanText = (value: string | null | undefined): string =>
        value?.replace(/\s+/g, ' ').trim() ?? '';
      const dishItemPattern = /^\d+(?:\.\d+)?\s+.+\s+\$[\d,.]+$/;

      if (
        dialogElement.querySelector('[data-testid="pos-ui-dish-item"], [class*="_dishItem_"]') !==
        null
      ) {
        return true;
      }

      return Array.from(dialogElement.querySelectorAll('button')).some((buttonElement) =>
        dishItemPattern.test(cleanText(buttonElement.textContent)),
      );
    });
  }

  private async resolveOrderDetailsPriceSummaryRoot(): Promise<Locator | null> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const expandedPriceSummaryButton = orderDetailsDialog
      .locator('[role="button"][aria-expanded="true"]')
      .filter({ has: orderDetailsDialog.getByText('Subtotal', { exact: true }) })
      .last();

    if (await expandedPriceSummaryButton.isVisible().catch(() => false)) {
      return expandedPriceSummaryButton;
    }

    const priceSummaryButtonWithSubtotal = orderDetailsDialog
      .getByRole('button', { name: /\bSubtotal\b/i })
      .last();

    if (await priceSummaryButtonWithSubtotal.isVisible().catch(() => false)) {
      return priceSummaryButtonWithSubtotal;
    }

    return await this.resolveVisibleOrderDetailsPriceSummaryToggle();
  }

  private async readOrderDetailsPriceSummaryFromLabels(): Promise<Record<string, number>> {
    const priceSummaryRoot = await this.resolveOrderDetailsPriceSummaryRoot();

    if (!priceSummaryRoot) {
      return {};
    }

    const summaryLabels = ['Count', 'Subtotal', 'Tax', 'Total Before Tips', 'Tips', 'Total'] as const;
    const summary: Record<string, number> = {};

    for (const label of summaryLabels) {
      const labelLocator = priceSummaryRoot.getByText(label, { exact: true }).first();

      if (!(await labelLocator.isVisible().catch(() => false))) {
        continue;
      }

      const valueText = await labelLocator.evaluate((labelElement) => {
        const cleanText = (value: string | null | undefined): string =>
          value?.replace(/\s+/g, ' ').trim() ?? '';
        const readMoneyValue = (text: string): string | null => {
          const moneyMatches = cleanText(text).match(/\$[\d,.]+/g);
          return moneyMatches?.at(-1) ?? null;
        };

        let currentElement: Element | null = labelElement.nextElementSibling;

        while (currentElement) {
          const currentText = cleanText(currentElement.textContent);
          const moneyValue = readMoneyValue(currentText);

          if (moneyValue) {
            return moneyValue;
          }

          currentElement = currentElement.nextElementSibling;
        }

        const rowElement = labelElement.parentElement;

        if (!rowElement) {
          return '';
        }

        const spanTexts = Array.from(rowElement.querySelectorAll('span'))
          .map((node) => cleanText(node.textContent))
          .filter(Boolean);
        const moneyValues = spanTexts
          .map((text) => readMoneyValue(text))
          .filter((value): value is string => Boolean(value));

        return moneyValues.at(-1) ?? '';
      });
      const normalizedValue = valueText.replace(/\s+/g, ' ').trim();
      const parsedValue = Number(normalizedValue.replace(/[$,]/g, ''));

      if (!normalizedValue || Number.isNaN(parsedValue)) {
        continue;
      }

      summary[label] = parsedValue;
    }

    const cashTotalLabel = priceSummaryRoot.getByText(/^Total\s*\(\s*Cash\s*\)$/i).first();

    if (await cashTotalLabel.isVisible().catch(() => false)) {
      const cashValueText = await cashTotalLabel.evaluate((labelElement) => {
        const moneyMatches =
          labelElement.parentElement?.textContent?.match(/\$[\d,.]+/g) ??
          labelElement.textContent?.match(/\$[\d,.]+/g);

        return moneyMatches?.at(-1) ?? '';
      });
      const parsedCashTotal = Number(cashValueText.replace(/[$,]/g, ''));

      if (!Number.isNaN(parsedCashTotal)) {
        summary['Total(Cash)'] = parsedCashTotal;
      }
    }

    const cardTotalLabel = priceSummaryRoot.getByText(/^Total\s*\(\s*Card\s*\)$/i).first();

    if (await cardTotalLabel.isVisible().catch(() => false)) {
      const cardValueText = await cardTotalLabel.evaluate((labelElement) => {
        const moneyMatches =
          labelElement.parentElement?.textContent?.match(/\$[\d,.]+/g) ??
          labelElement.textContent?.match(/\$[\d,.]+/g);

        return moneyMatches?.at(-1) ?? '';
      });
      const parsedCardTotal = Number(cardValueText.replace(/[$,]/g, ''));

      if (!Number.isNaN(parsedCardTotal)) {
        summary['Total(Card)'] = parsedCardTotal;
      }
    }

    return summary;
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

  @step('页面读取：仅读取订单详情价格汇总区域中当前展示的金额标签')
  async readDisplayedOrderPriceSummary(): Promise<Record<string, number>> {
    await this.waitForOrderDetailsDialogReady();
    await this.expandOrderDetailsPriceSummary();
    return await this.readOrderDetailsPriceSummaryFromLabels();
  }

  @step('页面读取：读取订单详情中的订单类型、桌号、人数与服务员信息')
  async readOrderContext(): Promise<RecallOrderContext> {
    return (await this.readOrderDetailsSnapshot()).orderContext;
  }

  @step('页面读取：读取订单详情中的支付记录')
  async readOrderPayments(): Promise<RecallOrderPaymentRecord[]> {
    return (await this.readOrderDetailsSnapshot()).payments;
  }

  @step((amountInCents: number) => `页面操作：在 Recall 订单详情中添加 Tips ${amountInCents} 分`)
  async addOrderDetailsTip(amountInCents: number): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickOrderDetailsMoreButton();
    await (await this.resolveOrderDetailsTipsButton()).click();
    await this.fillTipDialogAmount(amountInCents, false);
    await this.confirmTipDialog(false);

    if (await this.isBigTipConfirmDialogVisible()) {
      const message = await this.confirmBigTipDialog();
      await this.waitForGlobalLoadingOverlayAfterTipMutation();
      return message;
    }

    await this.waitForGlobalLoadingOverlayAfterTipMutation();
    return null;
  }

  @step((amountInCents: number, paymentMethod?: string) =>
    paymentMethod
      ? `页面操作：在 Recall 订单详情的 PAYMENT 卡片 ${paymentMethod} 中添加 Tips ${amountInCents} 分`
      : `页面操作：在 Recall 订单详情的 PAYMENT 卡片中添加 Tips ${amountInCents} 分`,
  )
  async addPaymentCardTip(amountInCents: number, paymentMethod?: string): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    await this.clickPaymentCardTipsButton(paymentMethod);
    await this.fillTipDialogAmount(amountInCents, true);
    await this.confirmTipDialog(true);

    if (await this.isBigTipConfirmDialogVisible()) {
      const message = await this.confirmBigTipDialog();
      await this.waitForGlobalLoadingOverlayAfterTipMutation();
      return message;
    }

    await this.waitForGlobalLoadingOverlayAfterTipMutation();
    return null;
  }

  @step('页面读取：读取当前详情弹窗中的完整订单信息')
  async readOrderDetailsSnapshot(): Promise<RecallOrderDetails> {
    await this.waitForOrderDetailsDialogReady();
    await this.expandOrderDetailsPriceSummary();

    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await waitUntil(
      async () => {
        const snapshot = await orderDetailsDialog.evaluate((dialogElement) => {
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

      const parsedItems = Array.from(
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

          const additionSelectors = [
            '[class*="_extraItem_"]',
            '[data-testid^="dish-item-subitem-"]',
            '[data-test-id^="dish-item-subitem-"]',
            '[class*="_optionItemContainer_"]',
          ].join(', ');
          const additionElements = dedupeElements(Array.from(dishElement.querySelectorAll(additionSelectors)));
          const additionElementSet = new Set(additionElements);
          const childMap = new Map<Element, Element[]>();
          const topLevelAdditionElements: Element[] = [];

          const parseAdditionElement = (
            additionElement: Element,
          ): RecallOrderItemAddition | null => {
            const rawAdditionText = normalizeOptionalText(additionElement.textContent);
            const additionPrice =
              selectText(additionElement, '[class*="_optionPrice_"]') ??
              rawAdditionText?.match(/\$[\d,.]+$/)?.[0] ??
              null;
            const additionName =
              selectText(additionElement, '[class*="_extraText_"]') ??
              selectText(additionElement, '[class*="_optionName_"]') ??
              (rawAdditionText && additionPrice
                ? normalizeOptionalText(
                    rawAdditionText.replace(
                      new RegExp(`\\s*${additionPrice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
                      '',
                    ),
                  )
                : rawAdditionText);

            if (!additionName) {
              return null;
            }

            const subAdditions = (childMap.get(additionElement) ?? [])
              .map((childElement) => parseAdditionElement(childElement))
              .filter((addition): addition is RecallOrderItemAddition => addition !== null);

            return {
              ...(additionPrice ? { price: additionPrice } : {}),
              ...(subAdditions.length > 0 ? { subAdditions } : {}),
              name: additionName,
            };
          };

          for (const additionElement of additionElements) {
            let parentAdditionElement: Element | null = null;
            let currentParent = additionElement.parentElement;

            while (currentParent && currentParent !== dishElement) {
              if (additionElementSet.has(currentParent)) {
                parentAdditionElement = currentParent;
                break;
              }

              currentParent = currentParent.parentElement;
            }

            if (parentAdditionElement) {
              const children = childMap.get(parentAdditionElement) ?? [];
              children.push(additionElement);
              childMap.set(parentAdditionElement, children);
              continue;
            }

            topLevelAdditionElements.push(additionElement);
          }

          const additions = topLevelAdditionElements
            .map((additionElement) => parseAdditionElement(additionElement))
            .filter((addition): addition is RecallOrderItemAddition => addition !== null);

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
      const items =
        parsedItems.length > 0
          ? parsedItems
          : uniqueValues(
              Array.from(dialogElement.querySelectorAll('button'))
                .map((buttonElement) => cleanText(buttonElement.textContent))
                .filter(Boolean),
            ).reduce<RecallOrderItem[]>((records, buttonText) => {
              const matchedItem = buttonText.match(
                /^(\d+(?:\.\d+)?)\s+(.+?)\s+(\$[\d,.]+)$/,
              );

              if (!matchedItem) {
                return records;
              }

              const [, quantity, name, price] = matchedItem;

              records.push({
                seat: null,
                sentTime: null,
                quantity,
                name,
                price,
                additions: [],
              });

              return records;
            }, []);

      const priceSummaryContainer =
        dialogElement.querySelector('[data-test-id="shared-order-price-summary-toggle"]') ??
        dialogElement.querySelector('[data-testid="shared-order-price-summary-toggle"]') ??
        dialogElement.querySelector('[class*="_container_"][class*="1w05p"]') ??
        dialogElement.querySelector('[class*="_container_1jzox_"]') ??
        dialogElement.querySelector('[class*="_container_"][class*="1jzox"]') ??
        Array.from(dialogElement.querySelectorAll('[class*="_headerRow_"]'))
          .map((headerRow) => headerRow.closest('[class*="_container_"]'))
          .find((container): container is Element => container instanceof Element) ??
        dialogElement.querySelector('button');
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

        if (/^Tips$/i.test(normalized)) {
          return 'Tips';
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
    });
        const labelPriceSummary = await this.readOrderDetailsPriceSummaryFromLabels();

        return {
          ...snapshot,
          priceSummary: {
            ...snapshot.priceSummary,
            ...labelPriceSummary,
          },
        };
      },
      (snapshot) => {
        const hasSubtotal = snapshot.priceSummary.Subtotal !== undefined;
        const hasItems = snapshot.items.length > 0;
        const hasCollapsedTotalOnly =
          snapshot.priceSummary.Total !== undefined && !hasSubtotal;

        if (hasItems && hasSubtotal) {
          return true;
        }

        if (hasItems) {
          return false;
        }

        // 无菜品时仅允许已确认的空订单（Total 为 0）通过，避免折叠态 Total 在菜品加载前误判就绪。
        return snapshot.priceSummary.Total === 0;
      },
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

  @step('页面操作：如 Recall 订单详情仍停留在页面上，则关闭详情并返回 Recall 列表')
  async dismissOrderDetailsDialogIfNeeded(): Promise<void> {
    if (!(await this.orderDetailsDialog.isVisible().catch(() => false))) {
      return;
    }

    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const backdropPoints = await orderDetailsDialog.evaluate((dialogElement) => {
      const dialogRect = dialogElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const dialogArea = dialogRect.width * dialogRect.height;
      const descendantRects = Array.from(dialogElement.querySelectorAll<HTMLElement>('*'))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            area: rect.width * rect.height,
          };
        })
        .filter(
          (rect) =>
            rect.width >= 120 &&
            rect.height >= 120 &&
            rect.area < dialogArea * 0.95 &&
            rect.left >= dialogRect.left &&
            rect.top >= dialogRect.top &&
            rect.right <= dialogRect.right &&
            rect.bottom <= dialogRect.bottom,
        )
        .sort((left, right) => right.area - left.area);

      const contentRect = descendantRects[0] ?? {
        left: dialogRect.left,
        top: dialogRect.top,
        right: dialogRect.right,
        bottom: dialogRect.bottom,
      };
      const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
      const points: Array<{ x: number; y: number }> = [];
      const pushPoint = (x: number, y: number) => {
        points.push({
          x: clamp(Math.round(x), 8, viewportWidth - 8),
          y: clamp(Math.round(y), 8, viewportHeight - 8),
        });
      };

      if (contentRect.left - dialogRect.left >= 16) {
        pushPoint(contentRect.left - 8, contentRect.top + 24);
        pushPoint(contentRect.left - 8, contentRect.bottom - 24);
      }

      if (contentRect.top - dialogRect.top >= 16) {
        pushPoint(contentRect.left + 24, contentRect.top - 8);
        pushPoint(contentRect.right - 24, contentRect.top - 8);
      }

      if (dialogRect.right - contentRect.right >= 16) {
        pushPoint(contentRect.right + 8, contentRect.top + 24);
        pushPoint(contentRect.right + 8, contentRect.bottom - 24);
      }

      if (dialogRect.bottom - contentRect.bottom >= 16) {
        pushPoint(contentRect.left + 24, contentRect.bottom + 8);
        pushPoint(contentRect.right - 24, contentRect.bottom + 8);
      }

      pushPoint(12, 12);
      pushPoint(viewportWidth - 12, 12);
      pushPoint(12, viewportHeight - 12);
      pushPoint(viewportWidth - 12, viewportHeight - 12);

      return points;
    });

    for (const backdropPoint of backdropPoints) {
      await this.page.mouse.click(backdropPoint.x, backdropPoint.y);

      if (!(await this.orderDetailsDialog.isVisible().catch(() => false))) {
        return;
      }
    }

    await this.page.keyboard.press('Escape').catch(() => undefined);
    await expect(this.orderDetailsDialog).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
  }

  @step('页面操作：在 Recall 订单详情中点击 Edit')
  private async clickEditInOrderDetails(): Promise<void> {
    await this.waitForOrderDetailsDialogReady();
    await expect(this.orderDetailsEditButton).toBeVisible({ timeout: 10_000 });
    await this.orderDetailsEditButton.click();
  }

  @step((orderNumber: string) => `页面操作：点击 Recall 列表中的订单 ${orderNumber}`)
  private async clickVisibleOrderNumber(orderNumber: string): Promise<void> {
    const orderInContainer = this.filterBar.orderListContainer
      .getByText(orderNumber, { exact: true })
      .first();

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
  async waitForOrderDetailsDialogReady(): Promise<void> {
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
    await this.waitForGlobalLoadingOverlayHidden();
  }

  @step('页面操作：等待 Recall 全局 Loading 遮罩消失')
  private async waitForGlobalLoadingOverlayHidden(): Promise<void> {
    if (!(await this.globalLoadingOverlay.isVisible().catch(() => false))) {
      return;
    }

    await waitUntil(
      async () => !(await this.globalLoadingOverlay.isVisible().catch(() => false)),
      (hidden) => hidden,
      {
        timeout: 15_000,
        message: 'Recall 全局 Loading 遮罩未在预期时间内消失。',
      },
    );
  }

  @step('页面操作：等待 Recall 加小费后的全局 Loading 遮罩出现并结束')
  private async waitForGlobalLoadingOverlayAfterTipMutation(): Promise<void> {
    await waitUntil(
      async () => await this.globalLoadingOverlay.isVisible().catch(() => false),
      (isVisible) => isVisible,
      {
        timeout: 3_000,
        interval: 50,
        message: 'Recall 加小费后未出现全局 Loading 遮罩。',
      },
    ).catch(() => undefined);

    await this.waitForGlobalLoadingOverlayHidden();
  }

  private async selectSplitTargetOrderIfNeeded(
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<void> {
    const splitOrderNumberText = targetOrderNumber
      ? normalizeOrderNumber(targetOrderNumber)
      : null;
    const splitOrderTargetLabel = splitOrderNumberText
      ? this.orderDetailsDialog.getByText(splitOrderNumberText, { exact: true }).first()
      : this.orderDetailsDialog
          .getByText(new RegExp(`^${escapeRegExp(orderNumber)}-\\d+$`))
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

  private orderDetailsCollapsedPriceSummaryButton(orderDetailsDialog: Locator): Locator {
    return orderDetailsDialog.getByRole('button', { name: /^Total\s+\$/i }).last();
  }

  private async resolveVisibleOrderDetailsPriceSummaryToggle(): Promise<Locator | null> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const testIdToggles = orderDetailsDialog.locator(
      '[data-test-id="shared-order-price-summary-toggle"], [data-testid="shared-order-price-summary-toggle"]',
    );
    const toggleCandidates: Locator[] = [];
    const testIdToggleCount = await testIdToggles.count().catch(() => 0);

    for (let index = 0; index < testIdToggleCount; index += 1) {
      toggleCandidates.push(testIdToggles.nth(index));
    }

    toggleCandidates.push(this.orderDetailsCollapsedPriceSummaryButton(orderDetailsDialog));

    return findFirstVisibleLocator(toggleCandidates);
  }

  private async resolveVisibleOrderDetailsPriceSummaryHeaderRow(): Promise<Locator | null> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const headerRowCandidates = orderDetailsDialog.locator('[class*="_headerRow_"]');
    const headerRowCount = await headerRowCandidates.count().catch(() => 0);

    for (let index = headerRowCount - 1; index >= 0; index -= 1) {
      const headerRow = headerRowCandidates.nth(index);

      if (await headerRow.isVisible().catch(() => false)) {
        return headerRow;
      }
    }

    const priceSummaryToggle = await this.resolveVisibleOrderDetailsPriceSummaryToggle();

    if (!priceSummaryToggle) {
      return null;
    }

    const headerRowInSummary = priceSummaryToggle.locator('[class*="_headerRow_"]').first();

    if (await headerRowInSummary.isVisible().catch(() => false)) {
      return headerRowInSummary;
    }

    return null;
  }

  private async resolveOrderDetailsTipsButton(): Promise<Locator> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const candidates = [
      recallScopedTestId(orderDetailsDialog, 'recall2-order-detail-tips'),
      this.orderDetailsTipsButton,
      orderDetailsDialog.getByRole('button', { name: /^(Tips|小费)$/ }).first(),
      this.page.getByRole('button', { name: /^(Tips|小费)$/ }).first(),
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    throw new Error('Recall 订单详情 More 菜单未出现 Tips 入口。');
  }

  private resolvePaymentSection(orderDetailsDialog: Locator): Locator {
    return orderDetailsDialog
      .locator('[class*="_section_"]')
      .filter({
        has: orderDetailsDialog.getByRole('heading', { name: /^PAYMENT$/i }),
      })
      .first();
  }

  private async resolvePaymentCardScope(
    paymentSection: Locator,
    paymentMethod?: string,
  ): Promise<Locator> {
    if (paymentMethod) {
      const paymentCardByAttribute = paymentSection
        .locator(`[data-payment-method="${paymentMethod}"]`)
        .first();

      if (await paymentCardByAttribute.isVisible().catch(() => false)) {
        return paymentCardByAttribute;
      }

      const paymentCardByText = paymentSection
        .locator('[data-payment-method], [class*="_card_"], [class*="_paymentInfo_"]')
        .filter({ hasText: paymentMethod })
        .first();

      if (await paymentCardByText.isVisible().catch(() => false)) {
        return paymentCardByText;
      }
    }

    const fallbackCard = paymentSection
      .locator('[data-payment-method], [class*="_card_"], [class*="_paymentInfo_"]')
      .last();

    return fallbackCard;
  }

  private buildPaymentCardTipsButtonCandidates(paymentCardScope: Locator): Locator[] {
    return [
      recallScopedTestId(paymentCardScope, 'payment-card-tips-button'),
      paymentCardScope.getByTestId('payment-card-tips-button'),
      paymentCardScope
        .locator('[class*="_contentItem_"]')
        .filter({ hasText: /^Tips\b/i })
        .getByRole('button', { name: /^(Tips|小费)$/ }),
      paymentCardScope.getByRole('button', { name: /^(Tips|小费)$/ }),
    ];
  }

  private async clickPaymentCardTipsButton(paymentMethod?: string): Promise<void> {
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();
    const paymentSection = this.resolvePaymentSection(orderDetailsDialog);

    await paymentSection.scrollIntoViewIfNeeded().catch(() => undefined);

    const paymentCardScope = await this.resolvePaymentCardScope(paymentSection, paymentMethod);
    const tipsButton = await resolveFirstVisibleLocator(
      this.buildPaymentCardTipsButtonCandidates(paymentCardScope),
      paymentMethod
        ? `Recall PAYMENT 卡片 ${paymentMethod} 的 Tips 按钮未在预期时间内出现。`
        : 'Recall PAYMENT 卡片的 Tips 按钮未在预期时间内出现。',
      15_000,
    );

    await tipsButton.scrollIntoViewIfNeeded();
    await tipsButton.click();
  }

  private async resolveTipDialog(isPaymentCardDialog: boolean): Promise<Locator> {
    const candidates = isPaymentCardDialog
      ? [
          this.page.getByTestId('payment-tip-dialog').first(),
          this.page.getByRole('dialog', { name: /^Credit Card Tips$/i }).first(),
          this.page.getByRole('dialog', { name: /Tips/i }).first(),
          this.page.getByRole('dialog', { name: /Payment Tips/i }).first(),
        ]
      : [
          this.page.getByTestId('tip-input-dialog').first(),
          this.page.getByRole('dialog', { name: /^Tips$/i }).first(),
        ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    const dialog = await waitUntil(
      async () => {
        for (const candidate of candidates) {
          if (await candidate.isVisible().catch(() => false)) {
            return candidate;
          }
        }

        return null;
      },
      (dialog): dialog is Locator => dialog !== null,
      {
        timeout: 5_000,
        message: isPaymentCardDialog
          ? 'Recall PAYMENT Tips dialog did not appear in time.'
          : 'Recall order-detail Tips dialog did not appear in time.',
      },
    );

    if (!dialog) {
      throw new Error(
        isPaymentCardDialog
          ? 'Recall PAYMENT Tips dialog did not appear in time.'
          : 'Recall order-detail Tips dialog did not appear in time.',
      );
    }

    return dialog;
  }

  private async fillTipDialogAmount(amountInCents: number, isPaymentCardDialog: boolean): Promise<void> {
    const tipDialog = await this.resolveTipDialog(isPaymentCardDialog);
    const input = await this.resolveTipDialogInput(tipDialog, isPaymentCardDialog);
    const valueText = isPaymentCardDialog
      ? this.formatPaymentCardTipInputValue(amountInCents)
      : this.formatTipInputDigits(amountInCents);

    await input.fill(valueText).catch(async () => {
      await input.evaluate((inputElement, nextValue) => {
        const htmlInput = inputElement as HTMLInputElement;
        htmlInput.value = String(nextValue);
        htmlInput.dispatchEvent(new Event('input', { bubbles: true }));
        htmlInput.dispatchEvent(new Event('change', { bubbles: true }));
      }, valueText);
    });

    const directInputAccepted = await waitUntil(
      async () => await input.inputValue().catch(() => ''),
      (currentValue) =>
        currentValue === valueText ||
        currentValue.replace(/[^\d.]/g, '') === valueText.replace(/[^\d.]/g, ''),
      {
        timeout: 1_000,
        message: `Recall tip value ${valueText} was not applied through direct input.`,
      },
    ).catch(() => null);

    if (directInputAccepted === valueText) {
      return;
    }

    if (isPaymentCardDialog) {
      return;
    }

    await this.enterTipValueByKeypad(tipDialog, valueText);
  }

  private async confirmTipDialog(isPaymentCardDialog: boolean): Promise<void> {
    const tipDialog = await this.resolveTipDialog(isPaymentCardDialog);
    const confirmButton = await this.resolveTipDialogConfirmButton(tipDialog);
    await waitForInputSettled();
    await confirmButton.click();
  }

  private async resolveTipDialogInput(
    tipDialog: Locator,
    isPaymentCardDialog: boolean,
  ): Promise<Locator> {
    const candidates = isPaymentCardDialog
      ? [
          tipDialog.getByTestId('payment-tip-input-value').first(),
          tipDialog.locator('input[type="text"], input').first(),
          tipDialog.getByRole('textbox').first(),
        ]
      : [
          tipDialog.getByTestId('tip-input-value').first(),
          tipDialog.locator('input[type="text"], input').first(),
          tipDialog.getByRole('textbox').first(),
        ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    throw new Error('Recall Tips 输入框不可见。');
  }

  private async resolveTipDialogConfirmButton(tipDialog: Locator): Promise<Locator> {
    const candidates = [
      tipDialog.getByRole('button', { name: /^(Confirm|确认)$/ }).first(),
      tipDialog.getByTestId('tip-input-confirm').first(),
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    throw new Error('Recall Tips 确认按钮不可见。');
  }

  private async resolveBigTipConfirmDialog(): Promise<Locator> {
    const candidates = this.bigTipDialogCandidates();

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private async isBigTipConfirmDialogVisible(): Promise<boolean> {
    for (const candidate of this.bigTipDialogCandidates()) {
      if (await candidate.isVisible().catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  private async confirmBigTipDialog(): Promise<string> {
    const dialog = await this.resolveBigTipConfirmDialog();
    const messageText =
      'The tip is more than 50% of the meal. Confirm to add?';
    const message =
      (
        await dialog
          .getByText(messageText, { exact: true })
          .first()
          .textContent()
          .catch(() => null)
      )
        ?.replace(/\s+/g, ' ')
        .trim() ?? messageText;
    await dialog.getByRole('button', { name: /^Yes$/i }).first().click();
    return message;
  }

  @step((paymentMethod?: string) =>
    paymentMethod
      ? `页面读取：读取 Recall 订单详情 PAYMENT 卡片 ${paymentMethod} 中的 Tips`
      : '页面读取：读取 Recall 订单详情 PAYMENT 卡片中的 Tips',
  )
  async readPaymentCardTip(paymentMethod?: string): Promise<string | null> {
    await this.waitForOrderDetailsDialogReady();
    const orderDetailsDialog = await this.resolveActiveOrderDetailsDialog();

    return await orderDetailsDialog.evaluate((dialogElement, targetPaymentMethod) => {
      const cleanText = (value: string | null | undefined): string =>
        value?.replace(/\s+/g, ' ').trim() ?? '';
      const headings = Array.from(dialogElement.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      const paymentHeading = headings.find(
        (headingElement) => cleanText(headingElement.textContent).toUpperCase() === 'PAYMENT',
      );
      const paymentSection =
        paymentHeading?.closest('[class*="_section_"]') ??
        paymentHeading?.parentElement?.parentElement ??
        dialogElement;
      const visibleCards = Array.from(
        paymentSection.querySelectorAll('[data-payment-method], [class*="_card_"], [class*="_paymentInfo_"]'),
      ).filter((element, index, elements) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const computedStyle = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          computedStyle.display !== 'none' &&
          computedStyle.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0 &&
          elements.indexOf(element) === index
        );
      });

        const paymentCard = targetPaymentMethod
          ? visibleCards.find((cardElement) =>
              cleanText(cardElement.textContent).includes(targetPaymentMethod),
            )
          : visibleCards.at(-1);

      if (!paymentCard) {
        return null;
      }

      const cardText = cleanText(paymentCard.textContent);
      const matchedTip = cardText.match(/Tips:?\s*(\$[\d,.]+)/i);
      return matchedTip?.[1] ?? null;
    }, paymentMethod ?? null);
  }

  private formatTipInputDigits(amountInCents: number): string {
    if (!Number.isFinite(amountInCents) || amountInCents < 0) {
      throw new Error(`Invalid tip amount in cents: ${amountInCents}`);
    }

    return String(Math.round(amountInCents));
  }

  private formatPaymentCardTipInputValue(amountInCents: number): string {
    if (!Number.isFinite(amountInCents) || amountInCents < 0) {
      throw new Error(`Invalid payment-card tip amount in cents: ${amountInCents}`);
    }

    return (Math.round(amountInCents) / 100).toFixed(2);
  }

  private async enterTipValueByKeypad(tipDialog: Locator, valueText: string): Promise<void> {
    const clearButton = tipDialog.getByRole('button', { name: 'C', exact: true }).first();
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
    }

    for (const digit of valueText) {
      await tipDialog.getByRole('button', { name: digit, exact: true }).first().click();
    }
  }

  private bigTipDialogCandidates(): Locator[] {
    return [
      this.page.getByTestId('big-tip-confirm-dialog').first(),
      this.page
        .getByRole('alertdialog')
        .filter({
          has: this.page.getByText(
            'The tip is more than 50% of the meal. Confirm to add?',
            { exact: true },
          ),
        })
        .first(),
      this.page
        .getByRole('dialog')
        .filter({
          has: this.page.getByText(
            'The tip is more than 50% of the meal. Confirm to add?',
            { exact: true },
          ),
        })
        .first(),
      ];
  }

  private async findVisibleTipsButton(scope: Locator): Promise<Locator | null> {
    return findFirstVisibleLocator(this.buildPaymentCardTipsButtonCandidates(scope));
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
}

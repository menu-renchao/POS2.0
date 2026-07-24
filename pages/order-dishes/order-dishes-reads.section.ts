import { expect, type Locator } from '@playwright/test';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import {
  type OrderDishesSnapshot,
  type OrderedDishItem,
  type OrderedDishItemAddition,
  type OrderedDishRowState,
  type OrderPriceSummary,
} from './order-dishes.types';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';

export class OrderDishesReadsSection {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
  ) {}

  private get page() {
    return this.ctx.page;
  }

  private get locators(): OrderDishesLocators {
    return this.ctx.locators;
  }

    @step('页面读取：读取点单页 Count 原始文本')
    async readCountText(): Promise<string> {
      await this.host.expectLoaded();
      return (await this.locators.countText.innerText()).trim();
    }

    @step('页面操作：确认购物车中有菜品')
    async expectCartHasItems(): Promise<void> {
      if (await this.locators.cartBadge.isVisible()) {
        const count = await this.locators.cartBadge.textContent();
        expect(Number(count)).toBeGreaterThan(0);
      }
    }

    @step(
      (dishName: string, additionName: string, price: string) =>
        `页面断言：菜品 ${dishName} 展示附加项 ${additionName}，金额 ${price}`,
    )
    async expectOrderedDishAddition(
      dishName: string,
      additionName: string,
      price: string,
    ): Promise<void> {
      await this.host.expectLoaded();
      const dishItem = this.locators.orderedDishItems.filter({ hasText: dishName }).first();
      await expect(dishItem).toContainText(additionName);
      await expect(dishItem).toContainText(price);
    }

    @step('页面读取：读取点单页左侧已点菜品明细')
    async readOrderedItems(): Promise<OrderedDishItem[]> {
      await this.host.expectLoaded();

      const items = await waitUntil(
        async () => await this.readOrderedItemsSnapshot(),
        (snapshotItems) => snapshotItems.length > 0,
        {
          timeout: 15_000,
          probeTimeout: 5_000,
          message: '点餐页购物车菜品未在超时内就绪。',
        },
      );

      return items.map((item) => ({
        ...item,
        additions: this.normalizeOrderedItemAdditions(item.additions),
      }));
    }

    @step((dishName: string) => `页面读取：读取已点菜品 ${dishName} 的数值价格`)
    async readOrderedDishPrice(dishName: string): Promise<number> {
      const orderedItem = (await this.readOrderedItems()).find((item) => item.name === dishName);
      const priceText = orderedItem?.price;

      if (!priceText) {
        throw new Error(`点单页未读取到菜品 ${dishName} 的价格。`);
      }

      const price = Number(priceText.replace(/[$,]/g, ''));
      if (Number.isNaN(price)) {
        throw new Error(`菜品 ${dishName} 的价格无法解析为数值：${priceText}`);
      }

      return price;
    }

    @step(
      (comboName: string, saleItemId: number) =>
        `页面读取：读取套餐 ${comboName} 的子菜 ID ${saleItemId} 数值价格`,
    )
    async readComboSubItemPrice(comboName: string, saleItemId: number): Promise<number> {
      const priceText = await this.locators
        .comboSubItemPriceBySaleItemId(comboName, saleItemId)
        .innerText();
      const price = Number(priceText.replace(/[$,]/g, ''));

      if (Number.isNaN(price)) {
        throw new Error(`套餐 ${comboName} 子菜 ${saleItemId} 的价格无法解析：${priceText}`);
      }

      return price;
    }

    @step(
      (dishName: string, detailText: string) =>
        `页面读取：检查已点菜品 ${dishName} 是否展示明细 ${detailText}`,
    )
    async isOrderedDishDetailVisible(dishName: string, detailText: string): Promise<boolean> {
      return await this.locators
        .orderedDishItemByName(dishName)
        .getByText(detailText, { exact: true })
        .isVisible()
        .catch(() => false);
    }

    @step((dishName: string) => `页面断言：已点菜品 ${dishName} 已从订单中移除`)
    async expectOrderedDishAbsent(dishName: string): Promise<void> {
      await expect(this.locators.orderedDishItemsByName(dishName)).toBeHidden();
    }

    @step((dishName: string) => `页面读取：读取同名菜品 ${dishName} 各订单行的数量和送厨状态`)
    async readOrderedDishRowStates(dishName: string): Promise<OrderedDishRowState[]> {
      await this.host.expectLoaded();
      const texts = await this.locators.orderedDishItemsByName(dishName).allInnerTexts();

      return texts.map((text) => {
        const normalizedText = text.replace(/\s+/g, ' ').trim();
        const quantity = normalizedText.match(/^(\d+(?:\.\d+)?)\s/)?.[1];
        const kitchenQuantityText = normalizedText.match(/\b(\d+(?:\.\d+)?)\s+sent\b/)?.[1];
        if (!quantity) {
          throw new Error(`菜品 ${dishName} 订单行缺少可解析数量：${normalizedText}`);
        }

        return {
          kitchenQuantity: kitchenQuantityText ? Number(kitchenQuantityText) : null,
          quantity,
          sentToKitchen: /\bSent in\b/.test(normalizedText),
          text: normalizedText,
        };
      });
    }

    @step((dishName: string) => `页面读取：读取已点菜品 ${dishName} 菜名的显示颜色`)
    async readOrderedDishNameColor(dishName: string): Promise<string> {
      await this.host.expectLoaded();
      return await this.locators.orderedDishNameByName(dishName).evaluate(
        (element) => getComputedStyle(element).color,
      );
    }

    @step(
      (dishName: string, additionName: string) =>
        `页面读取：读取菜品 ${dishName} 的附加项 ${additionName} 数量`,
    )
    async readOrderedDishAdditionQuantity(
      dishName: string,
      additionName: string,
    ): Promise<number> {
      const orderedItem = (await this.readOrderedItems()).find((item) => item.name === dishName);
      const addition = orderedItem?.additions.find(
        (item) => item.name === additionName || item.name.startsWith(`${additionName} ×`),
      );

      if (!addition) {
        return 0;
      }

      if (addition.name === additionName) {
        return 1;
      }

      const quantity = Number(addition.name.slice(`${additionName} ×`.length));

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error(`无法从附加项文本 ${addition.name} 解析有效数量。`);
      }

      return quantity;
    }

    private normalizeOrderedItemAdditions(
      additions: OrderedDishItemAddition[],
    ): OrderedDishItemAddition[] {
      return additions.flatMap((addition) => {
        const cleanedName = addition.name.replace(/DishLevelIcon/gi, ' ').replace(/\s+/g, ' ').trim();
        const pricedParentWithChild = cleanedName.match(/^(.+?)\s+(\$[\d,.]+)\s+(.+)$/);

        if (pricedParentWithChild) {
          const [, parentName, parentPrice, childName] = pricedParentWithChild;

          return [
            { ...addition, name: parentName, price: addition.price ?? parentPrice },
            { name: childName },
          ];
        }

        const splitNames = cleanedName
          .split(/\s+(?=(?:free|category)\s+(?:option|suboption))/i)
          .map((name) => name.trim())
          .filter(Boolean);

        if (splitNames.length <= 1) {
          return [{ ...addition, name: cleanedName }];
        }

        return splitNames.map((name) => ({
          ...addition,
          name,
          ...(name === cleanedName ? {} : { price: addition.price }),
        }));
      });
    }

    private async readOrderedItemsSnapshot(): Promise<OrderedDishItem[]> {
      return await this.readStructuredOrderedItems();
    }

    private async readStructuredOrderedItems(): Promise<OrderedDishItem[]> {
      return await this.locators.orderedDishItems.evaluateAll((dishElements) => {
        return (() => {
        type OrderedDishItemFromDom = {
          additions: Array<{ name: string; price?: string }>;
          name: string;
          price: string | null;
          quantity: string;
        };
        type OrderedDishItemAdditionFromDom = {
          name: string;
          price?: string;
          subAdditions?: OrderedDishItemAdditionFromDom[];
        };

        const cleanText = (value: string | null | undefined): string =>
          value?.replace(/\s+/g, ' ').trim() ?? '';
        const normalizeOptionalText = (value: string | null | undefined): string | null => {
          const normalizedText = cleanText(value);
          return normalizedText.length > 0 ? normalizedText : null;
        };
        const selectText = (root: Element, selector: string): string | null =>
          normalizeOptionalText(root.querySelector(selector)?.textContent);
        const readTexts = (root: Element, selector: string): string[] =>
          Array.from(root.querySelectorAll(selector))
            .map((element) => cleanText(element.textContent))
            .filter(Boolean);
        const dedupeElements = <T extends Element>(elements: T[]): T[] => {
          const seenElements = new Set<T>();

          return elements.filter((element) => {
            if (seenElements.has(element)) {
              return false;
            }

            seenElements.add(element);
            return true;
          });
        };
        const additionSelectors = [
          '[data-testid^="dish-item-subitem-"]',
          '[class*="_extraItem_"]',
          '[class*="_optionItemContainer_"]',
        ].join(', ');
        const readDishName = (
          dishElement: Element,
          quantity: string | null,
          price: string | null,
        ): string | null => {
          const explicitDishName = selectText(dishElement, '[class*="_dishName_"]');

          if (explicitDishName) {
            return explicitDishName;
          }

          return (
            readTexts(dishElement, 'span, div')
              .find(
                (text) =>
                  text !== quantity &&
                  text !== price &&
                  !/^\$[\d,.]+$/.test(text) &&
                  !/^\d+(?:\.\d+)?$/.test(text),
              ) ?? null
          );
        };
        const isAdditionElement = (element: Element): boolean => element.matches(additionSelectors);
        const parseAdditionElement = (
          additionElement: Element,
          childMap: Map<Element, Element[]>,
        ): OrderedDishItemAdditionFromDom | null => {
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
            .map((childElement) => parseAdditionElement(childElement, childMap))
            .filter((addition): addition is OrderedDishItemAdditionFromDom => addition !== null);

          return {
            ...(additionPrice ? { price: additionPrice } : {}),
            ...(subAdditions.length > 0 ? { subAdditions } : {}),
            name: additionName,
          };
        };

        return dedupeElements(dishElements).reduce<OrderedDishItemFromDom[]>((items, dishElement) => {
          const quantity =
            selectText(dishElement, '[class*="_quantity_"]') ??
            readTexts(dishElement, 'span').find((text) => /^\d+(?:\.\d+)?$/.test(text)) ??
            null;
          const price =
            selectText(dishElement, '[class*="_dishPrice_"]') ??
            readTexts(dishElement, 'span').find((text) => /^\$[\d,.]+$/.test(text)) ??
            null;
          const name = readDishName(dishElement, quantity, price);

          if (!quantity || !name) {
            return items;
          }

          const additionElements = dedupeElements(Array.from(dishElement.querySelectorAll(additionSelectors)));
          const additionElementSet = new Set(additionElements);
          const childMap = new Map<Element, Element[]>();
          const topLevelAdditionElements: Element[] = [];

          for (const additionElement of additionElements) {
            const closestParentAddition =
              additionElement.parentElement?.closest(additionSelectors) ?? null;
            const parentAdditionElement =
              closestParentAddition &&
              closestParentAddition !== additionElement &&
              additionElementSet.has(closestParentAddition) &&
              dishElement.contains(closestParentAddition)
                ? closestParentAddition
                : null;

            if (parentAdditionElement) {
              const children = childMap.get(parentAdditionElement) ?? [];
              children.push(additionElement);
              childMap.set(parentAdditionElement, children);
              continue;
            }

            topLevelAdditionElements.push(additionElement);
          }

          const additions = topLevelAdditionElements
            .map((additionElement) => parseAdditionElement(additionElement, childMap))
            .filter(
              (addition): addition is OrderedDishItemAdditionFromDom => addition !== null,
            );

          items.push({
            additions,
            name,
            price,
            quantity,
          });

          return items;
        }, []);
        })();
      });
    }

    @step('页面读取：读取点单页左侧价格汇总')
    async readPriceSummary(): Promise<OrderPriceSummary> {
      await this.host.expectLoaded();
      await this.expandPriceSummary();
      const inlinePriceSummary = await this.tryReadInlinePriceSummary();

      if (inlinePriceSummary) {
        return inlinePriceSummary;
      }

      const summary: Partial<OrderPriceSummary> = {};

      summary.Count = await this.readPriceSummaryRowNumber('Count');
      summary.Subtotal = await this.readPriceSummaryRowNumber('Subtotal');
      summary.Tax = await this.readPriceSummaryRowNumber('Tax');
      summary.Charge = await this.tryReadPriceSummaryRowNumber('Charge');
      summary['Total Before Tips'] = await this.readPriceSummaryRowNumber('Total Before Tips');
      summary.Tips = await this.tryReadPriceSummaryRowNumber('Tips');
      const total = await this.tryReadPriceSummaryMoneyNumber('Total');
      summary['Total(Cash)'] =
        (await this.tryReadPriceSummaryMoneyNumber('Total(Cash)')) ?? total ?? 0;
      summary['Total(Card)'] =
        (await this.tryReadPriceSummaryMoneyNumber('Total(Card)')) ??
        total ??
        summary['Total(Cash)'];

      return summary as OrderPriceSummary;
    }

    private async tryReadInlinePriceSummary(): Promise<OrderPriceSummary | null> {
      const priceSummaryToggle = await this.resolvePriceSummaryToggle().catch(() => null);

      if (!priceSummaryToggle) {
        return null;
      }

      const normalizedText = (await priceSummaryToggle.innerText().catch(() => ''))
        .replace(/\s+/g, ' ')
        .trim();

      if (!normalizedText.includes('Count') || !normalizedText.includes('Subtotal')) {
        return null;
      }

      const readNumber = (pattern: RegExp): number | null => {
        const matchedValue = normalizedText.match(pattern)?.[1];

        if (!matchedValue) {
          return null;
        }

        const parsedValue = Number(matchedValue.replace(/[$,]/g, ''));
        return Number.isNaN(parsedValue) ? null : parsedValue;
      };

      const count = readNumber(/\bCount\s+([\d,.]+)/);
      const subtotal = readNumber(/\bSubtotal\s+\$?([\d,.]+)/);
      const tax = readNumber(/\bTax\s+\$?([\d,.]+)/);
      const charge = readNumber(/\bCharge\s+\$?([\d,.]+)/);
      const totalBeforeTips = readNumber(/\bTotal Before Tips\s+\$?([\d,.]+)/);
      const tips = readNumber(/\bTips\s+\$?([\d,.]+)/);
      const totalMatch = [...normalizedText.matchAll(/\bTotal\s+\$?([\d,.]+)/g)];
      const totalValue =
        totalMatch.length > 0
          ? Number(totalMatch[totalMatch.length - 1]?.[1]?.replace(/[$,]/g, ''))
          : Number.NaN;

      if (
        count === null ||
        subtotal === null ||
        tax === null ||
        totalBeforeTips === null ||
        Number.isNaN(totalValue)
      ) {
        return null;
      }

      return {
        Count: count,
        Subtotal: subtotal,
        Tax: tax,
        ...(charge === null ? {} : { Charge: charge }),
        'Total Before Tips': totalBeforeTips,
        ...(tips === null ? {} : { Tips: tips }),
        'Total(Cash)': totalValue,
        'Total(Card)': totalValue,
      };
    }

    @step('页面操作：展开点单页价格汇总')
    async expandPriceSummary(): Promise<void> {
      await this.host.expectLoaded();

      if (await this.isPriceSummaryExpanded()) {
        return;
      }

      await (await this.resolvePriceSummaryToggle()).click({ timeout: 5_000 });
      await waitUntil(
        async () => await this.isPriceSummaryExpanded(),
        (summaryExpanded) => summaryExpanded,
        {
          timeout: 5_000,
          probeTimeout: 1_000,
          message: '点单页价格汇总未在展开后变为展开状态。',
        },
      );
    }

    private async isPriceSummaryExpanded(): Promise<boolean> {
      const priceSummaryToggle = await this.resolvePriceSummaryToggle();
      const expanded = await priceSummaryToggle.getAttribute('aria-expanded').catch(() => null);

      if (expanded === 'true') {
        return true;
      }

      if (expanded === 'false') {
        return false;
      }

      return await this.locators.priceSummaryDetailsContainer.isVisible().catch(() => false);
    }

    private async readPriceSummaryRowNumber(label: string): Promise<number> {
      const container = this.locators.priceSummaryDetailsContainer;
      await expect(container).toBeVisible();
      const normalizedText = (await container.innerText()).replace(/\s+/g, ' ').trim();
      const escapedLabel = this.ctx.escapeRegExp(label);
      const value = normalizedText.match(
        new RegExp(`(?:^|\\s)${escapedLabel}\\s+\\$?([\\d,.]+)(?:\\s|$)`, 'i'),
      )?.[1];
      const parsedValue = Number(value?.replace(/,/g, '') ?? Number.NaN);

      if (!Number.isNaN(parsedValue)) {
        return parsedValue;
      }

      throw new Error(`Unable to read ${label} from order price summary.`);
    }

    private async tryReadPriceSummaryRowNumber(label: string): Promise<number | undefined> {
      try {
        return await this.readPriceSummaryRowNumber(label);
      } catch {
        return undefined;
      }
    }

    private async readPriceSummaryMoneyNumber(label: string): Promise<number> {
      const container = this.locators.priceSummaryTotalContainer;
      await expect(container).toBeVisible();
      const normalizedText = (await container.innerText()).replace(/\s+/g, ' ').trim();
      const escapedLabel = this.ctx.escapeRegExp(label);
      const matches = [
        ...normalizedText.matchAll(
          new RegExp(`(?:^|\\s)${escapedLabel}\\s+\\$([\\d,.]+)(?:\\s|$)`, 'gi'),
        ),
      ];
      const parsedValue = Number(matches.at(-1)?.[1]?.replace(/,/g, '') ?? Number.NaN);

      if (!Number.isNaN(parsedValue)) {
        return parsedValue;
      }

      throw new Error(`Unable to read ${label} from order price summary.`);
    }

    private async tryReadPriceSummaryMoneyNumber(label: string): Promise<number | undefined> {
      try {
        return await this.readPriceSummaryMoneyNumber(label);
      } catch {
        return undefined;
      }
    }

    @step('页面读取：读取点单页税额')
    async readTaxAmount(): Promise<number> {
      const priceSummary = await this.readPriceSummary();
      const taxAmount = priceSummary.Tax;

      if (taxAmount === undefined || taxAmount === null) {
        throw new Error('Unable to read Tax from order price summary.');
      }

      return taxAmount;
    }

    @step('页面读取：读取点单页当前订单快照')
    async readOrderSnapshot(): Promise<OrderDishesSnapshot> {
      return {
        items: await this.readOrderedItems(),
        priceSummary: await this.readPriceSummary(),
      };
    }

    private async resolvePriceSummaryToggle(): Promise<Locator> {
      return this.locators.priceSummaryToggle;
    }
}

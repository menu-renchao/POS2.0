import { expect, type Frame, type Locator } from '@playwright/test';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import {
  ORDER_DISHES_IFRAME_SELECTOR,
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

  private orderDishesContentFrame: Frame | null = null;

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
      for (const readScope of await this.resolveOrderedItemReadScopes()) {
        const cartButtonItems = await this.readCartButtonOrderedItems(readScope);

        if (cartButtonItems.length > 0) {
          return cartButtonItems;
        }

        const structuredItems = await this.readStructuredOrderedItemsInScope(readScope);

        if (structuredItems.length > 0) {
          return structuredItems;
        }

        const cartItemTexts = (
          await readScope
            .getByRole('button', { name: /^\d+(?:\.\d+)?\s+.+\s+\$[\d,.]+/i })
            .allInnerTexts()
        ).map((text) => text.replace(/\s+/g, ' ').trim());
        const itemsFromCartButtons = this.parseOrderedItemsFromTexts(cartItemTexts);

        if (itemsFromCartButtons.length > 0) {
          return itemsFromCartButtons;
        }

        const frameLines = (await readScope.innerText())
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const itemsFromLines = this.parseOrderedItemsFromTexts(frameLines);

        if (itemsFromLines.length > 0) {
          return itemsFromLines;
        }
      }

      return [];
    }

    private async resolveOrderedItemReadScopes(): Promise<Locator[]> {
      const readScopes: Locator[] = [
        this.page.locator('#orderDishesContainer'),
        this.page.locator(ORDER_DISHES_IFRAME_SELECTOR).contentFrame().locator('body'),
      ];

      const contentFrame = await this.tryResolveOrderDishesContentFrame();
      if (contentFrame) {
        readScopes.push(contentFrame.locator('body'));
      }

      return readScopes;
    }

    private async tryResolveOrderDishesContentFrame(): Promise<Frame | null> {
      if (this.orderDishesContentFrame) {
        const frameStillReady = await this.frameHasOrderDishesContent(this.orderDishesContentFrame).catch(
          () => false,
        );

        if (frameStillReady) {
          return this.orderDishesContentFrame;
        }

        this.orderDishesContentFrame = null;
      }

      const iframeLocator = this.page.locator(ORDER_DISHES_IFRAME_SELECTOR);

      if ((await iframeLocator.count().catch(() => 0)) === 0) {
        return null;
      }

      const iframeHandle = await iframeLocator.first().elementHandle().catch(() => null);
      const contentFrame = iframeHandle ? await iframeHandle.contentFrame() : null;

      if (!contentFrame || !(await this.frameHasOrderDishesContent(contentFrame).catch(() => false))) {
        return null;
      }

      this.orderDishesContentFrame = contentFrame;
      return contentFrame;
    }

    private async frameHasOrderDishesContent(frame: Frame): Promise<boolean> {
      return await frame.locator('body').evaluate((bodyElement) => {
        const hasStructuredDishItem = Boolean(
          bodyElement.querySelector(
            '[data-testid="pos-ui-dish-item"], [data-test-id="pos-ui-dish-item"], [class*="_dishItem_"]',
          ),
        );
        const hasOrderActionButton = Boolean(
          bodyElement.querySelector(
            '[data-testid="bottom-button-sendOrderBtn"], [data-test-id="bottom-button-sendOrderBtn"], [data-testid="bottom-button-saveOrderBtn"], [data-test-id="bottom-button-saveOrderBtn"]',
          ),
        );
        const hasCartDishButton = Array.from(
          bodyElement.querySelectorAll('button,[role="button"]'),
        ).some((buttonElement) =>
          /^\d+(?:\.\d+)?\s+.+\s+\$[\d,.]+$/i.test(
            buttonElement.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          ),
        );

        return hasStructuredDishItem || hasOrderActionButton || hasCartDishButton;
      }).catch(() => false);
    }

    private async readStructuredOrderedItemsInScope(readScope: Locator): Promise<OrderedDishItem[]> {
      return await readScope.evaluate((scopeElement) => {
        const rootElement =
          scopeElement instanceof HTMLBodyElement ? scopeElement : scopeElement.closest('body') ?? scopeElement;

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
          '[data-test-id^="dish-item-subitem-"]',
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

        return dedupeElements(
          Array.from(
            rootElement.querySelectorAll(
              '[data-testid="pos-ui-dish-item"], [data-test-id="pos-ui-dish-item"], [class*="_dishItem_"]',
            ),
          ),
        ).reduce<OrderedDishItemFromDom[]>((items, dishElement) => {
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

    private async readCartButtonOrderedItems(readScope: Locator): Promise<OrderedDishItem[]> {
      return await readScope
        .getByRole('button', { name: /^\d+(?:\.\d+)?\s+.+\s+\$[\d,.]+/i })
        .evaluateAll((buttonElements) => {
          const cleanText = (value: string | null | undefined): string =>
            value?.replace(/\s+/g, ' ').trim() ?? '';

          return buttonElements
            .map<OrderedDishItem | null>((buttonElement) => {
              const text = cleanText(buttonElement.textContent);
              const headerMatch = text.match(/^(\d+(?:\.\d+)?)\s+(.+?)\s+(\$[\d,.]+)/i);

              if (!headerMatch) {
                return null;
              }

              const [, quantity, name, price] = headerMatch;
              const domAdditionNodes = Array.from(
                buttonElement.querySelectorAll(
                  [
                    '[data-testid^="dish-item-subitem-"]',
                    '[data-test-id^="dish-item-subitem-"]',
                    '[class*="_optionItemContainer_"]',
                    '[class*="_extraItem_"]',
                  ].join(', '),
                ),
              )
                .map((additionElement) =>
                  cleanText(additionElement.textContent).replace(/DishLevelIcon/gi, '').trim(),
                )
                .filter(Boolean);
              const leafAdditions = Array.from(buttonElement.querySelectorAll('span, div'))
                .filter((element) => element.children.length === 0)
                .map((element) => cleanText(element.textContent))
                .filter(
                  (label) =>
                    label &&
                    label !== quantity &&
                    label !== name &&
                    label !== price &&
                    !/^DishLevelIcon$/i.test(label) &&
                    !/^\d+(?:\.\d+)?$/.test(label),
                );
              const rowBasedAdditions = Array.from(buttonElement.children)
                .slice(1)
                .flatMap((rowElement) =>
                  Array.from(rowElement.children).map((additionRow) =>
                    cleanText(additionRow.textContent).replace(/DishLevelIcon/gi, '').trim(),
                  ),
                )
                .filter(Boolean);
              const iconBasedAdditions = Array.from(
                buttonElement.querySelectorAll('img[alt="DishLevelIcon"], img[alt*="DishLevel"]'),
              )
                .map((iconElement) => {
                  const labelElement = Array.from(iconElement.parentElement?.children ?? []).find(
                    (childElement) => childElement !== iconElement,
                  );

                  return cleanText(labelElement?.textContent ?? iconElement.parentElement?.textContent)
                    .replace(/DishLevelIcon/gi, '')
                    .trim();
                })
                .filter(Boolean);
              const remainder = text.slice(headerMatch[0].length).trim();
              const textBasedAdditions = remainder
                .split(/DishLevelIcon/i)
                .map((part) => cleanText(part))
                .filter(Boolean);
              const additionTexts =
                domAdditionNodes.length > 0
                  ? domAdditionNodes
                  : leafAdditions.length > 0
                    ? leafAdditions
                    : rowBasedAdditions.length > 0
                      ? rowBasedAdditions
                      : iconBasedAdditions.length > 0
                        ? iconBasedAdditions
                        : textBasedAdditions;
              const normalizedAdditionTexts =
                additionTexts.length === 1
                  ? additionTexts[0].split(/\s+(?=(?:free|category)\s+(?:option|suboption))/i)
                  : additionTexts;
              const additions = normalizedAdditionTexts
                .map((part) => cleanText(part))
                .filter(Boolean)
                .map((part) => {
                  const priceMatch = part.match(/\$[\d,.]+$/);
                  const additionName = priceMatch
                    ? cleanText(part.replace(priceMatch[0], ''))
                    : part;

                  return {
                    name: additionName,
                    ...(priceMatch ? { price: priceMatch[0] } : {}),
                  };
                })
                .filter((addition) => addition.name.length > 0);

              return {
                additions,
                name,
                price,
                quantity,
              } satisfies OrderedDishItem;
            })
            .filter((item): item is OrderedDishItem => item !== null);
        });
    }

    private parseOrderedItemsFromTexts(texts: string[]): OrderedDishItem[] {
      return texts.reduce<OrderedDishItem[]>((items, text) => {
        const matchedItem = text.match(/^(\d+(?:\.\d+)?)\s+(.+?)\s+(\$[\d,.]+)/i);

        if (!matchedItem) {
          return items;
        }

        const [, quantity, name, price] = matchedItem;
        const remainder = text.slice(matchedItem[0].length).trim();
        const additions = remainder
          .split(/DishLevelIcon/i)
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            const priceMatch = part.match(/\$[\d,.]+$/);
            const additionName = priceMatch ? part.replace(priceMatch[0], '').trim() : part;

            return {
              name: additionName,
              ...(priceMatch ? { price: priceMatch[0] } : {}),
            };
          })
          .filter((addition) => addition.name.length > 0);

        items.push({
          additions,
          quantity,
          name,
          price,
        });

        return items;
      }, []);
    }

    @step('页面读取：读取点单页左侧价格汇总')
    async readPriceSummary(): Promise<OrderPriceSummary> {
      await this.host.expectLoaded();
      await this.expandPriceSummary();
      const structuredPriceSummary = await this.tryReadStructuredPriceSummary();

      if (structuredPriceSummary) {
        return structuredPriceSummary;
      }

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

    private async tryReadStructuredPriceSummary(): Promise<OrderPriceSummary | null> {
      const containers = [
        this.locators.priceSummaryDetailsContainer,
        this.locators.priceSummaryTotalContainer,
        this.locators.priceSummaryToggle,
      ];
      const entries: Record<string, number> = {};

      for (const container of containers) {
        if (!(await container.isVisible().catch(() => false))) {
          continue;
        }

        const pairs = await container.evaluate((rootElement) => {
          const cleanText = (value: string | null | undefined): string =>
            value?.replace(/\s+/g, ' ').trim() ?? '';
          const rows = [rootElement, ...Array.from(rootElement.querySelectorAll('div, section, button'))];
          const results: Array<{ label: string; value: string }> = [];

          for (const row of rows) {
            const spanChildren = Array.from(row.children).filter(
              (childElement) => childElement.tagName === 'SPAN',
            );

            if (spanChildren.length < 2) {
              continue;
            }

            for (let index = 0; index < spanChildren.length - 1; index += 1) {
              const label = cleanText(spanChildren[index]?.textContent);
              const followingTexts = spanChildren
                .slice(index + 1)
                .map((childElement) => cleanText(childElement.textContent))
                .filter((text) => text && !/^Save/i.test(text));
              const value =
                followingTexts.find((text) => /^\$?[\d,.]+$/.test(text)) ??
                followingTexts.at(-1) ??
                '';

              if (label && value) {
                results.push({ label, value });
              }
            }
          }

          return results;
        });

        for (const pair of pairs) {
          const normalizedLabel =
            /^(Count|Subtotal|Tax|Charge|Total Before Tips|Tips|Total(?:\((?:Cash|Card)\))?)$/i.test(
              pair.label,
            )
              ? pair.label
              : null;

          if (!normalizedLabel) {
            continue;
          }

          const parsedValue = Number(pair.value.replace(/[$,]/g, ''));
          if (!Number.isNaN(parsedValue)) {
            entries[normalizedLabel] = parsedValue;
          }
        }
      }

      if (
        entries.Count === undefined ||
        entries.Subtotal === undefined ||
        entries.Tax === undefined ||
        entries['Total Before Tips'] === undefined
      ) {
        return null;
      }

      const resolvedTotal = entries['Total(Cash)'] ?? entries.Total;
      const resolvedCardTotal = entries['Total(Card)'] ?? entries.Total ?? resolvedTotal;

      if (resolvedTotal === undefined || resolvedCardTotal === undefined) {
        return null;
      }

      return {
        Count: entries.Count,
        Subtotal: entries.Subtotal,
        Tax: entries.Tax,
        ...(entries.Charge === undefined ? {} : { Charge: entries.Charge }),
        'Total Before Tips': entries['Total Before Tips'],
        ...(entries.Tips === undefined ? {} : { Tips: entries.Tips }),
        'Total(Cash)': resolvedTotal,
        'Total(Card)': resolvedCardTotal,
      };
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

      return await priceSummaryToggle
        .locator('xpath=following-sibling::*[1]')
        .isVisible()
        .catch(() => false);
    }

    private async readPriceSummaryRowNumber(label: string): Promise<number> {
      const containers = [this.locators.priceSummaryDetailsContainer, this.locators.priceSummaryToggle];

      for (const container of containers) {
        if (!(await container.isVisible().catch(() => false))) {
          continue;
        }

        const value = await container.evaluate((rootElement, targetLabel) => {
          const cleanText = (value: string | null | undefined): string =>
            value?.replace(/\s+/g, ' ').trim() ?? '';
          const rows = [rootElement, ...Array.from(rootElement.querySelectorAll('div, section, button'))];

          for (const row of rows) {
            const spans = Array.from(row.querySelectorAll(':scope > span'));

            if (spans.length < 2) {
              continue;
            }

            const labelText = cleanText(spans[0]?.textContent);
            if (labelText !== targetLabel) {
              continue;
            }

            return cleanText(spans.at(-1)?.textContent);
          }

          return '';
        }, label);
        const normalizedValue = value.replace(/\s+/g, ' ').trim();

        if (!normalizedValue) {
          continue;
        }

        const parsedValue = Number(normalizedValue.replace(/[$,]/g, ''));
        if (!Number.isNaN(parsedValue)) {
          return parsedValue;
        }
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
      const containers = [this.locators.priceSummaryTotalContainer, this.locators.priceSummaryToggle];

      for (const container of containers) {
        if (!(await container.isVisible().catch(() => false))) {
          continue;
        }

        const value = await container.evaluate((rootElement, targetLabel) => {
          const cleanText = (value: string | null | undefined): string =>
            value?.replace(/\s+/g, ' ').trim() ?? '';
          const rows = [rootElement, ...Array.from(rootElement.querySelectorAll('div, section, button'))];

          for (const row of rows) {
            const spans = Array.from(row.querySelectorAll(':scope > span'));

            if (spans.length < 2) {
              continue;
            }

            for (let index = 0; index < spans.length; index += 1) {
              const labelText = cleanText(spans[index]?.textContent);
              if (labelText !== targetLabel) {
                continue;
              }

              const followingTexts = spans
                .slice(index + 1)
                .map((span) => cleanText(span.textContent))
                .filter((text) => text && !/^Save/i.test(text));
              const moneyValue = followingTexts.find((text) => /^\$[\d,.]+$/.test(text));

              if (moneyValue) {
                return moneyValue;
              }
            }
          }

          return '';
        }, label);
        const normalizedValue = value.replace(/\s+/g, ' ').trim();

        if (!normalizedValue) {
          continue;
        }

        const parsedValue = Number(normalizedValue.replace(/[$,]/g, ''));
        if (!Number.isNaN(parsedValue)) {
          return parsedValue;
        }
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
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame
            .locator(
              '[data-test-id="shared-order-price-summary-toggle"], [data-testid="shared-order-price-summary-toggle"]',
            )
            .or(this.locators.appFrame.getByRole('button', { name: /Total\(Cash\).*Total\(Card\)/ }))
            .or(this.locators.appFrame.getByRole('button', { name: /Total\s*\$[\d,.]+/ }))
            .first(),
          this.page
            .locator(
              '[data-test-id="shared-order-price-summary-toggle"], [data-testid="shared-order-price-summary-toggle"]',
            )
            .or(this.page.getByRole('button', { name: /Total\(Cash\).*Total\(Card\)/ }))
            .or(this.page.getByRole('button', { name: /Total\s*\$[\d,.]+/ }))
            .first(),
        ],
        'Unable to find order price summary toggle.',
      );
    }
}

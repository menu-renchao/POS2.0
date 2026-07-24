import { step } from '../../../utils/step';
import type {
  RecallOrderItem,
  RecallOrderItemAddition,
} from '../../recall/recall.types';
import type { OrderDetailsContext } from './order-details-context';

export class OrderDetailsItemsSection {
  constructor(private readonly ctx: OrderDetailsContext) {}

  @step('页面读取：读取订单详情中的菜品明细')
  async readItems(): Promise<RecallOrderItem[]> {
    const items: RecallOrderItem[] = [];
    for (let index = 0; index < (await this.ctx.dishItems.count()); index += 1) {
      const dishItem = this.ctx.dishItems.nth(index);
      items.push(
        await dishItem.evaluate((dishElement) => {
          const clean = (value: string | null | undefined): string | null => {
            const normalized = value?.replace(/\s+/g, ' ').trim() ?? '';
            return normalized && normalized !== '-' ? normalized : null;
          };
          const text = (selector: string): string | null =>
            clean(dishElement.querySelector(selector)?.textContent);
          const spans = Array.from(dishElement.querySelectorAll('span'))
            .map((node) => clean(node.textContent))
            .filter((value): value is string => value !== null);
          const sentTime =
            text('[class*="_sentText_"]') ??
            spans.find((value) => /^Sent in /i.test(value)) ??
            null;
          const quantity =
            text('[class*="_quantity_"]') ??
            spans.find((value) => /^\d+(?:\.\d+)?$/.test(value)) ??
            null;
          const price =
            text('[class*="_dishPrice_"]') ??
            spans.find((value) => /^\$[\d,.]+$/.test(value)) ??
            null;
          const name =
            text('[data-testid="dish-item-name"]') ??
            text('[class*="_dishName_"]') ??
            spans.find(
              (value) =>
                value !== sentTime &&
                value !== quantity &&
                value !== price &&
                !/^\$[\d,.]+$/.test(value),
            ) ??
            '';
          const additions = Array.from(
            dishElement.querySelectorAll(
              '[class*="_extraItem_"], [data-testid^="dish-item-subitem-"], [class*="_optionItemContainer_"]',
            ),
          )
            .map((additionElement): RecallOrderItemAddition | null => {
              const raw = clean(additionElement.textContent);
              if (!raw) {
                return null;
              }
              const additionPrice =
                clean(additionElement.querySelector('[class*="_optionPrice_"]')?.textContent) ??
                raw.match(/\$[\d,.]+$/)?.[0];
              const quantityText = raw.match(/(?:×|x)\s*(\d+)$/i)?.[1];
              const additionName =
                clean(additionElement.querySelector('[class*="_extraText_"]')?.textContent) ??
                clean(additionElement.querySelector('[class*="_optionName_"]')?.textContent) ??
                (additionPrice
                  ? clean(
                      raw.replace(
                        new RegExp(
                          `\\s*${additionPrice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                        ),
                        '',
                      ),
                    )
                  : raw);
              return additionName
                ? {
                    name: additionName,
                    ...(additionPrice ? { price: additionPrice } : {}),
                    ...(quantityText ? { quantity: Number(quantityText) } : {}),
                  }
                : null;
            })
            .filter(
              (addition): addition is RecallOrderItemAddition => addition !== null,
            );

          return {
            seat: text('[class*="_seatTitle_"]'),
            sentTime,
            quantity,
            name,
            price,
            additions,
          };
        }),
      );
    }
    return items.filter((item) => item.name.length > 0);
  }

  @step((dishName: string) => `页面读取：读取订单详情中菜品 ${dishName} 的数值价格`)
  async readPrice(dishName: string): Promise<number> {
    const priceText = (await this.readItems()).find((item) => item.name === dishName)?.price;
    if (!priceText) {
      throw new Error(`订单详情未读取到菜品 ${dishName} 的价格。`);
    }
    const price = Number(priceText.replace(/[$,]/g, ''));
    if (!Number.isFinite(price)) {
      throw new Error(`菜品 ${dishName} 的价格无法解析为数值：${priceText}`);
    }
    return price;
  }
}

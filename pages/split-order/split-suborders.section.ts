import { expect, type Locator } from '@playwright/test';
import { step } from '../../utils/step';
import { normalizeOrderNumber } from '../../utils/text';
import type { SplitOrderContext } from './split-order-context';
import type {
  SplitOrderDishDisplay,
  SplitOrderDishSnapshot,
  SplitOrderSuborderSnapshot,
} from './split-order.types';

export class SplitSubordersSection {
  readonly cards: Locator;

  constructor(private readonly ctx: SplitOrderContext) {
    this.cards = ctx.modal.getByTestId('split-suborder');
  }

  card(orderNumber: string): Locator {
    return this.cards.filter({
      has: this.ctx.page.getByText(`#${normalizeOrderNumber(orderNumber)}`, {
        exact: true,
      }),
    });
  }

  dish(orderNumber: string, dishName: string): Locator {
    return this.card(orderNumber)
      .getByTestId('pos-ui-dish-item')
      .filter({
        has: this.ctx.page.getByText(dishName, { exact: true }),
      });
  }

  @step((orderNumber: string) => `页面操作：点击子单 ${orderNumber} 卡片`)
  async clickCard(orderNumber: string): Promise<void> {
    const card = this.card(orderNumber);
    await expect(card).toBeVisible();
    await card.click();
  }

  @step((orderNumber: string, dishName: string) =>
    `页面操作：点击子单 ${orderNumber} 中的菜品 ${dishName}`,
  )
  async clickDish(orderNumber: string, dishName: string): Promise<void> {
    const dish = this.dish(orderNumber, dishName);
    await expect(dish).toBeVisible();
    await dish.click();
  }

  @step('页面读取：读取全部分单子单快照')
  async readSnapshots(): Promise<SplitOrderSuborderSnapshot[]> {
    const snapshots: SplitOrderSuborderSnapshot[] = [];
    for (let index = 0; index < (await this.cards.count()); index += 1) {
      snapshots.push(await this.readCardSnapshot(this.cards.nth(index)));
    }
    return snapshots;
  }

  @step((orderNumber: string, dishName: string) =>
    `页面读取：读取子单 ${orderNumber} 中菜品 ${dishName} 的平分比例`,
  )
  async readDishProportion(
    orderNumber: string,
    dishName: string,
  ): Promise<string | null> {
    const dish = this.dish(orderNumber, dishName);
    if (!(await dish.isVisible().catch(() => false))) {
      return null;
    }
    const proportion =
      (await dish.getAttribute('data-proportion')) ??
      (await dish
        .locator('[class*="_proportion_"]')
        .textContent()
        .catch(() => null));
    const normalized = proportion?.replace(/\s+/g, ' ').trim() ?? '';
    return /^1\/\d+$/.test(normalized) ? normalized : null;
  }

  @step((orderNumber: string, dishName: string) =>
    `页面读取：读取子单 ${orderNumber} 中菜品 ${dishName} 的展示值`,
  )
  async readDishDisplay(
    orderNumber: string,
    dishName: string,
  ): Promise<SplitOrderDishDisplay> {
    const dish = this.dish(orderNumber, dishName);
    await expect(dish).toBeVisible({ timeout: 10_000 });
    const text = (await dish.innerText()).replace(/\s+/g, ' ').trim();
    const quantity = text.match(/\b\d+(?:\.\d+)?\b/)?.[0];
    const price = Number(
      text.match(/\$([\d,]+(?:\.\d{1,2})?)/)?.[1]?.replace(/,/g, ''),
    );
    if (!quantity || !Number.isFinite(price)) {
      throw new Error(`无法读取子单 ${orderNumber} 菜品 ${dishName} 的数量和价格：${text}`);
    }
    return { price, quantity };
  }

  @step((suborderIndex: string) =>
    `页面读取：读取分单索引 ${suborderIndex} 对应的子单号`,
  )
  async readOrderNumberByIndex(
    suborderIndex: string,
  ): Promise<string | null> {
    const normalizedIndex = normalizeOrderNumber(suborderIndex);
    const orderNumbers = (await this.readSnapshots()).map((snapshot) =>
      normalizeOrderNumber(snapshot.orderNumber),
    );
    return (
      orderNumbers.find((orderNumber) => orderNumber === normalizedIndex) ??
      orderNumbers.find((orderNumber) =>
        orderNumber.endsWith(`-${normalizedIndex}`),
      ) ??
      null
    );
  }

  @step((orderNumber: string, dishName: string) =>
    `页面读取：检查子单 ${orderNumber} 中是否存在菜品 ${dishName}`,
  )
  async hasDish(orderNumber: string, dishName: string): Promise<boolean> {
    return await this.dish(orderNumber, dishName)
      .isVisible()
      .catch(() => false);
  }

  @step('页面读取：读取单个分单子单快照')
  private async readCardSnapshot(
    card: Locator,
  ): Promise<SplitOrderSuborderSnapshot> {
    const orderNumber = normalizeOrderNumber(
      await card.getAttribute('data-order-number'),
    );
    if (!orderNumber) {
      throw new Error(
        '分单子单卡片缺少稳定的 data-order-number DOM 契约。',
      );
    }

    const dishSnapshots = await this.readDishSnapshots(card);
    const totalText = await card.getAttribute('data-total');
    const total =
      totalText === null && dishSnapshots.length === 0
        ? 0
        : parseAmount(totalText, `子单 ${orderNumber} 总额`);
    const paidStatusLocator = card.locator('[class*="_paidStatusSection_"]');
    const paidStatus = (await paidStatusLocator.isVisible().catch(() => false))
      ? normalizeText(await paidStatusLocator.innerText())
      : null;
    const seats = (await card.locator('[class*="_seatHeader_"]').allInnerTexts())
      .map(normalizeText)
      .filter(Boolean);

    return {
      dishes: dishSnapshots,
      orderNumber,
      paidStatus,
      seats,
      total,
    };
  }

  @step('页面读取：读取子单卡片中的菜品快照')
  private async readDishSnapshots(
    card: Locator,
  ): Promise<SplitOrderDishSnapshot[]> {
    const liveDishes = card.getByTestId('pos-ui-dish-item');
    const attributedDishes = card.getByTestId('split-dish');
    const dishes =
      (await liveDishes.count()) > 0 ? liveDishes : attributedDishes;
    const snapshots: SplitOrderDishSnapshot[] = [];

    for (let index = 0; index < (await dishes.count()); index += 1) {
      const dish = dishes.nth(index);
      const name = normalizeText(
        (await dish.getAttribute('data-dish-name')) ?? '',
      );
      if (!name) {
        throw new Error(
          `子单 ${await card.getAttribute('data-order-number')} 的菜品缺少稳定的 data-dish-name DOM 契约。`,
        );
      }
      const rawProportion =
        (await dish.getAttribute('data-proportion')) ??
        (await dish
          .locator('[class*="_proportion_"]')
          .textContent()
          .catch(() => null));
      const proportion = normalizeText(rawProportion ?? '');
      snapshots.push({
        name,
        proportion: /^1\/\d+$/.test(proportion) ? proportion : null,
      });
    }
    return snapshots;
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseAmount(value: string | null, label: string): number {
  const amount = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  if (!Number.isFinite(amount)) {
    throw new Error(`${label}不是有效金额：${value}`);
  }
  return amount;
}

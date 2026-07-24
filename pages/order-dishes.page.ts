import type { Page } from '@playwright/test';
import { step } from '../utils/step';
import { OrderDishesChargeSection } from './order-dishes/order-dishes-charge.section';
import { OrderDishesCustomerSection } from './order-dishes/order-dishes-customer.section';
import { OrderDishesDiscountSection } from './order-dishes/order-dishes-discount.section';
import { OrderDishesDriverSection } from './order-dishes/order-dishes-driver.section';
import { OrderDishesMenuSection } from './order-dishes/order-dishes-menu.section';
import { OrderDishesModifierSection } from './order-dishes/order-dishes-modifier.section';
import { OrderDishesNoteSection } from './order-dishes/order-dishes-note.section';
import { OrderDishesPageContext } from './order-dishes/order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes/order-dishes-page-host';
import { OrderDishesPageNavigation } from './order-dishes/order-dishes-navigation';
import { OrderDishesReadsSection } from './order-dishes/order-dishes-reads.section';
import { OrderDishesTipSection } from './order-dishes/order-dishes-tip.section';

export type {
  ChargeCustomType,
  ChargeScope,
  ItemChargeInfo,
  ModifierPriceSelection,
  OrderChargeSnapshot,
  OrderDishesSnapshot,
  OrderedDishItem,
  OrderedDishItemAddition,
  OrderPriceSummary,
  SavedOrderItemReference,
  WholeOrderChargeInfo,
} from './order-dishes/order-dishes.types';

export class OrderDishesPage implements OrderDishesPageHost {
  private readonly ctx: OrderDishesPageContext;
  public readonly navigation: OrderDishesPageNavigation;
  public readonly menu: OrderDishesMenuSection;
  public readonly modifier: OrderDishesModifierSection;
  public readonly note: OrderDishesNoteSection;
  public readonly charge: OrderDishesChargeSection;
  public readonly customer: OrderDishesCustomerSection;
  public readonly discount: OrderDishesDiscountSection;
  public readonly driver: OrderDishesDriverSection;
  public readonly reads: OrderDishesReadsSection;
  public readonly tips: OrderDishesTipSection;

  constructor(page: Page) {
    this.ctx = new OrderDishesPageContext(page);
    this.navigation = new OrderDishesPageNavigation(this.ctx, this);
    this.menu = new OrderDishesMenuSection(this.ctx, this);
    this.modifier = new OrderDishesModifierSection(this.ctx, this, (dishName) =>
      this.menu.selectOrderedDish(dishName),
    );
    this.note = new OrderDishesNoteSection(this.ctx, this);
    this.charge = new OrderDishesChargeSection(this.ctx, this);
    this.customer = new OrderDishesCustomerSection(this.ctx, this);
    this.discount = new OrderDishesDiscountSection(this.ctx, this);
    this.driver = new OrderDishesDriverSection(this.ctx);
    this.reads = new OrderDishesReadsSection(this.ctx, this);
    this.tips = new OrderDishesTipSection(this.ctx, this);
  }

  @step('页面校验：点单页已加载')
  expectLoaded(...args: Parameters<OrderDishesPageNavigation['expectLoaded']>): ReturnType<OrderDishesPageNavigation['expectLoaded']> {
    return this.navigation.expectLoaded(...args);
  }
}

import type { Page } from '@playwright/test';
import { OrderDishesLocators } from './order-dishes-locators';

export class OrderDishesPageContext {
  readonly page: Page;
  readonly locators: OrderDishesLocators;

  constructor(page: Page) {
    this.page = page;
    this.locators = new OrderDishesLocators(page);
  }

  escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

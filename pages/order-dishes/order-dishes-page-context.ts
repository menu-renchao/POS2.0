import type { Locator, Page } from '@playwright/test';
import {
  findFirstVisibleLocator,
  resolveFirstVisibleLocator,
  scopedLocator,
  type FrameOrHostScope,
} from '../shared/locator-scope';
import { OrderDishesLocators } from './order-dishes-locators';

export class OrderDishesPageContext {
  readonly page: Page;
  readonly locators: OrderDishesLocators;

  constructor(page: Page) {
    this.page = page;
    this.locators = new OrderDishesLocators(page);
  }

  get scope(): FrameOrHostScope {
    return this.locators.scope;
  }

  scopedLocator(selector: string): Locator {
    return scopedLocator(this.scope, selector);
  }

  async resolveVisibleLocator(candidates: Locator[], message: string): Promise<Locator> {
    return resolveFirstVisibleLocator(candidates, message);
  }

  async findVisibleLocator(candidates: Locator[]): Promise<Locator | null> {
    return findFirstVisibleLocator(candidates);
  }

  escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

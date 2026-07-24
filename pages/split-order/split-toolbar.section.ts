import { expect, type Locator } from '@playwright/test';
import { step } from '../../utils/step';
import type { SplitOrderContext } from './split-order-context';

export class SplitToolbarSection {
  readonly evenOrderButton: Locator;
  readonly bySeatsButton: Locator;
  readonly evenItemsButton: Locator;
  readonly moreButton: Locator;
  readonly byAmountMenuItem: Locator;
  readonly combineMenuItem: Locator;
  readonly unsplitMenuItem: Locator;
  readonly confirmButton: Locator;

  constructor(private readonly ctx: SplitOrderContext) {
    this.evenOrderButton = ctx.modal.getByTestId('evenOrderBtn');
    this.bySeatsButton = ctx.modal.getByRole('button', {
      name: 'By Seats',
      exact: true,
    });
    this.evenItemsButton = ctx.modal.getByRole('button', {
      name: 'Even Item',
      exact: true,
    });
    this.moreButton = ctx.frame.getByTestId('moreBtn');
    this.byAmountMenuItem = ctx.frame.getByRole('menuitem', {
      name: 'By Amount',
      exact: true,
    });
    this.combineMenuItem = ctx.frame.getByRole('menuitem', {
      name: 'Combine suborders',
      exact: true,
    });
    this.unsplitMenuItem = ctx.frame.getByTestId('dropdown-item-unsplitBtn');
    this.confirmButton = ctx.frame.getByTestId('splitPanelModal-confirm-button');
  }

  @step('页面操作：点击平分订单按钮')
  async clickEvenOrder(): Promise<void> {
    await this.evenOrderButton.click();
  }

  @step('页面操作：点击按座位分单按钮')
  async clickBySeats(): Promise<void> {
    await this.bySeatsButton.click();
  }

  @step('页面操作：点击平分菜品按钮')
  async clickEvenItems(): Promise<void> {
    await this.evenItemsButton.click();
  }

  @step('页面操作：打开分单 More 菜单')
  async openMore(): Promise<void> {
    await this.moreButton.click();
    await expect(this.byAmountMenuItem).toBeVisible();
  }
}

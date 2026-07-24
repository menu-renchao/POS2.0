import type { Locator } from '@playwright/test';
import { step } from '../../utils/step';
import { TipInputDialog } from '../shared/tip-input.dialog';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';

export class OrderDishesTipSection {
  private readonly moreButton: Locator;
  private readonly tipsMenuItem: Locator;
  private readonly tipDialog: TipInputDialog;

  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
  ) {
    this.moreButton = this.ctx.locators.moreActionButton;
    this.tipsMenuItem = this.page.getByRole('menuitem', {
      name: 'Tips',
      exact: true,
    });
    this.tipDialog = new TipInputDialog(this.page, 'standard');
  }

  private get page() {
    return this.ctx.page;
  }

  @step((amountInCents: number) => `页面操作：在点单页添加 Tips ${amountInCents} 分`)
  async addTip(amountInCents: number): Promise<string | null> {
    await this.openTipDialog();
    await this.fillTipAmount(amountInCents);
    await this.confirmTipDialog();

    if (await this.tipDialog.isBigTipConfirmationVisible()) {
      return await this.tipDialog.confirmBigTip();
    }

    return null;
  }

  @step('页面操作：从点单页 More 打开 Tips 输入框')
  async openTipDialog(): Promise<void> {
    await this.host.expectLoaded();
    await this.moreButton.click();
    await this.tipsMenuItem.click();
    await this.tipDialog.expectVisible();
  }

  @step((amountInCents: number) => `页面操作：在点单页 Tips 输入框中输入 ${amountInCents} 分`)
  async fillTipAmount(amountInCents: number): Promise<void> {
    await this.tipDialog.fillAmount(amountInCents);
  }

  @step('页面操作：确认点单页 Tips 输入框')
  async confirmTipDialog(): Promise<void> {
    await this.tipDialog.confirm();
  }

  @step('页面操作：确认点单页大额 Tips 提示弹窗')
  async confirmBigTipDialog(): Promise<string> {
    return await this.tipDialog.confirmBigTip();
  }
}

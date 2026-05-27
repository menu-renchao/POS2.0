import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';

export class OrderDishesTipSection {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
  ) {}

  private get page() {
    return this.ctx.page;
  }

  @step((amountInCents: number) => `页面操作：在点单页添加 Tips ${amountInCents} 分`)
  async addTip(amountInCents: number): Promise<string | null> {
    await this.openTipDialog();
    await this.fillTipAmount(amountInCents);
    await this.confirmTipDialog();

    if (await this.isBigTipConfirmDialogVisible()) {
      return await this.confirmBigTipDialog();
    }

    return null;
  }

  @step('页面操作：从点单页 More 打开 Tips 输入框')
  async openTipDialog(): Promise<void> {
    await this.host.expectLoaded();
    await (await this.resolveOrderActionMoreButton()).click();
    await (await this.resolveTipsMenuItem()).click();
    await expect(await this.resolveTipDialog()).toBeVisible();
  }

  @step((amountInCents: number) => `页面操作：在点单页 Tips 输入框中输入 ${amountInCents} 分`)
  async fillTipAmount(amountInCents: number): Promise<void> {
    const tipDialog = await this.resolveTipDialog();
    const tipInput = await this.resolveTipInput();
    const valueText = this.formatTipInputDigits(amountInCents);

    if (await tipInput.isVisible().catch(() => false)) {
      await tipInput.fill(valueText).catch(async () => {
        await tipInput.evaluate((inputElement, nextValue) => {
          const input = inputElement as HTMLInputElement;
          input.value = String(nextValue);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, valueText);
      });

      const directInputAccepted = await waitUntil(
        async () => await tipInput.inputValue().catch(() => ''),
        (currentValue) => currentValue === valueText,
        {
          timeout: 1_000,
          message: `Tip value ${valueText} was not applied through direct input.`,
        },
      ).catch(() => null);

      if (directInputAccepted === valueText) {
        return;
      }
    }

    await this.enterTipValueByKeypad(tipDialog, valueText);
  }

  @step('页面操作：确认点单页 Tips 输入框')
  async confirmTipDialog(): Promise<void> {
    await expect(await this.resolveTipDialog()).toBeVisible();
    await waitForInputSettled(await this.resolveTipInput());
    await (await this.resolveTipConfirmButton()).click();
  }

  @step('页面操作：确认点单页大额 Tips 提示弹窗')
  async confirmBigTipDialog(): Promise<string> {
    const dialog = await this.resolveBigTipConfirmDialog();
    await expect(dialog).toBeVisible();
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

  private async isBigTipConfirmDialogVisible(): Promise<boolean> {
    for (const candidate of this.bigTipDialogCandidates()) {
      if (await candidate.isVisible().catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  private async resolveOrderActionMoreButton(): Promise<Locator> {
    return await this.ctx.resolveVisibleLocator(
      [
        this.ctx.locators.moreActionButton,
        this.ctx.locators.appFrame.getByRole('button', { name: /^(More|更多)$/ }).first(),
        this.page.getByRole('button', { name: /^(More|更多)$/ }).first(),
      ],
      'Unable to find order-dishes action More button.',
    );
  }

  private async resolveTipsMenuItem(): Promise<Locator> {
    return await this.ctx.resolveVisibleLocator(
      [
        this.page.getByTestId('dropdown-item-tips').first(),
        this.ctx.locators.appFrame.getByTestId('dropdown-item-tips').first(),
        this.page.getByRole('menuitem', { name: /^(Tips|小费)$/ }).first(),
        this.ctx.locators.appFrame.getByRole('menuitem', { name: /^(Tips|小费)$/ }).first(),
        this.page.getByRole('button', { name: /^(Tips|小费)$/ }).first(),
        this.ctx.locators.appFrame.getByRole('button', { name: /^(Tips|小费)$/ }).first(),
      ],
      'Unable to find Tips entry in order-dishes More menu.',
    );
  }

  private async resolveTipDialog(): Promise<Locator> {
    return await this.ctx.resolveVisibleLocator(
      [
        this.page.getByTestId('tip-input-dialog').first(),
        this.ctx.locators.appFrame.getByTestId('tip-input-dialog').first(),
        this.page.getByRole('dialog', { name: /^Tips$/i }).first(),
        this.ctx.locators.appFrame.getByRole('dialog', { name: /^Tips$/i }).first(),
      ],
      'Unable to find order-dishes Tips dialog.',
    );
  }

  private async resolveTipInput(): Promise<Locator> {
    const tipDialog = await this.resolveTipDialog();
    return await this.ctx.resolveVisibleLocator(
      [
        tipDialog.getByTestId('tip-input-value').first(),
        tipDialog.locator('input[type="text"], input').first(),
        tipDialog.getByRole('textbox').first(),
      ],
      'Unable to find order-dishes Tips input.',
    );
  }

  private async resolveTipConfirmButton(): Promise<Locator> {
    const tipDialog = await this.resolveTipDialog();
    return await this.ctx.resolveVisibleLocator(
      [
        tipDialog.getByRole('button', { name: /^(Confirm|确认)$/ }).first(),
        tipDialog.getByTestId('tip-input-confirm').first(),
      ],
      'Unable to find order-dishes Tips confirm button.',
    );
  }

  private async resolveBigTipConfirmDialog(): Promise<Locator> {
    return await this.ctx.resolveVisibleLocator(
      this.bigTipDialogCandidates(),
      'Unable to find the order-dishes large-tip confirm dialog.',
    );
  }

  private bigTipDialogCandidates(): Locator[] {
    return [
      this.page.getByTestId('big-tip-confirm-dialog').first(),
      this.ctx.locators.appFrame.getByTestId('big-tip-confirm-dialog').first(),
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

  private formatTipInputDigits(amountInCents: number): string {
    if (!Number.isFinite(amountInCents) || amountInCents < 0) {
      throw new Error(`Invalid tip amount in cents: ${amountInCents}`);
    }

    return String(Math.round(amountInCents));
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
}

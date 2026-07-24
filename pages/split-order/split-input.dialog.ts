import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import type { SplitOrderContext } from './split-order-context';

export class SplitInputDialog {
  readonly dialog: Locator;
  private readonly input: Locator;
  private readonly confirmButton: Locator;
  private readonly cancelButton: Locator;
  private readonly clearButton: Locator;
  private readonly keyButton: (key: string) => Locator;

  constructor(ctx: SplitOrderContext) {
    this.input = ctx.frame.getByPlaceholder('0', { exact: true });
    this.dialog = ctx.frame.getByRole('dialog').filter({
      has: this.input,
    });
    this.confirmButton = this.dialog.getByRole('button', {
      name: 'Confirm',
      exact: true,
    });
    this.cancelButton = this.dialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });
    this.clearButton = this.dialog.getByRole('button', {
      name: 'C',
      exact: true,
    });
    this.keyButton = (key: string) =>
      this.dialog.getByRole('button', {
        name: key,
        exact: true,
      });
  }

  @step((value: number) => `页面操作：输入分单数值 ${value}`)
  async fill(value: number): Promise<void> {
    const valueText = String(value);
    if (!Number.isFinite(value) || value <= 0 || !/^\d+(?:\.\d+)?$/.test(valueText)) {
      throw new Error(`分单数值必须是大于 0 的普通十进制数字，实际为 ${valueText}。`);
    }

    await expect(this.dialog).toBeVisible();
    await this.clearButton.click();
    for (const key of valueText) {
      await this.keyButton(key).click();
    }
    await waitForInputSettled(this.input);
  }

  @step('页面操作：确认分单输入弹窗')
  async confirm(): Promise<void> {
    await waitForInputSettled(this.input);
    await this.confirmButton.click();
    await expect(this.dialog).toBeHidden();
  }

  @step('页面操作：关闭分单输入弹窗')
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.dialog).toBeHidden();
  }

  @step('页面读取：确认分单输入弹窗可见')
  async expectVisible(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }
}

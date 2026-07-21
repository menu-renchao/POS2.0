import { expect } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';

export class OrderDishesNoteSection {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
  ) {}

  private get locators(): OrderDishesLocators {
    return this.ctx.locators;
  }

  @step('页面操作：为当前选中菜品点击 Note 并确认出现权限校验')
  async requestSelectedItemNoteAndExpectAuthorization(): Promise<void> {
    await this.host.expectLoaded();
    await this.locators.noteButton.click();
    await expect(this.locators.notePermissionMessage).toBeVisible();
    await expect(this.locators.noteAuthorizationForm).toBeVisible();
  }

  @step('页面操作：输入有权限员工口令并完成 Note 授权')
  async authorizeSelectedItemNote(passcode: string): Promise<void> {
    if (!/^\d+$/.test(passcode)) {
      throw new Error('Note 授权口令必须只包含数字。');
    }

    for (const digit of passcode) {
      await this.locators.noteAuthorizationDigitButton(digit).click();
    }

    await this.locators.noteAuthorizationConfirmButton.click();
    await expect(this.locators.noteAuthorizationForm).toBeHidden();
    await expect(this.locators.noteInput).toBeVisible();
  }

  @step((note: string) => `页面操作：为当前选中菜品填写 Note：${note}`)
  async fillSelectedItemNote(note: string): Promise<void> {
    await this.locators.noteInput.fill(note);
    await waitForInputSettled(this.locators.noteInput);
    await this.locators.noteConfirmButton.click();
    await expect(this.locators.noteInput).toBeHidden();
  }
}

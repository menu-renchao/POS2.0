import { expect } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';

export class OrderDishesDiscountSection {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
  ) {}

  private get page() {
    return this.ctx.page;
  }

  private get locators(): OrderDishesLocators {
    return this.ctx.locators;
  }

  @step('页面操作：打开当前选中菜品的价格与折扣弹窗')
  async openSelectedItemPriceDiscountDialog(): Promise<void> {
    await this.host.expectLoaded();
    await this.locators.itemPriceChangeButton.click();
    await expect(this.locators.itemPriceDiscountDialog).toBeVisible();
  }

  @step((price: number) => `页面操作：在价格与折扣弹窗中输入特殊价格 ${price.toFixed(2)}`)
  async fillSelectedItemPrice(price: number): Promise<void> {
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`单菜特殊价格必须是大于 0 的有限数字：${price}`);
    }

    await expect(this.locators.itemPriceDiscountDialog).toBeVisible();
    const centsText = String(Math.round(price * 100));
    const keypadInputs =
      centsText.endsWith('00') && centsText.length > 2
        ? [...centsText.slice(0, -2), 'double-zero']
        : [...centsText];

    for (const keypadInput of keypadInputs) {
      if (keypadInput === 'double-zero') {
        await this.locators.itemPriceDiscountDoubleZeroButton.click();
      } else {
        await this.locators.itemPriceDiscountNumberButton(keypadInput).click();
      }
    }

    await expect(this.locators.itemPriceDiscountValue).toContainText(price.toFixed(2));
  }

  @step((discountName: string) => `页面操作：选择单菜折扣 ${discountName}`)
  async selectItemDiscount(discountName: string): Promise<void> {
    await expect(this.locators.itemPriceDiscountDialog).toBeVisible();
    const discountOption = this.locators.itemPriceDiscountOption(discountName);
    await expect(discountOption).toBeVisible();
    await discountOption.click();
    await expect(discountOption).toHaveAttribute('aria-pressed', 'true');
  }

  @step('页面操作：确认菜品价格与折扣并等待授权口令弹窗')
  async confirmItemPriceAndDiscountForAuthorization(): Promise<void> {
    await expect(this.locators.itemPriceDiscountDialog).toBeVisible();
    await waitForInputSettled(undefined, 250);
    await this.locators.itemPriceDiscountConfirmButton.click();
    await expect(this.locators.itemPriceAuthorizationForm).toBeVisible();
  }

  @step('页面操作：输入授权员工口令并完成单菜价格与折扣修改')
  async authorizeItemPriceAndDiscount(passcode: string): Promise<void> {
    if (!/^\d+$/.test(passcode)) {
      throw new Error('单菜价格与折扣授权口令必须只包含数字。');
    }

    await expect(this.locators.itemPriceAuthorizationForm).toBeVisible();
    for (const digit of passcode) {
      await this.locators.itemPriceAuthorizationDigitButton(digit).click();
    }

    const authorizationInput = this.locators.itemPriceAuthorizationForm.locator('input');
    await waitForInputSettled(authorizationInput);
    const loginResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().endsWith('/kpos/api/login') && response.request().method() === 'POST',
    );
    await this.locators.itemPriceAuthorizationConfirmButton.click();
    const loginResponse = await loginResponsePromise;

    if (!loginResponse.ok()) {
      throw new Error(`单菜价格与折扣授权失败：HTTP ${loginResponse.status()}`);
    }

    const loginBody = (await loginResponse.json()) as { code?: unknown; msg?: unknown };
    if (loginBody.code !== 0) {
      throw new Error(`单菜价格与折扣授权失败：code=${String(loginBody.code)} msg=${String(loginBody.msg)}`);
    }

    await expect(this.locators.itemPriceAuthorizationForm).toBeHidden();
    await expect(
      this.locators.itemPriceDiscountDialog,
      '授权接口成功后价格与折扣弹窗应关闭并应用所选折扣；若仍可见则为产品未继续原操作',
    ).toBeHidden({ timeout: 5_000 });
  }
}

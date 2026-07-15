import { expect } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import { PaymentPage } from '../payment.page';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';

export class OrderDishesCustomerSection {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
  ) {}

  private get page() {
    return this.ctx.page;
  }

  private get locators() {
    return this.ctx.locators;
  }

  @step('页面操作：点击 Pay 并确认客户信息弹窗已显示')
  async openCustomerDialogForPayment(): Promise<void> {
    await this.host.expectLoaded();
    await this.locators.payButton.click({ timeout: 15_000 });
    await expect(this.locators.customerDialog).toBeVisible();
    await expect(this.locators.customerDialogHeading).toBeVisible();
  }

  @step('页面操作：确认空客户信息并校验姓名必填提示')
  async confirmEmptyCustomerAndExpectNameRequired(): Promise<void> {
    await this.locators.customerConfirmButton.click();
    await expect(this.locators.customerNameRequiredMessage).toBeVisible();
  }

  @step((name: string) => `页面操作：填写客户姓名 ${name}`)
  async fillCustomerName(name: string): Promise<void> {
    await this.locators.customerNameInput.fill(name);
  }

  @step('页面操作：确认仅填写姓名的客户信息并校验电话必填提示')
  async confirmCustomerNameAndExpectPhoneRequired(): Promise<void> {
    await this.locators.customerConfirmButton.click();
    await expect(this.locators.customerPhoneRequiredMessage).toBeVisible();
  }

  @step((phone: string) => `页面操作：填写客户电话 ${phone}`)
  async fillCustomerPhone(phone: string): Promise<void> {
    await this.locators.customerPhoneInput.fill(phone);
  }

  @step('页面操作：确认完整客户信息并进入支付页面')
  async confirmCustomerAndOpenPayment(): Promise<PaymentPage> {
    await waitForInputSettled();
    await this.locators.customerConfirmButton.click();
    const paymentPage = new PaymentPage(this.page);
    await paymentPage.expectLoaded();
    return paymentPage;
  }
}

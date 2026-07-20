import { expect } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import { PaymentPage } from '../payment.page';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';

export type OrderDishesCustomerInformationSnapshot = {
  customerName: string;
  informationText: string;
  normalizedPhone: string;
};

function normalizeCustomerText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

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

  @step((customerButtonLabel: string) => `页面操作：打开客户信息 ${customerButtonLabel}`)
  async openCustomerInformation(customerButtonLabel: string): Promise<void> {
    await this.host.expectLoaded();
    const customerInformationButton = this.locators.customerInformationButton(customerButtonLabel);
    await expect(customerInformationButton).toBeVisible();
    await customerInformationButton.click();

    if (await this.locators.customerInformationKeyboardCloseButton.isVisible().catch(() => false)) {
      await this.locators.customerInformationKeyboardCloseButton.click();
    }

    await expect(this.locators.customerInformationRegion).toBeVisible();
  }

  @step('页面读取：读取点单页客户按钮和客户信息区域文本')
  async readCustomerInformationSnapshot(
    customerButtonLabel: string,
  ): Promise<OrderDishesCustomerInformationSnapshot> {
    await expect(this.locators.customerInformationRegion).toBeVisible();
    const customerButtonText = normalizeCustomerText(
      await this.locators.customerInformationButton(customerButtonLabel).innerText(),
    );
    const formattedPhone = customerButtonText.match(/\(\d{3}\)\d{3}-\d{4}/)?.[0];

    if (!formattedPhone) {
      throw new Error(`客户按钮未显示可解析的格式化电话：${customerButtonText}`);
    }

    return {
      customerName: customerButtonText.slice(0, customerButtonText.indexOf(formattedPhone)).trim(),
      informationText: normalizeCustomerText(
        await this.locators.customerInformationRegion.innerText(),
      ),
      normalizedPhone: formattedPhone.replace(/\D/g, ''),
    };
  }

  @step('页面操作：保存点单页客户信息并关闭 Info 区域')
  async saveCustomerInformation(): Promise<void> {
    await expect(this.locators.customerInformationSaveButton).toBeVisible();
    await this.locators.customerInformationSaveButton.click();
    await expect(this.locators.customerInformationRegion).toBeHidden();
  }

  @step('页面读取：读取点单页客户摘要文本')
  async readOrderCustomerSummaryText(customerButtonLabel: string): Promise<string> {
    await this.host.expectLoaded();
    const addressSummary = this.locators.orderCustomerAddressSummary(customerButtonLabel);
    await expect(addressSummary).toBeVisible();
    return normalizeCustomerText(await addressSummary.innerText());
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

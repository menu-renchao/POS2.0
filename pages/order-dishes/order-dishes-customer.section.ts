import { expect, type Locator } from '@playwright/test';
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

export type OrderDishesCustomerInformationInput = {
  address?: string;
  customerName: string;
  phoneNumber: string;
};

export type OrderDishesCustomerIdentitySnapshot = {
  customerName: string;
  normalizedPhone: string;
};

function normalizeCustomerText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseCustomerButtonIdentity(customerButtonText: string): {
  customerName: string;
  formattedPhone: string;
} {
  const normalizedText = normalizeCustomerText(customerButtonText);
  const formattedPhone = normalizedText.match(/\(\d{3}\)\d{3}-\d{4}/)?.[0];

  if (!formattedPhone) {
    throw new Error(`客户按钮未显示可解析的格式化电话：${normalizedText}`);
  }

  return {
    customerName: normalizedText.slice(0, normalizedText.indexOf(formattedPhone)).trim(),
    formattedPhone,
  };
}

export class OrderDishesCustomerSection {
  private lastEditedInformationInput: Locator | null = null;

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

  @step('页面操作：打开空客户信息编辑区域')
  async openEmptyCustomerInformation(): Promise<void> {
    await this.host.expectLoaded();
    await expect(this.locators.emptyCustomerInformationButton).toBeVisible();
    await this.locators.emptyCustomerInformationButton.click();

    if (await this.locators.customerInformationKeyboardCloseButton.isVisible().catch(() => false)) {
      await this.locators.customerInformationKeyboardCloseButton.click();
    }

    await expect(this.locators.customerInformationPageHeading).toBeVisible();
  }

  @step(
    (customer: OrderDishesCustomerInformationInput) =>
      `页面操作：填写点单页客户姓名 ${customer.customerName} 和电话 ${customer.phoneNumber}`,
  )
  async fillCustomerInformation(customer: OrderDishesCustomerInformationInput): Promise<void> {
    await expect(this.locators.customerInformationPageHeading).toBeVisible();
    await this.locators.customerInformationPhoneInput.fill(customer.phoneNumber);
    await this.locators.customerInformationNameInput.fill(customer.customerName);
    this.lastEditedInformationInput = this.locators.customerInformationNameInput;
    if (customer.address !== undefined) {
      await this.locators.customerInformationAddressInput.fill(customer.address);
      this.lastEditedInformationInput = this.locators.customerInformationAddressInput;
    }
  }

  @step((customerButtonLabel: string) => `页面读取：读取点单页客户按钮 ${customerButtonLabel}`)
  async readCustomerButtonText(customerButtonLabel: string): Promise<string> {
    const customerInformationButton = this.locators.customerInformationButton(customerButtonLabel);
    await expect(customerInformationButton).toBeVisible();
    return normalizeCustomerText(await customerInformationButton.innerText());
  }

  @step((customerButtonLabel: string) => `页面操作：打开点单页客户 Information 页面 ${customerButtonLabel}`)
  async openCustomerInformationPage(customerButtonLabel: string): Promise<void> {
    await this.host.expectLoaded();
    await this.locators.customerInformationButton(customerButtonLabel).click();

    if (await this.locators.customerInformationKeyboardCloseButton.isVisible().catch(() => false)) {
      await this.locators.customerInformationKeyboardCloseButton.click();
    }

    await expect(this.locators.customerInformationPageHeading).toBeVisible();
  }

  @step('页面读取：读取客户 Information 页面中的姓名和电话')
  async readCustomerInformationPageIdentity(): Promise<OrderDishesCustomerIdentitySnapshot> {
    await expect(this.locators.customerInformationPageHeading).toBeVisible();

    return {
      customerName: await this.locators.customerInformationNameInput.inputValue(),
      normalizedPhone: (await this.locators.customerInformationPhoneInput.inputValue()).replace(
        /\D/g,
        '',
      ),
    };
  }

  @step('页面操作：保存客户 Information 页面并返回点单页')
  async saveCustomerInformationPage(): Promise<void> {
    await expect(this.locators.customerInformationPageHeading).toBeVisible();
    if (this.lastEditedInformationInput) {
      await waitForInputSettled(this.lastEditedInformationInput);
    }
    await this.locators.customerInformationSaveButton.click();
    await expect(this.locators.customerInformationPageHeading).toBeHidden();
    this.lastEditedInformationInput = null;
  }

  @step((customerButtonLabel: string) => `页面操作：打开客户信息 ${customerButtonLabel}`)
  async openCustomerInformation(customerButtonLabel: string): Promise<void> {
    await this.host.expectLoaded();
    const { customerName, formattedPhone } = parseCustomerButtonIdentity(customerButtonLabel);
    const customerInformationButton = this.locators.customerInformationButton(customerButtonLabel);
    await expect(customerInformationButton).toBeVisible();
    await customerInformationButton.click();

    if (await this.locators.customerInformationKeyboardCloseButton.isVisible().catch(() => false)) {
      await this.locators.customerInformationKeyboardCloseButton.click();
    }

    await expect(
      this.locators.customerInformationRegion(customerName, formattedPhone),
    ).toBeVisible();
  }

  @step('页面读取：读取点单页客户按钮和客户信息区域文本')
  async readCustomerInformationSnapshot(
    customerButtonLabel: string,
  ): Promise<OrderDishesCustomerInformationSnapshot> {
    const customerButtonText = normalizeCustomerText(
      await this.locators.customerInformationButton(customerButtonLabel).innerText(),
    );
    const { customerName, formattedPhone } = parseCustomerButtonIdentity(customerButtonText);
    const customerInformationRegion = this.locators.customerInformationRegion(
      customerName,
      formattedPhone,
    );
    await expect(customerInformationRegion).toBeVisible();

    return {
      customerName,
      informationText: normalizeCustomerText(await customerInformationRegion.innerText()),
      normalizedPhone: formattedPhone.replace(/\D/g, ''),
    };
  }

  @step('页面操作：保存点单页客户信息并关闭 Info 区域')
  async saveCustomerInformation(): Promise<void> {
    await expect(this.locators.customerInformationSaveButton).toBeVisible();
    if (this.lastEditedInformationInput) {
      await waitForInputSettled(this.lastEditedInformationInput);
    }
    await this.locators.customerInformationSaveButton.click();
    await expect(this.locators.customerInformationPageHeading).toBeHidden();
    this.lastEditedInformationInput = null;
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
    await waitForInputSettled(this.locators.customerNameInput);
    await this.locators.customerConfirmButton.click();
    await expect(this.locators.customerPhoneRequiredMessage).toBeVisible();
  }

  @step((phone: string) => `页面操作：填写客户电话 ${phone}`)
  async fillCustomerPhone(phone: string): Promise<void> {
    await this.locators.customerPhoneInput.fill(phone);
  }

  @step('页面操作：确认完整客户信息并进入支付页面')
  async confirmCustomerAndOpenPayment(): Promise<PaymentPage> {
    await waitForInputSettled(this.locators.customerPhoneInput);
    await this.locators.customerConfirmButton.click();
    await expect(this.locators.customerDialog).toBeHidden({ timeout: 10_000 });

    const paymentPage = new PaymentPage(this.page);
    await paymentPage.expectLoaded();
    return paymentPage;
  }
}

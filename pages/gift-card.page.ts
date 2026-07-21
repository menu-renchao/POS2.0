import { expect, type Locator, type Page } from '@playwright/test';
import { waitForInputSettled } from '../utils/input-stability';
import { step } from '../utils/step';

export type PhysicalGiftCardInput = {
  cardNumber: string;
  customerName: string;
  phoneNumber: string;
};

export type PhysicalGiftCardFormSnapshot = {
  cardNumber: string;
  customerName: string;
  phoneNumber: string;
};

export type GiftCardSaveExchange = {
  requestBody: string;
  responseBody: string;
  status: number;
};

export class GiftCardPage {
  private readonly addNewCardButton: Locator;
  private readonly customerNameInput: Locator;
  private readonly cardNumberInput: Locator;
  private readonly phoneNumberInput: Locator;
  private readonly saveButton: Locator;
  private readonly networkErrorMessage: Locator;

  constructor(private readonly page: Page) {
    this.addNewCardButton = this.page.getByText('Add New Card', { exact: true });
    this.customerNameInput = this.page.locator('#vpCustName');
    this.cardNumberInput = this.page.locator('#vpCardNum');
    this.phoneNumberInput = this.page.locator('#vpPhoneNum');
    this.saveButton = this.page.locator('#vpCardeditbt');
    this.networkErrorMessage = this.page.getByText(
      'Network error, please check whether server working or network connect correctly!',
      { exact: true },
    );
  }

  @step('页面校验：确认礼品卡管理页面已经加载完成')
  async expectLoaded(): Promise<void> {
    await expect(this.addNewCardButton).toBeVisible({ timeout: 15_000 });
  }

  @step('页面操作：打开新增实体礼品卡表单')
  async openPhysicalCardForm(): Promise<void> {
    await this.addNewCardButton.click();
    await expect(this.customerNameInput).toBeVisible();
    await expect(this.cardNumberInput).toBeVisible();
    await expect(this.phoneNumberInput).toBeVisible();
    await expect(this.saveButton).toBeVisible();
  }

  @step('页面操作：填写实体礼品卡的姓名、卡号和手机号')
  async fillPhysicalCard(input: PhysicalGiftCardInput): Promise<void> {
    await this.customerNameInput.fill(input.customerName);
    await this.cardNumberInput.fill(input.cardNumber);
    await this.phoneNumberInput.fill(input.phoneNumber);
    await waitForInputSettled(this.phoneNumberInput);
  }

  @step('页面读取：读取实体礼品卡表单当前回显')
  async readPhysicalCardForm(): Promise<PhysicalGiftCardFormSnapshot> {
    return {
      cardNumber: await this.cardNumberInput.inputValue(),
      customerName: await this.customerNameInput.inputValue(),
      phoneNumber: await this.phoneNumberInput.inputValue(),
    };
  }

  @step('页面操作：保存实体礼品卡并读取保存请求结果')
  async savePhysicalCard(): Promise<GiftCardSaveExchange> {
    await waitForInputSettled(this.phoneNumberInput);

    const responsePromise = this.page.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === 'POST' &&
        new URL(response.url()).pathname === '/kpos/ws/kposService' &&
        (request.postData() ?? '').includes('SaveGiftCardType')
      );
    });

    await this.saveButton.click();
    const response = await responsePromise;

    return {
      requestBody: response.request().postData() ?? '',
      responseBody: await response.text().catch(() => ''),
      status: response.status(),
    };
  }

  @step('页面读取：读取礼品卡保存失败时的网络错误提示')
  async readNetworkErrorMessage(): Promise<string | null> {
    if (!(await this.networkErrorMessage.isVisible().catch(() => false))) {
      return null;
    }

    return (await this.networkErrorMessage.innerText()).trim();
  }
}

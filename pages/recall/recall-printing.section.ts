import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { step } from '../../utils/step';
import type { RecallOrderActionsSection } from './recall-order-actions.section';
import type {
  RecallKitchenTicketResult,
  RecallResendResult,
} from './recall.types';

export class RecallPrintingSection {
  private readonly resendConfirmButton: Locator;
  private readonly resendDialog: Locator;

  constructor(
    private readonly page: Page,
    private readonly actions: RecallOrderActionsSection,
  ) {
    this.resendDialog = page.getByLabel('Resend to Kitchen');
    this.resendConfirmButton = this.resendDialog.getByRole('button', {
      name: 'Resend',
      exact: true,
    });
  }

  @step('页面操作：点击 Recall 订单详情中的 Send 按钮')
  async clickSend(): Promise<void> {
    await this.actions.click('send');
  }

  @step('页面操作：点击 Recall 订单详情中的 Print 按钮')
  async clickPrint(): Promise<void> {
    await this.actions.click('print');
  }

  @step('页面操作：点击 Recall 订单详情中的 Send 并等待送厨接口成功')
  async sendAndReadKitchenTicketStatus(): Promise<number> {
    const response = await this.clickAndWaitForResponse(
      'send',
      '/kpos/api/print/kitchen/ticket',
    );
    return response.status();
  }

  @step('页面操作：点击 Recall 订单详情中的 Print 并读取打单结果')
  async printAndReadKitchenTicketResult(): Promise<RecallKitchenTicketResult> {
    const response = await this.clickAndWaitForResponse(
      'print',
      '/kpos/api/print/kitchen/ticket',
    );
    const responseBody = (await response.json()) as unknown;
    const responseCode =
      isRecord(responseBody) && 'code' in responseBody
        ? responseBody.code
        : null;

    if (responseCode !== 0) {
      throw new Error(`Recall 订单打单接口业务响应失败：${JSON.stringify(responseBody)}`);
    }

    return {
      httpStatus: response.status(),
      orderStatus: readKitchenTicketOrderStatus(responseBody),
    };
  }

  @step('页面操作：点击 Recall 订单详情中的 Print 并等待小票打印接口成功')
  async printAndReadReceiptStatus(): Promise<number> {
    const response = await this.clickAndWaitForResponse(
      'print',
      '/kpos/api/print/receipt',
    );
    return response.status();
  }

  @step('页面操作：点击 Recall 订单详情中的 Reprint 并等待小票打印接口成功')
  async reprintAndReadReceiptStatus(): Promise<number> {
    const response = await this.clickAndWaitForResponse(
      'reprint',
      '/kpos/api/print/receipt',
    );
    return response.status();
  }

  @step((dishNames: readonly string[]) =>
    `页面操作：从 Recall 对菜品 ${dishNames.join('、')} 执行 Resend`,
  )
  async resendDishes(dishNames: readonly string[]): Promise<RecallResendResult> {
    if (dishNames.length === 0) {
      throw new Error('Resend 至少需要选择一道菜。');
    }

    await this.actions.click('resend');
    await expect(this.resendDialog).toBeVisible({ timeout: 10_000 });
    for (const dishName of dishNames) {
      const dishLabel = this.resendDialog
        .getByText(dishName, { exact: true })
        .first();
      await expect(dishLabel).toBeVisible();
      await dishLabel.click();
    }

    const [response] = await Promise.all([
      this.waitForPrintResponse('/kpos/api/print/kitchen/ticket'),
      this.resendConfirmButton.click(),
    ]);
    await this.assertResponseOk(response, 'Recall Resend 送厨');

    return {
      httpStatus: response.status(),
      selectedDishes: [...dishNames],
    };
  }

  @step((action: 'send' | 'print' | 'reprint', pathname: string) =>
    `页面操作：点击 Recall ${action} 并等待接口 ${pathname}`,
  )
  private async clickAndWaitForResponse(
    action: 'send' | 'print' | 'reprint',
    pathname: string,
  ): Promise<Response> {
    const [response] = await Promise.all([
      this.waitForPrintResponse(pathname),
      this.actions.click(action),
    ]);
    await this.assertResponseOk(response, `Recall 订单 ${action}`);
    return response;
  }

  @step((pathname: string) => `页面操作：等待 Recall 打印接口 ${pathname}`)
  private async waitForPrintResponse(pathname: string): Promise<Response> {
    return await this.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith(pathname),
      { timeout: 15_000 },
    );
  }

  @step((_: Response, operation: string) => `页面校验：${operation} 接口响应成功`)
  private async assertResponseOk(
    response: Response,
    operation: string,
  ): Promise<void> {
    if (!response.ok()) {
      throw new Error(
        `${operation}接口失败：${response.status()} ${response.url()}`,
      );
    }
  }
}

function readKitchenTicketOrderStatus(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.data.order)) {
    return null;
  }

  return typeof value.data.order.status === 'string'
    ? value.data.order.status
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

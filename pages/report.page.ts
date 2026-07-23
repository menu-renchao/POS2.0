import type { FrameLocator, Locator, Page } from '@playwright/test';
import { waitForInputSettled } from '../utils/input-stability';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

export class ReportPage {
  private readonly passcodeInput: Locator;
  private readonly confirmButton: Locator;
  private readonly reportFrame: FrameLocator;
  private readonly reportBody: Locator;

  constructor(page: Page) {
    this.passcodeInput = page.getByTestId('pos-ui-password-input-hidden-input');
    this.confirmButton = page.getByRole('button', { name: 'confirm' });
    this.reportFrame = page.frameLocator('iframe#thirdAppIframe');
    this.reportBody = this.reportFrame.locator('body');
  }

  @step((passcode: string) => `页面操作：输入报表口令 ${passcode} 并进入云报表`)
  async enterWithPasscode(passcode: string): Promise<void> {
    await this.passcodeInput.fill(passcode);
    await waitForInputSettled(this.passcodeInput);
    await this.confirmButton.click();
  }

  @step((metric: 'Fee' | 'Unpaid') => `页面读取：读取报表首页 ${metric} 金额`)
  async readOverviewAmount(metric: 'Fee' | 'Unpaid'): Promise<number> {
    const metricPattern = new RegExp(
      `${metric}\\s*\\$?\\s*(-?\\d+(?:,\\d{3})*(?:\\.\\d{1,2})?)`,
      'i',
    );
    const loadFailurePattern =
      /GET LAST UPDATE TIME FAILED|LASTUPDATETIME|FAILED:|TYPEERROR/i;

    const reportState = await waitUntil(
      async () => {
        const bodyText = await this.reportBody
          .innerText({ timeout: 1_000 })
          .catch(() => '');
        return {
          bodyText,
          metricMatch: bodyText.match(metricPattern),
          loadFailed: loadFailurePattern.test(bodyText),
        };
      },
      (state) => state.loadFailed || state.metricMatch !== null,
      {
        timeout: 30_000,
        interval: 500,
        message: `云报表首页未展示 ${metric} 金额。`,
      },
    );

    if (reportState.loadFailed) {
      throw new Error(`云报表加载失败：${reportState.bodyText.trim()}`);
    }

    const amount = Number(reportState.metricMatch?.[1].replaceAll(',', ''));
    if (!Number.isFinite(amount)) {
      throw new Error(`云报表首页 ${metric} 金额无法解析：${reportState.bodyText.trim()}`);
    }

    return amount;
  }
}

import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../utils/step';
import { normalizeOrderNumber } from '../utils/text';
import { waitUntil } from '../utils/wait';

export class PickupScreenPage {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = this.page.locator('#root');
  }

  @step('页面操作：确认叫号屏已经加载完成')
  async expectLoaded(): Promise<void> {
    await expect(this.root).toBeVisible({ timeout: 15_000 });
  }

  @step((_orderNumber: string) => `页面读取：确认叫号屏展示订单 ${_orderNumber}`)
  async expectOrderVisible(orderNumber: string, timeout = 15_000): Promise<void> {
    const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
    const orderNumberText = this.root.getByText(normalizedOrderNumber, { exact: true });

    await waitUntil(
      async () => await orderNumberText.isVisible().catch(() => false),
      (isVisible) => isVisible,
      {
        timeout,
        interval: 200,
        message: `叫号屏未展示订单 ${normalizedOrderNumber}。`,
      },
    );
  }

  @step('页面读取：读取叫号屏当前文本')
  async readScreenText(): Promise<string> {
    return (await this.root.innerText()).replace(/\s+/g, ' ').trim();
  }

  @step('页面操作：关闭叫号屏标签页')
  async close(): Promise<void> {
    await this.page.close();
  }
}

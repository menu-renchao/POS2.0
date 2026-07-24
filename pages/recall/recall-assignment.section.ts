import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import type { OrderDetailsContext } from '../shared/order-details/order-details-context';
import { recallScopedTestId } from './recall-reads.section';

export class RecallAssignmentSection {
  private readonly driverButton: Locator;
  private readonly serverButton: Locator;
  private readonly serverOption: (serverName: string) => Locator;
  private readonly visibleDriverList: Locator;

  constructor(
    page: Page,
    context: OrderDetailsContext,
  ) {
    this.serverButton = recallScopedTestId(
      context.dialog,
      'shared-order-detail-action-server',
    );
    this.driverButton = context.dialog.getByRole('button', {
      name: /^DriverIcon\s+/,
    });
    this.serverOption = (serverName: string) =>
      page
        .locator('[data-testid^="dropdown-item-"]:visible')
        .filter({ has: page.getByText(serverName, { exact: true }) })
    this.visibleDriverList = page
      .getByRole('list')
      .filter({ visible: true })
      .last();
  }

  @step((serverName: string) => `页面操作：将 Recall 订单服务员切换为 ${serverName}`)
  async changeServer(serverName: string): Promise<void> {
    await expect(this.serverButton).toBeVisible();
    await this.serverButton.click();

    const serverOption = this.serverOption(serverName);
    await expect(serverOption).toBeVisible();
    await serverOption.click();
    await expect(this.serverButton).toContainText(serverName);
  }

  @step((driverName: string) => `页面操作：将 Recall 订单司机切换为 ${driverName}`)
  async changeDriver(driverName: string): Promise<void> {
    await expect(this.driverButton).toBeVisible();
    await this.driverButton.click();

    const driverOption = this.visibleDriverList.getByText(driverName, {
      exact: true,
    });
    await expect(driverOption).toBeVisible();
    await driverOption.click();
    await expect(this.driverButton).toContainText(driverName);
  }

  @step('页面读取：读取 Recall 订单当前司机')
  async readDriverName(): Promise<string> {
    await expect(this.driverButton).toBeVisible();
    return (await this.driverButton.innerText()).replace(/\s+/g, ' ').trim();
  }
}

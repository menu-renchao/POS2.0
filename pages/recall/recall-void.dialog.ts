import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import { waitForInputSettled } from '../../utils/input-stability';
import { waitUntil } from '../../utils/wait';
import { readVisiblePosAlertText } from '../shared/pos-alert';
import type { RecallOrderDetailsDialog } from './recall-order-details.dialog';
import { recallScopedTestId } from './recall-reads.section';

export class RecallVoidDialog {
  private readonly unifiedVoidMoreButton: Locator;
  private readonly voidDialog: Locator;
  private readonly voidRestoreInventoryCheckbox: Locator;
  private readonly voidReasonOptions: Locator;
  private readonly voidNoteInput: Locator;
  private readonly voidSubmitButton: Locator;

  constructor(
    readonly page: Page,
    private readonly orderDetails: RecallOrderDetailsDialog,
  ) {
    this.unifiedVoidMoreButton = this.page
      .getByRole('button', { name: 'Void', exact: true })
      .filter({ visible: true });
    this.voidDialog = this.page
      .locator('[role="dialog"]:visible')
      .filter({ has: this.page.getByText('Void Reason', { exact: true }) })
      .last();
    this.voidRestoreInventoryCheckbox = recallScopedTestId(
      this.voidDialog,
      'shared-void-dialog-restore-inventory-checkbox',
    ).getByRole('checkbox');
    this.voidReasonOptions = this.voidDialog.getByRole('radio');
    this.voidNoteInput = this.voidDialog.getByRole('textbox', { name: /^Note$/i });
    this.voidSubmitButton = this.voidDialog.getByRole('button', { name: /^Void$/i });
  }

  @step('页面操作：对当前 Recall 订单详情执行 Void')
  async voidCurrentOrder(options: { restoreInventory?: boolean; reason?: string } = {}): Promise<void> {
    await this.submitCurrentOrderVoid(options);
    await this.orderDetails.dismissOrderDetailsDialogIfNeeded();
    await expect(this.orderDetails.orderDetailsDialog).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
  }

  @step('页面操作：对当前 Recall 子单执行 Void 并保留订单详情上下文')
  async voidCurrentOrderKeepingDetails(options: { restoreInventory?: boolean; reason?: string } = {}): Promise<void> {
    await this.submitCurrentOrderVoid(options);
  }

  @step('页面读取：打开 Recall Void 弹窗并读取作废原因数量')
  async readVoidReasonCount(): Promise<number> {
    await this.orderDetails.waitForOrderDetailsDialogReady();
    await this.openVoidActionFromOrderDetails();
    await this.waitForVoidDialogReady();

    const reasonCount = await this.countVisibleVoidReasonOptions();
    await this.closeVoidDialog();
    return reasonCount;
  }

  private async submitCurrentOrderVoid(options: { restoreInventory?: boolean; reason?: string } = {}): Promise<void> {
    const { restoreInventory = true, reason = 'test' } = options;

    await this.orderDetails.waitForOrderDetailsDialogReady();
    await this.openVoidActionFromOrderDetails();
    await this.waitForVoidDialogReady();
    await this.setVoidRestoreInventoryCheckbox(restoreInventory);

    await this.voidNoteInput.fill(reason);
    const keyboardCloseButton = this.page.getByTestId('pos-keyboard-button-{close}');

    if (await keyboardCloseButton.isVisible().catch(() => false)) {
      await keyboardCloseButton.click();
    }

    await waitForInputSettled(this.voidNoteInput);
    await this.voidSubmitButton.click();
    await expect(this.voidSubmitButton).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
  }

  @step('页面操作：Void Recall 列表第一张可见订单')
  async voidFirstVisibleOrder(options: { restoreInventory?: boolean; reason?: string } = {}): Promise<void> {
    await this.voidRecentVisibleOrder(options);
  }

  @step('页面操作：Void Recall 最近一笔可见订单')
  async voidRecentVisibleOrder(options: { restoreInventory?: boolean; reason?: string } = {}): Promise<void> {
    await this.orderDetails.openRecentOrderDetails();
    await this.voidCurrentOrder(options);
  }

  @step((restoreInventory: boolean) => `页面操作：将 Void 弹窗中的恢复库存切换为${restoreInventory ? '勾选' : '不勾选'}`)
  private async setVoidRestoreInventoryCheckbox(restoreInventory: boolean): Promise<void> {
    await expect(this.voidRestoreInventoryCheckbox).toBeVisible();
    await this.voidRestoreInventoryCheckbox.setChecked(restoreInventory);
    await expect(this.voidRestoreInventoryCheckbox).toBeChecked({ checked: restoreInventory });
  }

  @step('页面操作：在 Recall 订单详情中打开 Void 操作')
  private async openVoidActionFromOrderDetails(): Promise<void> {
    await this.orderDetails.waitForOrderDetailsDialogReady();
    await this.orderDetails.clickOrderDetailsMoreButton();
    await expect(this.unifiedVoidMoreButton).toBeVisible({ timeout: 10_000 });
    await this.unifiedVoidMoreButton.click();
  }

  @step('页面操作：等待 Void 弹窗完成展示')
  private async waitForVoidDialogReady(): Promise<void> {
    await waitUntil(
      async () => ({
        noteEditable: await this.voidNoteInput.isEditable().catch(() => false),
        submitVisible: await this.voidSubmitButton.isVisible().catch(() => false),
      }),
      ({ noteEditable, submitVisible }) => noteEditable && submitVisible,
      {
        timeout: 5_000,
        interval: 100,
        message: 'Recall Void 弹窗未完成展示。',
      },
    );
  }

  @step('页面读取：统计可见 Void 原因选项数量')
  private async countVisibleVoidReasonOptions(): Promise<number> {
    return await this.voidReasonOptions.count();
  }

  @step('页面操作：关闭 Recall Void 弹窗')
  private async closeVoidDialog(): Promise<void> {
    if (!(await this.voidDialog.isVisible().catch(() => false))) {
      return;
    }

    const cancelButton = this.voidDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });

    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click();
      await expect(this.voidDialog).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
      return;
    }

    await this.page.keyboard.press('Escape');
    await expect(this.voidDialog).toBeHidden({ timeout: 5_000 }).catch(() => undefined);
  }

  @step('页面操作：尝试对当前 Recall 订单详情执行 Void 并读取阻断提示')
  async attemptVoidCurrentOrder(
    options: { restoreInventory?: boolean; reason?: string } = {},
  ): Promise<string | null> {
    await this.submitCurrentOrderVoid(options);

    const blockingMessage = await readVisiblePosAlertText(this.page, 5_000).catch(() => null);

    if (blockingMessage) {
      return blockingMessage;
    }

    await expect(this.orderDetails.orderDetailsDialog).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
    return null;
  }

}

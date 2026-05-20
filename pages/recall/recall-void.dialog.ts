import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import { waitForInputSettled } from '../../utils/input-stability';
import { waitUntil } from '../../utils/wait';
import type { RecallOrderDetailsDialog } from './recall-order-details.dialog';
import { recallScopedTestId } from './recall-reads.section';

export class RecallVoidDialog {
  private readonly voidOrderButton: Locator;
  private readonly voidAllMoreButton: Locator;
  private readonly legacyVoidAllMoreButton: Locator;
  private readonly namedVoidAllMoreButton: Locator;
  private readonly voidDialog: Locator;
  private readonly voidRestoreInventoryCheckbox: Locator;
  private readonly labeledVoidRestoreInventoryCheckbox: Locator;
  private readonly voidNoteInput: Locator;
  private readonly voidSubmitButton: Locator;

  constructor(
    readonly page: Page,
    private readonly orderDetails: RecallOrderDetailsDialog,
  ) {
    this.voidOrderButton = recallScopedTestId(this.page, 'recall2-order-detail-void');
    this.voidAllMoreButton = recallScopedTestId(this.page, 'recall2-order-detail-void-all');
    this.legacyVoidAllMoreButton = this.page.locator('#pvoidod');
    this.namedVoidAllMoreButton = this.page.getByRole('button', { name: /^Void All$/i });
    this.voidDialog = this.page
      .locator('[role="dialog"]:visible')
      .filter({ has: this.page.getByText('Void Reason', { exact: true }) })
      .last();
    this.voidRestoreInventoryCheckbox = recallScopedTestId(
      this.voidDialog,
      'shared-void-dialog-restore-inventory-checkbox',
    );
    this.labeledVoidRestoreInventoryCheckbox = this.voidDialog.getByRole('checkbox', {
      name: /Restore inventory/i,
    });
    this.voidNoteInput = this.voidDialog.getByRole('textbox', { name: /^Note$/i });
    this.voidSubmitButton = this.voidDialog.getByRole('button', { name: /^Void$/i });
  }

  @step('页面操作：对当前 Recall 订单详情执行 Void')
  async voidCurrentOrder(options: { restoreInventory?: boolean; reason?: string } = {}): Promise<void> {
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

    await waitForInputSettled();
    await this.voidSubmitButton.click();
    await expect(this.voidSubmitButton).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
    await this.orderDetails.dismissOrderDetailsDialogIfNeeded();
    await expect(this.orderDetails.orderDetailsDialog).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
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
    const restoreInventoryCheckbox = await this.resolveRestoreInventoryCheckbox();

    if (!restoreInventoryCheckbox) {
      return;
    }

    const checkboxChecked = await restoreInventoryCheckbox.isChecked().catch(() => null);

    if (checkboxChecked === null || checkboxChecked === restoreInventory) {
      return;
    }

    const visibleToggleTargets = [
      this.voidDialog.getByRole('button', { name: /Restore inventory/i }).first(),
      this.voidDialog.getByText(/Restore inventory/i).first(),
    ];

    for (const toggleTarget of visibleToggleTargets) {
      if (!(await toggleTarget.isVisible().catch(() => false))) {
        continue;
      }

      await toggleTarget.click({ force: true }).catch(() => undefined);

      const toggledState = await restoreInventoryCheckbox.isChecked().catch(() => null);

      if (toggledState === restoreInventory) {
        return;
      }
    }

    await restoreInventoryCheckbox.evaluate((checkboxElement, nextChecked) => {
      const checkbox = checkboxElement as HTMLInputElement;

      if (checkbox.checked === nextChecked) {
        return;
      }

      const checkedSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'checked',
      )?.set;

      checkedSetter?.call(checkbox, nextChecked);
      checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }, restoreInventory);

    await waitUntil(
      async () => await restoreInventoryCheckbox.isChecked().catch(() => null),
      (checked) => checked === restoreInventory,
      {
        timeout: 5_000,
        message: 'Void dialog restore inventory checkbox did not reach the expected state.',
      },
    );
  }

  @step('页面操作：在 Recall 订单详情中打开 Void 操作')
  private async openVoidActionFromOrderDetails(): Promise<void> {
    await this.orderDetails.waitForOrderDetailsDialogReady();

    if (await this.voidOrderButton.isVisible().catch(() => false)) {
      await this.voidOrderButton.click();
      return;
    }

    if (await this.voidAllMoreButton.isVisible().catch(() => false)) {
      await this.voidAllMoreButton.click();
      return;
    }

    if (await this.legacyVoidAllMoreButton.isVisible().catch(() => false)) {
      await this.legacyVoidAllMoreButton.click();
      return;
    }

    if (await this.namedVoidAllMoreButton.isVisible().catch(() => false)) {
      await this.namedVoidAllMoreButton.click();
      return;
    }

    await this.orderDetails.clickOrderDetailsMoreButton();

    const visibleAction = await waitUntil(
      async () => {
        if (await this.voidOrderButton.isVisible().catch(() => false)) {
          return 'void';
        }

        if (await this.voidAllMoreButton.isVisible().catch(() => false)) {
          return 'void-all';
        }

        if (await this.legacyVoidAllMoreButton.isVisible().catch(() => false)) {
          return 'void-all';
        }

        if (await this.namedVoidAllMoreButton.isVisible().catch(() => false)) {
          return 'void-all';
        }

        return null;
      },
      (action): action is 'void' | 'void-all' => action !== null,
      {
        timeout: 3_000,
        interval: 100,
        message: 'Recall 订单详情 More 菜单未出现 Void 入口。',
      },
    ).catch(() => null);

    if (visibleAction === 'void') {
      await this.voidOrderButton.click();
      return;
    }

    if (visibleAction === 'void-all') {
      if (await this.voidAllMoreButton.isVisible().catch(() => false)) {
        await this.voidAllMoreButton.click();
        return;
      }

      if (await this.legacyVoidAllMoreButton.isVisible().catch(() => false)) {
        await this.legacyVoidAllMoreButton.click();
        return;
      }

      await this.namedVoidAllMoreButton.click();
      return;
    }

    throw new Error('Unable to find Void action in Recall order details.');
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

  private async resolveRestoreInventoryCheckbox(): Promise<Locator | null> {
    const checkboxCandidates = [
      this.voidRestoreInventoryCheckbox,
      this.labeledVoidRestoreInventoryCheckbox,
    ];

    for (const checkboxCandidate of checkboxCandidates) {
      if ((await checkboxCandidate.count().catch(() => 0)) > 0) {
        return checkboxCandidate;
      }
    }

    return null;
  }
}

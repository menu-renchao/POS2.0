import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../utils/step';
import type {
  RecallOrderDetailAction,
  RecallOrderDetailsMoreAction,
} from './recall.types';

const actionNames = {
  edit: 'Edit',
  send: 'Send',
  print: 'Print',
  reprint: 'Reprint',
  resend: 'Resend',
  pay: 'Pay',
  split: 'Split',
  discount: 'Discount',
  reopen: 'Reopen',
  more: 'More',
} as const satisfies Record<RecallOrderDetailAction, string>;

const moreActionNames = {
  charge: 'Charge',
  moveItem: 'Move Item',
  combine: 'Combine',
  tips: 'Tips',
  paging: 'Paging',
  callOff: 'Call Off',
  clearTable: 'Clear Table',
  copy: 'Copy',
  void: 'Void',
  sort: 'Sort',
} as const satisfies Record<RecallOrderDetailsMoreAction, string>;

const detailActions = Object.keys(actionNames) as RecallOrderDetailAction[];

export class RecallOrderActionsSection {
  private readonly moreButton: Locator;

  constructor(
    private readonly page: Page,
    private readonly orderDetailsDialog: Locator,
  ) {
    this.moreButton = this.orderDetailsDialog.getByRole('button', {
      name: /\bMore$/,
    });
  }

  @step((action: RecallOrderDetailAction) =>
    `页面操作：点击 Recall 订单详情中的 ${actionNames[action]} 按钮`,
  )
  async click(action: RecallOrderDetailAction): Promise<void> {
    const actionButton =
      action === 'more'
        ? this.moreButton
        : this.orderDetailsDialog.getByRole('button', {
            name: actionNames[action],
            exact: true,
          });

    await expect(actionButton).toBeVisible({ timeout: 10_000 });
    await actionButton.click();
  }

  @step('页面读取：读取 Recall 订单详情可用操作')
  async readAvailable(): Promise<Record<RecallOrderDetailAction, boolean>> {
    const entries = await Promise.all(
      detailActions.map(async (action) => {
        const actionButton =
          action === 'more'
            ? this.moreButton
            : this.orderDetailsDialog.getByRole('button', {
                name: actionNames[action],
                exact: true,
              });

        return [
          action,
          await actionButton.isVisible().catch(() => false),
        ] as const;
      }),
    );

    return Object.fromEntries(entries) as Record<
      RecallOrderDetailAction,
      boolean
    >;
  }

  @step('页面操作：打开 Recall 订单详情 More 菜单')
  async openMore(): Promise<void> {
    await expect(this.moreButton).toBeVisible({ timeout: 10_000 });
    await this.moreButton.click();
  }

  @step((action: RecallOrderDetailsMoreAction) =>
    `页面操作：点击 Recall 订单详情 More 菜单中的 ${moreActionNames[action]} 按钮`,
  )
  async clickMore(action: RecallOrderDetailsMoreAction): Promise<void> {
    await this.openMore();
    const actionButton = this.page.getByRole('button', {
      name: moreActionNames[action],
      exact: true,
    });

    await expect(actionButton).toBeVisible({ timeout: 10_000 });
    await actionButton.click();
  }
}

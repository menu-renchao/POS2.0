import { expect, type Locator } from '@playwright/test';
import { step } from '../../utils/step';
import { HomePage } from '../home.page';
import { InventoryPage } from '../inventory.page';
import type { RecallPage } from '../recall.page';
import { PaymentPage } from '../payment.page';
import { SplitOrderPage } from '../split-order.page';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesLocators } from './order-dishes-locators';

export class OrderDishesPageNavigation {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: { expectLoaded(): Promise<void> },
  ) {}

  private get page() {
    return this.ctx.page;
  }

  private get locators(): OrderDishesLocators {
    return this.ctx.locators;
  }

    @step('页面操作：确认点餐页已加载')
    async expectLoaded(): Promise<void> {
      await expect(this.page).toHaveURL(/#orderDishes/, { timeout: 15_000 });
      await expect(await this.resolveBackButton()).toBeVisible();
      await expect(await this.resolveSendButton()).toBeVisible();
      await expect(await this.resolvePayButton()).toBeVisible();
    }


    @step('页面操作：保存订单')
    async saveOrder(): Promise<HomePage> {
      await (await this.resolveSaveOrderButton()).click();
      await this.dismissPostSaveDialogsIfNeeded();
      return new HomePage(this.page);
    }

    @step('页面操作：点击 Send 送厨订单')
    async sendOrder(): Promise<HomePage> {
      await this.host.expectLoaded();
      await (await this.resolveSendButton()).click();
      return new HomePage(this.page);
    }

    @step('页面操作：点击 Save 保存订单但不假设页面跳转')
    async clickSaveOrder(): Promise<void> {
      await this.host.expectLoaded();
      await (await this.resolveSaveOrderButton()).click();
      await this.dismissPostSaveDialogsIfNeeded();
    }

    @step('页面读取：读取库存不足提示文案')
    async readInventoryAlertText(): Promise<string> {
      const alertBody = this.page
        .getByText('Insufficient stock, please modify the order.', { exact: true })
        .locator('xpath=..');

      await expect(alertBody).toBeVisible({ timeout: 10_000 });

      return (await alertBody.innerText()).replace(/\s*\n\s*/g, '\n').trim();
    }

    @step('页面操作：打开库存管理页')
    async openInventoryPage(): Promise<InventoryPage> {
      await this.host.expectLoaded();
      await (await this.resolveHeaderMoreButton()).click();
      await (await this.resolveInventoryMenuItem()).click();

      const inventoryPage = new InventoryPage(this.page);
      await inventoryPage.expectLoaded();
      return inventoryPage;
    }

    @step('页面操作：退出点单页')
    async exitOrderPage(): Promise<void> {
      await this.host.expectLoaded();
      const exitButton = await this.ctx.resolveVisibleLocator(
        [
          this.page.getByRole('button', { name: /^Back$/ }).first(),
          this.locators.appFrame.getByRole('button', { name: /^Back$/ }).first(),
          this.ctx.scopedLocator('#odBack'),
        ],
        'Unable to find order-dishes exit button.',
      );
      await exitButton.click();

      if (await this.locators.exitConfirmButton.isVisible().catch(() => false)) {
        await this.locators.exitConfirmButton.click();
      }
    }

    @step('页面操作：从点单页顶部点击 Recall 入口')
    async clickRecall(): Promise<RecallPage> {
      await this.host.expectLoaded();
      await (await this.resolveHeaderRecallButton()).click();

      const { RecallPage } = await import('../recall.page.js');
      const recallPage = new RecallPage(this.page);
      await recallPage.expectLoaded();

      return recallPage;
    }

    @step('页面操作：从点单页点击 Pay 并进入支付页面')
    async openPayment(): Promise<PaymentPage> {
      await this.host.expectLoaded();
      await (await this.resolvePayButton()).click();

      const paymentPage = new PaymentPage(this.page);
      await paymentPage.expectLoaded();

      return paymentPage;
    }

    @step('页面操作：点击 Split 并打开分单面板')
    async openSplitOrder(): Promise<SplitOrderPage> {
      await this.host.expectLoaded();
      await (await this.resolveSplitButton()).evaluate((buttonElement) => {
        (buttonElement as HTMLElement).click();
      });

      const splitOrderPage = new SplitOrderPage(this.page);
      await splitOrderPage.expectLoaded();

      return splitOrderPage;
    }

    @step('页面操作：关闭保存订单后的提示或删菜原因弹窗')
    private async dismissPostSaveDialogsIfNeeded(): Promise<void> {
      const gotItButton = this.page.getByRole('button', { name: /^I Got it$/i });

      if (await gotItButton.isVisible().catch(() => false)) {
        await gotItButton.click();
      }

      const voidReasonConfirmButton = this.page.locator(
        '[data-test-id="order-dishes-save-void-reason-confirm"], [data-testid="order-dishes-save-void-reason-confirm"]',
      );

      if (!(await voidReasonConfirmButton.isVisible().catch(() => false))) {
        return;
      }

      const voidReasonOption = this.page
        .locator(
          '[data-test-id="order-dishes-save-void-reason-option-1"], [data-testid="order-dishes-save-void-reason-option-1"]',
        )
        .first();

      if (await voidReasonOption.isVisible().catch(() => false)) {
        await voidReasonOption.click();
      }

      await voidReasonConfirmButton.click();
    }

    private async resolveHeaderMoreButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [this.page.getByTestId('icon-button-more').first(), this.locators.appFrame.getByTestId('icon-button-more').first()],
        'Unable to find order-dishes header More button.',
      );
    }

    private async resolveInventoryMenuItem(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.page.getByTestId('dropdown-item-inventory').first(),
          this.page.getByRole('menuitem', { name: 'Inventory' }).first(),
          this.locators.appFrame.getByTestId('dropdown-item-inventory').first(),
        ],
        'Unable to find Inventory entry in order-dishes More menu.',
      );
    }

    private async resolveBackButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByTestId('icon-button-Back').first(),
          this.locators.appFrame.getByRole('button', { name: /^Back$/ }).first(),
          this.page.getByTestId('icon-button-Back').first(),
          this.page.getByRole('button', { name: /^Back$/ }).first(),
        ],
        'Unable to find order-dishes Back button.',
      );
    }

    private async resolveHeaderRecallButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByRole('button', { name: /Recall/ }).first(),
          this.page.getByRole('button', { name: /Recall/ }).first(),
        ],
        'Unable to find order-dishes Recall button.',
      );
    }

    private async resolveSendButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame
            .locator(
              '[data-testid="bottom-button-sendOrderBtn"], [data-test-id="bottom-button-sendOrderBtn"]',
            )
            .or(this.locators.appFrame.getByRole('button', { name: 'Send' }))
            .first(),
          this.page
            .locator(
              '[data-testid="bottom-button-sendOrderBtn"], [data-test-id="bottom-button-sendOrderBtn"]',
            )
            .or(this.page.getByRole('button', { name: 'Send' }))
            .first(),
        ],
        'Unable to find order-dishes Send button.',
      );
    }

    private async resolvePayButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByRole('button', { name: 'Pay' }).first(),
          this.page.getByRole('button', { name: 'Pay' }).first(),
        ],
        'Unable to find order-dishes Pay button.',
      );
    }

    private async resolveSaveOrderButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame
            .locator(
              '[data-testid="bottom-button-saveOrderBtn"], [data-test-id="bottom-button-saveOrderBtn"]',
            )
            .or(this.locators.appFrame.getByRole('button', { name: /^(Save|保存)$/ }))
            .first(),
          this.page
            .locator(
              '[data-testid="bottom-button-saveOrderBtn"], [data-test-id="bottom-button-saveOrderBtn"]',
            )
            .or(this.page.getByRole('button', { name: /^(Save|保存)$/ }))
            .first(),
        ],
        'Unable to find order-dishes Save button.',
      );
    }

    private async resolveSplitButton(): Promise<Locator> {
      return await this.ctx.resolveVisibleLocator(
        [
          this.locators.appFrame.getByRole('button', { name: /^Split$/ }).first(),
          this.page.getByRole('button', { name: /^Split$/ }).first(),
          this.locators.appFrame.getByRole('button', { name: /^分单$/ }).first(),
          this.page.getByRole('button', { name: /^分单$/ }).first(),
          this.locators.splitButton,
        ],
        'Unable to find visible Split button on the order page.',
      );
    }
}

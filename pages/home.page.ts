import { expect, type Locator, type Page } from '@playwright/test';
import { AdminPage } from './admin.page';
import { DeliveryPage } from './delivery.page';
import { OrderDishesPage } from './order-dishes.page';
import { PickUpPage } from './pick-up.page';
import { RecallPage } from './recall.page';
import { ReportPage } from './report.page';
import { SelectTablePage } from './select-table.page';
import { appConfig } from '../test-data/env';
import { expectPathname } from '../utils/expectations';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { createHomeScope, type FrameOrHostScope } from './shared/locator-scope';
import type { HomeEntry } from './shared/page-method-contracts';

export class HomePage {
  private readonly scope: FrameOrHostScope;
  private readonly openDrawerButton: Locator;
  private readonly themeToggleButton: Locator;
  private readonly languageButton: Locator;
  private readonly supportButton: Locator;
  private readonly refreshButton: Locator;
  private readonly exitButton: Locator;
  private readonly refreshLoadingText: Locator;

  constructor(private readonly page: Page) {
    this.scope = createHomeScope(page);
    this.openDrawerButton = this.scope.appFrame.getByRole('button', { name: 'Open drawer' });
    this.themeToggleButton = this.scope.appFrame.getByTestId('pos-ui-theme-toggle');
    this.languageButton = this.scope.appFrame.getByTestId('icon-button-language');
    this.supportButton = this.scope.appFrame.getByTestId('icon-button-support');
    this.refreshButton = this.scope.appFrame.getByTestId('icon-button-refresh');
    this.exitButton = this.scope.appFrame.getByTestId('icon-button-exit');
    this.refreshLoadingText = this.page.locator('#floatmsgbx');
  }

  @step('页面操作：打开 POS 首页')
  async goto(): Promise<void> {
    await this.page.goto(appConfig.homePath);
  }

  @step('页面操作：确认 POS 首页已经加载完成')
  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveTitle(appConfig.homeTitle);
    await expectPathname(this.page, appConfig.homePath);
  }

  @step('页面操作：确认员工已经进入 POS 主页状态')
  async expectEmployeeReady(): Promise<void> {
    await expect(this.resolveFunctionButton('Dine In')).resolves.toBeDefined();
  }

  @step('页面操作：点击主页刷新按钮并等待刷新完成')
  async clickRefresh(): Promise<void> {
    await waitUntil(
      async () => ({
        isVisible: await this.refreshButton.isVisible().catch(() => false),
        isEnabled: await this.refreshButton.isEnabled().catch(() => false),
      }),
      (state) => state.isVisible && state.isEnabled,
      {
        timeout: 15_000,
        message: 'Home page refresh button is not ready.',
      },
    );

    await this.refreshButton.click({ timeout: 10_000 });
    await this.waitUntilRefreshCompleted();
    await this.expectEmployeeReady();
  }

  @step('页面操作：确认主页固定头部按钮已经可用')
  async expectPrimaryFunctionCardsVisible(): Promise<void> {
    await expect(this.themeToggleButton).toBeVisible();
    await expect(this.languageButton).toBeVisible();
    await expect(this.supportButton).toBeVisible();
    await expect(this.refreshButton).toBeVisible();
    await expect(this.exitButton).toBeVisible();
  }

  @step('页面操作：点击 Dine In 入口并进入选桌页')
  async enterDineIn(): Promise<SelectTablePage> {
    await this.clickFunctionButton('Dine In');
    const selectTablePage = new SelectTablePage(this.page);
    await selectTablePage.expectLoaded();
    return selectTablePage;
  }

  /** @deprecated 请使用 {@link enterDineIn} */
  async clickDineIn(): Promise<SelectTablePage> {
    return this.enterDineIn();
  }

  @step('页面操作：点击 Delivery 入口并进入 Delivery 页面')
  async enterDelivery(): Promise<DeliveryPage> {
    await this.clickFunctionButton('Delivery');
    const deliveryPage = new DeliveryPage(this.page);
    await deliveryPage.expectVisible();
    return deliveryPage;
  }

  /** @deprecated 请使用 {@link enterDelivery} */
  async clickDelivery(): Promise<DeliveryPage> {
    return this.enterDelivery();
  }

  @step('页面操作：点击 Pick Up 入口并进入 Pick Up 页面')
  async enterPickUp(): Promise<PickUpPage> {
    await this.clickFunctionButton('Pick Up');
    const pickUpPage = new PickUpPage(this.page);
    await pickUpPage.expectVisible();
    return pickUpPage;
  }

  /** @deprecated 请使用 {@link enterPickUp} */
  async clickPickUp(): Promise<PickUpPage> {
    return this.enterPickUp();
  }

  @step('页面操作：点击 To Go 入口并进入点单页')
  async enterToGo(): Promise<OrderDishesPage> {
    await waitUntil(
      async () => {
        const currentUrl = this.page.url();

        if (/#orderDishes/.test(currentUrl)) {
          return currentUrl;
        }

        const toGoButton = await this.resolveFunctionButton('To Go', 2_000).catch(() => null);

        if (toGoButton) {
          await toGoButton.click({ timeout: 3_000 }).catch(() => undefined);
        }

        return this.page.url();
      },
      (url) => /#orderDishes/.test(url),
      {
        timeout: 30_000,
        interval: 250,
        message: 'Home page did not navigate to order dishes after clicking To Go.',
      },
    );

    const orderDishesPage = new OrderDishesPage(this.page);
    await orderDishesPage.expectLoaded();
    return orderDishesPage;
  }

  /** @deprecated 请使用 {@link enterToGo} */
  async clickToGo(): Promise<OrderDishesPage> {
    return this.enterToGo();
  }

  @step('页面操作：点击 Report 入口并进入 Report 页面')
  async enterReport(): Promise<ReportPage> {
    await this.clickFunctionButton('Report');
    return new ReportPage(this.page);
  }

  /** @deprecated 请使用 {@link enterReport} */
  async clickReport(): Promise<ReportPage> {
    return this.enterReport();
  }

  @step('页面操作：点击 Admin 入口并进入 Admin 页面')
  async enterAdmin(): Promise<AdminPage> {
    await this.clickFunctionButton('Admin');
    return new AdminPage(this.page);
  }

  /** @deprecated 请使用 {@link enterAdmin} */
  async clickAdmin(): Promise<AdminPage> {
    return this.enterAdmin();
  }

  @step('页面操作：点击 Recall 入口并进入 Recall 页面')
  async enterRecall(): Promise<RecallPage> {
    await this.clickFunctionButton('Recall');
    const recallPage = new RecallPage(this.page);
    await recallPage.expectLoaded();
    return recallPage;
  }

  /** @deprecated 请使用 {@link enterRecall} */
  async clickRecall(): Promise<RecallPage> {
    return this.enterRecall();
  }

  @step((buttonName: HomeEntry) => `页面操作：点击主页中的 ${buttonName} 功能入口`)
  private async clickFunctionButton(buttonName: HomeEntry): Promise<void> {
    const button = await this.resolveFunctionButton(buttonName);
    await button.click({ timeout: 10_000 });
  }

  @step((buttonName: HomeEntry) => `页面操作：在主页中查找 ${buttonName} 功能入口，若未显示则展开更多菜单后查找`)
  private async resolveFunctionButton(buttonName: HomeEntry, timeout = 10_000): Promise<Locator> {
    const resolvedButton = await waitUntil(
      async () => {
        const visibleButton = await this.findVisibleFunctionButton(buttonName);

        if (visibleButton) {
          return visibleButton;
        }

        await this.openMoreMenu();
        return await this.findVisibleFunctionButton(buttonName);
      },
      (resolvedButton): resolvedButton is Locator => Boolean(resolvedButton),
      {
        timeout,
        message: `Unable to find function button on home page: ${buttonName}.`,
      },
    );

    if (!resolvedButton) {
      throw new Error(`Unable to find function button on home page: ${buttonName}.`);
    }

    return resolvedButton;
  }

  @step('页面操作：等待主页刷新完成')
  private async waitUntilRefreshCompleted(): Promise<void> {
    await waitUntil(
      async () => await this.refreshLoadingText.isVisible().catch(() => false),
      (isLoading) => isLoading,
      {
        timeout: 5_000,
        message: 'Home page refresh did not start.',
      },
    ).catch(() => undefined);

    await waitUntil(
      async () => ({
        isLoading: await this.refreshLoadingText.isVisible().catch(() => false),
        isRefreshEnabled: await this.refreshButton.isEnabled().catch(() => false),
      }),
      (state) => !state.isLoading && state.isRefreshEnabled,
      {
        timeout: 30_000,
        message: 'Home page did not finish refreshing in time.',
      },
    );

    await expect(this.refreshLoadingText).toBeHidden({ timeout: 30_000 });
  }

  @step('页面操作：点击更多菜单展开按钮')
  private async openMoreMenu(): Promise<void> {
    if (await this.openDrawerButton.isVisible().catch(() => false)) {
      await this.openDrawerButton.click();
    }
  }

  @step((buttonName: HomeEntry) => `页面操作：查找当前已显示的 ${buttonName} 功能入口`)
  private async findVisibleFunctionButton(buttonName: HomeEntry): Promise<Locator | null> {
    const buttons = this.resolveFunctionButtonLocator(buttonName);
    const count = await buttons.count();

    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);

      if (await button.isVisible().catch(() => false)) {
        return button;
      }
    }

    return null;
  }

  private resolveFunctionButtonLocator(buttonName: HomeEntry): Locator {
    return this.scope.appFrame.getByRole('button', { name: buttonName, exact: true });
  }
}

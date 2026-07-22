import { expect, type Locator, type Page } from '@playwright/test';
import { AdminPage } from './admin.page';
import { DeliveryPage } from './delivery.page';
import { GiftCardPage } from './gift-card.page';
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
import { HOME_ENTRY_TEST_IDS, type HomeEntry } from './shared/page-method-contracts';

export type DineInEntryPage = SelectTablePage | OrderDishesPage;
type DineInEntryState = 'selectTable' | 'orderDishes';
export type HomeLanguage = 'en' | 'zh-cn';

export class HomePage {
  private readonly scope: FrameOrHostScope;
  private readonly openDrawerButton: Locator;
  private readonly themeToggleButton: Locator;
  private readonly languageButton: Locator;
  private readonly supportButton: Locator;
  private readonly refreshButton: Locator;
  private readonly exitButton: Locator;
  private readonly refreshLoadingText: Locator;
  private readonly configurationRefreshDialog: Locator;
  private readonly configurationRefreshButton: Locator;
  private readonly customOrderType1Button: Locator;

  constructor(private readonly page: Page) {
    this.scope = createHomeScope(page);
    this.openDrawerButton = this.scope.appFrame.getByRole('button', { name: 'Open drawer' });
    this.themeToggleButton = this.scope.appFrame.getByTestId('pos-ui-theme-toggle');
    this.languageButton = this.scope.appFrame.getByTestId('icon-button-language');
    this.supportButton = this.scope.appFrame.getByTestId('icon-button-support');
    this.refreshButton = this.scope.appFrame.getByTestId('icon-button-refresh');
    this.exitButton = this.scope.appFrame.getByTestId('icon-button-exit');
    this.refreshLoadingText = this.page.locator('#floatmsgbx');
    this.configurationRefreshDialog = this.scope.appFrame.getByRole('alertdialog', {
      name: 'Notification',
    });
    this.configurationRefreshButton = this.configurationRefreshDialog.getByRole('button', {
      name: 'Refresh',
      exact: true,
    });
    this.customOrderType1Button = this.scope.appFrame.getByTestId(
      'pos-ui-function-card-custom_order_type1',
    );
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
    if (await this.configurationRefreshDialog.isVisible().catch(() => false)) {
      await this.configurationRefreshButton.click();
      await expect(this.configurationRefreshDialog).toBeHidden({ timeout: 15_000 });
      await this.waitUntilRefreshCompleted();
      await this.expectEmployeeReady();
      return;
    }

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

  @step('页面操作：确认延迟出现的系统配置刷新通知')
  async confirmDelayedConfigurationRefresh(): Promise<boolean> {
    const notificationAppeared = await waitUntil(
      async () => await this.configurationRefreshDialog.isVisible().catch(() => false),
      (isVisible) => isVisible,
      {
        timeout: 20_000,
        interval: 100,
        message: 'System configuration refresh notification did not appear.',
      },
    )
      .then(() => true)
      .catch(() => false);

    if (!notificationAppeared) {
      return false;
    }

    await this.configurationRefreshButton.click();
    await expect(this.configurationRefreshDialog).toBeHidden({ timeout: 15_000 });
    await this.waitUntilRefreshCompleted();
    await this.expectEmployeeReady();
    return true;
  }

  @step('页面操作：确认主页固定头部按钮已经可用')
  async expectPrimaryFunctionCardsVisible(): Promise<void> {
    await expect(this.themeToggleButton).toBeVisible();
    await expect(this.languageButton).toBeVisible();
    await expect(this.supportButton).toBeVisible();
    await expect(this.refreshButton).toBeVisible();
    await expect(this.exitButton).toBeVisible();
  }

  @step('页面操作：判断主页固定头部按钮当前是否可用')
  async isPrimaryFunctionCardsVisible(): Promise<boolean> {
    return await this.supportButton.isVisible().catch(() => false);
  }

  @step('页面读取：读取主页当前界面语言')
  async readCurrentLanguage(): Promise<HomeLanguage> {
    const dineInText = (
      await this.scope.appFrame.getByTestId(HOME_ENTRY_TEST_IDS['Dine In']).innerText()
    )
      .replace(/\s+/g, ' ')
      .trim();

    if (dineInText.includes('Dine In')) {
      return 'en';
    }

    if (dineInText.includes('堂吃')) {
      return 'zh-cn';
    }

    throw new Error(`无法从主页堂食入口识别当前语言：${dineInText}`);
  }

  @step((language: HomeLanguage) =>
    `页面操作：将主页界面语言切换为 ${language === 'zh-cn' ? '中文' : '英文'}`,
  )
  async switchLanguage(language: HomeLanguage): Promise<void> {
    if ((await this.readCurrentLanguage()) === language) {
      return;
    }

    await this.languageButton.click();
    await waitUntil(
      async () => await this.readCurrentLanguage().catch(() => null),
      (currentLanguage): currentLanguage is HomeLanguage => currentLanguage === language,
      {
        timeout: 10_000,
        message: `主页语言未能切换为 ${language}。`,
      },
    );
  }

  @step((entry: HomeEntry) => `页面操作：点击主页功能入口 ${entry}`)
  async clickEntry(entry: HomeEntry): Promise<void> {
    await this.clickFunctionButton(entry);
  }

  @step('页面操作：点击 Dine In 入口并进入选桌页')
  async enterDineIn(): Promise<SelectTablePage> {
    const entryPage = await this.enterDineInEntry();

    if (entryPage instanceof SelectTablePage) {
      return entryPage;
    }

    throw new Error('Dine In 已直接进入点单页；无桌位堂食流程请使用 SelectTableFlow.enterDineInNoTableOrder。');
  }

  /** @deprecated 请使用 {@link enterDineIn} */
  async clickDineIn(): Promise<SelectTablePage> {
    return this.enterDineIn();
  }

  @step('页面操作：点击 Dine In 入口并等待堂食入口页面稳定')
  async enterDineInEntry(): Promise<DineInEntryPage> {
    await this.clickFunctionButton('Dine In');
    const entryPage = this.createDineInEntryPage(await this.waitForDineInEntryState());
    await entryPage.expectLoaded();
    return entryPage;
  }

  @step('页面读取：等待已触发的 Dine In 入口到达选桌页或点单页')
  async waitForDineInEntryPage(): Promise<DineInEntryPage> {
    const entryPage = this.createDineInEntryPage(await this.waitForDineInEntryState());
    await entryPage.expectLoaded();
    return entryPage;
  }

  @step('页面读取：判断当前是否已经到达 Dine In 选桌页或点单页')
  async isDineInEntryRoute(): Promise<boolean> {
    return /#(?:tableV2|orderDishes)/.test(this.page.url());
  }

  private createDineInEntryPage(entryState: DineInEntryState): DineInEntryPage {
    if (entryState === 'orderDishes') {
      return new OrderDishesPage(this.page);
    }

    return new SelectTablePage(this.page);
  }

  @step('页面操作：点击 Delivery 入口并进入 Delivery 页面')
  async enterDelivery(): Promise<DeliveryPage> {
    await this.clickFunctionButton('Delivery');
    const deliveryPage = new DeliveryPage(this.page);
    await deliveryPage.expectVisible();
    return deliveryPage;
  }

  @step('页面操作：点击首页自定义订单类型 1')
  async clickCustomOrderType1(): Promise<void> {
    await expect(this.customOrderType1Button).toBeVisible({ timeout: 15_000 });
    await this.customOrderType1Button.click();
  }

  @step('页面操作：确认自定义订单类型 1 已进入 Delivery 页面')
  async waitForCustomOrderType1Delivery(): Promise<DeliveryPage> {
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
    return this.scope.appFrame.getByTestId(HOME_ENTRY_TEST_IDS[buttonName]);
  }

  @step('页面操作：点击 Gift Card 入口并进入礼品卡管理页面')
  async enterGiftCard(): Promise<GiftCardPage> {
    await this.clickFunctionButton('Gift Card');
    const giftCardPage = new GiftCardPage(this.page);
    await giftCardPage.expectLoaded();
    return giftCardPage;
  }

  @step('页面读取：等待 Dine In 入口进入选桌页或点单页')
  private async waitForDineInEntryState(): Promise<DineInEntryState> {
    const entryState = await waitUntil(
      async () => {
        const currentUrl = this.page.url();

        if (/#orderDishes/.test(currentUrl)) {
          return 'orderDishes';
        }

        if (/#tableV2/.test(currentUrl)) {
          return 'selectTable';
        }

        return null;
      },
      (state): state is DineInEntryState => state !== null,
      {
        timeout: 15_000,
        interval: 250,
        message: 'Dine In did not navigate to select-table or order-dishes page in time.',
      },
    );

    if (!entryState) {
      throw new Error('Unable to determine Dine In entry page.');
    }

    return entryState;
  }
}

import { expect, type Locator, type Page } from '@playwright/test';
import { appConfig } from '../test-data/env';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { PickupScreenPage } from './pickup-screen.page';

export type PagingStatus = 'all' | 'preparing' | 'ready' | 'completed';
export type PagingOrderType = 'Dine In' | 'To Go' | 'Pick Up' | 'Delivery';

const statusSelectors: Record<PagingStatus, string> = {
  all: '.statusBtn_ALL',
  preparing: '.statusBtn_PREPARING',
  ready: '.statusBtn_READY',
  completed: '.statusBtn_DONE',
};

const orderTypeSelectors: Record<PagingOrderType, string> = {
  'Dine In': '#set_DINE_IN',
  'To Go': '#set_TOGO',
  'Pick Up': '#set_PICKUP',
  Delivery: '#set_DELIVERY',
};

export class PagingPage {
  private readonly container: Locator;
  private readonly searchInput: Locator;
  private readonly refreshPickupScreenButton: Locator;
  private readonly backHomeButton: Locator;
  private readonly allDoneButton: Locator;
  private readonly allDoneDialogTitle: Locator;
  private readonly exitDialogTitle: Locator;
  private readonly confirmButton: Locator;

  constructor(private readonly page: Page) {
    this.container = this.page.locator('#orderPagingContainer');
    this.searchInput = this.page.locator('#callPageSearchInput');
    this.refreshPickupScreenButton = this.page.locator('#refreshScreen');
    this.backHomeButton = this.page.locator('#pagingToHomePage');
    this.allDoneButton = this.page.locator('.oneKeyDone');
    this.allDoneDialogTitle = this.page.getByRole('heading', {
      name: 'Complete with one click?',
      exact: true,
    });
    this.exitDialogTitle = this.page.getByRole('heading', { name: 'Exit', exact: true });
    this.confirmButton = this.page.getByRole('button', { name: 'OK', exact: true });
  }

  @step('页面操作：确认 Paging 页面已经加载完成')
  async expectLoaded(): Promise<void> {
    await expect(this.container).toBeVisible({ timeout: 15_000 });
    await expect(this.searchInput).toBeVisible();
    await expect(this.statusButton('all')).toBeVisible();
  }

  @step((_status: PagingStatus) => `页面操作：切换 Paging 订单状态为 ${statusLabel(_status)}`)
  async selectStatus(status: PagingStatus): Promise<void> {
    await this.statusButton(status).click();
  }

  @step((_orderType: PagingOrderType) => `页面操作：按订单类型 ${_orderType} 筛选 Paging 订单`)
  async selectOrderType(orderType: PagingOrderType): Promise<void> {
    await this.orderTypeButton(orderType).click();
  }

  @step((_orderNumber: string) => `页面操作：按订单号 ${_orderNumber} 搜索 Paging 订单`)
  async fillOrderSearch(orderNumber: string): Promise<void> {
    await this.searchInput.fill(normalizeOrderNumber(orderNumber));
  }

  @step('页面读取：读取 Paging 当前可见订单号列表')
  async readVisibleOrderNumbers(): Promise<string[]> {
    const orderNumbers = await this.container.locator('.pagingOrderNumber:visible').allInnerTexts();
    return orderNumbers.map(normalizeOrderNumber);
  }

  @step((_orderNumber: string) => `页面读取：读取 Paging 订单 ${_orderNumber} 的订单类型`)
  async readOrderType(orderNumber: string): Promise<string> {
    await this.waitForOrderVisible(orderNumber);
    return (await this.orderCard(orderNumber).locator('.pagingOrderType').innerText()).trim();
  }

  @step((_orderNumber: string) => `页面操作：等待 Paging 订单 ${_orderNumber} 出现在当前列表`)
  async waitForOrderVisible(orderNumber: string, timeout = 30_000): Promise<void> {
    const card = this.orderCard(orderNumber);
    await waitUntil(
      async () => await card.isVisible().catch(() => false),
      (isVisible) => isVisible,
      {
        timeout,
        interval: 200,
        message: `Paging 当前列表未展示订单 ${normalizeOrderNumber(orderNumber)}。`,
      },
    );
  }

  @step((_orderNumber: string) => `页面操作：将 Paging 订单 ${_orderNumber} 标记为待取餐`)
  async markOrderReady(orderNumber: string): Promise<void> {
    const card = this.orderCard(orderNumber);
    await this.waitForOrderVisible(orderNumber);
    await card.locator('.paging_notifyFirstTime').click();
    await waitUntil(
      async () => {
        const isVisible = await card.isVisible().catch(() => false);
        return {
          isVisible,
          text: isVisible ? (await card.innerText()).replace(/\s+/g, ' ') : '',
        };
      },
      ({ isVisible, text }) => !isVisible || text.includes('Ready'),
      {
        timeout: 15_000,
        interval: 200,
        message: `Paging 订单 ${normalizeOrderNumber(orderNumber)} 未离开 Preparing 状态。`,
      },
    );
  }

  @step((_orderNumber: string) => `页面操作：销号 Paging 订单 ${_orderNumber}`)
  async callOffOrder(orderNumber: string): Promise<void> {
    const card = this.orderCard(orderNumber);
    await this.waitForOrderVisible(orderNumber);
    await card.locator('.paging_isPickupCompleted').click();
    await waitUntil(
      async () => {
        const isVisible = await card.isVisible().catch(() => false);
        return {
          isVisible,
          text: isVisible ? (await card.innerText()).replace(/\s+/g, ' ') : '',
        };
      },
      ({ isVisible, text }) => !isVisible || text.includes('Completed'),
      {
        timeout: 15_000,
        interval: 200,
        message: `Paging 订单 ${normalizeOrderNumber(orderNumber)} 未离开 Ready 状态。`,
      },
    );
  }

  @step('页面操作：将 Paging 当前全部待取餐订单标记为完成')
  async completeAllReadyOrders(): Promise<void> {
    await this.allDoneButton.click();
    await expect(this.allDoneDialogTitle).toBeVisible();
    await this.confirmButton.click();
    await expect(this.allDoneDialogTitle).toBeHidden({ timeout: 15_000 });
  }

  @step('页面操作：刷新叫号屏')
  async refreshPickupScreen(): Promise<void> {
    await this.refreshPickupScreenButton.click();
  }

  @step('页面操作：打开叫号屏页面')
  async openPickupScreen(): Promise<PickupScreenPage> {
    const pickupPage = await this.page.context().newPage();
    await pickupPage.goto(new URL('/kpos/call/index.html', appConfig.baseURL).toString());
    const pickupScreenPage = new PickupScreenPage(pickupPage);
    await pickupScreenPage.expectLoaded();
    return pickupScreenPage;
  }

  @step('页面操作：从 Paging 返回 POS 首页')
  async clickBackHome(): Promise<void> {
    await this.backHomeButton.click();
    await expect(this.exitDialogTitle).toBeVisible();
    await this.confirmButton.click();
    await expect(this.container).toBeHidden({ timeout: 15_000 });
  }

  private statusButton(status: PagingStatus): Locator {
    return this.page.locator(statusSelectors[status]);
  }

  private orderTypeButton(orderType: PagingOrderType): Locator {
    return this.page.locator(orderTypeSelectors[orderType]);
  }

  private orderCard(orderNumber: string): Locator {
    const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
    const numberText = new RegExp(`^#\\s*${escapeRegExp(normalizedOrderNumber)}$`);
    const orderNumberLocator = this.page.locator('.pagingOrderNumber', { hasText: numberText });
    return this.container.locator('[id^="order_"]', { has: orderNumberLocator }).first();
  }
}

function normalizeOrderNumber(orderNumber: string): string {
  return orderNumber.replace(/^#\s*/, '').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function statusLabel(status: PagingStatus): string {
  return {
    all: '全部',
    preparing: '准备中',
    ready: '待取餐',
    completed: '已完成',
  }[status];
}

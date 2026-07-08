import type { FrameLocator, Locator, Page } from '@playwright/test';
import {
  createOrderDishesScope,
  mergeFrameOrHost,
  scopedLocator,
  type FrameOrHostScope,
} from '../shared/locator-scope';
import {
  CANCEL_BUTTON_NAMES,
  CHARGE_BUTTON_NAMES,
  CHARGE_DIALOG_TEXT,
  CLEAR_ALL_BUTTON_NAMES,
  CLEAR_SELECTED_BUTTON_NAMES,
  CONFIRM_BUTTON_NAMES,
  CUSTOM_TAXED_LABELS,
} from './order-dishes.types';

export class OrderDishesLocators {
  readonly scope: FrameOrHostScope;
  readonly page: Page;
  readonly appFrame: FrameLocator;
  readonly backButton: Locator;
  readonly headerRecallButton: Locator;
  readonly sendButton: Locator;
  readonly payButton: Locator;
  readonly addLineButton: Locator;
  readonly selectedDishAddButton: Locator;
  readonly changePriceButton: Locator;
  readonly changePriceConfirmButton: Locator;
  readonly countButton: Locator;
  readonly firstAvailableDishButton: Locator;
  readonly menuGroupCards: Locator;
  readonly menuCategoryCards: Locator;
  readonly countDialog: Locator;
  readonly countDialogInput: Locator;
  readonly countDialogConfirmButton: Locator;
  readonly weightDialog: Locator;
  readonly weightDialogLoadingText: Locator;
  readonly weightInput: Locator;
  readonly weightConfirmButton: Locator;
  readonly priceDialog: Locator;
  readonly priceInput: Locator;
  readonly priceConfirmButton: Locator;
  readonly specificationDialog: Locator;
  readonly specificationConfirmButton: Locator;
  readonly categoryOptionPanel: Locator;
  readonly categoryOptionGrid: Locator;
  readonly categoryOptionSubGrid: Locator;
  readonly comboDialog: Locator;
  readonly comboConfirmButton: Locator;
  readonly cartBadge: Locator;
  readonly priceSummaryToggle: Locator;
  readonly priceSummaryDetailsContainer: Locator;
  readonly priceSummaryTotalContainer: Locator;
  readonly saveOrderButton: Locator;
  readonly headerMoreButton: Locator;
  readonly inventoryMenuItem: Locator;
  readonly reduceButton: Locator;
  readonly exitButton: Locator;
  readonly exitConfirmButton: Locator;
  readonly inventoryAlertItems: Locator;
  readonly moreActionButton: Locator;
  readonly splitButton: Locator;
  readonly modifyButton: Locator;
  readonly modifyPanel: Locator;
  readonly modifyBackButton: Locator;
  readonly customModifierNameInput: Locator;
  readonly customModifierPriceInput: Locator;
  readonly customModifierAddButton: Locator;
  readonly chargeButton: Locator;
  readonly chargeDialog: Locator;
  readonly customChargeDialog: Locator;
  readonly clearAllChargesButton: Locator;
  readonly confirmChargeButton: Locator;
  readonly cancelChargeButton: Locator;
  readonly clearSelectedChargeButton: Locator;
  readonly customChargeConfirmButton: Locator;
  readonly customChargeCancelButton: Locator;
  readonly customChargeValueInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scope = createOrderDishesScope(page);
    this.appFrame = this.scope.appFrame;
    const scoped = (selector: string) => scopedLocator(this.scope, selector);

    this.backButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .getByTestId('icon-button-Back')
        .or(appFrame.getByRole('button', { name: /^Back$/ }))
        .or(hostPage.getByTestId('icon-button-Back'))
        .or(hostPage.getByRole('button', { name: /^Back$/ }))
        .first(),
    );
    this.headerRecallButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame.getByRole('button', { name: /Recall/ }).or(hostPage.getByRole('button', { name: /Recall/ })).first(),
    );
    this.sendButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .locator(
          '[data-testid="bottom-button-sendOrderBtn"], [data-test-id="bottom-button-sendOrderBtn"]',
        )
        .or(appFrame.getByRole('button', { name: 'Send' }))
        .or(
          hostPage.locator(
            '[data-testid="bottom-button-sendOrderBtn"], [data-test-id="bottom-button-sendOrderBtn"]',
          ),
        )
        .or(hostPage.getByRole('button', { name: 'Send' }))
        .first(),
    );
    this.payButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame.getByRole('button', { name: 'Pay' }).or(hostPage.getByRole('button', { name: 'Pay' })).first(),
    );
    this.addLineButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .getByTestId('action-rail-button-addline')
        .or(hostPage.getByTestId('action-rail-button-addline'))
        .first(),
    );
    this.selectedDishAddButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .locator('[data-testid="action-rail-button-add1"], [data-test-id="action-rail-button-add1"]')
        .or(
          appFrame
            .locator('aside, [role="complementary"]')
            .getByRole('button', { name: /^(Add|加)$/ }),
        )
        .or(
          hostPage.locator(
            '[data-testid="action-rail-button-add1"], [data-test-id="action-rail-button-add1"]',
          ),
        )
        .or(
          hostPage
            .locator('aside, [role="complementary"]')
            .getByRole('button', { name: /^(Add|加)$/ }),
        )
        .first(),
    );
    this.changePriceButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .getByTestId('action-rail-button-chgPrc')
        .or(hostPage.getByTestId('action-rail-button-chgPrc'))
        .first(),
    );
    this.changePriceConfirmButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .getByTestId('preset-currency-keypad-input-confirm-button')
        .or(hostPage.getByTestId('preset-currency-keypad-input-confirm-button'))
        .first(),
    );
    this.countButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .getByRole('button', { name: /^(Count|数量)$/ })
        .or(hostPage.getByRole('button', { name: /^(Count|数量)$/ }))
        .first(),
    );
    this.firstAvailableDishButton = this.appFrame
      .locator(
        'button:not([name*="Back"]):not([name*="Cart"]):not([name*="Send"]):not([name*="Pay"])',
      )
      .first();
    this.menuGroupCards = scoped(
      '[data-testid^="menu-group-card-"], [data-test-id^="menu-group-card-"]',
    );
    this.menuCategoryCards = scoped(
      '[data-testid^="menu-category-card-"], [data-test-id^="menu-category-card-"]',
    );
    this.countDialog = scoped('[data-testid="dish-count-modal"], [data-testid="option-count-modal"]');
    this.countDialogInput = this.countDialog.locator('input').first();
    this.countDialogConfirmButton = this.countDialog.getByRole('button', {
      name: /^(Confirm|确认)$/,
    });
    this.weightDialog = this.appFrame
      .getByRole('dialog')
      .filter({
        has: this.appFrame.getByText('Weight', { exact: true }),
      })
      .first();
    this.weightDialogLoadingText = this.weightDialog.getByText('Loading', { exact: true });
    this.weightInput = this.weightDialog.locator('input').first();
    this.weightConfirmButton = this.weightDialog.getByRole('button', { name: 'Confirm' });
    this.priceDialog = this.appFrame.getByRole('dialog', { name: 'Enter Price' });
    this.priceInput = this.priceDialog.getByRole('textbox', { name: 'Price' });
    this.priceConfirmButton = this.priceDialog.getByRole('button', { name: 'Confirm' });
    this.specificationDialog = this.appFrame.getByRole('dialog', {
      name: 'Select Specifications',
    });
    this.specificationConfirmButton = this.specificationDialog.getByRole('button', {
      name: 'Confirm',
    });
    this.categoryOptionPanel = this.page
      .locator('[data-testid="item-option-panel"], [class*="_dock_"]')
      .filter({ has: this.page.getByRole('button', { name: /^Collapse/i }) })
      .first();
    this.categoryOptionGrid = this.categoryOptionPanel
      .locator('[class*="_grid_"]')
      .first()
      .or(this.categoryOptionPanel);
    this.categoryOptionSubGrid = this.page.locator('[class*="_subGrid_"]').first();
    this.comboDialog = this.appFrame.locator('aside[class*="_panel_"]').filter({
      has: this.appFrame.getByRole('button', { name: 'Cancel', exact: true }),
    }).first();
    this.comboConfirmButton = this.comboDialog.locator('button', {
      hasText: /^(Confirm|确认)$/,
    }).first();
    this.cartBadge = scoped('[data-testid="cart-badge"]');
    this.priceSummaryToggle = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .locator(
          '[data-test-id="shared-order-price-summary-toggle"], [data-testid="shared-order-price-summary-toggle"]',
        )
        .or(appFrame.getByRole('button', { name: /Total\(Cash\).*Total\(Card\)/ }))
        .or(
          hostPage.locator(
            '[data-test-id="shared-order-price-summary-toggle"], [data-testid="shared-order-price-summary-toggle"]',
          ),
        )
        .or(hostPage.getByRole('button', { name: /Total\(Cash\).*Total\(Card\)/ }))
        .or(appFrame.getByRole('button', { name: /Total\s*\$[\d,.]+/ }))
        .or(hostPage.getByRole('button', { name: /Total\s*\$[\d,.]+/ }))
        .first(),
    );
    this.priceSummaryDetailsContainer = this.priceSummaryToggle.locator(
      'xpath=following-sibling::*[1]',
    );
    this.priceSummaryTotalContainer = this.priceSummaryToggle.locator('xpath=following-sibling::*[2]');
    this.saveOrderButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .locator('[data-testid="bottom-button-saveOrderBtn"], [data-test-id="bottom-button-saveOrderBtn"]')
        .or(
          hostPage.locator(
            '[data-testid="bottom-button-saveOrderBtn"], [data-test-id="bottom-button-saveOrderBtn"]',
          ),
        )
        .or(appFrame.getByRole('button', { name: /^(Save|保存)$/ }))
        .or(hostPage.getByRole('button', { name: /^(Save|保存)$/ }))
        .first(),
    );
    this.headerMoreButton = this.page
      .getByTestId('icon-button-more')
      .or(this.appFrame.getByTestId('icon-button-more'));
    this.inventoryMenuItem = this.page
      .getByTestId('dropdown-item-inventory')
      .or(this.page.getByRole('menuitem', { name: 'Inventory' }));
    this.reduceButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .getByRole('button', { name: /^Reduce$/ })
        .or(hostPage.getByRole('button', { name: /^Reduce$/ }))
        .first(),
    ).or(scoped('#reduce1icon'));
    this.exitButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .getByRole('button', { name: /^Back$/ })
        .or(hostPage.getByRole('button', { name: /^Back$/ }))
        .first(),
    ).or(scoped('#odBack'));
    this.exitConfirmButton = scoped('#exit-edit-submit');
    this.inventoryAlertItems = this.page
      .getByText('Insufficient stock, please modify the order.', { exact: true })
      .locator('xpath=..');
    this.moreActionButton = this.appFrame.getByRole('button', {
      name: /^(More|更多)$/,
    }).first();
    this.splitButton = this.appFrame.getByRole('button', {
      name: /^Split$/,
    }).first();
    this.modifyButton = this.appFrame
      .locator(
        '[data-testid="action-rail-button-modify"], [data-test-id="action-rail-button-modify"], [data-testid="modify-button"], [data-test-id="modify-button"]',
      )
      .or(this.appFrame.getByRole('button', { name: /^(Modify|修改)$/ }))
      .first();
    this.modifyPanel = this.appFrame
      .locator(
        '[data-testid="modify-panel"], [data-test-id="modify-panel"], [class*="_panel_"]',
      )
      .filter({
        has: this.appFrame.getByText(/^(Modify|修改)$/),
      })
      .first();
    this.modifyBackButton = this.modifyPanel
      .locator('[aria-label="onLeftIcon"], [aria-label="Back"], [aria-label="返回"]')
      .first();
    this.customModifierNameInput = this.modifyPanel
      .getByPlaceholder(/^(Enter custom modifier|输入自定义调味)$/)
      .first();
    this.customModifierPriceInput = this.modifyPanel
      .getByPlaceholder(/^(0\.00)$/)
      .first();
    this.customModifierAddButton = this.modifyPanel
      .locator('[class*="_bodyFirstRow_"]')
      .getByRole('button', { name: /^(Add|添加)$/ })
      .first();
    this.chargeButton = this.appFrame.getByRole('button', {
      name: CHARGE_BUTTON_NAMES,
    }).first();
    this.chargeDialog = this.appFrame
      .locator('[data-testid="charge-dialog"], [data-test-id="charge-dialog"], [role="dialog"]')
      .filter({
        has: this.appFrame.getByText(CHARGE_DIALOG_TEXT),
      })
      .first();
    this.customChargeDialog = this.appFrame
      .locator(
        '[data-testid="custom-charge-dialog"], [data-test-id="custom-charge-dialog"], [role="dialog"]',
      )
      .filter({
        has: this.appFrame.getByRole('checkbox', { name: CUSTOM_TAXED_LABELS }).first(),
      })
      .first();
    this.clearAllChargesButton = this.chargeDialog.getByRole('button', {
      name: CLEAR_ALL_BUTTON_NAMES,
    }).first();
    this.confirmChargeButton = this.chargeDialog.getByRole('button', {
      name: CONFIRM_BUTTON_NAMES,
    }).first();
    this.cancelChargeButton = this.chargeDialog.getByRole('button', {
      name: CANCEL_BUTTON_NAMES,
    }).first();
    this.clearSelectedChargeButton = this.chargeDialog.getByRole('button', {
      name: CLEAR_SELECTED_BUTTON_NAMES,
    }).first();
    this.customChargeConfirmButton = this.customChargeDialog.getByRole('button', {
      name: CONFIRM_BUTTON_NAMES,
    }).first();
    this.customChargeCancelButton = this.customChargeDialog.getByRole('button', {
      name: CANCEL_BUTTON_NAMES,
    }).first();
    this.customChargeValueInput = this.customChargeDialog
      .locator('input[type="text"], input')
      .first();
  }
}

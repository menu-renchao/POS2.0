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
  readonly guestCountButton: Locator;
  readonly guestCountDialog: Locator;
  readonly guestCountClearButton: Locator;
  readonly guestCountNumberButton: (guestCount: number) => Locator;
  readonly guestCountConfirmButton: Locator;
  readonly headerRecallButton: Locator;
  readonly sendButton: Locator;
  readonly payButton: Locator;
  readonly addLineButton: Locator;
  readonly selectedDishAddButton: Locator;
  readonly changePriceButton: Locator;
  readonly changePriceConfirmButton: Locator;
  readonly itemPriceDiscountDialog: Locator;
  readonly itemPriceChangeButton: Locator;
  readonly itemPriceDiscountConfirmButton: Locator;
  readonly itemPriceDiscountValue: Locator;
  readonly itemPriceDiscountNumberButton: (digit: string) => Locator;
  readonly itemPriceDiscountDoubleZeroButton: Locator;
  readonly itemPriceDiscountOption: (discountName: string) => Locator;
  readonly itemPriceAuthorizationForm: Locator;
  readonly itemPriceAuthorizationDigitButton: (digit: string) => Locator;
  readonly itemPriceAuthorizationConfirmButton: Locator;
  readonly countButton: Locator;
  readonly countText: Locator;
  readonly firstAvailableDishButton: Locator;
  readonly menuGroupCard: (groupName: string) => Locator;
  readonly selectedMenuGroupName: Locator;
  readonly menuCategoryCards: Locator;
  readonly menuCategoryCard: (categoryName: string) => Locator;
  readonly selectedMenuCategoryName: Locator;
  readonly menuItemCards: Locator;
  readonly menuItemButtonByName: (dishName: string) => Locator;
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
  readonly openFoodButton: Locator;
  readonly openFoodDialog: Locator;
  readonly searchMenuButton: Locator;
  readonly chineseSearchMenuButton: Locator;
  readonly searchMenuInput: Locator;
  readonly searchMenuResultCard: (testId: string) => Locator;
  readonly searchMenuResultCardsByNameAndNumber: (name: string, itemNumber: string) => Locator;
  readonly openFoodNameInput: Locator;
  readonly openFoodPriceInput: Locator;
  readonly openFoodKeyboardCloseButton: Locator;
  readonly openFoodKeyboardLanguageButton: Locator;
  readonly openFoodKeyboardLetterButton: (letter: string) => Locator;
  readonly openFoodKeyboardCandidateButton: (candidate: string) => Locator;
  readonly openFoodConfirmButton: Locator;
  readonly openFoodNoTaxOption: Locator;
  readonly notification: Locator;
  readonly notificationConfirmButton: Locator;
  readonly customerDialog: Locator;
  readonly customerDialogHeading: Locator;
  readonly customerNameInput: Locator;
  readonly customerPhoneInput: Locator;
  readonly customerConfirmButton: Locator;
  readonly customerNameRequiredMessage: Locator;
  readonly customerPhoneRequiredMessage: Locator;
  readonly emptyCustomerInformationButton: Locator;
  readonly customerInformationButton: (accessibleName: string) => Locator;
  readonly customerInformationRegion: Locator;
  readonly customerInformationPageHeading: Locator;
  readonly customerInformationNameInput: Locator;
  readonly customerInformationPhoneInput: Locator;
  readonly customerInformationSaveButton: Locator;
  readonly customerInformationKeyboardCloseButton: Locator;
  readonly orderCustomerAddressSummary: (accessibleName: string) => Locator;
  readonly removeItemButton: Locator;
  readonly kitchenVoidPermissionMessage: Locator;
  readonly authorizationDigitButton: (digit: string) => Locator;
  readonly authorizationConfirmButton: Locator;
  readonly noteButton: Locator;
  readonly notePermissionMessage: Locator;
  readonly noteAuthorizationForm: Locator;
  readonly noteAuthorizationDigitButton: (digit: string) => Locator;
  readonly noteAuthorizationConfirmButton: Locator;
  readonly noteInput: Locator;
  readonly noteConfirmButton: Locator;
  readonly specificationDialog: Locator;
  readonly specificationConfirmButton: Locator;
  readonly categoryOptionPanel: Locator;
  readonly categoryOptionGrid: Locator;
  readonly categoryOptionSubGrid: Locator;
  readonly itemOptionButton: (optionName: string) => Locator;
  readonly comboDialog: Locator;
  readonly comboConfirmButton: Locator;
  readonly comboItemButton: (sectionId: number, saleItemId: number, itemIndex: number) => Locator;
  readonly comboSubItemBySaleItemId: (comboName: string, saleItemId: number) => Locator;
  readonly comboSubItemPriceBySaleItemId: (comboName: string, saleItemId: number) => Locator;
  readonly reduceSelectedOptionButton: Locator;
  readonly orderedDishItems: Locator;
  readonly orderedDishItemsByName: (dishName: string) => Locator;
  readonly orderedDishItemByName: (dishName: string) => Locator;
  readonly orderedDishNameByName: (dishName: string) => Locator;
  readonly cartBadge: Locator;
  readonly priceSummaryToggle: Locator;
  readonly priceSummaryDetailsContainer: Locator;
  readonly priceSummaryTotalContainer: Locator;
  readonly saveOrderButton: Locator;
  readonly headerMoreButton: Locator;
  readonly inventoryMenuItem: Locator;
  readonly reduceButton: Locator;
  readonly exitConfirmButton: Locator;
  readonly inventoryAlertItems: Locator;
  readonly moreActionButton: Locator;
  readonly splitButton: Locator;
  readonly modifyButton: Locator;
  readonly modifyPanel: Locator;
  readonly modifyBackButton: Locator;
  readonly modifyOptionButton: (optionName: string) => Locator;
  readonly selectedModifyOptionAddButton: Locator;
  readonly selectedModifyOptionCountButton: Locator;
  readonly selectedModifyOptionReduceButton: Locator;
  readonly modifyOptionCountDialog: Locator;
  readonly modifyOptionCountCancelButton: Locator;
  readonly modifyOptionCountDisplay: Locator;
  readonly modifyOptionCountClearButton: Locator;
  readonly modifyOptionCountNumberButton: (digit: string) => Locator;
  readonly modifyOptionCountConfirmButton: Locator;
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
  readonly configurationRefreshDialog: Locator;
  readonly configurationRefreshButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.scope = createOrderDishesScope(page);
    this.appFrame = this.scope.appFrame;
    const scoped = (selector: string) => scopedLocator(this.scope, selector);

    this.backButton = this.page.getByTestId('button-back');
    this.guestCountButton = this.page.getByTestId('guestCount-button');
    this.guestCountDialog = this.page.getByRole('dialog', {
      name: 'Party Size',
      exact: true,
    });
    this.guestCountClearButton = this.guestCountDialog.getByTestId(
      'pos-ui-numeric-input-clear',
    );
    this.guestCountNumberButton = (guestCount: number) =>
      this.guestCountDialog.getByTestId(`pos-ui-numeric-input-number-${guestCount}`);
    this.guestCountConfirmButton = this.guestCountDialog.getByTestId(
      'pos-ui-numeric-input-confirm-button',
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
    this.payButton = this.page.getByTestId('bottom-button-payOrderBtn');
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
    this.itemPriceChangeButton = this.page.getByTestId('action-rail-button-chgPrc');
    this.itemPriceDiscountDialog = this.page.getByRole('dialog', { name: 'Price', exact: true });
    this.itemPriceDiscountConfirmButton = this.itemPriceDiscountDialog.getByTestId(
      'preset-numeric-input-modal-confirm-button',
    );
    this.itemPriceDiscountValue = this.itemPriceDiscountDialog.getByTestId(
      'preset-currency-keypad-input-input',
    );
    this.itemPriceDiscountNumberButton = (digit: string) =>
      this.itemPriceDiscountDialog.getByTestId(`preset-currency-keypad-input-number-${digit}`);
    this.itemPriceDiscountDoubleZeroButton = this.itemPriceDiscountDialog.getByTestId(
      'preset-currency-keypad-input-double-zero',
    );
    this.itemPriceDiscountOption = (discountName: string) =>
      this.itemPriceDiscountDialog.getByRole('button', {
        name: discountName,
        exact: true,
      });
    this.itemPriceAuthorizationForm = this.page.getByRole('form', {
      name: 'Enter Your Passcode',
    });
    this.itemPriceAuthorizationDigitButton = (digit: string) =>
      this.itemPriceAuthorizationForm.getByRole('button', {
        name: `Number ${digit}`,
        exact: true,
      });
    this.itemPriceAuthorizationConfirmButton = this.itemPriceAuthorizationForm.getByRole(
      'button',
      {
        name: 'confirm',
        exact: true,
      },
    );
    this.countButton = mergeFrameOrHost(this.scope, ({ appFrame, page: hostPage }) =>
      appFrame
        .getByRole('button', { name: /^(Count|数量)$/ })
        .or(hostPage.getByRole('button', { name: /^(Count|数量)$/ }))
        .first(),
    );
    this.countText = this.page.locator('#ododttcnt');
    this.firstAvailableDishButton = this.appFrame
      .locator(
        'button:not([name*="Back"]):not([name*="Cart"]):not([name*="Send"]):not([name*="Pay"])',
      )
      .first();
    const menuGroupCards = this.page.locator('[data-testid^="menu-group-card-"]');
    this.menuGroupCard = (groupName: string) =>
      menuGroupCards.filter({ hasText: groupName }).first();
    this.selectedMenuGroupName = this.page
      .locator('[data-testid^="menu-group-card-"][class*="_selected_"]')
      .first();
    this.menuCategoryCards = this.page.locator('[data-testid^="menu-category-card-"]');
    this.menuCategoryCard = (categoryName: string) =>
      this.menuCategoryCards.filter({ hasText: categoryName }).first();
    this.selectedMenuCategoryName = this.page.locator(
      '[data-testid^="menu-category-card-"][class*="_selected_"]',
    );
    this.menuItemCards = this.page.locator('[data-testid^="menu-item-card-"]');
    this.menuItemButtonByName = (dishName: string) =>
      this.page.getByRole('button', { name: dishName, exact: true });
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
    this.openFoodButton = this.page.getByTestId('icon-button-Open item');
    this.openFoodDialog = this.page.getByTestId('pos-ui-modal');
    this.searchMenuButton = this.page.getByTestId('icon-button-Search menu');
    this.chineseSearchMenuButton = this.page.getByRole('button', {
      name: '搜索菜单',
      exact: true,
    });
    this.searchMenuInput = this.page.getByTestId('pos-ui-input');
    this.searchMenuResultCard = (testId: string) => this.page.getByTestId(testId);
    this.searchMenuResultCardsByNameAndNumber = (name: string, itemNumber: string) =>
      this.page.getByRole('button', {
        name: `${name}.${itemNumber}`,
        exact: true,
      });
    this.openFoodNameInput = this.openFoodDialog
      .getByTestId('pos-ui-autocomplete-input')
      .first();
    this.openFoodPriceInput = this.openFoodDialog.getByTestId('pos-ui-input');
    this.openFoodKeyboardCloseButton = this.page.getByTestId('pos-keyboard-button-{close}');
    this.openFoodKeyboardLanguageButton = this.page.getByTestId('pos-keyboard-button-globe');
    this.openFoodKeyboardLetterButton = (letter: string) =>
      this.page.getByTestId(`pos-keyboard-button-${letter}`);
    this.openFoodKeyboardCandidateButton = (candidate: string) =>
      this.page.getByRole('button', { name: candidate, exact: true });
    this.openFoodConfirmButton = this.page.getByTestId('open-food-confirm');
    this.openFoodNoTaxOption = this.page.getByTestId('open-food-tax-3');
    this.notification = this.page.getByTestId('notification');
    this.notificationConfirmButton = this.page.getByTestId('notification-confirm-button');
    this.customerDialog = this.page.locator('#customer-dialog');
    this.customerDialogHeading = this.customerDialog.getByRole('heading', {
      name: 'Customer Information',
    });
    this.customerNameInput = this.customerDialog.getByRole('textbox', { name: 'Name' });
    this.customerPhoneInput = this.customerDialog.getByRole('textbox', { name: 'Phone No.' });
    this.customerConfirmButton = this.customerDialog.getByRole('button', { name: 'Confirm' });
    this.customerNameRequiredMessage = this.page.getByText("Name can't be empty", { exact: true });
    this.customerPhoneRequiredMessage = this.page.getByText("Phone can't be empty", { exact: true });
    this.emptyCustomerInformationButton = this.page.getByRole('button', {
      name: 'AddIcon Customer',
      exact: true,
    });
    this.customerInformationButton = (accessibleName: string) =>
      this.page.getByRole('button', { name: accessibleName, exact: true });
    this.customerInformationRegion = this.page.getByLabel('客人信息', { exact: true });
    this.customerInformationPageHeading = this.page
      .getByRole('banner')
      .getByText('Information', { exact: true });
    this.customerInformationNameInput = this.page.getByPlaceholder('Name', {
      exact: true,
    });
    this.customerInformationPhoneInput = this.page.getByPlaceholder(
      'Phone number',
      { exact: true },
    );
    this.customerInformationSaveButton = this.page
      .getByRole('banner')
      .getByRole('button', { name: 'Save', exact: true });
    this.customerInformationKeyboardCloseButton = this.page.getByTestId(
      'pos-keyboard-button-{close}',
    );
    this.orderCustomerAddressSummary = (accessibleName: string) =>
      this.customerInformationButton(accessibleName).locator(
        '[class*="_customerDetailText_"]:not([class*="_customerNoteText_"])',
      );
    this.removeItemButton = this.page.getByTestId('action-rail-button-rmvItem');
    this.kitchenVoidPermissionMessage = this.page.getByText(
      'You do not have permission VOID_KITCHEN_ITEM, please enter the password!',
      { exact: true },
    );
    this.authorizationDigitButton = (digit: string) =>
      this.page.getByRole('button', { name: `Number ${digit}`, exact: true });
    this.authorizationConfirmButton = this.page.getByRole('button', {
      name: 'confirm',
      exact: true,
    });
    this.noteButton = this.page.getByTestId('action-rail-button-addnote');
    this.notePermissionMessage = this.page.getByText(
      'You do not have permission NOTE, please enter the password!',
      { exact: true },
    );
    this.noteAuthorizationForm = this.page.getByRole('form', {
      name: 'Enter Your Passcode',
    });
    this.noteAuthorizationDigitButton = (digit: string) =>
      this.noteAuthorizationForm.getByRole('button', {
        name: `Number ${digit}`,
        exact: true,
      });
    this.noteAuthorizationConfirmButton = this.noteAuthorizationForm.getByRole('button', {
      name: 'confirm',
      exact: true,
    });
    this.noteInput = this.page.getByPlaceholder('Note', { exact: true });
    this.noteConfirmButton = this.page.getByTestId('note-action-modal-confirm-button');
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
    this.itemOptionButton = (optionName: string) =>
      this.page.getByRole('button', { name: optionName, exact: true });
    this.comboDialog = this.page.getByRole('complementary').filter({
      has: this.page.getByRole('button', { name: 'Cancel', exact: true }),
    });
    this.comboConfirmButton = this.comboDialog.getByRole('button', {
      name: 'Confirm',
      exact: true,
    });
    this.comboItemButton = (sectionId: number, saleItemId: number, itemIndex: number) =>
      this.page.locator(`[id="${sectionId}-${saleItemId}-${itemIndex}"]`);
    this.comboSubItemBySaleItemId = (comboName: string, saleItemId: number) =>
      this.orderedDishItemByName(comboName).getByTestId(`dish-item-subitem-combo-${saleItemId}`);
    this.comboSubItemPriceBySaleItemId = (comboName: string, saleItemId: number) =>
      this.comboSubItemBySaleItemId(comboName, saleItemId).getByText(/^\$[\d,.]+$/).first();
    this.reduceSelectedOptionButton = this.page.getByTestId('action-rail-button-reduce1opt');
    this.orderedDishItems = this.page.getByTestId('pos-ui-dish-item');
    this.orderedDishItemsByName = (dishName: string) =>
      this.orderedDishItems.filter({
        has: this.page.getByText(dishName, { exact: true }),
      });
    this.orderedDishItemByName = (dishName: string) => this.orderedDishItemsByName(dishName).first();
    this.orderedDishNameByName = (dishName: string) =>
      this.orderedDishItemByName(dishName).getByText(dishName, { exact: true });
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
    this.saveOrderButton = this.page.getByTestId('bottom-button-saveOrderBtn');
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
    this.modifyButton = this.page.getByRole('button', { name: /^Modify$/ }).first();
    this.modifyPanel = this.page
      .locator(
        '[data-testid="modify-panel"], [data-test-id="modify-panel"], [class*="_panel_"]',
      )
      .filter({
        has: this.page.getByText(/^(Modify|修改)$/),
      })
      .first();
    this.modifyBackButton = this.modifyPanel
      .locator('[aria-label="onLeftIcon"], [aria-label="Back"], [aria-label="返回"]')
      .first();
    this.modifyOptionButton = (optionName: string) =>
      this.page.getByRole('button', { name: optionName, exact: true });
    this.selectedModifyOptionAddButton = this.page.getByTestId(
      'action-rail-button-add1opt',
    );
    this.selectedModifyOptionCountButton = this.page.getByTestId(
      'action-rail-button-chgNumopt',
    );
    this.selectedModifyOptionReduceButton = this.page.getByTestId(
      'action-rail-button-reduce1opt',
    );
    this.modifyOptionCountDialog = this.page.getByTestId('option-count-modal');
    this.modifyOptionCountCancelButton = this.modifyOptionCountDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    });
    this.modifyOptionCountDisplay = this.modifyOptionCountDialog.getByTestId(
      'option-count-modal-numeric-input-input',
    );
    this.modifyOptionCountClearButton = this.modifyOptionCountDialog.getByTestId(
      'option-count-modal-numeric-input-clear',
    );
    this.modifyOptionCountNumberButton = (digit: string) =>
      this.modifyOptionCountDialog.getByTestId(
        `option-count-modal-numeric-input-number-${digit}`,
      );
    this.modifyOptionCountConfirmButton = this.modifyOptionCountDialog.getByTestId(
      'option-count-modal-numeric-input-confirm-button',
    );
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
    this.chargeDialog = this.page
      .locator('[role="dialog"]')
      .filter({ hasText: /Whole Order[\s\S]*Item Charge[\s\S]*Custom Charge/ })
      .first();
    this.customChargeDialog = this.page
      .locator('[role="dialog"]')
      .filter({
        has: this.page.getByRole('heading', { name: /^Custom Charge$/i }).first(),
      })
      .filter({
        has: this.page.getByRole('button', { name: CUSTOM_TAXED_LABELS }).first(),
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
    this.configurationRefreshDialog = this.page.getByRole('alertdialog', {
      name: 'Notification',
    });
    this.configurationRefreshButton = this.configurationRefreshDialog.getByRole('button', {
      name: 'Refresh',
      exact: true,
    });
  }
}

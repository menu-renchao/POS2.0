import type { Page } from '@playwright/test';
import { OrderDishesChargeSection } from './order-dishes/order-dishes-charge.section';
import { OrderDishesCustomerSection } from './order-dishes/order-dishes-customer.section';
import { OrderDishesDiscountSection } from './order-dishes/order-dishes-discount.section';
import { OrderDishesDriverSection } from './order-dishes/order-dishes-driver.section';
import { OrderDishesMenuSection } from './order-dishes/order-dishes-menu.section';
import { OrderDishesModifierSection } from './order-dishes/order-dishes-modifier.section';
import { OrderDishesNoteSection } from './order-dishes/order-dishes-note.section';
import { OrderDishesPageContext } from './order-dishes/order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes/order-dishes-page-host';
import { OrderDishesPageNavigation } from './order-dishes/order-dishes-navigation';
import { OrderDishesReadsSection } from './order-dishes/order-dishes-reads.section';
import { OrderDishesTipSection } from './order-dishes/order-dishes-tip.section';

export type {
  ChargeCustomType,
  ChargeScope,
  ItemChargeInfo,
  ModifierPriceSelection,
  OrderChargeSnapshot,
  OrderDishesSnapshot,
  OrderedDishItem,
  OrderedDishItemAddition,
  OrderPriceSummary,
  SavedOrderItemReference,
  WholeOrderChargeInfo,
} from './order-dishes/order-dishes.types';

export class OrderDishesPage implements OrderDishesPageHost {
  private readonly ctx: OrderDishesPageContext;
  public readonly navigation: OrderDishesPageNavigation;
  public readonly menu: OrderDishesMenuSection;
  public readonly modifier: OrderDishesModifierSection;
  public readonly note: OrderDishesNoteSection;
  public readonly charge: OrderDishesChargeSection;
  public readonly customer: OrderDishesCustomerSection;
  public readonly discount: OrderDishesDiscountSection;
  public readonly driver: OrderDishesDriverSection;
  public readonly reads: OrderDishesReadsSection;
  public readonly tips: OrderDishesTipSection;

  constructor(page: Page) {
    this.ctx = new OrderDishesPageContext(page);
    this.navigation = new OrderDishesPageNavigation(this.ctx, this);
    this.menu = new OrderDishesMenuSection(this.ctx, this);
    this.modifier = new OrderDishesModifierSection(this.ctx, this, (dishName) =>
      this.menu.selectOrderedDish(dishName),
    );
    this.note = new OrderDishesNoteSection(this.ctx, this);
    this.charge = new OrderDishesChargeSection(this.ctx, this);
    this.customer = new OrderDishesCustomerSection(this.ctx, this);
    this.discount = new OrderDishesDiscountSection(this.ctx, this);
    this.driver = new OrderDishesDriverSection(this.ctx);
    this.reads = new OrderDishesReadsSection(this.ctx, this);
    this.tips = new OrderDishesTipSection(this.ctx, this);
  }

  expectLoaded(...args: Parameters<OrderDishesPageNavigation['expectLoaded']>): ReturnType<OrderDishesPageNavigation['expectLoaded']> {
    return this.navigation.expectLoaded(...args);
  }

  expectTableNumber(...args: Parameters<OrderDishesMenuSection['expectTableNumber']>): ReturnType<OrderDishesMenuSection['expectTableNumber']> {
    return this.menu.expectTableNumber(...args);
  }

  openChangeTable(...args: Parameters<OrderDishesMenuSection['openChangeTable']>): ReturnType<OrderDishesMenuSection['openChangeTable']> {
    return this.menu.openChangeTable(...args);
  }

  readAvailableChangeTableNumbers(...args: Parameters<OrderDishesMenuSection['readAvailableChangeTableNumbers']>): ReturnType<OrderDishesMenuSection['readAvailableChangeTableNumbers']> {
    return this.menu.readAvailableChangeTableNumbers(...args);
  }

  selectChangeTableTarget(...args: Parameters<OrderDishesMenuSection['selectChangeTableTarget']>): ReturnType<OrderDishesMenuSection['selectChangeTableTarget']> {
    return this.menu.selectChangeTableTarget(...args);
  }

  confirmChangeTable(...args: Parameters<OrderDishesMenuSection['confirmChangeTable']>): ReturnType<OrderDishesMenuSection['confirmChangeTable']> {
    return this.menu.confirmChangeTable(...args);
  }

  expectGuestCount(...args: Parameters<OrderDishesMenuSection['expectGuestCount']>): ReturnType<OrderDishesMenuSection['expectGuestCount']> {
    return this.menu.expectGuestCount(...args);
  }

  changeGuestCount(...args: Parameters<OrderDishesMenuSection['changeGuestCount']>): ReturnType<OrderDishesMenuSection['changeGuestCount']> {
    return this.menu.changeGuestCount(...args);
  }

  selectSharedSeat(...args: Parameters<OrderDishesMenuSection['selectSharedSeat']>): ReturnType<OrderDishesMenuSection['selectSharedSeat']> {
    return this.menu.selectSharedSeat(...args);
  }

  selectSeat(...args: Parameters<OrderDishesMenuSection['selectSeat']>): ReturnType<OrderDishesMenuSection['selectSeat']> {
    return this.menu.selectSeat(...args);
  }

  clickDish(...args: Parameters<OrderDishesMenuSection['clickDish']>): ReturnType<OrderDishesMenuSection['clickDish']> {
    return this.menu.clickDish(...args);
  }

  markOrderedDishToGo(...args: Parameters<OrderDishesMenuSection['markOrderedDishToGo']>): ReturnType<OrderDishesMenuSection['markOrderedDishToGo']> {
    return this.menu.markOrderedDishToGo(...args);
  }

  addOpenFoodWithoutTax(...args: Parameters<OrderDishesMenuSection['addOpenFoodWithoutTax']>): ReturnType<OrderDishesMenuSection['addOpenFoodWithoutTax']> {
    return this.menu.addOpenFoodWithoutTax(...args);
  }

  searchAndClickDish(...args: Parameters<OrderDishesMenuSection['searchAndClickDish']>): ReturnType<OrderDishesMenuSection['searchAndClickDish']> {
    return this.menu.searchAndClickDish(...args);
  }

  expectSearchMenuVisible(...args: Parameters<OrderDishesMenuSection['expectSearchMenuVisible']>): ReturnType<OrderDishesMenuSection['expectSearchMenuVisible']> {
    return this.menu.expectSearchMenuVisible(...args);
  }

  openSearchMenuAndFill(...args: Parameters<OrderDishesMenuSection['openSearchMenuAndFill']>): ReturnType<OrderDishesMenuSection['openSearchMenuAndFill']> {
    return this.menu.openSearchMenuAndFill(...args);
  }

  selectDriver(...args: Parameters<OrderDishesDriverSection['selectDriver']>): ReturnType<OrderDishesDriverSection['selectDriver']> {
    return this.driver.selectDriver(...args);
  }

  openChineseSearchMenuAndFill(...args: Parameters<OrderDishesMenuSection['openChineseSearchMenuAndFill']>): ReturnType<OrderDishesMenuSection['openChineseSearchMenuAndFill']> {
    return this.menu.openChineseSearchMenuAndFill(...args);
  }

  readSearchMenuResultCountByNameAndNumber(...args: Parameters<OrderDishesMenuSection['readSearchMenuResultCountByNameAndNumber']>): ReturnType<OrderDishesMenuSection['readSearchMenuResultCountByNameAndNumber']> {
    return this.menu.readSearchMenuResultCountByNameAndNumber(...args);
  }

  expectSearchMenuResult(...args: Parameters<OrderDishesMenuSection['expectSearchMenuResult']>): ReturnType<OrderDishesMenuSection['expectSearchMenuResult']> {
    return this.menu.expectSearchMenuResult(...args);
  }

  expectSearchMenuResultByName(...args: Parameters<OrderDishesMenuSection['expectSearchMenuResultByName']>): ReturnType<OrderDishesMenuSection['expectSearchMenuResultByName']> {
    return this.menu.expectSearchMenuResultByName(...args);
  }

  clickSearchMenuResult(...args: Parameters<OrderDishesMenuSection['clickSearchMenuResult']>): ReturnType<OrderDishesMenuSection['clickSearchMenuResult']> {
    return this.menu.clickSearchMenuResult(...args);
  }

  switchMenuGroup(...args: Parameters<OrderDishesMenuSection['switchMenuGroup']>): ReturnType<OrderDishesMenuSection['switchMenuGroup']> {
    return this.menu.switchMenuGroup(...args);
  }

  switchMenuCategory(...args: Parameters<OrderDishesMenuSection['switchMenuCategory']>): ReturnType<OrderDishesMenuSection['switchMenuCategory']> {
    return this.menu.switchMenuCategory(...args);
  }

  switchMenu(...args: Parameters<OrderDishesMenuSection['switchMenu']>): ReturnType<OrderDishesMenuSection['switchMenu']> {
    return this.menu.switchMenu(...args);
  }

  readSelectedMenuGroupName(...args: Parameters<OrderDishesMenuSection['readSelectedMenuGroupName']>): ReturnType<OrderDishesMenuSection['readSelectedMenuGroupName']> {
    return this.menu.readSelectedMenuGroupName(...args);
  }

  readSelectedMenuCategoryName(...args: Parameters<OrderDishesMenuSection['readSelectedMenuCategoryName']>): ReturnType<OrderDishesMenuSection['readSelectedMenuCategoryName']> {
    return this.menu.readSelectedMenuCategoryName(...args);
  }

  readMenuCategoryNames(...args: Parameters<OrderDishesMenuSection['readMenuCategoryNames']>): ReturnType<OrderDishesMenuSection['readMenuCategoryNames']> {
    return this.menu.readMenuCategoryNames(...args);
  }

  readCurrentCategoryDishNames(...args: Parameters<OrderDishesMenuSection['readCurrentCategoryDishNames']>): ReturnType<OrderDishesMenuSection['readCurrentCategoryDishNames']> {
    return this.menu.readCurrentCategoryDishNames(...args);
  }

  clickFirstCurrentCategoryDish(...args: Parameters<OrderDishesMenuSection['clickFirstCurrentCategoryDish']>): ReturnType<OrderDishesMenuSection['clickFirstCurrentCategoryDish']> {
    return this.menu.clickFirstCurrentCategoryDish(...args);
  }

  clickCurrentCategoryDish(...args: Parameters<OrderDishesMenuSection['clickCurrentCategoryDish']>): ReturnType<OrderDishesMenuSection['clickCurrentCategoryDish']> {
    return this.menu.clickCurrentCategoryDish(...args);
  }

  doubleClickCurrentCategoryDish(...args: Parameters<OrderDishesMenuSection['doubleClickCurrentCategoryDish']>): ReturnType<OrderDishesMenuSection['doubleClickCurrentCategoryDish']> {
    return this.menu.doubleClickCurrentCategoryDish(...args);
  }

  changeDishCount(...args: Parameters<OrderDishesMenuSection['changeDishCount']>): ReturnType<OrderDishesMenuSection['changeDishCount']> {
    return this.menu.changeDishCount(...args);
  }

  clickFirstAvailableDish(...args: Parameters<OrderDishesMenuSection['clickFirstAvailableDish']>): ReturnType<OrderDishesMenuSection['clickFirstAvailableDish']> {
    return this.menu.clickFirstAvailableDish(...args);
  }

  selectOrderedDish(...args: Parameters<OrderDishesMenuSection['selectOrderedDish']>): ReturnType<OrderDishesMenuSection['selectOrderedDish']> {
    return this.menu.selectOrderedDish(...args);
  }

  clickSelectedDishAdd(...args: Parameters<OrderDishesMenuSection['clickSelectedDishAdd']>): ReturnType<OrderDishesMenuSection['clickSelectedDishAdd']> {
    return this.menu.clickSelectedDishAdd(...args);
  }

  increaseOrderedDishQuantityByOne(...args: Parameters<OrderDishesMenuSection['increaseOrderedDishQuantityByOne']>): ReturnType<OrderDishesMenuSection['increaseOrderedDishQuantityByOne']> {
    return this.menu.increaseOrderedDishQuantityByOne(...args);
  }

  clickAddLine(...args: Parameters<OrderDishesMenuSection['clickAddLine']>): ReturnType<OrderDishesMenuSection['clickAddLine']> {
    return this.menu.clickAddLine(...args);
  }

  changeOrderedDishPrice(...args: Parameters<OrderDishesMenuSection['changeOrderedDishPrice']>): ReturnType<OrderDishesMenuSection['changeOrderedDishPrice']> {
    return this.menu.changeOrderedDishPrice(...args);
  }

  openSelectedItemPriceDiscountDialog(...args: Parameters<OrderDishesDiscountSection['openSelectedItemPriceDiscountDialog']>): ReturnType<OrderDishesDiscountSection['openSelectedItemPriceDiscountDialog']> {
    return this.discount.openSelectedItemPriceDiscountDialog(...args);
  }

  fillSelectedItemPrice(...args: Parameters<OrderDishesDiscountSection['fillSelectedItemPrice']>): ReturnType<OrderDishesDiscountSection['fillSelectedItemPrice']> {
    return this.discount.fillSelectedItemPrice(...args);
  }

  selectItemDiscount(...args: Parameters<OrderDishesDiscountSection['selectItemDiscount']>): ReturnType<OrderDishesDiscountSection['selectItemDiscount']> {
    return this.discount.selectItemDiscount(...args);
  }

  confirmItemPriceAndDiscountForAuthorization(...args: Parameters<OrderDishesDiscountSection['confirmItemPriceAndDiscountForAuthorization']>): ReturnType<OrderDishesDiscountSection['confirmItemPriceAndDiscountForAuthorization']> {
    return this.discount.confirmItemPriceAndDiscountForAuthorization(...args);
  }

  authorizeItemPriceAndDiscount(...args: Parameters<OrderDishesDiscountSection['authorizeItemPriceAndDiscount']>): ReturnType<OrderDishesDiscountSection['authorizeItemPriceAndDiscount']> {
    return this.discount.authorizeItemPriceAndDiscount(...args);
  }

  setOrderedDishTaxExempt(...args: Parameters<OrderDishesMenuSection['setOrderedDishTaxExempt']>): ReturnType<OrderDishesMenuSection['setOrderedDishTaxExempt']> {
    return this.menu.setOrderedDishTaxExempt(...args);
  }

  requestSelectedItemNoteAndExpectAuthorization(...args: Parameters<OrderDishesNoteSection['requestSelectedItemNoteAndExpectAuthorization']>): ReturnType<OrderDishesNoteSection['requestSelectedItemNoteAndExpectAuthorization']> {
    return this.note.requestSelectedItemNoteAndExpectAuthorization(...args);
  }

  openSelectedItemNote(...args: Parameters<OrderDishesNoteSection['openSelectedItemNote']>): ReturnType<OrderDishesNoteSection['openSelectedItemNote']> {
    return this.note.openSelectedItemNote(...args);
  }

  authorizeSelectedItemNote(...args: Parameters<OrderDishesNoteSection['authorizeSelectedItemNote']>): ReturnType<OrderDishesNoteSection['authorizeSelectedItemNote']> {
    return this.note.authorizeSelectedItemNote(...args);
  }

  fillSelectedItemNote(...args: Parameters<OrderDishesNoteSection['fillSelectedItemNote']>): ReturnType<OrderDishesNoteSection['fillSelectedItemNote']> {
    return this.note.fillSelectedItemNote(...args);
  }

  addOrderNote(...args: Parameters<OrderDishesNoteSection['addOrderNote']>): ReturnType<OrderDishesNoteSection['addOrderNote']> {
    return this.note.addOrderNote(...args);
  }

  openModifyForOrderedDish(...args: Parameters<OrderDishesModifierSection['openModifyForOrderedDish']>): ReturnType<OrderDishesModifierSection['openModifyForOrderedDish']> {
    return this.modifier.openModifyForOrderedDish(...args);
  }

  openModifyForSelectedItem(...args: Parameters<OrderDishesModifierSection['openModifyForSelectedItem']>): ReturnType<OrderDishesModifierSection['openModifyForSelectedItem']> {
    return this.modifier.openModifyForSelectedItem(...args);
  }

  openComboEditorForOrderedCombo(...args: Parameters<OrderDishesMenuSection['openComboEditorForOrderedCombo']>): ReturnType<OrderDishesMenuSection['openComboEditorForOrderedCombo']> {
    return this.menu.openComboEditorForOrderedCombo(...args);
  }

  expectModifyPanelVisible(...args: Parameters<OrderDishesModifierSection['expectModifyPanelVisible']>): ReturnType<OrderDishesModifierSection['expectModifyPanelVisible']> {
    return this.modifier.expectModifyPanelVisible(...args);
  }

  closeModifyPanel(...args: Parameters<OrderDishesModifierSection['closeModifyPanel']>): ReturnType<OrderDishesModifierSection['closeModifyPanel']> {
    return this.modifier.closeModifyPanel(...args);
  }

  selectModifyAction(...args: Parameters<OrderDishesModifierSection['selectModifyAction']>): ReturnType<OrderDishesModifierSection['selectModifyAction']> {
    return this.modifier.selectModifyAction(...args);
  }

  selectModifyCategory(...args: Parameters<OrderDishesModifierSection['selectModifyCategory']>): ReturnType<OrderDishesModifierSection['selectModifyCategory']> {
    return this.modifier.selectModifyCategory(...args);
  }

  selectModifyOption(...args: Parameters<OrderDishesModifierSection['selectModifyOption']>): ReturnType<OrderDishesModifierSection['selectModifyOption']> {
    return this.modifier.selectModifyOption(...args);
  }

  isModifyPanelVisible(...args: Parameters<OrderDishesModifierSection['isModifyPanelVisible']>): ReturnType<OrderDishesModifierSection['isModifyPanelVisible']> {
    return this.modifier.isModifyPanelVisible(...args);
  }

  addSelectedModifyOption(...args: Parameters<OrderDishesModifierSection['addSelectedModifyOption']>): ReturnType<OrderDishesModifierSection['addSelectedModifyOption']> {
    return this.modifier.addSelectedModifyOption(...args);
  }

  changeSelectedModifyOptionCount(...args: Parameters<OrderDishesModifierSection['changeSelectedModifyOptionCount']>): ReturnType<OrderDishesModifierSection['changeSelectedModifyOptionCount']> {
    return this.modifier.changeSelectedModifyOptionCount(...args);
  }

  reduceSelectedModifyOption(...args: Parameters<OrderDishesModifierSection['reduceSelectedModifyOption']>): ReturnType<OrderDishesModifierSection['reduceSelectedModifyOption']> {
    return this.modifier.reduceSelectedModifyOption(...args);
  }

  selectModifyPrice(...args: Parameters<OrderDishesModifierSection['selectModifyPrice']>): ReturnType<OrderDishesModifierSection['selectModifyPrice']> {
    return this.modifier.selectModifyPrice(...args);
  }

  addCustomModifier(...args: Parameters<OrderDishesModifierSection['addCustomModifier']>): ReturnType<OrderDishesModifierSection['addCustomModifier']> {
    return this.modifier.addCustomModifier(...args);
  }

  expectWeightDialogVisible(...args: Parameters<OrderDishesMenuSection['expectWeightDialogVisible']>): ReturnType<OrderDishesMenuSection['expectWeightDialogVisible']> {
    return this.menu.expectWeightDialogVisible(...args);
  }

  enterWeight(...args: Parameters<OrderDishesMenuSection['enterWeight']>): ReturnType<OrderDishesMenuSection['enterWeight']> {
    return this.menu.enterWeight(...args);
  }

  confirmWeightDialog(...args: Parameters<OrderDishesMenuSection['confirmWeightDialog']>): ReturnType<OrderDishesMenuSection['confirmWeightDialog']> {
    return this.menu.confirmWeightDialog(...args);
  }

  expectPriceDialogVisible(...args: Parameters<OrderDishesMenuSection['expectPriceDialogVisible']>): ReturnType<OrderDishesMenuSection['expectPriceDialogVisible']> {
    return this.menu.expectPriceDialogVisible(...args);
  }

  enterPrice(...args: Parameters<OrderDishesMenuSection['enterPrice']>): ReturnType<OrderDishesMenuSection['enterPrice']> {
    return this.menu.enterPrice(...args);
  }

  confirmPriceDialog(...args: Parameters<OrderDishesMenuSection['confirmPriceDialog']>): ReturnType<OrderDishesMenuSection['confirmPriceDialog']> {
    return this.menu.confirmPriceDialog(...args);
  }

  addOpenFood(...args: Parameters<OrderDishesMenuSection['addOpenFood']>): ReturnType<OrderDishesMenuSection['addOpenFood']> {
    return this.menu.addOpenFood(...args);
  }

  openOpenFoodDialog(...args: Parameters<OrderDishesMenuSection['openOpenFoodDialog']>): ReturnType<OrderDishesMenuSection['openOpenFoodDialog']> {
    return this.menu.openOpenFoodDialog(...args);
  }

  readOpenFoodKeyboardLanguage(...args: Parameters<OrderDishesMenuSection['readOpenFoodKeyboardLanguage']>): ReturnType<OrderDishesMenuSection['readOpenFoodKeyboardLanguage']> {
    return this.menu.readOpenFoodKeyboardLanguage(...args);
  }

  switchOpenFoodKeyboardLanguage(...args: Parameters<OrderDishesMenuSection['switchOpenFoodKeyboardLanguage']>): ReturnType<OrderDishesMenuSection['switchOpenFoodKeyboardLanguage']> {
    return this.menu.switchOpenFoodKeyboardLanguage(...args);
  }

  pressOpenFoodKeyboardLetters(...args: Parameters<OrderDishesMenuSection['pressOpenFoodKeyboardLetters']>): ReturnType<OrderDishesMenuSection['pressOpenFoodKeyboardLetters']> {
    return this.menu.pressOpenFoodKeyboardLetters(...args);
  }

  selectOpenFoodKeyboardCandidate(...args: Parameters<OrderDishesMenuSection['selectOpenFoodKeyboardCandidate']>): ReturnType<OrderDishesMenuSection['selectOpenFoodKeyboardCandidate']> {
    return this.menu.selectOpenFoodKeyboardCandidate(...args);
  }

  readOpenFoodName(...args: Parameters<OrderDishesMenuSection['readOpenFoodName']>): ReturnType<OrderDishesMenuSection['readOpenFoodName']> {
    return this.menu.readOpenFoodName(...args);
  }

  fillOpenFoodPriceAndConfirm(...args: Parameters<OrderDishesMenuSection['fillOpenFoodPriceAndConfirm']>): ReturnType<OrderDishesMenuSection['fillOpenFoodPriceAndConfirm']> {
    return this.menu.fillOpenFoodPriceAndConfirm(...args);
  }

  expectSpecificationDialogVisible(...args: Parameters<OrderDishesMenuSection['expectSpecificationDialogVisible']>): ReturnType<OrderDishesMenuSection['expectSpecificationDialogVisible']> {
    return this.menu.expectSpecificationDialogVisible(...args);
  }

  isSpecificationDialogVisible(...args: Parameters<OrderDishesMenuSection['isSpecificationDialogVisible']>): ReturnType<OrderDishesMenuSection['isSpecificationDialogVisible']> {
    return this.menu.isSpecificationDialogVisible(...args);
  }

  expectCategoryOptionPanelVisible(...args: Parameters<OrderDishesMenuSection['expectCategoryOptionPanelVisible']>): ReturnType<OrderDishesMenuSection['expectCategoryOptionPanelVisible']> {
    return this.menu.expectCategoryOptionPanelVisible(...args);
  }

  isCategoryOptionPanelVisible(...args: Parameters<OrderDishesMenuSection['isCategoryOptionPanelVisible']>): ReturnType<OrderDishesMenuSection['isCategoryOptionPanelVisible']> {
    return this.menu.isCategoryOptionPanelVisible(...args);
  }

  selectSpecification(...args: Parameters<OrderDishesMenuSection['selectSpecification']>): ReturnType<OrderDishesMenuSection['selectSpecification']> {
    return this.menu.selectSpecification(...args);
  }

  selectCategoryOption(...args: Parameters<OrderDishesMenuSection['selectCategoryOption']>): ReturnType<OrderDishesMenuSection['selectCategoryOption']> {
    return this.menu.selectCategoryOption(...args);
  }

  expectItemOptionVisible(...args: Parameters<OrderDishesMenuSection['expectItemOptionVisible']>): ReturnType<OrderDishesMenuSection['expectItemOptionVisible']> {
    return this.menu.expectItemOptionVisible(...args);
  }

  confirmSpecificationDialog(...args: Parameters<OrderDishesMenuSection['confirmSpecificationDialog']>): ReturnType<OrderDishesMenuSection['confirmSpecificationDialog']> {
    return this.menu.confirmSpecificationDialog(...args);
  }

  selectComboSectionItem(...args: Parameters<OrderDishesMenuSection['selectComboSectionItem']>): ReturnType<OrderDishesMenuSection['selectComboSectionItem']> {
    return this.menu.selectComboSectionItem(...args);
  }

  confirmComboDialog(...args: Parameters<OrderDishesMenuSection['confirmComboDialog']>): ReturnType<OrderDishesMenuSection['confirmComboDialog']> {
    return this.menu.confirmComboDialog(...args);
  }

  selectComboItem(...args: Parameters<OrderDishesMenuSection['selectComboItem']>): ReturnType<OrderDishesMenuSection['selectComboItem']> {
    return this.menu.selectComboItem(...args);
  }

  expectComboItemVisible(...args: Parameters<OrderDishesMenuSection['expectComboItemVisible']>): ReturnType<OrderDishesMenuSection['expectComboItemVisible']> {
    return this.menu.expectComboItemVisible(...args);
  }

  selectComboSubItem(...args: Parameters<OrderDishesMenuSection['selectComboSubItem']>): ReturnType<OrderDishesMenuSection['selectComboSubItem']> {
    return this.menu.selectComboSubItem(...args);
  }

  changeComboSubItemPrice(...args: Parameters<OrderDishesMenuSection['changeComboSubItemPrice']>): ReturnType<OrderDishesMenuSection['changeComboSubItemPrice']> {
    return this.menu.changeComboSubItemPrice(...args);
  }

  reduceSelectedComboOption(...args: Parameters<OrderDishesMenuSection['reduceSelectedComboOption']>): ReturnType<OrderDishesMenuSection['reduceSelectedComboOption']> {
    return this.menu.reduceSelectedComboOption(...args);
  }

  clickCharge(...args: Parameters<OrderDishesChargeSection['clickCharge']>): ReturnType<OrderDishesChargeSection['clickCharge']> {
    return this.charge.clickCharge(...args);
  }

  expectChargeDialogVisible(...args: Parameters<OrderDishesChargeSection['expectChargeDialogVisible']>): ReturnType<OrderDishesChargeSection['expectChargeDialogVisible']> {
    return this.charge.expectChargeDialogVisible(...args);
  }

  isChargeDialogVisible(...args: Parameters<OrderDishesChargeSection['isChargeDialogVisible']>): ReturnType<OrderDishesChargeSection['isChargeDialogVisible']> {
    return this.charge.isChargeDialogVisible(...args);
  }

  switchChargeScope(...args: Parameters<OrderDishesChargeSection['switchChargeScope']>): ReturnType<OrderDishesChargeSection['switchChargeScope']> {
    return this.charge.switchChargeScope(...args);
  }

  toggleChargeDish(...args: Parameters<OrderDishesChargeSection['toggleChargeDish']>): ReturnType<OrderDishesChargeSection['toggleChargeDish']> {
    return this.charge.toggleChargeDish(...args);
  }

  toggleChargeOption(...args: Parameters<OrderDishesChargeSection['toggleChargeOption']>): ReturnType<OrderDishesChargeSection['toggleChargeOption']> {
    return this.charge.toggleChargeOption(...args);
  }

  clickCustomCharge(...args: Parameters<OrderDishesChargeSection['clickCustomCharge']>): ReturnType<OrderDishesChargeSection['clickCustomCharge']> {
    return this.charge.clickCustomCharge(...args);
  }

  applyCustomPercentageDiscount(...args: Parameters<OrderDishesChargeSection['applyCustomPercentageDiscount']>): ReturnType<OrderDishesChargeSection['applyCustomPercentageDiscount']> {
    return this.charge.applyCustomPercentageDiscount(...args);
  }

  applyCustomFixedDiscount(...args: Parameters<OrderDishesChargeSection['applyCustomFixedDiscount']>): ReturnType<OrderDishesChargeSection['applyCustomFixedDiscount']> {
    return this.charge.applyCustomFixedDiscount(...args);
  }

  selectCustomChargeType(...args: Parameters<OrderDishesChargeSection['selectCustomChargeType']>): ReturnType<OrderDishesChargeSection['selectCustomChargeType']> {
    return this.charge.selectCustomChargeType(...args);
  }

  fillCustomChargeValue(...args: Parameters<OrderDishesChargeSection['fillCustomChargeValue']>): ReturnType<OrderDishesChargeSection['fillCustomChargeValue']> {
    return this.charge.fillCustomChargeValue(...args);
  }

  setCustomChargeTaxed(...args: Parameters<OrderDishesChargeSection['setCustomChargeTaxed']>): ReturnType<OrderDishesChargeSection['setCustomChargeTaxed']> {
    return this.charge.setCustomChargeTaxed(...args);
  }

  confirmCustomChargeDialog(...args: Parameters<OrderDishesChargeSection['confirmCustomChargeDialog']>): ReturnType<OrderDishesChargeSection['confirmCustomChargeDialog']> {
    return this.charge.confirmCustomChargeDialog(...args);
  }

  closeCustomChargeDialog(...args: Parameters<OrderDishesChargeSection['closeCustomChargeDialog']>): ReturnType<OrderDishesChargeSection['closeCustomChargeDialog']> {
    return this.charge.closeCustomChargeDialog(...args);
  }

  clearSelectedChargeEntries(...args: Parameters<OrderDishesChargeSection['clearSelectedChargeEntries']>): ReturnType<OrderDishesChargeSection['clearSelectedChargeEntries']> {
    return this.charge.clearSelectedChargeEntries(...args);
  }

  clearAllCharges(...args: Parameters<OrderDishesChargeSection['clearAllCharges']>): ReturnType<OrderDishesChargeSection['clearAllCharges']> {
    return this.charge.clearAllCharges(...args);
  }

  confirmChargeDialog(...args: Parameters<OrderDishesChargeSection['confirmChargeDialog']>): ReturnType<OrderDishesChargeSection['confirmChargeDialog']> {
    return this.charge.confirmChargeDialog(...args);
  }

  closeChargeDialog(...args: Parameters<OrderDishesChargeSection['closeChargeDialog']>): ReturnType<OrderDishesChargeSection['closeChargeDialog']> {
    return this.charge.closeChargeDialog(...args);
  }

  readChargeSnapshot(...args: Parameters<OrderDishesChargeSection['readChargeSnapshot']>): ReturnType<OrderDishesChargeSection['readChargeSnapshot']> {
    return this.charge.readChargeSnapshot(...args);
  }

  expectChargeDishVisible(...args: Parameters<OrderDishesChargeSection['expectChargeDishVisible']>): ReturnType<OrderDishesChargeSection['expectChargeDishVisible']> {
    return this.charge.expectChargeDishVisible(...args);
  }

  expectCartHasItems(...args: Parameters<OrderDishesReadsSection['expectCartHasItems']>): ReturnType<OrderDishesReadsSection['expectCartHasItems']> {
    return this.reads.expectCartHasItems(...args);
  }

  expectOrderedDishAddition(...args: Parameters<OrderDishesReadsSection['expectOrderedDishAddition']>): ReturnType<OrderDishesReadsSection['expectOrderedDishAddition']> {
    return this.reads.expectOrderedDishAddition(...args);
  }

  readOrderedItems(...args: Parameters<OrderDishesReadsSection['readOrderedItems']>): ReturnType<OrderDishesReadsSection['readOrderedItems']> {
    return this.reads.readOrderedItems(...args);
  }

  readOrderedDishRowStates(...args: Parameters<OrderDishesReadsSection['readOrderedDishRowStates']>): ReturnType<OrderDishesReadsSection['readOrderedDishRowStates']> {
    return this.reads.readOrderedDishRowStates(...args);
  }

  readOrderedDishNameColor(...args: Parameters<OrderDishesReadsSection['readOrderedDishNameColor']>): ReturnType<OrderDishesReadsSection['readOrderedDishNameColor']> {
    return this.reads.readOrderedDishNameColor(...args);
  }

  readOrderedDishPrice(...args: Parameters<OrderDishesReadsSection['readOrderedDishPrice']>): ReturnType<OrderDishesReadsSection['readOrderedDishPrice']> {
    return this.reads.readOrderedDishPrice(...args);
  }

  readComboSubItemPrice(...args: Parameters<OrderDishesReadsSection['readComboSubItemPrice']>): ReturnType<OrderDishesReadsSection['readComboSubItemPrice']> {
    return this.reads.readComboSubItemPrice(...args);
  }

  isOrderedDishDetailVisible(...args: Parameters<OrderDishesReadsSection['isOrderedDishDetailVisible']>): ReturnType<OrderDishesReadsSection['isOrderedDishDetailVisible']> {
    return this.reads.isOrderedDishDetailVisible(...args);
  }

  expectOrderedDishAbsent(...args: Parameters<OrderDishesReadsSection['expectOrderedDishAbsent']>): ReturnType<OrderDishesReadsSection['expectOrderedDishAbsent']> {
    return this.reads.expectOrderedDishAbsent(...args);
  }

  readOrderedDishAdditionQuantity(...args: Parameters<OrderDishesReadsSection['readOrderedDishAdditionQuantity']>): ReturnType<OrderDishesReadsSection['readOrderedDishAdditionQuantity']> {
    return this.reads.readOrderedDishAdditionQuantity(...args);
  }

  readCountText(...args: Parameters<OrderDishesReadsSection['readCountText']>): ReturnType<OrderDishesReadsSection['readCountText']> {
    return this.reads.readCountText(...args);
  }

  readPriceSummary(...args: Parameters<OrderDishesReadsSection['readPriceSummary']>): ReturnType<OrderDishesReadsSection['readPriceSummary']> {
    return this.reads.readPriceSummary(...args);
  }

  addTip(...args: Parameters<OrderDishesTipSection['addTip']>): ReturnType<OrderDishesTipSection['addTip']> {
    return this.tips.addTip(...args);
  }

  expandPriceSummary(...args: Parameters<OrderDishesReadsSection['expandPriceSummary']>): ReturnType<OrderDishesReadsSection['expandPriceSummary']> {
    return this.reads.expandPriceSummary(...args);
  }

  readTaxAmount(...args: Parameters<OrderDishesReadsSection['readTaxAmount']>): ReturnType<OrderDishesReadsSection['readTaxAmount']> {
    return this.reads.readTaxAmount(...args);
  }

  readOrderSnapshot(...args: Parameters<OrderDishesReadsSection['readOrderSnapshot']>): ReturnType<OrderDishesReadsSection['readOrderSnapshot']> {
    return this.reads.readOrderSnapshot(...args);
  }

  saveOrder(...args: Parameters<OrderDishesPageNavigation['saveOrder']>): ReturnType<OrderDishesPageNavigation['saveOrder']> {
    return this.navigation.saveOrder(...args);
  }

  saveOrderWithReference(...args: Parameters<OrderDishesPageNavigation['saveOrderWithReference']>): ReturnType<OrderDishesPageNavigation['saveOrderWithReference']> {
    return this.navigation.saveOrderWithReference(...args);
  }

  sendOrder(...args: Parameters<OrderDishesPageNavigation['sendOrder']>): ReturnType<OrderDishesPageNavigation['sendOrder']> {
    return this.navigation.sendOrder(...args);
  }

  sendOrderWithReference(...args: Parameters<OrderDishesPageNavigation['sendOrderWithReference']>): ReturnType<OrderDishesPageNavigation['sendOrderWithReference']> {
    return this.navigation.sendOrderWithReference(...args);
  }

  printReceiptWithReference(...args: Parameters<OrderDishesPageNavigation['printReceiptWithReference']>): ReturnType<OrderDishesPageNavigation['printReceiptWithReference']> {
    return this.navigation.printReceiptWithReference(...args);
  }

  clickSaveOrder(...args: Parameters<OrderDishesPageNavigation['clickSaveOrder']>): ReturnType<OrderDishesPageNavigation['clickSaveOrder']> {
    return this.navigation.clickSaveOrder(...args);
  }

  confirmConfigurationRefresh(...args: Parameters<OrderDishesPageNavigation['confirmConfigurationRefresh']>): ReturnType<OrderDishesPageNavigation['confirmConfigurationRefresh']> {
    return this.navigation.confirmConfigurationRefresh(...args);
  }

  readInventoryAlertText(...args: Parameters<OrderDishesPageNavigation['readInventoryAlertText']>): ReturnType<OrderDishesPageNavigation['readInventoryAlertText']> {
    return this.navigation.readInventoryAlertText(...args);
  }

  openInventoryPage(...args: Parameters<OrderDishesPageNavigation['openInventoryPage']>): ReturnType<OrderDishesPageNavigation['openInventoryPage']> {
    return this.navigation.openInventoryPage(...args);
  }

  exitOrderPage(...args: Parameters<OrderDishesPageNavigation['exitOrderPage']>): ReturnType<OrderDishesPageNavigation['exitOrderPage']> {
    return this.navigation.exitOrderPage(...args);
  }

  exitOrderPageWithoutConfirmation(...args: Parameters<OrderDishesPageNavigation['exitOrderPageWithoutConfirmation']>): ReturnType<OrderDishesPageNavigation['exitOrderPageWithoutConfirmation']> {
    return this.navigation.exitOrderPageWithoutConfirmation(...args);
  }

  reduceOrderedDishQuantity(...args: Parameters<OrderDishesMenuSection['reduceOrderedDishQuantity']>): ReturnType<OrderDishesMenuSection['reduceOrderedDishQuantity']> {
    return this.menu.reduceOrderedDishQuantity(...args);
  }

  removeSentDish(...args: Parameters<OrderDishesMenuSection['removeSentDish']>): ReturnType<OrderDishesMenuSection['removeSentDish']> {
    return this.menu.removeSentDish(...args);
  }

  requestSentDishRemovalAndExpectAuthorization(...args: Parameters<OrderDishesMenuSection['requestSentDishRemovalAndExpectAuthorization']>): ReturnType<OrderDishesMenuSection['requestSentDishRemovalAndExpectAuthorization']> {
    return this.menu.requestSentDishRemovalAndExpectAuthorization(...args);
  }

  expectPendingDishRemovalAuthorization(...args: Parameters<OrderDishesMenuSection['expectPendingDishRemovalAuthorization']>): ReturnType<OrderDishesMenuSection['expectPendingDishRemovalAuthorization']> {
    return this.menu.expectPendingDishRemovalAuthorization(...args);
  }

  authorizePendingDishRemoval(...args: Parameters<OrderDishesMenuSection['authorizePendingDishRemoval']>): ReturnType<OrderDishesMenuSection['authorizePendingDishRemoval']> {
    return this.menu.authorizePendingDishRemoval(...args);
  }

  changeOrderedDishQuantity(...args: Parameters<OrderDishesMenuSection['changeOrderedDishQuantity']>): ReturnType<OrderDishesMenuSection['changeOrderedDishQuantity']> {
    return this.menu.changeOrderedDishQuantity(...args);
  }

  clickRecall(...args: Parameters<OrderDishesPageNavigation['clickRecall']>): ReturnType<OrderDishesPageNavigation['clickRecall']> {
    return this.navigation.clickRecall(...args);
  }

  openPayment(...args: Parameters<OrderDishesPageNavigation['openPayment']>): ReturnType<OrderDishesPageNavigation['openPayment']> {
    return this.navigation.openPayment(...args);
  }

  openCustomerDialogForPayment(...args: Parameters<OrderDishesCustomerSection['openCustomerDialogForPayment']>): ReturnType<OrderDishesCustomerSection['openCustomerDialogForPayment']> {
    return this.customer.openCustomerDialogForPayment(...args);
  }

  openEmptyCustomerInformation(...args: Parameters<OrderDishesCustomerSection['openEmptyCustomerInformation']>): ReturnType<OrderDishesCustomerSection['openEmptyCustomerInformation']> {
    return this.customer.openEmptyCustomerInformation(...args);
  }

  openCustomerInformation(...args: Parameters<OrderDishesCustomerSection['openCustomerInformation']>): ReturnType<OrderDishesCustomerSection['openCustomerInformation']> {
    return this.customer.openCustomerInformation(...args);
  }

  fillCustomerInformation(...args: Parameters<OrderDishesCustomerSection['fillCustomerInformation']>): ReturnType<OrderDishesCustomerSection['fillCustomerInformation']> {
    return this.customer.fillCustomerInformation(...args);
  }

  readCustomerButtonText(...args: Parameters<OrderDishesCustomerSection['readCustomerButtonText']>): ReturnType<OrderDishesCustomerSection['readCustomerButtonText']> {
    return this.customer.readCustomerButtonText(...args);
  }

  openCustomerInformationPage(...args: Parameters<OrderDishesCustomerSection['openCustomerInformationPage']>): ReturnType<OrderDishesCustomerSection['openCustomerInformationPage']> {
    return this.customer.openCustomerInformationPage(...args);
  }

  readCustomerInformationPageIdentity(...args: Parameters<OrderDishesCustomerSection['readCustomerInformationPageIdentity']>): ReturnType<OrderDishesCustomerSection['readCustomerInformationPageIdentity']> {
    return this.customer.readCustomerInformationPageIdentity(...args);
  }

  saveCustomerInformationPage(...args: Parameters<OrderDishesCustomerSection['saveCustomerInformationPage']>): ReturnType<OrderDishesCustomerSection['saveCustomerInformationPage']> {
    return this.customer.saveCustomerInformationPage(...args);
  }

  readCustomerInformationSnapshot(...args: Parameters<OrderDishesCustomerSection['readCustomerInformationSnapshot']>): ReturnType<OrderDishesCustomerSection['readCustomerInformationSnapshot']> {
    return this.customer.readCustomerInformationSnapshot(...args);
  }

  saveCustomerInformation(...args: Parameters<OrderDishesCustomerSection['saveCustomerInformation']>): ReturnType<OrderDishesCustomerSection['saveCustomerInformation']> {
    return this.customer.saveCustomerInformation(...args);
  }

  confirmEmptyCustomerAndExpectNameRequired(...args: Parameters<OrderDishesCustomerSection['confirmEmptyCustomerAndExpectNameRequired']>): ReturnType<OrderDishesCustomerSection['confirmEmptyCustomerAndExpectNameRequired']> {
    return this.customer.confirmEmptyCustomerAndExpectNameRequired(...args);
  }

  fillCustomerName(...args: Parameters<OrderDishesCustomerSection['fillCustomerName']>): ReturnType<OrderDishesCustomerSection['fillCustomerName']> {
    return this.customer.fillCustomerName(...args);
  }

  confirmCustomerNameAndExpectPhoneRequired(...args: Parameters<OrderDishesCustomerSection['confirmCustomerNameAndExpectPhoneRequired']>): ReturnType<OrderDishesCustomerSection['confirmCustomerNameAndExpectPhoneRequired']> {
    return this.customer.confirmCustomerNameAndExpectPhoneRequired(...args);
  }

  fillCustomerPhone(...args: Parameters<OrderDishesCustomerSection['fillCustomerPhone']>): ReturnType<OrderDishesCustomerSection['fillCustomerPhone']> {
    return this.customer.fillCustomerPhone(...args);
  }

  confirmCustomerAndOpenPayment(...args: Parameters<OrderDishesCustomerSection['confirmCustomerAndOpenPayment']>): ReturnType<OrderDishesCustomerSection['confirmCustomerAndOpenPayment']> {
    return this.customer.confirmCustomerAndOpenPayment(...args);
  }

  openSplitOrder(...args: Parameters<OrderDishesPageNavigation['openSplitOrder']>): ReturnType<OrderDishesPageNavigation['openSplitOrder']> {
    return this.navigation.openSplitOrder(...args);
  }
}

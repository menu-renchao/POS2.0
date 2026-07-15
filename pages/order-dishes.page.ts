import type { Page } from '@playwright/test';
import { OrderDishesChargeSection } from './order-dishes/order-dishes-charge.section';
import { OrderDishesCustomerSection } from './order-dishes/order-dishes-customer.section';
import { OrderDishesMenuSection } from './order-dishes/order-dishes-menu.section';
import { OrderDishesModifierSection } from './order-dishes/order-dishes-modifier.section';
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
  WholeOrderChargeInfo,
} from './order-dishes/order-dishes.types';

export class OrderDishesPage implements OrderDishesPageHost {
  private readonly ctx: OrderDishesPageContext;
  public readonly navigation: OrderDishesPageNavigation;
  public readonly menu: OrderDishesMenuSection;
  public readonly modifier: OrderDishesModifierSection;
  public readonly charge: OrderDishesChargeSection;
  public readonly customer: OrderDishesCustomerSection;
  public readonly reads: OrderDishesReadsSection;
  public readonly tips: OrderDishesTipSection;

  constructor(page: Page) {
    this.ctx = new OrderDishesPageContext(page);
    this.navigation = new OrderDishesPageNavigation(this.ctx, this);
    this.menu = new OrderDishesMenuSection(this.ctx, this);
    this.modifier = new OrderDishesModifierSection(this.ctx, this, (dishName) =>
      this.menu.selectOrderedDish(dishName),
    );
    this.charge = new OrderDishesChargeSection(this.ctx, this);
    this.customer = new OrderDishesCustomerSection(this.ctx, this);
    this.reads = new OrderDishesReadsSection(this.ctx, this);
    this.tips = new OrderDishesTipSection(this.ctx, this);
  }

  expectLoaded(...args: Parameters<OrderDishesPageNavigation['expectLoaded']>): ReturnType<OrderDishesPageNavigation['expectLoaded']> {
    return this.navigation.expectLoaded(...args);
  }

  expectTableNumber(...args: Parameters<OrderDishesMenuSection['expectTableNumber']>): ReturnType<OrderDishesMenuSection['expectTableNumber']> {
    return this.menu.expectTableNumber(...args);
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

  addOpenFoodWithoutTax(...args: Parameters<OrderDishesMenuSection['addOpenFoodWithoutTax']>): ReturnType<OrderDishesMenuSection['addOpenFoodWithoutTax']> {
    return this.menu.addOpenFoodWithoutTax(...args);
  }

  searchAndClickDish(...args: Parameters<OrderDishesMenuSection['searchAndClickDish']>): ReturnType<OrderDishesMenuSection['searchAndClickDish']> {
    return this.menu.searchAndClickDish(...args);
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

  setOrderedDishTaxExempt(...args: Parameters<OrderDishesMenuSection['setOrderedDishTaxExempt']>): ReturnType<OrderDishesMenuSection['setOrderedDishTaxExempt']> {
    return this.menu.setOrderedDishTaxExempt(...args);
  }

  openModifyForOrderedDish(...args: Parameters<OrderDishesModifierSection['openModifyForOrderedDish']>): ReturnType<OrderDishesModifierSection['openModifyForOrderedDish']> {
    return this.modifier.openModifyForOrderedDish(...args);
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

  confirmSpecificationDialog(...args: Parameters<OrderDishesMenuSection['confirmSpecificationDialog']>): ReturnType<OrderDishesMenuSection['confirmSpecificationDialog']> {
    return this.menu.confirmSpecificationDialog(...args);
  }

  selectComboSectionItem(...args: Parameters<OrderDishesMenuSection['selectComboSectionItem']>): ReturnType<OrderDishesMenuSection['selectComboSectionItem']> {
    return this.menu.selectComboSectionItem(...args);
  }

  confirmComboDialog(...args: Parameters<OrderDishesMenuSection['confirmComboDialog']>): ReturnType<OrderDishesMenuSection['confirmComboDialog']> {
    return this.menu.confirmComboDialog(...args);
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

  clickSaveOrder(...args: Parameters<OrderDishesPageNavigation['clickSaveOrder']>): ReturnType<OrderDishesPageNavigation['clickSaveOrder']> {
    return this.navigation.clickSaveOrder(...args);
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

  reduceOrderedDishQuantity(...args: Parameters<OrderDishesMenuSection['reduceOrderedDishQuantity']>): ReturnType<OrderDishesMenuSection['reduceOrderedDishQuantity']> {
    return this.menu.reduceOrderedDishQuantity(...args);
  }

  requestSentDishRemovalAndExpectAuthorization(...args: Parameters<OrderDishesMenuSection['requestSentDishRemovalAndExpectAuthorization']>): ReturnType<OrderDishesMenuSection['requestSentDishRemovalAndExpectAuthorization']> {
    return this.menu.requestSentDishRemovalAndExpectAuthorization(...args);
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

import fs from 'node:fs';
import path from 'node:path';

const delegations = [
  ['navigation', 'expectLoaded'],
  ['menu', 'expectTableNumber'],
  ['menu', 'expectGuestCount'],
  ['menu', 'clickDish'],
  ['menu', 'searchAndClickDish'],
  ['menu', 'expectSearchMenuVisible'],
  ['menu', 'openSearchMenuAndFill'],
  ['menu', 'expectSearchMenuResult'],
  ['menu', 'clickSearchMenuResult'],
  ['menu', 'switchMenuGroup'],
  ['menu', 'switchMenuCategory'],
  ['menu', 'switchMenu'],
  ['menu', 'changeDishCount'],
  ['menu', 'clickFirstAvailableDish'],
  ['menu', 'selectOrderedDish'],
  ['menu', 'clickSelectedDishAdd'],
  ['menu', 'increaseOrderedDishQuantityByOne'],
  ['modifier', 'openModifyForOrderedDish'],
  ['modifier', 'expectModifyPanelVisible'],
  ['modifier', 'closeModifyPanel'],
  ['modifier', 'selectModifyAction'],
  ['modifier', 'selectModifyCategory'],
  ['modifier', 'selectModifyOption'],
  ['modifier', 'selectModifyPrice'],
  ['modifier', 'addCustomModifier'],
  ['menu', 'expectWeightDialogVisible'],
  ['menu', 'enterWeight'],
  ['menu', 'confirmWeightDialog'],
  ['menu', 'expectPriceDialogVisible'],
  ['menu', 'enterPrice'],
  ['menu', 'confirmPriceDialog'],
  ['menu', 'expectSpecificationDialogVisible'],
  ['menu', 'isSpecificationDialogVisible'],
  ['menu', 'expectCategoryOptionPanelVisible'],
  ['menu', 'isCategoryOptionPanelVisible'],
  ['menu', 'selectSpecification'],
  ['menu', 'selectCategoryOption'],
  ['menu', 'expectItemOptionVisible'],
  ['menu', 'confirmSpecificationDialog'],
  ['menu', 'selectComboSectionItem'],
  ['menu', 'confirmComboDialog'],
  ['menu', 'selectComboItem'],
  ['menu', 'reduceSelectedComboOption'],
  ['charge', 'clickCharge'],
  ['charge', 'expectChargeDialogVisible'],
  ['charge', 'isChargeDialogVisible'],
  ['charge', 'switchChargeScope'],
  ['charge', 'toggleChargeDish'],
  ['charge', 'toggleChargeOption'],
  ['charge', 'clickCustomCharge'],
  ['charge', 'selectCustomChargeType'],
  ['charge', 'fillCustomChargeValue'],
  ['charge', 'setCustomChargeTaxed'],
  ['charge', 'confirmCustomChargeDialog'],
  ['charge', 'closeCustomChargeDialog'],
  ['charge', 'clearSelectedChargeEntries'],
  ['charge', 'clearAllCharges'],
  ['charge', 'confirmChargeDialog'],
  ['charge', 'closeChargeDialog'],
  ['charge', 'readChargeSnapshot'],
  ['reads', 'expectCartHasItems'],
  ['reads', 'readOrderedItems'],
  ['reads', 'readOrderedDishPrice'],
  ['reads', 'isOrderedDishDetailVisible'],
  ['reads', 'readPriceSummary'],
  ['reads', 'expandPriceSummary'],
  ['reads', 'readTaxAmount'],
  ['reads', 'readOrderSnapshot'],
  ['navigation', 'saveOrder'],
  ['navigation', 'sendOrder'],
  ['navigation', 'clickSaveOrder'],
  ['navigation', 'readInventoryAlertText'],
  ['navigation', 'openInventoryPage'],
  ['navigation', 'exitOrderPage'],
  ['menu', 'reduceOrderedDishQuantity'],
  ['menu', 'changeOrderedDishQuantity'],
  ['navigation', 'clickRecall'],
  ['navigation', 'openPayment'],
  ['navigation', 'openSplitOrder'],
];

const sectionTypes = {
  navigation: 'OrderDishesPageNavigation',
  menu: 'OrderDishesMenuSection',
  modifier: 'OrderDishesModifierSection',
  charge: 'OrderDishesChargeSection',
  reads: 'OrderDishesReadsSection',
};

const methods = delegations
  .map(([section, name]) => {
    const typeName = sectionTypes[section];
    return `  ${name}(...args: Parameters<${typeName}['${name}']>): ReturnType<${typeName}['${name}']> {
    return this.${section}.${name}(...args);
  }`;
  })
  .join('\n\n');

const facade = `import type { Page } from '@playwright/test';
import { OrderDishesChargeSection } from './order-dishes/order-dishes-charge.section';
import { OrderDishesMenuSection } from './order-dishes/order-dishes-menu.section';
import { OrderDishesModifierSection } from './order-dishes/order-dishes-modifier.section';
import { OrderDishesPageContext } from './order-dishes/order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes/order-dishes-page-host';
import { OrderDishesPageNavigation } from './order-dishes/order-dishes-navigation';
import { OrderDishesReadsSection } from './order-dishes/order-dishes-reads.section';

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
  private readonly navigation: OrderDishesPageNavigation;
  private readonly menu: OrderDishesMenuSection;
  private readonly modifier: OrderDishesModifierSection;
  private readonly charge: OrderDishesChargeSection;
  private readonly reads: OrderDishesReadsSection;

  constructor(page: Page) {
    this.ctx = new OrderDishesPageContext(page);
    this.navigation = new OrderDishesPageNavigation(this.ctx, this);
    this.menu = new OrderDishesMenuSection(this.ctx, this);
    this.modifier = new OrderDishesModifierSection(this.ctx, this, (dishName) =>
      this.menu.selectOrderedDish(dishName),
    );
    this.charge = new OrderDishesChargeSection(this.ctx, this);
    this.reads = new OrderDishesReadsSection(this.ctx, this);
  }

${methods}
}
`;

fs.writeFileSync(path.resolve('pages/order-dishes.page.ts'), facade);
console.log('Facade written with', delegations.length, 'delegations');

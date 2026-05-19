import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('pages');
const src = fs.readFileSync(path.join(root, 'order-dishes.page.ts'), 'utf8');
const lines = src.split(/\r?\n/);
const slice = (s, e) => lines.slice(s - 1, e).join('\n');

const locatorFields = [
  'backButton', 'headerRecallButton', 'sendButton', 'payButton', 'selectedDishAddButton',
  'countButton', 'firstAvailableDishButton', 'menuGroupCards', 'menuCategoryCards',
  'countDialog', 'countDialogInput', 'countDialogConfirmButton', 'weightDialog',
  'weightDialogLoadingText', 'weightInput', 'weightConfirmButton', 'priceDialog',
  'priceInput', 'priceConfirmButton', 'specificationDialog', 'specificationConfirmButton',
  'categoryOptionPanel', 'categoryOptionGrid', 'categoryOptionSubGrid', 'comboDialog',
  'comboConfirmButton', 'cartBadge', 'priceSummaryToggle', 'priceSummaryDetailsContainer',
  'priceSummaryTotalContainer', 'saveOrderButton', 'headerMoreButton', 'inventoryMenuItem',
  'reduceButton', 'exitButton', 'exitConfirmButton', 'inventoryAlertItems', 'moreActionButton',
  'splitButton', 'modifyButton', 'modifyPanel', 'modifyBackButton', 'customModifierNameInput',
  'customModifierPriceInput', 'customModifierAddButton', 'chargeButton', 'chargeDialog',
  'customChargeDialog', 'clearAllChargesButton', 'confirmChargeButton', 'cancelChargeButton',
  'clearSelectedChargeButton', 'customChargeConfirmButton', 'customChargeCancelButton',
  'customChargeValueInput',
];

function adaptBody(body) {
  let result = body;
  result = result.replace(/\bthis\.appFrame\b/g, 'this.locators.appFrame');
  for (const field of locatorFields) {
    result = result.replace(new RegExp(`\\bthis\\.${field}\\b`, 'g'), `this.locators.${field}`);
  }
  result = result.replace(/\bthis\.resolveScopedLocator\b/g, 'this.ctx.scopedLocator');
  result = result.replace(/\bthis\.resolveVisibleLocator\b/g, 'this.ctx.resolveVisibleLocator');
  result = result.replace(/\bthis\.findVisibleLocator\b/g, 'this.ctx.findVisibleLocator');
  result = result.replace(/\bthis\.escapeRegExp\b/g, 'this.ctx.escapeRegExp');
  result = result.replace(/\bthis\.expectLoaded\(\)/g, 'this.host.expectLoaded()');
  result = result.replace(/\bthis\.orderDishesContentFrame\b/g, 'this.orderDishesContentFrame');
  result = result.replace(/\bORDER_DISHES_IFRAME_SELECTOR\b/g, 'ORDER_DISHES_IFRAME_SELECTOR');
  return result;
}

const typesFile = `${slice(11, 96)}
export const ORDER_DISHES_IFRAME_SELECTOR = 'iframe[data-wujie-id="orderDishes"]';
`;

fs.writeFileSync(path.join(root, 'order-dishes/order-dishes.types.ts'), typesFile);

console.log('types written, lines', typesFile.split('\n').length);

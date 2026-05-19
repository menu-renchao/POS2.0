import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('pages');
const src = fs.readFileSync(path.join(root, 'order-dishes.page.ts'), 'utf8');
const lines = src.split(/\r?\n/);
const slice = (s, e) => lines.slice(s - 1, e).join('\n');
const outDir = path.join(root, 'order-dishes');

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
  result = result.replace(/\bawait this\.expectLoaded\(\)/g, 'await this.host.expectLoaded()');
  result = result.replace(/\bthis\.expectLoaded\(\)/g, 'this.host.expectLoaded()');
  return result;
}

const sectionDefs = {
  menu: {
    file: 'order-dishes-menu.section.ts',
    className: 'OrderDishesMenuSection',
    imports: `import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';`,
    ranges: [[400, 542], [610, 772], [1766, 1816], [2166, 2233], [2659, 2873]],
    extra: '',
  },
  modifier: {
    file: 'order-dishes-modifier.section.ts',
    className: 'OrderDishesModifierSection',
    imports: `import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import type { ModifierPriceSelection } from './order-dishes.types';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';`,
    ranges: [[544, 608], [2133, 2151], [2496, 2615]],
    extra: '',
  },
  charge: {
    file: 'order-dishes-charge.section.ts',
    className: 'OrderDishesChargeSection',
    imports: `import { expect, type Locator } from '@playwright/test';
import { waitForInputSettled } from '../../utils/input-stability';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import {
  CANCEL_BUTTON_NAMES,
  CONFIRM_BUTTON_NAMES,
  CUSTOM_FIXED_BUTTON_NAMES,
  CUSTOM_PERCENTAGE_BUTTON_NAMES,
  CUSTOM_TAXED_LABELS,
  type ChargeCustomType,
  type ChargeOptionDraft,
  type ChargeScope,
  type ChargeState,
  type ItemChargeInfo,
  type OrderChargeSnapshot,
  type WholeOrderChargeInfo,
  WHOLE_ORDER_BUTTON_NAMES,
  ITEM_CHARGE_BUTTON_NAMES,
} from './order-dishes.types';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';`,
    ranges: [[774, 1008], [1854, 2312], [2106, 2131]],
    extra: `  private persistedChargeState: ChargeState = this.createEmptyChargeState();
  private draftChargeState: ChargeState | null = null;
  private customChargeDraft: {
    taxed: boolean;
    type: ChargeCustomType;
    value: number | null;
  } = {
    taxed: false,
    type: 'percentage',
    value: null,
  };

`,
  },
  reads: {
    file: 'order-dishes-reads.section.ts',
    className: 'OrderDishesReadsSection',
    imports: `import { expect, type Frame, type Locator } from '@playwright/test';
import { step } from '../../utils/step';
import { waitUntil } from '../../utils/wait';
import {
  ORDER_DISHES_IFRAME_SELECTOR,
  type OrderDishesSnapshot,
  type OrderedDishItem,
  type OrderedDishItemAddition,
  type OrderPriceSummary,
} from './order-dishes.types';
import type { OrderDishesPageContext } from './order-dishes-page-context';
import type { OrderDishesPageHost } from './order-dishes-page-host';
import type { OrderDishesLocators } from './order-dishes-locators';`,
    ranges: [[1010, 1703], [2474, 2494]],
    extra: `  private orderDishesContentFrame: Frame | null = null;

`,
  },
};

for (const [key, def] of Object.entries(sectionDefs)) {
  const body = def.ranges.map(([s, e]) => slice(s, e)).join('\n\n');
  const adapted = adaptBody(body);
  const content = `${def.imports}

export class ${def.className} {
  constructor(
    private readonly ctx: OrderDishesPageContext,
    private readonly host: OrderDishesPageHost,
  ) {}

  private get page() {
    return this.ctx.page;
  }

  private get locators(): OrderDishesLocators {
    return this.ctx.locators;
  }

${def.extra}${adapted.split('\n').map((line) => (line ? `  ${line}` : '')).join('\n')}
}
`;
  fs.writeFileSync(path.join(outDir, def.file), content);
  console.log('Wrote', def.file, content.length, 'chars');
}

// Facade navigation extract
const navBody = adaptBody(
  [
    [392, 399],
    [1705, 1764],
    [1818, 1852],
    [2189, 2216],
    [2356, 2424],
    [2153, 2164],
  ]
    .map(([s, e]) => slice(s, e))
    .join('\n\n'),
);

const facadeNav = `import { expect, type Locator } from '@playwright/test';
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

${navBody.split('\n').map((line) => (line ? `  ${line}` : '')).join('\n')}
}
`;

fs.writeFileSync(path.join(outDir, 'order-dishes-navigation.ts'), facadeNav);
console.log('Done');

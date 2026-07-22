export type OrderedDishItem = {
  additions: OrderedDishItemAddition[];
  quantity: string;
  name: string;
  price: string | null;
};

export type SentOrderItemReference = {
  displayName: string;
  id: number;
};

export type SavedComboOptionReference = {
  name: string;
  type: string;
};

export type SavedComboSubItemReference = {
  saleItemId: number | string;
  options: SavedComboOptionReference[];
};

export type SavedOrderItemReference = {
  saleItemId: number | string;
  displayText: string;
  originalSalePrice: number | null;
  price: number | null;
  totalAmount: number | null;
  discount: number | null;
  discountName: string | null;
  discountRate: number | null;
  discountRateType: number | null;
  comboSubItems: SavedComboSubItemReference[];
};

export type OrderedDishRowState = {
  kitchenQuantity: number | null;
  quantity: string;
  sentToKitchen: boolean;
  text: string;
};

export type OrderedDishItemAddition = {
  name: string;
  price?: string;
  subAdditions?: OrderedDishItemAddition[];
};

export type OrderPriceSummary = {
  Charge?: number;
  Count: number;
  Subtotal: number;
  Tax: number;
  'Total Before Tips': number;
  Tips?: number;
  'Total(Cash)': number;
  'Total(Card)': number;
};

export type OrderDishesSnapshot = {
  items: OrderedDishItem[];
  priceSummary: OrderPriceSummary;
};

export type ChargeScope = 'whole' | 'item';

export type ChargeCustomType = 'percentage' | 'fixed';

export type ModifierPriceSelection =
  | {
      kind: 'preset';
      value: string;
    }
  | {
      kind: 'custom';
      value: number | string;
    };

export type WholeOrderChargeInfo = {
  amountText: string | null;
  name: string;
};

export type ItemChargeInfo = {
  dishName: string;
  optionName: string | null;
};

export type OrderChargeSnapshot = {
  itemCharges: ItemChargeInfo[];
  scope: ChargeScope;
  selectedDishNames: string[];
  wholeOrderCharges: WholeOrderChargeInfo[];
};

export type ChargeOptionDraft = {
  kind: ChargeCustomType;
  name: string;
  taxed?: boolean;
  value?: number | null;
};

export type ChargeState = {
  itemCharges: Record<string, ChargeOptionDraft>;
  scope: ChargeScope;
  selectedDishNames: string[];
  wholeOrderCharges: ChargeOptionDraft[];
};

export const CHARGE_BUTTON_NAMES = /^(Charge|加费)$/;
export const CHARGE_DIALOG_TEXT =
  /\bCharge\b|Whole Order Charge|Item Charge|Charge Options|整单加费|菜品加费|加费选项/;
export const CUSTOM_CHARGE_DIALOG_TEXT = /Custom Charge|自定义加费/;
export const WHOLE_ORDER_BUTTON_NAMES = /^(Whole Order Charge|Whole Order|整单加费|整单加收)$/;
export const ITEM_CHARGE_BUTTON_NAMES = /^(Item Charge|Item Discount|菜品加费|菜品加收)$/;
export const CLEAR_SELECTED_BUTTON_NAMES = /^(Clear Selected|清除已选|清空已选)$/;
export const CLEAR_ALL_BUTTON_NAMES = /^(Clear All|清除全部|清空全部)$/;
export const CANCEL_BUTTON_NAMES = /^(Cancel|取消)$/;
export const CONFIRM_BUTTON_NAMES = /^(Confirm|确认)$/;
export const CUSTOM_PERCENTAGE_BUTTON_NAMES = /^(Percentage|%)$/;
export const CUSTOM_FIXED_BUTTON_NAMES = /^(Fixed Amount|\$)$/;
export const CUSTOM_TAXED_LABELS = /^(Taxed|含税)$/;
export const ORDER_DISHES_IFRAME_SELECTOR = 'iframe[data-wujie-id="orderDishes"]';

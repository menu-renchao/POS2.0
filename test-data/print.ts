import { orderServiceCategoryOptions, orderServiceDishes } from './order-service';

export const printTestData = {
  chargeReminder: {
    defaultText:
      'The Service Fee has been added to your purchase. Extra tips are generous, but not required.',
    maximumEnglishText:
      'The Service Fee has been added to your purchase. Extra tips are generous, but not required.'
        .repeat(3)
        .slice(0, 200),
    specialText: 'you已经给小费了!@#$%&*().-+=[]、',
    chineseText: '您已经给过小费了，可以不用再给了',
  },
  customer: {
    address: 'white house',
    customerName: 'print-test',
    phoneNumber: '(934)221-9929',
  },
  dishes: {
    first: orderServiceDishes.regular,
    second: orderServiceDishes.test,
    option: orderServiceCategoryOptions.paidNested,
  },
  notes: {
    item: 'this is item note',
    order: 'this is order note',
  },
  ticketText: {
    tipSuggestion: 'ADD TIPS',
    totalBeforeTips: 'Total Before Tips',
  },
  tipSuggestionMode: {
    onlyWithoutTips: '1',
  },
} as const;

export const printConfigurationNames = {
  chargeReminder: 'CHARGE_REMINDER',
  combineItemsOnReceipt: 'COMBINE_SAME_ITEMS_AUTOMATICALLY_WHEN_SENT_TO_RECEIPT',
  kitchenPrintAddress: 'KITCHEN_TICKET_PRINT_ADDR',
  kitchenPrintTelephone: 'KITCHEN_TICKET_PRINT_TEL',
  packerVoidItemsStyle: 'PACKER_TICKET_VOID_ITEMS_STYLE',
  paymentTipSuggestion: 'PAYMENT_RECEIPT_TIP_SUGGESTION',
  printChargeReminder: 'RECEIPT_PRINT_CHARGE_REMINDER',
  printXAfterItemCount: 'PRINT_X_AFTER_ITEM_COUNT',
  receiptOnlyPrintNewItems: 'RECEIPT_ONLY_PRINT_NEW_ITEMS',
  receiptTipSuggestion: 'RECEIPT_TIP_SUGGESTION',
} as const;

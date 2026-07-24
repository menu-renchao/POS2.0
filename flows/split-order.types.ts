import type { RecallPage } from '../pages/recall.page';
import type {
  OrderChargeSnapshot,
  OrderPriceSummary,
} from '../pages/order-dishes/order-dishes.types';

export type SplitOrderTargets = {
  orderNumber: string;
  firstTargetOrderNumber: string;
  secondTargetOrderNumber: string;
};

export type SavedChargeOrder = {
  beforeChargeSnapshot: OrderChargeSnapshot;
  beforeSummary: OrderPriceSummary;
  orderNumber: string;
  recallPage: RecallPage;
};

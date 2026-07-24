export type SplitOrderDishSnapshot = {
  name: string;
  proportion: string | null;
};

export type SplitOrderDishDisplay = {
  price: number;
  quantity: string;
};

export type SplitOrderSuborderSnapshot = {
  dishes: SplitOrderDishSnapshot[];
  orderNumber: string;
  paidStatus: string | null;
  seats: string[];
  total: number;
};

export type SplitOrderSnapshot = {
  remain: number | null;
  suborders: SplitOrderSuborderSnapshot[];
  title: string;
  total: number;
};

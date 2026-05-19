/** 供 section 调用的点餐页宿主能力（加载态等）。 */
export interface OrderDishesPageHost {
  expectLoaded(): Promise<void>;
}

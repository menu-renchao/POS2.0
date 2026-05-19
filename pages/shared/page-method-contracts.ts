/** 主页功能入口的有限枚举，避免在 page/flow 层散落魔法字符串。 */
export type HomeEntry =
  | 'Dine In'
  | 'Delivery'
  | 'Pick Up'
  | 'Report'
  | 'Admin'
  | 'Recall'
  | 'To Go';

export const HOME_ENTRY_TEST_IDS: Record<HomeEntry, string> = {
  'Dine In': 'pos-ui-function-card-dine_in',
  Delivery: 'pos-ui-function-card-delivery',
  'Pick Up': 'pos-ui-function-card-pickup',
  Report: 'pos-ui-function-card-report',
  Admin: 'pos-ui-function-card-admin',
  Recall: 'pos-ui-function-card-recall',
  'To Go': 'pos-ui-function-card-togo',
};

/** 同页动作：点击、填写、切换，不保证离开当前页。 */
export type SamePageAction = Promise<void>;

/** 跨页动作：保证返回目标页面对象实例。 */
export type CrossPageAction<TPage> = Promise<TPage>;

/** 页面读取动作：返回明确的数据模型，而非 Locator。 */
export type PageReadAction<TData> = Promise<TData>;

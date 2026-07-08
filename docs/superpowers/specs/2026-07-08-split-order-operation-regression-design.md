# 分单操作回归用例第一批设计

## 背景

`C:/mansuper/test_order_operation_playwright_prompts.md` 中包含 95 个 POS 订单操作回归场景。第一批只处理清单中的 `1-10`，聚焦分单、小费、半支付、作废和撤销分单相关行为。

当前仓库已有 Playwright + TypeScript 分层结构，并已在 `tests/py-migrate/order.service.spec.ts` 中覆盖部分订单、Recall、支付和分单场景。其中 `POS-19362` 已有相近用例，应优先复核和补强，避免重复新增同义测试。

## 范围

第一批覆盖以下提示场景：

- `test_seat_split_void_no_shared_item`
- `test_seat_split_void_have_shared_item`
- `test_seat_split_modify_tip`
- `test_seat_split_close_unsplit`
- `test_amount_split_semi_paid_add`
- `test_amount_split_split`
- `test_amount_split_semi_paid_unsplit`
- `test_even_split_tip_unsplit`
- `test_split_tip_reduce_item`
- `test_split_tip_discount_item`

本批不处理退款、报表、语言切换、后台配置修改、打印后自动送厨、折扣原因必填等后续场景。

## 设计目标

- 所有新增或补强测试使用 Playwright Test。
- `describe`、`test`、`test.step` 和页面/流程 `@step(...)` 描述均使用中文。
- 测试文件只表达业务意图和断言，页面动作放在 `pages/`，业务编排放在 `flows/`。
- 复用现有 `HomeFlow`、`SelectTableFlow`、`OrderDishesFlow`、`SplitOrderFlow`、`RecallFlow`、`PaymentFlow`。
- 通过 POS 首页进入系统，不使用业务内页直达 URL。
- 对后续 Recall 定位优先保存订单号、子单号、支付状态、金额和 tips 等关键字段。
- 每个输入后立即确认且可能触发保存/API 的动作，沿用已有输入稳定等待规则。

## 文件组织

新增第一批用例时优先创建：

- `tests/py-migrate/split-order-operation.spec.ts`

该文件承载清单 `1-10` 的分单操作回归。已存在且完全满足要求的场景，可以保留在原 spec 中并在新 spec 中不重复实现；若迁移到新 spec，应保持 Jira key 可搜索，并避免同时存在两条同义用例。

按需补充：

- `flows/split-order.flow.ts`：增加按座位、按金额、撤销、合并、移动菜品等业务编排能力。
- `flows/recall.flow.ts`：增加按母单/子单精确打开、进入支付、进入分单、作废后继续读取详情等业务编排。
- `pages/split-order.page.ts`：只补页面稳定动作和读取能力，例如读取子单、读取 paid 状态、触发撤销分单、读取/确认提示。
- `pages/recall.page.ts` 及 `pages/recall/*`：只补 Recall 订单详情、More 菜单、Void、Tips、Split 等页面级动作。
- `pages/order-dishes.page.ts` 及 `pages/order-dishes/*`：只补点单页小费、折扣、菜品数量、分单入口、保存等页面级动作。
- `test-data/order-service.ts`：集中存放本批复用业务数据，例如小费金额、作废原因、按金额分单金额、预期提示文案。

## 场景分组

### 座位分单作废与提示

覆盖 `1-4`。

核心流程是堂食不选桌进入点单页，设置就餐人数或使用已有默认无桌路径，添加普通菜，添加 tips，按座位分单，支付其中一个子单，再对另一个子单执行作废或撤销分单操作。

断言重点：

- 已支付子单的 tips 不因另一个子单作废而变化。
- 含共享菜品的订单不能直接作废，提示文案与需求一致。
- 半支付状态下撤销分单失败，提示文案与需求一致。
- 修改某个子单 tips 后，目标子单更新，其他子单 tips 保持不变。

### 按金额分单半支付

覆盖 `5-7`。

核心流程是创建堂食或默认无桌订单，按金额拆出多个子单，支付其中一部分，然后尝试追加菜品、继续拆分或撤销分单。

断言重点：

- 半支付后不允许执行会破坏已支付子单金额归属的操作。
- 允许的追加或继续拆分操作必须保留已支付子单金额和状态。
- 阻断类操作需要读取页面 alert 或确认弹窗文案。

### 平分与按菜 tips 保留

覆盖 `8-10`。

核心流程是创建订单并添加 tips，再执行平分、按菜拆分、减少菜品或对菜品折扣，最后校验分单后各子单 tips 和金额计算。

断言重点：

- 撤销分单后 tips 与总额恢复到合理状态。
- 减少菜品后 tips 不丢失且金额重算符合页面汇总。
- 折扣后 tips 维度不被错误清除或错误分摊。

## 数据与断言策略

- 菜品优先复用 `orderServiceDishes.regular`、`orderServiceDishes.test` 和已有分单测试数据。
- 新增数据必须放在 `test-data/order-service.ts`，spec 中不内联动态样本。
- 金额读取优先使用页面对象返回的 number，不在 spec 中重复解析货币字符串。
- Recall 后续定位优先使用订单号和子单号；如果只能按最新订单定位，测试注释和最终汇报必须说明并发风险。
- Jira key 保留在 spec 的 `annotation` 中，使用 `jiraIssueAnnotation(...)` 或 `jiraIssueAnnotations(...)`。

## 错误处理

- 页面级方法遇到目标控件不可见时抛出带业务含义的错误。
- 业务 flow 遇到不满足前置状态时抛出明确错误，例如“未找到两个子单”或“目标子单已支付，不可移动菜品”。
- 阻断类场景不吞掉 alert；应读取提示文案并断言。
- 不使用 `waitForTimeout`；需要轮询时使用 `waitUntil()`。

## 测试验证

每完成一个场景：

1. 运行对应单条 Playwright 用例。
2. 根据失败结果补页面或 flow 能力。
3. 确认通过后再进入下一条。

第一批完成后运行：

```bash
npm test -- tests/py-migrate/split-order-operation.spec.ts
```

若真实 POS 环境不可达，最终汇报必须说明未能执行的命令、失败原因和未验证风险。

## 实施顺序

1. 复核现有 `POS-19362`，决定保留、迁移或补强。
2. 实现 `test_seat_split_void_have_shared_item`。
3. 实现 `test_seat_split_modify_tip`。
4. 实现 `test_seat_split_close_unsplit`。
5. 实现 `test_amount_split_semi_paid_add`。
6. 实现 `test_amount_split_split`。
7. 实现 `test_amount_split_semi_paid_unsplit`。
8. 实现 `test_even_split_tip_unsplit`。
9. 实现 `test_split_tip_reduce_item`。
10. 实现 `test_split_tip_discount_item`。

## 非目标

- 不重构所有历史订单用例。
- 不引入 `.or()` 选择器链或候选 selector 枚举来强行兼容未知 DOM。
- 不新增深链 URL 导航。
- 不把页面 locator 写入 spec。
- 不处理第一批之外的 85 个提示场景。

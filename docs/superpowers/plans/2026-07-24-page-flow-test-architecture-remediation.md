# Page / Flow / Test Architecture Remediation Implementation Plan

> **For agentic workers:** Implement this plan task by task. Keep each task independently reviewable and reversible. Do not overwrite unrelated working-tree changes. Use checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** 在保持现有 POS UI 自动化业务覆盖的前提下，收敛 Page/Flow/Test 职责边界和真实 DOM 契约，消除隐性硬等待、候选 locator 遍历、重复 facade/flow 入口及共享环境清空式准备，使项目更易维护、可扩展、可诊断，并在系统仅支持单 worker 的约束下提高执行稳定性和效率。

**Architecture:** 按“稳定性止血 → DOM 契约收敛 → 热点 Page 拆分 → Flow/Test 去重 → 数据隔离 → 单 worker 提效”的顺序实施。Page 只负责确定的页面结构、单步动作和窄读取；Component/Section 负责可复用页面区域；Flow 负责业务策略与跨步骤编排；Test 只保留场景级步骤、断言和 Jira 追踪；Fixture 负责依赖装配和测试拥有资源的生命周期。

**Tech Stack:** Playwright Test, TypeScript, Page Object Model, typed flows, API-assisted setup, Allure

## Implementation Status（2026-07-24）

- [x] Phase 1：输入稳定契约、诊断测试隔离和关键等待失败定位已完成。
- [x] Phase 2：DOM contract 收敛与 UI 架构门禁已完成，全部债务计数降为 0。
- [x] Phase 3：Payment、Order Dishes、Recall、Split Order 已按能力域组件化；`order-dishes.page.ts` 已由约 709 行降至约 63 行并删除 162 个一对一 facade，476 个调用点迁移到显式 section API；`recall.page.ts` 已删除 101 个一对一 facade 并降至约 120 行；`recall-order-details.dialog.ts` 已由约 1793 行降至约 1163 行，Tips、打印/送厨、折扣、服务员/司机等能力已独立，且不再使用 `evaluate/querySelectorAll/dispatchEvent` 遍历或原生点击。
- [x] Phase 4：Flow fixture 已统一装配，`SplitOrderScenarioFlow` 已删除 `TestFlows` 服务定位器参数并改为 7 个显式构造器依赖；`split-order-operation.spec.ts` 已由约 5184 行降至约 1349 行且移除顶部生命周期 helper，三个 split charge spec 已分别接入 combine/edit/transfer 专用 Flow；原 `order.service.spec.ts` 的 21 条用例已按 Recall/分单、客户/外送、菜单配置、套餐四个业务域拆分，四个新 spec 顶部 helper 计数均为 0。
- [x] Phase 5 / Task 13：精确资源注册、聚合清理、单 API context 复用和桌台自有订单清理已完成；CI 不再全局清桌。
- [x] Phase 5 / Task 14（执行约束）：当前系统不支持多 worker，全部 UI project 已固定为单 worker，取消 2/4 workers 与 shard 提升目标。
- [ ] Phase 5 / Task 14（稳定性验收）：真实环境连续稳定运行及单 worker wall time、失败率、重试率基线尚待记录。
- [x] 静态验收：TypeScript、脚本单测、架构门禁、diff check 和 Playwright 用例枚举通过。
- [ ] 真实 POS/打印机/数据库定向 E2E：POS smoke 及 Payment（现金、小费、部分支付）、Order Dishes、Inventory、Recall、Refund、Split、Table、Paging 定向基线已记录；POS-21845 长链路已由 180 秒超时降至约 23 秒通过。打印机和全量 UI 仍待独立窗口验收；信用卡支付按当前范围明确跳过。

**用例映射：** 原 230 条 = 225 条常规 UI + 2 条 `ui-slow` + 3 条诊断测试。整改后 3 条诊断测试移出正式 discovery，业务用例仍为 227 条（225 + 2），Jira key 与业务 tag 保留在所属 spec。

**最近一次本地验证证据：**

- `tsc --noEmit` 通过。
- 17 条脚本/架构单测通过。
- 输入稳定、Split 返回页识别、配置资源恢复、UI 资源管理和支付流水解析共 19 条契约单测通过；配置恢复支持手工幂等恢复及 teardown 兜底。
- UI 架构门禁 15 项计数全部为 0，其中包含禁止 Flow 接收聚合 Flow 容器的服务定位器规则。
- 正式 UI discovery 为 227 tests / 22 files；`order-settle` 为 3 条，`table-order` 为 12 条。
- `git diff --check` 通过，仅报告 Windows CRLF 转换提示。

### 真实环境单 worker 定向基线（2026-07-24）

所有命令均使用 `workers: 1`、`retries: 0`；信用卡支付按用户指示不在本轮调试和验收范围内。

| 业务域 | 定向用例 | 结果 | wall time |
| --- | --- | --- | ---: |
| Smoke | POS-30543、POS-31409 | 2/2 通过 | 22.6s |
| Payment | 最新 To Go 订单现金支付并在 Recall 校验 Success | 1/1 通过 | 16.2s |
| Payment / Tips | POS-33110 大额小费；POS-19049 两笔现金部分支付分别加小费 | 2/2 通过 | 9.1s、25.5s |
| Order Dishes | POS-15602、POS-33600 | 2/2 通过；修复后分别取得通过证据 | 16.9s、10.5s |
| Inventory | POS-43898 / POS-43890 / POS-43889 未送厨增减菜库存 | 1/1 通过 | 37.5s |
| Recall | POS-32940 / POS-33781 | 1/1 通过 | 12.4s |
| Recall / Refund | POS-35134 按菜现金退款及负向流水 | 1/1 通过 | 25.1s |
| Split | POS-21855；POS-21845 多金额拆分 | 2/2 通过 | 9.1s、约 23s |
| Table | POS-15531 | 1/1 通过 | 11.6s |
| Paging | POS-42087 | 1/1 通过 | 33.0s |

- 上述最终通过证据共 14 条用例，最终失败率 0%，重试率 0%。
- POS-21845 初始运行在错误 iframe locator 上等待至 180 秒超时；收敛真实 DOM contract、输入弹窗和返回页状态后，测试体 21.7 秒、总 wall time 约 23 秒通过。
- UI 自动创建订单已按保存响应中的精确 ID 注册；失败调试产生的订单已精确 void，随后 smoke 创建的订单也验证为 `status = -1`，未执行全局清桌。

---

## Current Baseline

本计划基于 2026-07-24 当前工作树的只读审查：

- UI 项目共 13 个 spec 文件、230 个测试。
- 显式 `waitForTimeout`、`expect.poll`、`toPass` 均为 0。
- `waitForInputSettled()` 共约 47 个调用点；16 个调用未传 locator 或显式传入 `undefined`，会退化为 250/400ms 固定等待。
- 当前传入 locator 的稳定检测最快约 50ms 即返回，未保证提交前至少 200ms。
- pages 中候选 locator resolver 约 71 个调用点，`.or()` 约 43 处，XPath 约 14 处，`[class*=...]` 约 134 处。
- `RecallOrderDetailsDialog` 约 3275 行、172 个方法。
- `SplitOrderPage` 约 1338 行，`PaymentPage` 约 748 行。
- `OrderDishesPage` 在公开 section 的同时保留约 164 个一对一 facade 转发方法。
- `split-order-operation.spec.ts` 约 5184 行，包含 57 个异步本地 helper。
- UI spec 中即时创建 Flow 约 659 次，`enterReadyHome()` 存在 8 份重复实现。
- CI 当前固定 `workers: 1`，并存在多个 serial suite。
- `report-debug.spec.ts` 中 3 个诊断测试被正式 UI 项目收集。

## Target Layer Contract

| Layer | Allowed | Forbidden |
| --- | --- | --- |
| `pages/` | 唯一稳定 locator、页面单步动作、窄读取、目标页最小加载校验 | 选择“第一个可用”、翻页搜索策略、候选 selector 猜测、跨业务恢复策略 |
| page component/section | 一个稳定页面区域的 locator、动作、读取 | 万能候选列表、跨页面业务决策 |
| `flows/` | 业务策略、多页面编排、选择顺序、显式恢复路径 | raw locator、重复实现页面低层动作 |
| `tests/` | 3–5 个场景级中文步骤、断言、Jira key、业务 tag | 完整订单生命周期 helper、API response 解析、DOM 探测 |
| `fixtures/` | Page/Flow/API client 装配、测试拥有资源的精确清理 | `deleteAll()`、清理非当前测试拥有的数据、隐藏业务前置条件 |
| `test-data/` | 纯数据、工厂、稳定 domain contract | 反向依赖具体 Flow 实现 |

## Global Constraints

- 不改变业务预期，不为让测试通过而扩大 locator 范围。
- 不新增 `.or()`、候选 locator 数组、XPath、`nth()` 猜测或 `data-testid/data-test-id` 双别名。
- 仅在产品确认存在互斥渲染区域时保留 scope abstraction；具体元素仍只有一个真实 selector。
- 所有输入后立即提交并触发保存/API 的动作必须保证至少 200ms，并等待确定的业务后置条件。
- 同页动作返回 `Promise<void>`；跨页动作返回目标 Page 并完成最小加载校验。
- 每个提交批次只处理一个可回滚能力域，不进行全仓大爆炸式重写。
- 不修改或覆盖实施开始前已存在的无关工作树变更。
- 当前系统设计不支持多 worker；所有 UI project 固定为单 worker，不再规划 worker 提升或 shard 并发。

---

## Phase 1 — Stability And Execution Stop-Loss

### Task 1: 修正输入稳定等待契约

**Files:**

- Create: `tests/api/unit/input-stability.unit.spec.ts`
- Modify: `utils/input-stability.ts`
- Modify: `pages/order-dishes/order-dishes-customer.section.ts`
- Modify: `pages/delivery.page.ts`
- Modify: `pages/payment.page.ts`
- Modify: `pages/order-dishes/order-dishes-menu.section.ts`
- Modify: `pages/order-dishes/order-dishes-charge.section.ts`
- Modify: `pages/order-dishes/order-dishes-discount.section.ts`
- Modify: `pages/recall/recall-order-details.dialog.ts`

**Contract:**

- 提供 locator 时，返回条件必须同时满足：
  - 输入可读取；
  - 输入值在连续观察窗口内保持稳定；
  - 自稳定等待开始至少经过 200ms。
- 不提供 locator 的固定延迟入口只作为短期兼容层，并在本任务结束前消除生产调用。
- 稳定检测失败必须给出 input 和最后读取值相关的诊断，不得静默吞错后继续提交。

- [x] **Step 1: 为“50ms 相同值不得提前返回”编写失败单元测试**
- [x] **Step 2: 为“稳定满 200ms 后返回”编写通过契约**
- [x] **Step 3: 修改 `waitForInputSettled()`，显式区分 `minimumSettleMs`、`stableWindowMs` 和总超时**
- [x] **Step 4: 修复客户姓名填写后直接确认的遗漏**
- [x] **Step 5: 将所有无 locator/`undefined` 调用改为传入最后编辑的 input**
- [x] **Step 6: 确认每个提交动作还等待 API 响应、弹窗关闭或页面切换等业务后置条件**
- [x] **Step 7: 运行输入稳定单元测试、TypeScript 检查及客户/支付相关定向用例**

**Verification:**

```powershell
npm.cmd exec playwright test tests/api/unit/input-stability.unit.spec.ts -- --project=api
npm.cmd exec tsc -- --noEmit
npm.cmd exec playwright test tests/py-migrate/order-page-recorded-regression.spec.ts -- --project=ui-isolated --project=ui-shared --project=ui-exclusive-config --project=ui-print --grep "客户姓名和电话"
```

**Exit Criteria:**

- 生产代码中不存在 `waitForInputSettled()` 无参数调用。
- 生产代码中不存在 `waitForInputSettled(undefined, ...)`。
- 所有输入后提交路径均通过至少 200ms 的契约测试。

### Task 2: 移除正式回归中的诊断测试与分钟级硬等待

**Files:**

- Move: `tests/py-migrate/report-debug.spec.ts` → `scripts/diagnostics/report-dom-diagnostic.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/py-migrate/table-order.spec.ts`
- Modify: `tests/py-migrate/paging.spec.ts`
- Modify: `api/clients/order-api.client.ts` or create a focused API-assisted time setup helper if the current API supports it

- [x] **Step 1: 将三个仅打印 DOM/请求的 debug 测试移出正式测试目录**
- [x] **Step 2: 为 diagnostics 提供显式命令，默认 test discovery 不收集**
- [x] **Step 3: 评估 API 时间准备能力；当前无可用接口，不在 PR 回归中伪造时间状态**
- [x] **Step 4: 将两个分钟级场景标为 `@slow` 并放入独立非 PR project**
- [x] **Step 5: 删除 `waitUntil(() => Date.now())` 形式的时间轮询**
- [x] **Step 6: 确认常规 `py-migrate` 列表不再包含 debug 和非确定性分钟级等待**

**Verification:**

```powershell
npm.cmd exec playwright test tests/py-migrate -- --list --project=ui-isolated --project=ui-shared --project=ui-exclusive-config --project=ui-print --project=ui-slow
npm.cmd exec tsc -- --noEmit
```

**Exit Criteria:**

- 正式 UI 报告中没有“调试”测试。
- PR UI 项目没有必然等待 60–105 秒的用例。

### Task 3: 让关键等待失败在原始位置暴露

**Files:**

- Modify: `pages/split-order.page.ts`
- Modify: `flows/recall.flow.ts`
- Modify: `pages/home.page.ts`
- Modify: `pages/recall/recall-filter-bar.section.ts`
- Modify: `pages/recall/recall-order-details.dialog.ts`

- [x] **Step 1: 删除 Split 返回页等待后的 `.catch(() => undefined)`**
- [x] **Step 2: 未识别返回页时抛出包含 URL、可见页面信号和前置动作的错误，不再默认返回 `HomePage`**
- [x] **Step 3: Recall 清空筛选失败时停止后续搜索，保留最终稳定状态证据**
- [x] **Step 4: 区分“可选弹窗未出现”和“关键页面后置条件失败”，仅前者允许受控容错**
- [x] **Step 5: 清理关键链路中的 DOM click/force click，恢复 Playwright actionability 检查**
- [x] **Step 6: 为 Split 返回 Recall、Order Dishes、Home 三种目标分别增加契约测试**

**Exit Criteria:**

- 跨页动作不存在未知状态默认 Page。
- 关键导航/提交等待不得静默吞错。

---

## Phase 2 — DOM Contract And Structural Guardrails

### Task 4: 建立禁止 selector 猜测回潮的自动护栏

**Files:**

- Create: `scripts/check-ui-architecture.mjs`
- Create: `tests/scripts/check-ui-architecture.unit.test.mjs`
- Create: `docs/ui-architecture-baseline.json`
- Modify: `package.json`
- Modify: `AGENTS.md`
- Modify: `docs/page-object-guidelines.md`

**Guard Scope:**

- 禁止新增 `resolveVisibleLocator([...])` 候选数组。
- 禁止新增 `.or()` 作为同一元素的 selector fallback。
- 禁止新增 XPath、`data-testid/data-test-id` 双别名和多语言 selector fallback。
- 禁止在 `flows/`、常规 spec 中出现 raw locator。
- 禁止同页 action 返回 `this` 或当前 Page。
- 对现存债务使用递减 baseline；每个迁移任务只能降低或保持数量，不能增加。

- [x] **Step 1: 为架构扫描器编写失败测试**
- [x] **Step 2: 记录当前基线和热点文件，不将现存债务一次性豁免为永久规则**
- [x] **Step 3: 添加 `npm run lint:ui-architecture`**
- [x] **Step 4: 在每个后续 Task 完成后同步降低 baseline**
- [x] **Step 5: 将唯一 DOM contract 和受控互斥 scope 规则写入项目文档**

**Verification:**

```powershell
npm.cmd run lint:ui-architecture
npm.cmd run test:scripts
```

### Task 5: 收窄 frame/host scope 基础设施

**Files:**

- Modify: `pages/shared/locator-scope.ts`
- Modify: `pages/order-dishes/order-dishes-page-context.ts`
- Modify: `pages/order-dishes/order-dishes-locators.ts`
- Modify: affected callers under `pages/order-dishes/`

- [x] **Step 1: 用页面加载时的唯一信号确定当前真实 render scope**
- [x] **Step 2: scope context 只负责返回目标根节点，不接收具体元素候选数组**
- [x] **Step 3: 删除 `resolveFirstVisibleLocator()`、`findFirstVisibleLocator()` 的通用猜测用途**
- [x] **Step 4: 每个稳定控件只在 locator owner 中定义一次**
- [x] **Step 5: 对确有两种产品渲染模式的页面建立显式 typed variant，而不是逐元素 fallback**

**Exit Criteria:**

- 通用 scope helper 不再逐个探测元素候选。
- 修改范围内每个语义控件只有一个 locator owner。

---

## Phase 3 — Hotspot Page Refactoring

### Task 6: 重构 Payment 为确定性 sections

**Files:**

- Create: `pages/payment/payment-page-context.ts`
- Create: `pages/payment/payment-summary.section.ts`
- Create: `pages/payment/payment-cash.section.ts`
- Create: `pages/payment/payment-card.section.ts`
- Create: `pages/payment/payment-tip.dialog.ts`
- Create: `pages/payment/payment-receipt.dialog.ts`
- Modify: `pages/payment.page.ts`
- Modify: `flows/payment.flow.ts`
- Modify: payment callers under `tests/py-migrate/`

- [x] **Step 1: 通过当前真实页面/录制确认 Payment 唯一 scope 和稳定 testid**
- [x] **Step 2: 删除信用卡字段的 ID/role/nth/XPath 候选列表**
- [x] **Step 3: 将现金、卡入口、Tips、小票弹窗和汇总读取拆成 sections/dialogs**
- [x] **Step 4: `PaymentPage` 只保留跨 section 的页面级入口与加载契约**
- [x] **Step 5: 所有提交路径使用 Task 1 的稳定等待和明确响应/页面后置条件**
- [x] **Step 6: 回跑现金支付、小费和部分支付用例；信用卡支付按用户指示跳过**

> 当前真实页面没有历史卡表单，环境返回 `paymentAccounts: []`；已删除 `#cardNof/#carddate/#carddateY/#cvv2/payment-submit` 伪契约。现金支付、POS-33110 Tips 和 POS-19049 两笔现金部分支付定向用例均通过；信用卡支付按本轮范围明确跳过。

**Exit Criteria:**

- `PaymentPage` 中不存在候选 locator resolver、XPath 和 index-based 表单字段定位。
- Payment Page/Section 每个文件只承载一个能力域。

### Task 7: 明确 Order Dishes 的动作与策略边界

**Files:**

- Modify: `pages/order-dishes.page.ts`
- Modify: `pages/order-dishes/order-dishes-locators.ts`
- Modify: `pages/order-dishes/order-dishes-menu.section.ts`
- Modify: `pages/order-dishes/order-dishes-navigation.ts`
- Modify: `flows/order-dishes.flow.ts`
- Modify: affected UI specs

- [x] **Step 1: 将 `clickDish()` 改为只点击当前已知范围内的目标菜品**
- [x] **Step 2: 将翻页查找、Search menu fallback 和首个可用菜品选择迁入 Flow 的显式方法**
- [x] **Step 3: 删除 page 内最多翻 15 页及 catch 任意错误后改走搜索的行为**
- [x] **Step 4: 将 action 方法内重新拼装的 Add Line、Change Price、Count 等 locator 收回 locator owner**
- [x] **Step 5: 选择 section API 作为唯一公开模式，迁移并删除平铺 facade delegate**
- [x] **Step 6: 删除兼容期转发方法，并由架构门禁禁止新增**
- [x] **Step 7: 回跑点菜、搜索、分页、改价、数量、套餐和 Save/Send 代表用例**

**Exit Criteria:**

- Page 方法名与实际动作一致，不隐藏搜索、分页或恢复策略。
- `OrderDishesPage` 不再同时提供两套等价 API。

### Task 8: 拆分 Recall Order Details God Object

**Files:**

- Create: `pages/shared/order-details/order-details-context.ts`
- Create: `pages/shared/order-details/order-details-header.section.ts`
- Create: `pages/shared/order-details/order-details-items.section.ts`
- Create: `pages/shared/order-details/order-details-summary.section.ts`
- Create: `pages/shared/order-details/order-details-payment.section.ts`
- Create: `pages/recall/recall-order-actions.section.ts`
- Create: `pages/recall/recall-move-combine.section.ts`
- Create: `pages/recall/recall-refund.section.ts`
- Create: `pages/shared/tip-input.dialog.ts`
- Modify: `pages/recall/recall-order-details.dialog.ts`
- Modify: `pages/recall.page.ts`
- Modify: `pages/select-table/select-table-cards.section.ts`
- Modify: `flows/recall.flow.ts`

- [x] **Step 1: 先建立轻量 `expectReady()`，打开详情不再通过完整 snapshot 判断就绪**
- [x] **Step 2: 将 header、items、summary、payment 读取拆成真正窄 API**
- [x] **Step 3: aggregate snapshot 只组合窄读取；互不依赖读取使用 `Promise.all`**
- [x] **Step 4: 将退款、移菜/合单、厨房动作和 Tips 分离为能力 section**
- [x] **Step 5: 抽取共享 `TipInputDialog`，消除 Order Dishes 与 Recall 的整套重复实现**
- [x] **Step 6: Select Table 只依赖共享 Order Details component，不再 new Recall FilterBar**
- [x] **Step 7: 删除 dialog 内大范围 `querySelectorAll('*')`、祖先遍历和多组 dialog 候选**
- [x] **Step 8: 回跑 Recall 搜索、详情、现金支付、退款、分单、桌台多订单和 Tips 代表用例**

**Exit Criteria:**

- 读取单个字段不得触发完整 snapshot。
- Select Table 不依赖 Recall 页面专属筛选结构。
- 原 God Object 被拆成可独立测试和维护的能力组件。

### Task 9: 拆分 Split Order 并修正返回语义

**Files:**

- Create: `pages/split-order/split-order-context.ts`
- Create: `pages/split-order/split-toolbar.section.ts`
- Create: `pages/split-order/split-suborders.section.ts`
- Create: `pages/split-order/split-input.dialog.ts`
- Create: `pages/split-order/split-summary.section.ts`
- Modify: `pages/split-order.page.ts`
- Modify: `flows/split-order.flow.ts`
- Modify: affected split-order specs

- [x] **Step 1: 将 toolbar、子单列表、输入弹窗和 summary 分离**
- [x] **Step 2: 删除 `querySelectorAll('*')` 和祖先 while 遍历，使用稳定 row/card contract**
- [x] **Step 3: 提交方法由调用上下文传入预期 destination，或等待唯一页面加载信号**
- [x] **Step 4: 同 URL 返回不得依赖 750ms 时间阈值**
- [x] **Step 5: 同页动作统一返回 `Promise<void>`**
- [x] **Step 6: 回跑金额分单、平分、座位分单、合并、撤销和子单支付代表用例**

---

## Phase 4 — Flow And Test Simplification

### Task 10: 统一 Flow 装配并清除隐藏依赖

**Files:**

- Create: `fixtures/flow.fixture.ts` or extend `fixtures/test.fixture.ts` with explicit lazy flow fixtures
- Modify: `flows/home.flow.ts`
- Modify: `flows/select-table.flow.ts`
- Modify: `flows/paging.flow.ts`
- Modify: `flows/recall.flow.ts`
- Modify: `flows/order-dishes.flow.ts`
- Modify: UI specs consuming these flows

- [x] **Step 1: 将无状态 Flow 作为显式 fixture 提供，不使用自动执行前置条件的 autouse fixture**
- [x] **Step 2: 删除 Flow 内散落的 `new OtherFlow()`，通过构造器或 fixture 装配 collaborator**
- [x] **Step 3: 将重复的 `enterReadyHome()` 收敛为一个保证后置状态的权威入口**
- [x] **Step 4: 合并 Recall 中重复的“打开详情 → 打开 More → 点击 action”编排模板**
- [x] **Step 5: 同页 Flow 返回 `Promise<void>`，跨页 Flow 返回明确 destination**
- [x] **Step 6: 将 `test-data` 使用的 Flow 参数类型移到独立 domain contract**

**Exit Criteria:**

- UI spec 不再即时 `new XxxFlow()`。
- 不存在多份 `enterReadyHome()` 一对一包装。
- Flow 依赖图由 fixture/constructor 明确表达。

### Task 11: 拆分超大 Spec 并迁移影子 Flow

**Files:**

- Split: `tests/py-migrate/split-order-operation.spec.ts`
- Split: `tests/py-migrate/order.service.spec.ts`
- Split: `tests/py-migrate/order-page-regression.spec.ts`
- Create/Modify: focused files under `flows/`
- Create/Modify: focused files under `test-data/`
- Create/Modify: focused API read models under `api/`

**Suggested Split:**

- `split-order-payment.spec.ts`
- `split-order-charge.spec.ts`
- `split-order-combine-move.spec.ts`
- `split-order-permission.spec.ts`
- `order-menu-and-option.spec.ts`
- `order-customer-and-delivery.spec.ts`
- `order-discount-and-tip.spec.ts`

- [x] **Step 1: 按业务能力移动测试，保持 Jira key 仍位于所属 spec**
- [x] **Step 2: 将订单创建、保存、Recall、支付等完整生命周期 helper 迁入 Flow**
- [x] **Step 3: 将 API response 解析迁入 client/read-model**
- [x] **Step 4: 将纯输入/预期矩阵迁入 `test-data/`**
- [x] **Step 5: 每个测试只保留 3–5 个中文场景级步骤**
- [x] **Step 6: 删除与 Flow `@step` 完全重复的一对一 `test.step` 包装**
- [x] **Step 7: 分文件定向回归后执行完整 UI list 和 TypeScript 检查**

**Exit Criteria:**

- Spec 正文能够直接读出业务 Given/When/Then。
- 单个 spec 不再同时承载多个独立业务域和数十个基础 helper。

### Task 12: 收敛重复小工具和方法契约

**Files:**

- Create or modify focused helpers under `utils/`
- Modify: `pages/paging.page.ts`
- Modify: `pages/pickup-screen.page.ts`
- Modify: `pages/inventory.page.ts`
- Modify: `pages/select-table/select-table-cards.section.ts`
- Modify: `pages/inventory-stock-setting.page.ts`
- Modify: affected callers

- [x] **Step 1: 统一 `normalizeOrderNumber()`、`escapeRegExp()` 等纯函数**
- [x] **Step 2: 将库存设置同页动作从 `Promise<this>` 改为 `Promise<void>`**
- [x] **Step 3: 清除 action/read 方法内的稳定 selector 拼装**
- [x] **Step 4: 明确叫号屏为独立外部展示端，并文档化 deep-link 豁免**

---

## Phase 5 — Resource Ownership And Parallel Execution

### Task 13: 将共享环境清理改为资源所有权清理

**Files:**

- Modify: `fixtures/test.fixture.ts`
- Modify: `fixtures/api.fixture.ts`
- Modify: `api/core/resource-registry.ts`
- Modify: charge/order/table setup helpers
- Modify: `tests/py-migrate/table-order.spec.ts`
- Modify: affected `@加收` specs

- [x] **Step 1: 删除按 tag 执行的 `setup.charge.deleteAll()`**
- [x] **Step 2: 每个测试资源名称包含 `testId + workerIndex + retry` 或等价唯一标识**
- [x] **Step 3: 所有创建资源按精确 ID 注册到 `ResourceRegistry`**
- [x] **Step 4: 桌台测试仅清理本测试创建订单**
- [x] **Step 5: cleanup 使用逐项尝试或 `Promise.allSettled`，不得因首个失败跳过其他恢复**
- [x] **Step 6: cleanup 错误聚合后使 teardown 失败，不再只 `console.warn`**
- [x] **Step 7: UI fixture 复用一个 test-scoped API request context**

**Exit Criteria:**

- 测试不得删除非自身拥有的数据。
- teardown 失败在当前测试报告中可见。
- 同一测试不重复创建 API request context。

### Task 14: 固化单 worker 分层执行并优化串行效率

**Files:**

- Modify: `playwright.config.ts`
- Modify: `Jenkinsfile.ui`
- Modify: suites currently using `mode: 'serial'`
- Modify: test metadata/tags

**Execution Classes:**

- `ui-isolated`: 已具备精确资源所有权，但受系统能力约束仍固定单 worker。
- `ui-exclusive-config`: 修改全局配置且暂时无法隔离，单 worker。
- `ui-print`: 依赖共享打印输出或物理打印机，按资源能力串行。
- `ui-slow`: 非 PR 的定时场景。

- [ ] **Step 1: 记录当前 UI 全量耗时、失败率和重试率基线**
- [x] **Step 2: 将已隔离测试迁入 `ui-isolated`，全局配置变更测试归入 `ui-exclusive-config`**
- [x] **Step 3: 将 `ui-isolated` 及其他 UI project 固定为单 worker**
- [x] **Step 4: 取消 2/4 workers 与业务文件 shard 目标，按业务文件分层串行执行**
- [x] **Step 5: 仅保留真实资源冲突场景的 exclusive project，删除 spec 内 serial suite**
- [x] **Step 6: 通过删除 serial suite 保证单个用例失败不会跳过同文件无关用例**

**Exit Criteria:**

- 普通 PR UI 回归固定使用单 worker。
- 记录单 worker wall time、失败率和重试率，并通过去重、条件等待和分层选集控制执行时间。
- 不发生跨测试资源删除、配置串扰或随机名称冲突。

---

## Final Acceptance

### Structural Acceptance

- [x] `npm run lint:ui-architecture` 通过。
- [x] 修改范围内无候选 locator 数组、XPath、selector alias 和隐式搜索 fallback。
- [x] 无同页 action 返回 `this` 或当前 Page。
- [x] 无生产调用退化为固定 input delay。
- [x] 无 debug spec 被正式 UI project 收集。
- [x] Flow/Test/Page 职责满足本计划 Target Layer Contract。

### Functional Acceptance

- [x] TypeScript `--noEmit` 通过。
- [x] Node script/unit tests 通过。
- [x] Payment（信用卡除外）、Order Dishes、Inventory、Recall、Refund、Split、Table、Paging 定向用例通过。
- [x] 230 个现有测试有明确映射：227 条正式业务 UI + 3 条独立 diagnostics。
- [x] Jira annotation 和业务 tag 未丢失：226 个 Jira key 全部保留，原 24 个 tag 无缺失。
- [x] Page/Flow `@step(...)` 及测试场景步骤保留中文报告描述。

### Efficiency Acceptance

- [x] PR suite 不包含分钟级固定等待。
- [x] 所有 UI project 固定为单 worker，配置中不存在 2/4 workers 或 shard 并发目标。
- [x] 记录代表性长链路对比：POS-21845 从 180 秒超时降至约 23 秒通过，定向通过集重试率为 0%。

## Standard Verification Commands

```powershell
npm.cmd run test:scripts
npm.cmd run lint:ui-architecture
npm.cmd exec tsc -- --noEmit
npm.cmd exec playwright test tests/py-migrate -- --list --project=ui-isolated --project=ui-shared --project=ui-exclusive-config --project=ui-print --project=ui-slow
npm.cmd exec playwright test tests/py-migrate/inventory.spec.ts -- --project=ui-isolated --project=ui-shared --project=ui-exclusive-config --project=ui-print
npm.cmd exec playwright test tests/py-migrate/paging.spec.ts -- --project=ui-slow
npm.cmd exec playwright test tests/py-migrate/table-order.spec.ts -- --project=ui-slow
git diff --check
```

需要访问真实 POS、打印机、数据库或共享环境的 E2E 命令，应在对应 Task 完成且资源所有权确认后执行；不得为了验证结构性改动无条件清空共享业务数据。

## Rollback Strategy

- 每个 Task 独立提交，禁止跨 Phase 混合提交。
- Page 拆分期间先保持旧 API 兼容，再迁移调用方，最后删除 deprecated 入口。
- locator 迁移必须先用真实 DOM/录制确认目标，再删除旧候选链。
- UI 执行固定单 worker；后续提效仅通过用例分层、步骤去重、条件等待和精确资源清理实现，不引入 shard 并发。
- 若某业务能力暂时无法获得稳定 selector，应停止该能力迁移并提出 `data-testid` 需求，不得恢复候选遍历。

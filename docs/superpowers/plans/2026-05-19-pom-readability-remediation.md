# POM Readability Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过分批重构页面对象、收敛 locator 契约、统一 page/flow API 语义，降低 `pages/` 与 `flows/` 的阅读和维护成本，同时保持现有 UI 自动化行为稳定。

**Architecture:** 先用现有 e2e/smoke 用例给 `HomePage`、`OrderDishesPage`、`RecallPage` 的关键行为加护栏，再抽取共享作用域与 typed entry 契约，随后将超大 page 拆成“主 facade + 聚焦协作对象”，并在最后一批统一方法命名、返回值、后置条件和 flow 导出模式。规范落到 `AGENTS.md` 与仓库文档，同时把结构性回归检查写进测试护栏，防止大文件和 locator 猜测链回潮。

**Tech Stack:** Playwright Test, TypeScript, page objects, flows, shared utils, repository docs

---

### Task 1: 补齐重构安全网

**Files:**
- Modify: `D:\menusifu\pos2.0\tests\e2e\order-dishes-load.spec.ts`
- Modify: `D:\menusifu\pos2.0\tests\e2e\order-dishes-price-summary.spec.ts`
- Modify: `D:\menusifu\pos2.0\tests\e2e\recall-page-selectors.spec.ts`
- Modify: `D:\menusifu\pos2.0\tests\e2e\recall-order-details.spec.ts`
- Modify: `D:\menusifu\pos2.0\tests\smoke\home.smoke.spec.ts`
- Modify: `D:\menusifu\pos2.0\tests\smoke\recall-search.smoke.spec.ts`

- [x] **Step 1: 为首页入口、点单页加载、Recall 搜索与详情补齐最小行为护栏**
- [x] **Step 2: 确保新增断言只锁定公开 page 行为，不把内部 locator 实现细节写死**
- [x] **Step 3: 运行首页、点单、Recall 相关 e2e/smoke 用例，确认重构前基线为绿**

### Task 2: 引入共享作用域与类型化页面入口

**Files:**
- Create: `D:\menusifu\pos2.0\pages\shared\locator-scope.ts`
- Create: `D:\menusifu\pos2.0\pages\shared\page-method-contracts.ts`
- Modify: `D:\menusifu\pos2.0\pages\home.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\select-table.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\inventory.page.ts`

- [x] **Step 1: 提供共享的页面作用域 helper，统一处理 iframe 与宿主页面互斥渲染，不再让每个按钮各自堆 `.or(...)`**
- [x] **Step 2: 定义页面方法命名与返回值契约的共享类型，如入口枚举、同页动作/跨页动作约定**
- [x] **Step 3: 先在 `HomePage`、`SelectTablePage`、`InventoryPage` 落地 typed entry 与共享作用域，作为后续大页重构模板**
- [x] **Step 4: 回跑 `home-page-refresh.spec.ts`、`select-table-page.spec.ts` 与相关 smoke 用例，确认模板页改造稳定**

### Task 3: 拆分 OrderDishesPage 为聚焦协作对象

**Files:**
- Create: `D:\menusifu\pos2.0\pages\order-dishes\order-dishes-locators.ts`
- Create: `D:\menusifu\pos2.0\pages\order-dishes\order-dishes-menu.section.ts`
- Create: `D:\menusifu\pos2.0\pages\order-dishes\order-dishes-modifier.section.ts`
- Create: `D:\menusifu\pos2.0\pages\order-dishes\order-dishes-charge.section.ts`
- Create: `D:\menusifu\pos2.0\pages\order-dishes\order-dishes-reads.section.ts`
- Modify: `D:\menusifu\pos2.0\pages\order-dishes.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\inventory.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\payment.page.ts`
- Modify: `D:\menusifu\pos2.0\flows\order-dishes.flow.ts`

- [x] **Step 1: 保留 `OrderDishesPage` 作为 facade，只承担公开 API 编排与跨区块衔接**
- [x] **Step 2: 将菜单切换/点菜、改单、加费、价格与购物车读取分别下沉到 section/helper 文件，避免单文件继续承载全部细节**
- [x] **Step 3: 清理 `OrderDishesPage` 中重复的 `resolveX()` 与 locator fallback 链，优先走共享作用域 helper 和单一 DOM 契约**
- [x] **Step 4: 确保 `saveOrder()`、`sendOrder()`、`openPayment()`、`openSplitOrder()` 等跨页动作保留清晰返回值与最小后置条件**
- [x] **Step 5: 回跑 `order-dishes-*.spec.ts`、`payment-page.spec.ts`、`split-order.spec.ts`、`order-dishes.smoke.spec.ts`**

### Task 4: 拆分 RecallPage 为过滤、详情、作废三个责任块

**Files:**
- Create: `D:\menusifu\pos2.0\pages\recall\recall-filter-bar.section.ts`
- Create: `D:\menusifu\pos2.0\pages\recall\recall-order-details.dialog.ts`
- Create: `D:\menusifu\pos2.0\pages\recall\recall-void.dialog.ts`
- Create: `D:\menusifu\pos2.0\pages\recall\recall-reads.section.ts`
- Modify: `D:\menusifu\pos2.0\pages\recall.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\payment.page.ts`
- Modify: `D:\menusifu\pos2.0\flows\recall.flow.ts`

- [x] **Step 1: 保留 `RecallPage` 作为 facade，公开搜索、打开详情、进入编辑、进入支付、作废订单等稳定能力**
- [x] **Step 2: 将筛选条件、手动搜索、详情弹窗读取、作废弹窗交互拆到聚焦 section/dialog 文件**
- [x] **Step 3: 去掉详情弹窗与作废流程中的猜测式 locator 链，只保留真实 DOM 契约与必要的互斥作用域封装**
- [x] **Step 4: 统一 `openX`、`readX`、`closeX`、`voidX` 的命名与后置条件，避免名字轻、内部策略重**
- [x] **Step 5: 回跑 `recall-*.spec.ts`、`recall-order-details.smoke.spec.ts`、`recall-search.smoke.spec.ts`、`dine-in-recall-consistency.smoke.spec.ts`**

### Task 5: 统一页面方法命名、返回值与后置条件

**Files:**
- Modify: `D:\menusifu\pos2.0\pages\home.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\delivery.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\pick-up.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\select-table.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\inventory-stock-setting.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\inventory.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\order-dishes.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\payment.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\recall.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\split-order.page.ts`

- [x] **Step 1: 把同页动作统一收敛为 `Promise<void>`，跨页动作统一返回目标 page，读取动作统一返回明确数据模型**
- [x] **Step 2: 清理 `clickX`、`openX`、`enterX`、`saveX`、`readX`、`expectX` 的命名混用，名字必须直接表达动作层级**
- [x] **Step 3: 给跨页动作补最小加载校验约定，并保持 page 层不掺杂业务选择策略**
- [x] **Step 4: 回跑点单、Recall、库存、支付、分单与 takeout 相关用例，确认 API 语义调整不改变业务行为**

### Task 6: 收敛 flow 导出模式并删除无价值重复入口

**Files:**
- Modify: `D:\menusifu\pos2.0\flows\employee-login.flow.ts`
- Modify: `D:\menusifu\pos2.0\flows\home.flow.ts`
- Modify: `D:\menusifu\pos2.0\flows\inventory.flow.ts`
- Modify: `D:\menusifu\pos2.0\flows\license-selection.flow.ts`
- Modify: `D:\menusifu\pos2.0\flows\order-dishes.flow.ts`
- Modify: `D:\menusifu\pos2.0\flows\payment.flow.ts`
- Modify: `D:\menusifu\pos2.0\flows\recall.flow.ts`
- Modify: `D:\menusifu\pos2.0\flows\select-table.flow.ts`
- Modify: `D:\menusifu\pos2.0\flows\split-order.flow.ts`
- Modify: `D:\menusifu\pos2.0\flows\takeout.flow.ts`
- Modify: `D:\menusifu\pos2.0\tests\**\*.spec.ts`（按实际 import 命中更新）

- [x] **Step 1: 统计各 flow 的真实调用入口，确定保留“decorated class methods + 薄包装函数”还是“函数优先、类内聚不导出”的单一模式**
- [x] **Step 2: 删除未被使用、只制造阅读分叉的一比一重复导出，同时保留报告步骤可见性**
- [x] **Step 3: 批量更新测试与 fixture 的 import，确保团队只面对一种推荐调用方式**
- [x] **Step 4: 回跑 `tests\smoke`、`tests\py-migrate` 与受影响 e2e，确认 flow 清理不破坏业务编排**

### Task 7: 固化仓库规范并加入结构性回归护栏

**Files:**
- Create: `D:\menusifu\pos2.0\docs\page-object-guidelines.md`
- Modify: `D:\menusifu\pos2.0\AGENTS.md`
- Modify: `D:\menusifu\pos2.0\tests\e2e\report-noise-guard.spec.ts`

- [x] **Step 1: 把 locator 契约、命名规则、返回值规则、page/flow 边界、后置条件约定写入项目文档**
- [x] **Step 2: 在 `AGENTS.md` 中补充“避免 locator 猜测链”“统一返回值语义”“同页动作不默认 `return this`”等规则**
- [x] **Step 3: 为 `report-noise-guard.spec.ts` 增加结构性护栏，如禁止新增超长 `.or(...)` 链、限制热点 page 文件重新膨胀**
- [x] **Step 4: 全量回跑 `report-noise-guard.spec.ts`、关键 e2e、关键 smoke，记录剩余非本次重构问题并单独归档**

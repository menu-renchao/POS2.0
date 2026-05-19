# Input Stabilization Before Submit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为所有输入后直接确认/提交且会触发接口的页面动作统一补上提交前 `200ms` 稳定等待，并以回归测试锁定。

**Architecture:** 在 `utils/` 提供共享输入稳定等待 helper，由 `pages/` 内部在最终确认/提交前显式调用。先用库存设置和跨页契约测试驱动，再把 helper 接入库存设置、点单页、Recall、分单页面对象，并把规则写入 `AGENTS.md`。

**Tech Stack:** Playwright Test, TypeScript, page objects, shared utils

---

### Task 1: 写设计驱动的失败测试

**Files:**
- Create: `D:\menusifu\pos2.0\tests\e2e\inventory-stock-setting.spec.ts`
- Modify: `D:\menusifu\pos2.0\tests\e2e\recall-page-selectors.spec.ts`

- [ ] **Step 1: 为库存设置补最小失败测试**
- [ ] **Step 2: 运行库存设置测试并确认在未加等待时失败**
- [ ] **Step 3: 为 Recall 手动搜索补 200ms 稳定等待契约**
- [ ] **Step 4: 运行 Recall 契约并确认未加等待时失败**

### Task 2: 实现共享输入稳定等待 helper

**Files:**
- Create: `D:\menusifu\pos2.0\utils\input-stability.ts`

- [ ] **Step 1: 新增 `waitForInputSettled()` 与默认 200ms 常量**
- [ ] **Step 2: 保持 helper 单一职责，不耦合点击和页面状态**
- [ ] **Step 3: 运行相关测试确保 helper 可被页面对象使用**

### Task 3: 接入库存设置与 Recall

**Files:**
- Modify: `D:\menusifu\pos2.0\pages\inventory-stock-setting.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\recall.page.ts`

- [ ] **Step 1: 在库存设置提交前接入共享等待**
- [ ] **Step 2: 在 Recall 手动搜索提交与 Void 提交前接入共享等待**
- [ ] **Step 3: 运行库存设置与 Recall 契约验证转绿**

### Task 4: 接入点单页与分单页

**Files:**
- Modify: `D:\menusifu\pos2.0\pages\order-dishes.page.ts`
- Modify: `D:\menusifu\pos2.0\pages\split-order.page.ts`

- [ ] **Step 1: 识别点单页中输入后立即确认的动作并统一接入等待**
- [ ] **Step 2: 在分单输入确认与提交前接入等待**
- [ ] **Step 3: 回跑点单页、分单相关契约测试**

### Task 5: 固化项目规则并全量验证

**Files:**
- Modify: `D:\menusifu\pos2.0\AGENTS.md`

- [ ] **Step 1: 将 200ms 输入稳定等待规则写入项目约束**
- [ ] **Step 2: 回跑库存、Recall、分单及受影响的契约/迁移测试**
- [ ] **Step 3: 记录仍存在的独立业务失败，不将其与输入稳定问题混淆**

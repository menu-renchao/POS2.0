# POS-32955 Open Food Charge Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用真实 Open Food 入口创建自定义中英文名称菜品，并验证加收弹窗的 Item 模式展示该名称。

**Architecture:** Open Food 的稳定控件集中在 `OrderDishesLocators`，低层输入与确认动作属于 `OrderDishesMenuSection`，业务编排由 `OrderDishesFlow` 暴露。加收区提供名称可见性断言，测试只描述业务步骤。

**Tech Stack:** TypeScript、Playwright Test、现有 Page Object/Flow/`@step` 基础设施。

## Global Constraints

- 使用录制得到的真实 `data-testid`，不添加候选定位器。
- 输入后确认前至少等待 200ms。
- 页面和 Flow 方法均使用中文 `@step`。
- 只真实运行 POS-32955，不进行无休止重试。

---

### Task 1: 封装 Open Food 页面能力

**Files:**
- Modify: `pages/order-dishes/order-dishes-locators.ts`
- Modify: `pages/order-dishes/order-dishes-menu.section.ts`
- Modify: `pages/order-dishes.page.ts`
- Modify: `flows/order-dishes.flow.ts`

**Interfaces:**
- Produces: `OrderDishesPage.addOpenFood(name: string, price: number): Promise<void>`
- Produces: `OrderDishesFlow.addOpenFoodItem(orderDishesPage, name, price): Promise<void>`

- [x] **Step 1:** 集中定义录制确认的 Open Food 控件。
- [x] **Step 2:** 封装打开、输入、关闭键盘和确认动作。
- [x] **Step 3:** 在页面门面和 Flow 中公开业务接口。

### Task 2: 启用并验证 POS-32955

**Files:**
- Modify: `pages/order-dishes/order-dishes-charge.section.ts`
- Modify: `pages/order-dishes.page.ts`
- Modify: `tests/py-migrate/split-order-operation.spec.ts`
- Modify: `docs/playwright-recordings-needed.md`

**Interfaces:**
- Produces: `OrderDishesPage.expectChargeDishVisible(dishName: string): Promise<void>`

- [x] **Step 1:** 在 Item 加收模式中断言自定义菜名可见。
- [x] **Step 2:** 移除 POS-32955 的 `test.fixme` 与空占位辅助函数。
- [x] **Step 3:** 从待录制清单移除 POS-32955。
- [x] **Step 4:** 运行 TypeScript 检查、差异检查和 POS-32955 单测。

# Playwright Test Agents Seed Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 为当前 POS Playwright 项目补一个可被 Playwright Test Agents 复用的 `tests/seed.spec.ts`，并补齐建议的 `specs/generated/`、`tests/generated/` 目录占位说明。

**Architecture:** `seed.spec.ts` 只复用现有 `fixtures/` 与 `flows/` 建立 POS 首页员工上下文，不引入新的页面对象或业务策略。建议目录使用占位说明文件保留结构，让后续 planner / generator 产物有固定落点，同时不干扰现有 `tests/smoke/` 和 `tests/e2e/`。

**Tech Stack:** Playwright Test, TypeScript, existing project fixtures/flows

---

### Task 1: 补 seed 入口

**Files:**
- Create: `tests/seed.spec.ts`

**Step 1: 复用现有登录链路**

从以下模块复用既有行为：

- `fixtures/test.fixture.ts`
- `flows/home.flow.ts`
- `flows/license-selection.flow.ts`
- `flows/employee-login.flow.ts`

**Step 2: 使用最小业务路径建立员工上下文**

seed 需要：

- 打开 `myhome.html`
- 如出现授权页则进入可用 License
- 如出现员工口令页则输入默认员工口令
- 最终确认进入 POS 首页

**Step 3: 保持仓库测试风格**

要求：

- `describe` / `test` 标题使用中文
- 使用 Playwright 原生 `test(title, details, body)` 风格
- 不直接深链进入内部页面

### Task 2: 补建议目录结构

**Files:**
- Create: `specs/generated/README.md`
- Create: `tests/generated/README.md`

**Step 1: 固定 planner 输出目录**

在 `specs/generated/README.md` 中说明该目录用于保存 agent 生成的 Markdown 测试计划。

**Step 2: 固定 generator 输出目录**

在 `tests/generated/README.md` 中说明该目录用于保存 agent 生成的 Playwright Test 文件，并与人工维护目录分开。

### Task 3: 最小验证

**Files:**
- Verify: `tests/seed.spec.ts`

**Step 1: 列出 Playwright 测试文件**

运行：`npx playwright test --list`

**Step 2: 确认 seed 已被识别**

预期：

- 列表中出现 `tests/seed.spec.ts`
- 不要求真正执行 UI 业务流

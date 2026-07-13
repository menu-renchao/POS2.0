# Codegen 固定请求头 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让现有 `npm.cmd run codegen` 在打开 POS 和 Playwright Inspector 时固定发送 `x-client-sn: mansuper` 与 `x-client-type: 0`。

**Architecture:** 用一个可直接执行、也可被单元测试导入的 Node ESM 脚本替代原始 Codegen CLI 命令。脚本通过 Chromium browser context 的 `extraHTTPHeaders` 注入固定请求头，通过 `page.pause()` 提供 Inspector 录制能力；Node 内置测试运行器只验证静态配置和 npm script，不启动交互式浏览器。

**Tech Stack:** Node.js ESM、`@playwright/test` 1.60、Node 内置 `node:test`、npm scripts。

## Global Constraints

- 保留用户命令 `npm.cmd run codegen`。
- POS 入口固定为 `http://192.168.247:22080/kpos/front/myhome.html`。
- `x-client-sn` 固定为 `mansuper`，不允许环境变量覆盖。
- `x-client-type` 固定为 `0`。
- 使用现有 Playwright 依赖，不新增 npm 包。
- Codegen 必须从 POS 首页通过 UI 导航，不直接打开内部页面。
- 不修改普通 Playwright Test 或 API 测试认证配置。
- 不触碰现有未提交的 `pages/recall.page.ts`、`pages/recall/recall-order-details.dialog.ts` 和 `tests/py-migrate/split-order-operation.spec.ts` 修改。

---

## File Structure

- Create `scripts/codegen.mjs`: 持有固定 Codegen 配置，启动有头 Chromium、创建带请求头的 context、打开 POS 首页并进入 Inspector。
- Create `tests/scripts/codegen.unit.test.mjs`: 用 Node 内置测试运行器验证 URL、固定请求头和 npm script 指向，不启动浏览器。
- Modify `package.json:13`: 保留 `codegen` script 名称，将命令切换为 `node scripts/codegen.mjs`。

### Task 1: 实现固定请求头的 Codegen 启动入口

**Files:**
- Create: `tests/scripts/codegen.unit.test.mjs`
- Create: `scripts/codegen.mjs`
- Modify: `package.json:13`

**Interfaces:**
- Consumes: `chromium` from `@playwright/test`；Node ESM 的 `import.meta.url`、`process.argv[1]` 和 `pathToFileURL()`。
- Produces: `CODEGEN_URL: string`、`CODEGEN_CONTEXT_OPTIONS: Readonly<{ extraHTTPHeaders: Readonly<Record<string, string>>; viewport: Readonly<{ width: number; height: number }> }>`、`runCodegen(): Promise<void>`，以及保持不变的 npm 命令 `npm.cmd run codegen`。

- [ ] **Step 1: 写入失败的脚本级单元测试**

创建 `tests/scripts/codegen.unit.test.mjs`：

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { CODEGEN_CONTEXT_OPTIONS, CODEGEN_URL } from '../../scripts/codegen.mjs';

test('应为 Codegen 固定 POS 首页和客户端请求头', () => {
  assert.equal(CODEGEN_URL, 'http://192.168.247:22080/kpos/front/myhome.html');
  assert.deepEqual(CODEGEN_CONTEXT_OPTIONS.extraHTTPHeaders, {
    'x-client-sn': 'mansuper',
    'x-client-type': '0',
  });
});

test('应通过自定义 Node 脚本启动 Codegen', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );

  assert.equal(packageJson.scripts.codegen, 'node scripts/codegen.mjs');
});
```

- [ ] **Step 2: 运行测试并确认按预期失败**

Run:

```powershell
node --test tests/scripts/codegen.unit.test.mjs
```

Expected: FAIL，错误包含 `ERR_MODULE_NOT_FOUND`，指出 `scripts/codegen.mjs` 尚不存在。

- [ ] **Step 3: 写入最小 Codegen 启动脚本**

创建 `scripts/codegen.mjs`：

```js
import { pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

export const CODEGEN_URL = 'http://192.168.247:22080/kpos/front/myhome.html';

export const CODEGEN_CONTEXT_OPTIONS = Object.freeze({
  extraHTTPHeaders: Object.freeze({
    'x-client-sn': 'mansuper',
    'x-client-type': '0',
  }),
  viewport: Object.freeze({ width: 1920, height: 1080 }),
});

export async function runCodegen() {
  const browser = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext(CODEGEN_CONTEXT_OPTIONS);
    const page = await context.newPage();

    await page.goto(CODEGEN_URL);
    await page.pause();
  } catch (error) {
    if (browser.isConnected()) {
      throw error;
    }
  } finally {
    if (browser.isConnected()) {
      await browser.close();
    }
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';

if (import.meta.url === entryUrl) {
  try {
    await runCodegen();
  } catch (error) {
    console.error('Codegen 启动失败：', error);
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: 将 npm script 切换到自定义启动脚本**

在 `package.json` 中将：

```json
"codegen": "playwright codegen http://192.168.247:22080/kpos/front/myhome.html"
```

改为：

```json
"codegen": "node scripts/codegen.mjs"
```

- [ ] **Step 5: 运行脚本级单元测试并确认通过**

Run:

```powershell
node --test tests/scripts/codegen.unit.test.mjs
```

Expected: PASS，显示 `2` 个测试通过、`0` 个测试失败。

- [ ] **Step 6: 检查脚本语法和变更边界**

Run:

```powershell
node --check scripts/codegen.mjs
git diff --check -- package.json scripts/codegen.mjs tests/scripts/codegen.unit.test.mjs
git status --short
```

Expected:

- `node --check` 退出码为 `0`。
- `git diff --check` 无输出。
- `git status --short` 只新增或修改本任务的三个文件，同时仍保留进入任务前已有的三个用户修改文件。

- [ ] **Step 7: 人工验证 Codegen 与实际请求头**

Run:

```powershell
npm.cmd run codegen
```

Expected:

- Chromium 打开 `http://192.168.247:22080/kpos/front/myhome.html`。
- Playwright Inspector 打开并可录制操作。
- 网络面板或服务端请求日志显示 `x-client-sn: mansuper` 与 `x-client-type: 0`。
- 关闭录制器与浏览器后 npm 命令退出，无残留 Chromium 进程。

- [ ] **Step 8: 仅提交本任务文件**

```powershell
git add -- package.json scripts/codegen.mjs tests/scripts/codegen.unit.test.mjs
git commit -m "feat: launch codegen with POS client headers"
```

Expected: 新提交只包含 `package.json`、`scripts/codegen.mjs` 和 `tests/scripts/codegen.unit.test.mjs`，不包含进入任务前已有的未提交修改。

# Codegen 固定请求头设计

## 背景

当前 `npm.cmd run codegen` 直接执行 Playwright 的 `codegen` CLI，并打开 POS 首页。该命令不通过 Playwright Test runner，因此不会读取 `playwright.config.ts` 中 `py-migrate` 项目的 `extraHTTPHeaders`。测试配置中的 `mansuper` 不会覆盖 Codegen 浏览器请求里由页面提供的 `device001`。

## 目标

- 保留现有命令入口：`npm.cmd run codegen`。
- 从 `http://192.168.247:22080/kpos/front/myhome.html` 进入 POS。
- Codegen 浏览器上下文固定发送以下请求头：
  - `x-client-sn: mansuper`
  - `x-client-type: 0`
- 打开 Playwright Inspector，继续提供录制和定位器选择能力。
- 录制结束或浏览器关闭后释放浏览器进程。

## 非目标

- 不为请求头增加环境变量覆盖能力。
- 不修改普通 Playwright Test 或 API 测试的认证配置。
- 不引入代理、浏览器扩展或新的第三方依赖。
- 不改变 POS 的页面导航规则。

## 方案比较

### 方案一：自定义 Playwright 启动脚本

通过 Node `.mjs` 脚本启动 Chromium，创建带 `extraHTTPHeaders` 的浏览器上下文，打开首页后调用 `page.pause()` 进入 Playwright Inspector。

优点是请求头在浏览器上下文边界统一设置，初始页面请求和后续请求均可携带固定值；实现直接，也符合仓库已有的 `.mjs` 脚本形式。

### 方案二：逐请求拦截并覆盖请求头

自定义脚本通过 `page.route()` 拦截请求并改写 headers。

该方案比上下文级请求头复杂，还需要处理导航、资源请求和既有 header 的合并，不适合作为默认实现。

### 方案三：本地代理注入请求头

继续使用原始 Codegen CLI，但通过代理服务器改写请求头。

该方案需要新增并维护代理进程，故障面和使用成本明显高于需求本身。

## 选定方案

采用方案一：自定义 Playwright 启动脚本。

## 组件与数据流

### `scripts/codegen.mjs`

该脚本负责：

1. 定义固定的 POS 首页地址和浏览器上下文选项。
2. 使用项目现有 Playwright 依赖启动有头 Chromium。
3. 使用 `extraHTTPHeaders` 创建浏览器上下文。
4. 创建页面并进入 POS 首页。
5. 调用 `page.pause()` 打开 Inspector，供使用者录制操作。
6. 在录制结束后关闭浏览器；发生启动错误时输出明确错误并以非零状态退出。

配置构造与浏览器启动逻辑保持可分离，使固定 URL 和请求头可以由自动化测试直接验证，而不必在测试中打开交互式 Inspector。

脚本导出固定 URL、浏览器上下文选项和启动函数，并使用直接执行判断保护启动入口；测试导入脚本时只读取配置，不启动浏览器。

### `package.json`

保留 `codegen` script 名称，将其命令改为执行 `node scripts/codegen.mjs`。使用者仍运行：

```powershell
npm.cmd run codegen
```

## 请求流程

```text
npm.cmd run codegen
  -> node scripts/codegen.mjs
  -> chromium.launch({ headless: false })
  -> browser.newContext({ extraHTTPHeaders })
  -> page.goto(POS 首页)
  -> page.pause()
  -> Playwright Inspector 录制操作
```

## 错误处理

- Chromium 启动、上下文创建或首页导航失败时，脚本输出原始错误并设置非零退出码。
- 浏览器实例一旦创建，无论正常结束还是后续步骤抛错，都通过 `finally` 关闭。
- 不添加静默重试，避免掩盖地址不可达或浏览器未安装等真实问题。

## 测试与验收

自动化测试至少验证：

- Codegen 首页地址为 `http://192.168.247:22080/kpos/front/myhome.html`。
- `extraHTTPHeaders['x-client-sn']` 固定为 `mansuper`。
- `extraHTTPHeaders['x-client-type']` 固定为 `0`。
- `package.json` 的 `codegen` script 指向自定义启动脚本。

脚本级测试放在 `tests/scripts/codegen.unit.test.mjs`，使用 Node 内置测试运行器执行，以免单元测试触发 Playwright Test 的全局 POS 环境检查。

人工验收步骤：

1. 运行 `npm.cmd run codegen`。
2. 确认 POS 首页和 Playwright Inspector 正常打开。
3. 在浏览器网络面板或服务端请求日志中确认请求包含 `x-client-sn: mansuper` 和 `x-client-type: 0`。
4. 关闭录制器与浏览器，确认命令正常退出且无残留浏览器进程。

## 兼容性

- 使用仓库现有 `@playwright/test`/Playwright 依赖，不增加 npm 包。
- 默认继续使用 Chromium，与当前 `playwright codegen` 的默认浏览器类型一致。
- 仅改变 Codegen 启动链路，不影响现有 Playwright Test 项目配置。

# API Jenkins 独立流水线设计

## 目标

为 `tests/api` 新增独立 Jenkins 流水线入口，避免 API 测试和现有 UI 流水线混在一起。Jenkins job 可以单独配置目标环境 IP、端口和 context path，并按范围运行 API 测试。

## 方案

新增根目录 `Jenkinsfile.api`，现有 `Jenkinsfile` 不变。Jenkins 新建 Pipeline job 时指向 `Jenkinsfile.api`。

流水线参数：

- `API_HOST`：预填 `192.168.0`，运行前必须补成完整 IPv4 或合法 hostname。
- `API_PORT`：预填 `22080`。
- `API_CONTEXT_PATH`：预填 `kpos`。
- `API_TEST_SCOPE`：支持 `all`、`endpoints`、`business`、`contracts`、`unit`、`cleanup`。
- `GIT_BRANCH`：从远端分支动态加载的下拉选项，取不到分支列表时回退 `main`。

最终由流水线拼出 `API_BASE_URL=http://${API_HOST}:${API_PORT}/${API_CONTEXT_PATH}`，并注入 Playwright API 测试进程。

## 参数校验

`API_HOST` 不提供完整默认 IP。预填值 `192.168.0` 仅用于方便输入，如果用户没有补全，流水线会在 `Validate Parameters` 阶段失败。

校验规则：

- IPv4 必须是四段完整地址，并且每段在 `0..255`。
- 纯数字和点号组成但不是完整 IPv4 的值直接拒绝。
- 非 IPv4 时允许合法 hostname。
- `API_PORT` 必须是 `1..65535`。
- `API_CONTEXT_PATH` 只能使用普通 path segment 字符，不能包含 `..`。

## 执行流程

1. `Validate Parameters`：校验参数并生成 `API_BASE_URL`。
2. `Checkout`：拉取并切换到 `GIT_BRANCH`。
3. `Check Environment`：打印 Node.js 和 npm 版本。
4. `Install Dependencies`：执行 `npm ci`。
5. `Check Playwright Installation`：打印本地 Playwright CLI、package 版本和关键 Node 环境变量。
6. `Clean Test Reports`：清理本次构建前的测试产物。
7. `Run API Tests`：按 `API_TEST_SCOPE` 使用仓库内 `node_modules/@playwright/test/cli.js` 执行对应 Playwright API 测试。
8. `post`：发布 Allure 原始结果并归档 `test-results`。

## 鉴权

流水线固定使用 `API_AUTH_MODE=apiLogin`。API 测试框架继续使用开发提供的接口测试后门请求头，不暴露 Cookie、API key 或浏览器登录态配置。

## 风险控制

- 不默认打到某个完整 IP，避免误跑真实环境。
- 参数阶段先失败，避免依赖安装和测试阶段才暴露配置错误。
- 分支参数使用 Active Choices 动态加载远端分支，并保留 `main` 兜底。
- 测试阶段显式调用仓库内 Playwright Test CLI，避免 Jenkins Agent 的全局 `playwright`、`npx` 或 npm shim 影响 runner 实例。
- `API_TEST_SCOPE=cleanup` 单独保留，便于需要时清理自动化残留数据。

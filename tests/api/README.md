# API 测试目录说明

`tests/api` 只放可执行的 Playwright API 测试。按用途分目录：

- `business/`：真实业务接口测试。会访问专用测试环境 API，覆盖只读链路和写接口闭环。
- `contracts/`：契约和覆盖矩阵测试。用于确认 Swagger 首批接口、覆盖等级、用例文件映射和契约烟测入口。
- `endpoints/`：单接口真实 API 测试。每个用例聚焦一个 endpoint，适合追加异常、边界和参数校验场景。
- `support/`：endpoint 测试支撑层，包括断言、资源工厂和接入模板，不直接代表业务接口覆盖。
- `unit/`：API 自动化自身的工具测试。只验证配置解析、客户端路径、响应信封、资源登记、测试数据工厂和 fixture，不代表真实业务接口跑通。
- `maintenance/`：维护类接口测试。用于清理自动化残留数据，默认不作为业务覆盖入口。

新增接口测试时优先判断是否会真实调用业务接口。真实调用放 `business/`；只验证自动化框架能力放 `unit/`；只验证接口契约或覆盖矩阵放 `contracts/`；清理脚本放 `maintenance/`。

## 常用命令

- `npm run test:api`：运行全部 API 测试。
- `npx playwright test tests/api/endpoints --project=api --reporter=line`：只运行 endpoint 单接口测试。

## API 登录配置

接口测试只保留 `apiLogin` 鉴权模式。请求上下文会固定注入测试环境后门请求头：

- `x-client-sn: device001`
- `x-client-type: 0`
- `X-Direct-Req: true`

随后框架自动完成两步 API 登录：

1. `POST /api/client/session/login` 获取客户端 `sessionKey`，并写入 `licenseAuthKey` cookie。
2. `POST /api/login?passcode=11&fetchClockInOutStatus=true&fetchSettings=true` 建立员工登录态，保留后端下发的 `KPOS_REMEMBER_USER` 和 `JSESSIONID`。

测试代码不读取浏览器 Cookie，也不需要在本地 `.env` 手工配置 Cookie。

常用环境变量：

- `API_BASE_URL`：接口根地址，默认 `http://192.168.0.182:22080/kpos`。
- `API_AUTH_MODE`：可省略；如显式配置，只允许 `apiLogin` 或 `api_login`。

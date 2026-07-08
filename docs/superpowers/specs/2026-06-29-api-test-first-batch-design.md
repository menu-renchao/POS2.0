# 首批接口测试设计

## 背景

当前仓库是 Playwright Test + TypeScript 的 POS 自动化项目，已有 UI 自动化分层：

- `pages/`：页面对象和页面级动作
- `flows/`：业务流程编排
- `fixtures/`：Playwright fixture 扩展
- `test-data/`：环境和测试数据
- `utils/`：公共工具

接口文档来自：

- Swagger UI：`http://192.168.0.247:22080/kpos/swagger-ui/index.html`
- OpenAPI JSON：`http://192.168.0.247:22080/kpos/v3/api-docs`
- 本地文档：`接口文档.md`

Swagger 当前包含 77 个分组、484 个 path、517 个 operation、795 个 schema。首批接口测试不做全量 517 个 operation，而是先覆盖用户指定的核心领域。

## 目标

首批接口测试目标是建立可维护的 API 自动化基础设施，并覆盖菜单、商品、订单、支付和后台配置相关接口。

具体目标：

1. 使用现有 Playwright Test runner，不引入新的测试运行器。
2. 新增独立 `tests/api/` 套件，使 Jenkins 可以按现有动态套件机制选择 API 测试。
3. 默认使用 API Key 认证，同时支持 Cookie 认证。
4. 在专用测试环境中允许创建、更新、删除测试数据。
5. 所有测试创建的数据必须可识别、可登记、可清理。
6. 对首批接口形成覆盖矩阵，明确每个接口的覆盖等级。

## 首批范围

首批范围包含 13 个接口分组，共 112 个 operation。

| 分组 | operation 数 |
| --- | ---: |
| 菜单管理 | 10 |
| 菜单全局搜索 | 1 |
| 菜单组管理 | 12 |
| 订单管理 | 17 |
| 订单支付 | 8 |
| 分类管理 | 13 |
| 角色管理 | 3 |
| 商品管理 | 21 |
| 税费管理 | 3 |
| 折扣管理 | 3 |
| `global-option-category-controller` | 5 |
| `global-option-controller` | 10 |
| SPU 库存管理 | 6 |

## 方案选择

对比过三种方案：

| 方案 | 内容 | 优点 | 缺点 |
| --- | --- | --- | --- |
| A | 全量动态契约扫描 | 覆盖面快，生成成本低 | 正向业务价值弱，写接口合法数据难生成 |
| B | 全部手写业务链路 | 业务校验最强 | 首批工作量大，Swagger 变化后维护成本高 |
| C | 生成清单 + 领域 client + 手写核心链路 | 覆盖和可维护性平衡 | 需要先建设 client、fixture、清理机制 |

采用方案 C。

方案 C 的核心是：

- OpenAPI 用于生成接口清单和覆盖矩阵。
- 测试代码按领域维护 client。
- 每个领域写少量核心 CRUD 或业务链路。
- 剩余接口先进入契约冒烟或错误参数覆盖，再逐步补正向数据。

## 架构设计

新增 API 测试层，不混入现有 UI 的 `pages/` 和 `flows/`。

建议结构：

```text
api/
  clients/
    menu-api.client.ts
    menu-group-api.client.ts
    category-api.client.ts
    sale-item-api.client.ts
    order-api.client.ts
    payment-api.client.ts
    tax-api.client.ts
    discount-api.client.ts
    role-api.client.ts
    global-option-api.client.ts
    spu-api.client.ts
  core/
    api-context.ts
    api-response.ts
    api-auth.ts
    resource-registry.ts
    test-data-id.ts
  contracts/
    first-batch-api-cases.ts

fixtures/
  api.fixture.ts

tests/api/
  menu-catalog.api.spec.ts
  sale-item.api.spec.ts
  order-payment.api.spec.ts
  admin-config.api.spec.ts
  contract-smoke.api.spec.ts
  cleanup.api.spec.ts

test-data/api/
  menu-api-data.ts
  order-api-data.ts
  payment-api-data.ts
```

### 分层职责

`api/core/` 只负责请求上下文、认证、响应解析、通用断言、测试资源登记和清理。

`api/clients/` 按领域封装接口路径、请求参数和响应读取，不写测试断言，不隐藏跨领域业务策略。

`fixtures/api.fixture.ts` 负责注入 API client、测试资源登记器和认证后的 request context。

`tests/api/` 负责表达测试意图，例如“应能创建菜单组后查询并删除”。

`test-data/api/` 保存可复用请求样本和测试数据工厂。

## 认证配置

认证支持 API Key 和 Cookie 两种模式，默认 API Key。

环境变量：

```text
API_BASE_URL=http://192.168.0.247:22080/kpos
API_AUTH_MODE=apiKey
API_KEY=<固定 API Key>
API_COOKIE_LICENSE_AUTH_KEY=<cookie 模式时使用>
```

规则：

- `API_BASE_URL` 优先使用显式配置。
- 如果没有配置 `API_BASE_URL`，可以从 `PLAYWRIGHT_BASE_URL + /kpos` 推导。
- `API_AUTH_MODE=apiKey` 时通过 `Authorization` header 传入固定 API key。
- `API_AUTH_MODE=cookie` 时通过 `licenseAuthKey` cookie 认证。
- 缺失必要认证配置时，API suite 在启动阶段失败并给出明确错误。

## 测试数据命名

由于部分业务字段不支持长名称，测试数据不能使用长时间戳前缀。

统一使用短前缀：

```text
AT_<4位时间码><2位随机>_<领域缩写>
```

示例：

```text
AT_1530A7_MG
AT_1530B2_MI
AT_1530C9_TAX
```

领域缩写建议：

| 缩写 | 含义 |
| --- | --- |
| `MN` | menu |
| `MG` | menu group |
| `CAT` | category |
| `MI` | menu item |
| `GO` | global option |
| `GOC` | global option category |
| `TAX` | tax |
| `DSC` | discount |
| `ROL` | role |
| `ORD` | order |
| `SPU` | SPU inventory |

规则：

1. 所有数据工厂必须声明字段最大长度。
2. 生成值超过字段最大长度时必须截断，但必须保留 `AT_` 前缀。
3. 用例内清理主要依赖创建接口返回的 ID。
4. `AT_` 前缀只用于历史残留兜底清理，不作为唯一清理依据。

## 资源登记与清理

所有正向写接口创建资源后，必须立即登记到 `resource-registry`。

登记内容：

- 资源类型
- 资源 ID
- 可选资源名称
- 清理方法
- 清理顺序
- 创建接口和测试用例名

清理按反向依赖顺序执行：

```text
商品 / option / 分类关联
  -> 商品
  -> 分类
  -> 菜单组
  -> 菜单
  -> 税费 / 折扣 / 角色等独立配置
```

清理分三层：

1. 用例级清理：每个测试 `afterEach` 清理当前测试创建的资源。测试失败也执行清理。清理失败不能覆盖原始失败，但必须写入报告。
2. 套件级清理：`cleanup.api.spec.ts` 按 `AT_` 前缀清理历史残留，适合手工执行或 CI 定期执行。
3. client 层保护：删除、作废、库存扣减等高风险方法只能操作已登记资源，否则直接抛错。

## 破坏性操作保护

首批运行在专用测试环境，但仍需要显式保护开关。

环境变量：

```text
API_ENABLE_DESTRUCTIVE=true
```

规则：

- 未开启 `API_ENABLE_DESTRUCTIVE=true` 时，正向 `POST/PUT/DELETE` 写入链路必须跳过或在启动阶段失败。
- 契约冒烟可以在不开启破坏性开关时运行。
- 订单、支付、SPU 库存只能操作当前测试创建或登记过的资源。

## 首批测试组织

### `menu-catalog.api.spec.ts`

覆盖：

- 菜单管理
- 菜单全局搜索
- 菜单组管理
- 分类管理
- `global-option-category-controller`
- `global-option-controller`

核心链路：

```text
创建测试菜单
  -> 创建菜单组
  -> 创建分类
  -> 创建 global option category
  -> 创建 global option
  -> 查询菜单列表 / 菜单详情 / 分类列表 / 菜单组列表 / global option 搜索
  -> 更新排序 / quick edit / batch update
  -> 删除测试创建的数据
```

### `sale-item.api.spec.ts`

覆盖：

- 商品管理
- SPU 库存管理

核心链路：

```text
基于测试菜单和分类创建商品
  -> 查询商品详情、按分类查询、按名称搜索
  -> quick edit 修改名称 / 价格
  -> 批量排序 / 批量更新 / 批量库存状态
  -> SPU 关联测试商品
  -> 对测试商品执行库存入库 / 扣减
  -> 删除测试商品
```

### `order-payment.api.spec.ts`

覆盖：

- 订单管理
- 订单支付

核心链路：

```text
使用测试商品创建测试订单
  -> 查询订单列表 / 详情 / recall / fetch
  -> 保存支付记录
  -> 调整 tip
  -> 删除或作废测试支付记录
  -> 作废测试订单
```

约束：

- 只操作当前测试创建的订单。
- 支付方式优先使用不会触发外部真实扣款的 payment record 接口。
- 信用卡退款、终端支付、真实网关相关接口先标记为 `deferred-external` 或进入 `contract-only`，除非确认有 sandbox 终端。

### `admin-config.api.spec.ts`

覆盖：

- 税费管理
- 折扣管理
- 角色管理

核心链路：

```text
创建税费 -> 查询 -> 更新 -> 删除
创建折扣 -> 查询 -> 更新 -> 删除
创建角色 -> 查询 -> 更新 -> 删除
```

### `contract-smoke.api.spec.ts`

覆盖首批领域中暂不适合正向跑的接口。

契约冒烟检查：

- 认证存在性
- 参数缺失时返回受控错误
- 响应必须是 JSON 或预期状态
- 服务不能返回 500
- OpenAPI 覆盖矩阵标记为 `contract-only`

## 覆盖等级

每个接口都需要进入覆盖矩阵。

覆盖等级：

| 等级 | 含义 |
| --- | --- |
| `positive-crud` | 已有创建、查询、更新、删除链路覆盖 |
| `positive-business` | 已有真实业务链路覆盖 |
| `contract-only` | 只做认证、参数错误、状态码和 JSON 结构冒烟 |
| `deferred-external` | 依赖外部终端、网关、SSE、文件或第三方环境，暂不做正向覆盖 |
| `blocked-missing-data` | 缺少合法请求数据或环境前置，暂时阻塞 |

矩阵字段：

```text
接口路径 | 方法 | 分组 | 覆盖等级 | 用例文件 | 风险备注
```

## 运行方式

新增脚本：

```json
{
  "test:api": "playwright test tests/api",
  "test:api:contract": "playwright test tests/api/contract-smoke.api.spec.ts",
  "test:api:cleanup": "playwright test tests/api/cleanup.api.spec.ts"
}
```

建议新增 Playwright project：

```ts
{
  name: 'api',
  testMatch: /api/,
  use: {
    baseURL: apiConfig.baseURL,
  },
}
```

API suite 不依赖浏览器，不使用 UI 的 `page` fixture。

## 报告要求

所有 `describe`、`test`、`test.step` 标题继续使用中文。

接口测试步骤示例：

```text
创建测试菜单组
读取菜单组详情并校验名称
更新菜单组排序
删除测试菜单组
```

失败信息必须包含：

- 方法和路径
- 请求 query/body 摘要
- 响应 status
- 响应 body 摘要
- 资源登记 ID

## 失败判定

正向 CRUD 和业务链路：

- HTTP 状态必须是预期状态。
- `Response<T>` 包装结构必须包含 `code`、`msg`、`traceId`、`data`。
- 新增接口必须能读回关键字段。
- 更新接口必须能读回变更。
- 删除或作废接口必须能读回删除状态，或再次查询返回预期错误/空结果。
- 清理失败不覆盖原始断言失败，但必须在报告中作为独立步骤记录。

契约冒烟：

- 不允许 500。
- 鉴权失败、参数错误、404 等必须是可解释状态。
- 响应是 JSON 时必须能解析。
- 文件、流、SSE 接口必须按接口类型单独标记。

## 不在首批范围

首批不实现：

- 全量 517 个 operation 的正向覆盖。
- 真实外部支付网关扣款。
- SSE 长连接完整业务校验。
- 文件上传下载的完整二进制内容校验。
- 和 UI 测试共享 API setup 的深度整合。

这些能力后续可在首批基础设施稳定后逐步扩展。

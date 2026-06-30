# API Endpoint 单接口测试框架迁移设计

## 背景

当前 API 测试已经具备可用的 Playwright API 登录、领域 client、资源登记清理、覆盖矩阵和业务链路用例。现有 `tests/api/business/` 以真实业务链路为主，一个用例内会串联多个接口，适合验证端到端业务可用性，但不利于针对单个 endpoint 增加异常场景、边界场景和失败定位。

第一版 endpoint 迁移的目标不是简单拆文件，而是建立一套可复制的单接口测试框架。后续新增接口时，测试人员应能按固定模板接入，不需要重新理解业务链路文件内部的辅助函数。

## 目标

- 新增 `tests/api/endpoints/`，承载按 endpoint 组织的真实接口用例。
- 只迁移已真实跑通的正向接口，即 `positive-business` 和 `positive-crud` 覆盖等级。
- 保留 `tests/api/business/` 作为业务链路回归，不用 endpoint 层替代业务链路层。
- 建立可复用的 endpoint 支撑层，统一断言、前置数据、资源清理、失败信息和新增接口模板。
- 覆盖矩阵能区分业务链路覆盖和 endpoint 单接口覆盖，便于后续统计和补缺口。

## 非目标

- 第一版不迁移 `contract-only`、`deferred-external`、`blocked-missing-data` 为真实 endpoint 用例。
- 第一版不执行日结、真实退款、外部支付撤销、外部通知等破坏性或外部依赖强的接口。
- 第一版不移除现有 `business/` 用例，也不把业务链路拆散成唯一测试入口。
- 第一版不做数据驱动万能 runner。接口入参、前置、断言差异较大，强行配置化会降低可维护性。

## 目录结构

```text
tests/api/
  endpoints/
    admin-config/
      tax.endpoint.api.spec.ts
      discount.endpoint.api.spec.ts
      role.endpoint.api.spec.ts
    menu/
      menu.endpoint.api.spec.ts
      menu-group.endpoint.api.spec.ts
      category.endpoint.api.spec.ts
      global-option.endpoint.api.spec.ts
    sale-item/
      sale-item.endpoint.api.spec.ts
      spu.endpoint.api.spec.ts
    order/
      order.endpoint.api.spec.ts
      payment.endpoint.api.spec.ts
  support/
    endpoint-assertions.ts
    endpoint-case.ts
    endpoint-resources.ts
    endpoint-read-model.ts
    README.md
```

`endpoints/` 只放可执行单接口 spec。`support/` 只放 endpoint 测试框架能力，不放真实业务断言矩阵。已有 `api/clients/`、`api/core/`、`fixtures/api.fixture.ts` 继续作为底层通用能力。

## Endpoint Case 模型

每个 endpoint 用例采用固定的 Arrange / Act / Assert / Cleanup 结构。测试标题必须包含中文说明和原始 HTTP method/path，方便 Allure、VS Code 测试树和命令行报告定位。

推荐结构：

```ts
test.describe('税费管理 /api/tax/save', () => {
  test('POST /api/tax/save 应能保存税费', async ({ adminConfigApi, endpointResources }) => {
    await test.step('准备税费保存请求', async () => {
      // arrange
    });

    await test.step('调用 POST /api/tax/save', async () => {
      // act
    });

    await test.step('校验税费保存响应和回读结果', async () => {
      // assert
    });
  });
});
```

`endpoint-case.ts` 定义类型边界，不强制所有用例进入同一个 runner。推荐提供轻量类型和命名工具：

- `EndpointMethod`
- `EndpointIdentity`
- `EndpointCaseMetadata`
- `toEndpointTitle(method, path, action)`

这样既能保持接口用例可读，也能让后续矩阵统计复用统一的 endpoint 身份。

## 断言设计

`endpoint-assertions.ts` 提供单接口通用断言：

- `expectApiOk(response, identity)`：校验 HTTP 状态、JSON 解析、响应信封和业务成功状态。
- `expectApiBusinessError(response, identity, options)`：用于后续异常场景，校验 HTTP 成功但业务 code/message 为失败。
- `expectHttpStatus(response, identity, expectedStatus)`：用于鉴权、非法方法或明确 HTTP 错误类接口。
- `expectArrayData(body, identity)`：校验列表类响应的 `data` 可按数组或分页容器读取。
- `expectResourceId(value, identity)`：统一提取并校验创建类接口返回 ID。

失败信息必须包含：

- HTTP method
- path
- status
- request 摘要
- response 摘要

这一点沿用 `api/core/api-response.ts` 的摘要能力，避免接口失败时只看到 Playwright 断言失败。

## 资源和前置数据设计

`endpoint-resources.ts` 是第一版可拓展性的核心。它提供按领域封装的最小前置资源，并自动登记清理：

- `createMenuResource()`
- `createMenuGroupResource(menuId)`
- `createCategoryResource(menuId, menuGroupId)`
- `createGlobalOptionCategoryResource(menuId)`
- `createGlobalOptionResource(menuId, optionCategoryId)`
- `createSaleItemResource(menuId, menuGroupId, categoryId)`
- `createOrderResource(options)`
- `createPaymentRecordResource(orderId)`
- `createTaxResource()`
- `createDiscountResource()`
- `createRoleResource()`

资源 helper 的规则：

- helper 只表达“创建一个可用于 endpoint 测试的最小资源”，不隐藏被测 endpoint 的核心行为。
- helper 必须通过 `ResourceRegistry` 登记清理动作。
- helper 返回结构化结果，例如 `{ id, request, body }`，便于 endpoint 用例继续断言。
- helper 不使用固定抓包 ID；所有可写数据优先运行时创建。
- 测试名称继续使用短名称策略，避免后端字段长度限制。

## 数据工厂设计

请求体工厂继续放在 `test-data/api/`。第一版新增或整理时遵循：

- 稳定业务样本放在 `test-data/api/`，不放在 spec 文件里。
- 动态字段通过小工厂生成，不在 spec 内直接写 `Date.now()`。
- 工厂支持 override，例如 `buildTaxRequest({ name, rate })` 或 `buildTaxRequest(name, overrides)`。
- 请求体字段以真实已调通 payload 为准，不为了 Swagger 类型臆造字段。

## 覆盖矩阵调整

`api/contracts/first-batch-api-cases.ts` 保留当前 `specFile` 能力，并新增 endpoint 覆盖维度。推荐模型：

- `businessSpecFile`：现有业务链路覆盖文件。
- `endpointSpecFile`：单接口覆盖文件，可为空。
- `coverage`：继续表示当前真实可执行等级。
- `endpointStatus`：`covered`、`planned`、`blocked`。

第一版只把已迁移 endpoint 的 `endpointSpecFile` 填上。未迁移但属于 `positive-business` 或 `positive-crud` 的接口标记为 `planned`。

文档 `docs/api/112接口覆盖映射.md` 同步更新为两列：

- 当前业务链路 spec
- 当前 endpoint spec

这样可以避免“业务链路覆盖”和“单接口覆盖”混在一起。

## 第一版迁移范围

第一版迁移代表性 endpoint，先验证框架质量，再批量铺开：

- 后台配置：
  - `GET /api/tax/list`
  - `POST /api/tax/save`
  - `POST /api/tax/delete`
  - `GET /api/discount/list`
  - `POST /api/discount/save`
  - `POST /api/discount/delete`
  - `GET /api/admin/role/list`
  - `POST /api/admin/role/save`
  - `POST /api/admin/role/delete`
- 菜单目录：
  - `GET /api/menu/menus`
  - `POST /api/menu/menu`
  - `PUT /api/menu/menu`
  - `GET /api/menu/menu/{id}`
  - `POST /api/menu/menuGroup`
  - `PUT /api/menu/menuGroup`
  - `GET /api/menu/menuGroup/{id}`
  - `DELETE /api/menu/menuGroup/{id}`
  - `POST /api/menu/menuCategory`
  - `PUT /api/menu/menuCategory`
  - `GET /api/menu/menuCategory/{id}`
  - `DELETE /api/menu/menuCategory/{id}`
- 商品和 SPU：
  - `POST /api/menu/menuSaleItem`
  - `PUT /api/menu/menuSaleItem`
  - `GET /api/menu/menuSaleItem/{id}`
  - `DELETE /api/menu/menuSaleItem/{id}`
  - `POST /api/spu/menuSaleItem/assign`
  - `POST /api/spu/menuSaleItem/link`
  - `GET /api/spu/menuSaleItem/list/{code}`
  - `POST /api/spu/stockOperation`
- 订单和支付：
  - `POST /api/order/save`
  - `GET /api/order/fetch`
  - `GET /api/order/list`
  - `POST /api/order/void`
  - `POST /api/payment/record/save`
  - `POST /api/payment/record/delete`

这些 endpoint 覆盖了无前置查询、单资源 CRUD、跨领域前置、复杂订单数据和支付记录清理，足以检验框架扩展性。

## 后续接入模板

新增 endpoint 时按以下步骤：

1. 确认接口是否属于 `positive-business` 或 `positive-crud`，否则先留在契约或 blocked。
2. 在对应领域 endpoint spec 中新增 `describe`，标题包含业务组和 path。
3. 使用 `endpointResources` 创建最小前置数据。
4. 通过领域 client 调用被测接口。
5. 使用 `endpoint-assertions.ts` 断言响应。
6. 如需清理，优先由 `endpointResources` 或 `ResourceRegistry` 登记。
7. 更新 `first-batch-api-cases.ts` 的 endpoint 映射。
8. 更新 `docs/api/112接口覆盖映射.md`。
9. 跑 `npx tsc --noEmit` 和 endpoint 目录测试。

## 命名和报告规则

- `describe` 和 `test` 标题必须使用中文。
- endpoint path 保留原始 Swagger path。
- `test.step(...)` 必须使用中文，且调用接口的 step 明确包含 method/path。
- 文件命名使用领域名加 `.endpoint.api.spec.ts`。
- helper 命名表达能力边界，例如 `createMenuResource`，不使用含糊的 `prepareData`。

## 验收标准

- `npx tsc --noEmit` 通过。
- `npx playwright test tests/api/endpoints --project=api --reporter=line` 通过。
- `npx playwright test tests/api/business --project=api --reporter=line` 通过。
- 新增 `tests/api/support/README.md`，说明新增 endpoint 的标准模板。
- 覆盖矩阵能显示已迁移 endpoint 和计划迁移 endpoint。
- 任意一个新接口接入时，不需要复制业务链路 spec 里的私有 helper。

## 风险和处理

- 风险：前置资源 helper 过度封装，导致 endpoint 用例看不出测了什么。
  - 处理：helper 只创建依赖资源，被测接口的 act 和 assert 必须留在 spec。
- 风险：endpoint 层和 business 层重复调用，增加环境数据压力。
  - 处理：endpoint 优先使用最小数据和清理登记，业务链路保留少量关键回归。
- 风险：订单和支付 endpoint 前置复杂。
  - 处理：第一版只迁移最小可稳定闭环，复杂拆单、重开、外部支付类后续补。
- 风险：覆盖矩阵字段调整影响现有单元测试。
  - 处理：先新增字段并保持旧字段兼容，再逐步更新断言。


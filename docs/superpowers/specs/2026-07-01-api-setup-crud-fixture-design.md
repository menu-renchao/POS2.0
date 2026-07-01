# UI 测试 API 数据预置 CRUD 设计

## 背景

当前接口测试已经沉淀了 `fixtures/api.fixture.ts`、API client、`ResourceRegistry`、`tests/api/support/endpoint-resources.ts` 和 `test-data/api/*`。这些能力能创建税费、折扣、菜单、菜单组、分类、商品、选项等测试数据，但主要服务 endpoint 测试，并且多数方法只暴露固定默认创建逻辑。

UI 自动化后续需要通过接口预置后台配置数据，例如税费、加收、折扣、菜单、分类、商品和选项。预置能力不能只支持创建，还要支持参数化增删改查，便于 UI 用例覆盖“创建后页面可见”、“编辑后生效”、“删除后不可见”、“组合菜单用于点餐”等场景。

## 目标

第一版提供一个 UI spec 可直接使用的 `apiSetup` fixture。它面向 UI 测试暴露参数化 CRUD 和业务套餐方法，同时复用现有 API client、响应断言、资源 ID 解析和清理登记能力。

目标范围：

- 支持配置税费、加收、折扣、菜单、菜单组、分类、商品、选项的参数化 CRUD。
- 支持组合式菜单套餐预置，能一次创建 UI 点餐测试需要的菜单结构。
- 所有创建出的测试资源都进入 `ResourceRegistry`，测试结束自动清理。
- `delete()` 的语义遵循系统接口语义；系统支持软删除，因此不设计物理删除或 `{ force: true }`。
- endpoint 测试和 UI 测试逐步复用同一套 setup 服务，避免两套数据预置逻辑。

## 非目标

- 不在第一版封装订单、支付、桌台状态变更等强业务状态接口。
- 不把每个 UI case 的业务断言封装成专用方法，例如 `prepareDiscountCase()`；第一版只提供通用 CRUD 和菜单套餐。
- 不绕过系统 API 直接写数据库。
- 不实现物理删除能力。

## 架构

新增一个面向测试数据预置的服务层：

```text
fixtures/api-setup.fixture.ts
  -> tests/api/support/api-setup.ts
    -> api/clients/*.client.ts
    -> test-data/api/*.ts
    -> api/core/resource-registry.ts
```

职责边界：

- `test-data/api/*`：定义请求参数类型、默认值 builder、参数覆盖和命名规则。
- `api/clients/*`：只封装 HTTP 方法和 Swagger path，不承担业务预置策略。
- `tests/api/support/api-setup.ts`：封装参数化 CRUD、资源 ID 解析、清理登记、组合套餐。
- `fixtures/api-setup.fixture.ts`：把 `apiSetup` 挂给 UI spec 使用，并负责创建 API request context 与 `ResourceRegistry` 生命周期。
- UI spec：只表达业务意图，调用 `apiSetup` 准备数据，不拼接底层请求体。

## API 形态

UI 用例中的使用方式：

```ts
test('应能在点餐页使用预置菜单数据', async ({ apiSetup }) => {
  const preset = await apiSetup.menuPreset.create({
    tax: { rate: 8.875 },
    charge: { name: 'AT_SERVICE_CHARGE', rate: 2, taxed: false },
    discount: { rate: 10, rateType: 'percentage' },
    items: [
      { name: 'AT_BURGER', price: 12.5 },
      { name: 'AT_TEA', price: 3 },
    ],
  });

  // UI 测试使用 preset.menuName / preset.items[0].name 等业务字段继续操作。
});
```

单资源 CRUD 形态：

```ts
const discount = await apiSetup.discount.create({
  name: 'AT_DISC_10',
  rate: 10,
  rateType: 'percentage',
});

await apiSetup.discount.update(discount.id, {
  rate: 15,
  description: 'UI update case',
});

const updatedDiscount = await apiSetup.discount.read(discount.id);
const discounts = await apiSetup.discount.list({ keyword: discount.name });
await apiSetup.discount.delete(discount.id);
```

需要暴露的资源模块：

- `apiSetup.tax.create/read/list/update/delete`
- `apiSetup.charge.create/read/list/update/delete`
- `apiSetup.discount.create/read/list/update/delete`
- `apiSetup.menu.create/read/list/update/delete`
- `apiSetup.menuGroup.create/read/list/update/delete`
- `apiSetup.category.create/read/list/update/delete`
- `apiSetup.saleItem.create/read/list/update/delete`
- `apiSetup.option.create/read/list/update/delete`
- `apiSetup.menuPreset.create/update/delete`

## 删除语义

系统接口层只支持软删除，因此 `delete()` 方法统一表示“调用业务删除接口并让资源在业务上不可用”。不设计 `{ force: true }`，也不提供物理删除。

清理规则：

- `create()` 成功后登记资源清理。
- 显式 `delete()` 成功后调用 `resourceRegistry.markCleaned(type, id)`，避免 afterEach 重复清理。
- 自动清理失败时保留现有 `ResourceRegistry` 行为：收集错误并输出汇总，不静默吞掉。
- 如果某个资源没有删除接口，才单独提供 `archive()` 或 `disable()`，并且方法名不能叫 `delete()`。

## 参数化策略

每个 builder 使用“稳定默认值 + 覆盖参数”的方式：

```ts
buildDiscountRequest({
  name,
  rate,
  rateType,
  description,
});
```

约束：

- 默认名称仍使用 `createShortTestName()`，避免超过后端字段长度。
- 调用方传入 `name` 时直接使用调用方值，但类型注释提醒字段长度限制。
- 有限枚举字段使用类型限制，例如 `rateType: 'percentage' | 'amount'`。
- 返回值统一包含 `id`、`name`、`request`、`body`，组合套餐额外返回结构化业务上下文。

## 加收接口缺口

当前仓库已有税费、折扣、菜单相关 client；加收 charge 管理接口尚未在现有 client 中看到明确封装。实现第一步需要从 Swagger 或已抓包请求确认加收管理接口的 path、请求体和删除语义，然后补 `ChargeApiClient` 或并入合适的 admin config client。

如果加收接口暂时缺少成功抓包，第一版可以先提交 tax、discount、menu、menuGroup、category、saleItem、option 和 menuPreset，`charge` 模块保留类型接口但不暴露可调用实现，直到接口契约确认后再开启。

## 数据流

1. UI spec 调用 `apiSetup.menuPreset.create(options)`。
2. `apiSetup` 调用各资源 CRUD 服务创建税费、折扣、加收、菜单、菜单组、分类、商品、选项。
3. 每个创建响应先从响应体解析 ID；若响应不返回 ID，则按名称查询列表定位 ID。
4. 创建成功后登记 `ResourceRegistry` 清理回调。
5. UI spec 使用返回的业务名称和 ID 执行页面操作。
6. 测试结束后 fixture 自动清理未显式删除的资源。

## 错误处理

- API 响应必须通过现有 envelope 断言，业务失败时抛出包含 method/path/status/响应摘要的错误。
- 创建成功但无法解析 ID 时抛出明确错误，提示创建接口和列表定位均失败。
- 更新、删除后按接口返回 `code=0` 判断成功。
- 显式删除成功后立即标记资源已清理。
- 清理阶段的错误按现有 registry 汇总输出，避免一个清理失败掩盖测试主体结果。

## 测试策略

第一版用 TDD 推进：

- 单元测试覆盖 request builder 的默认值、参数覆盖、字段长度控制和枚举映射。
- 单元测试覆盖 `apiSetup` 服务调用正确 client、解析 ID、登记清理、显式删除后标记清理。
- endpoint 或 API 级真实环境测试覆盖 tax、discount、menu、menuGroup、category、saleItem、option 的 create/read/list/update/delete 正向路径。
- UI 侧增加一个最小示例 spec 或 fixture contract test，证明 `apiSetup` 能在 UI fixture 中直接使用。
- 加收模块在接口契约确认后补同等 CRUD 测试。

## 迁移顺序

1. 抽出通用 `ApiSetupResource` 类型和 CRUD 服务基类或小型工厂。
2. 参数化现有 tax、discount、menu、menuGroup、category、saleItem、option builder。
3. 把 `endpointResources` 迁移为调用新 `apiSetup` 服务，保持现有 endpoint spec 行为不变。
4. 新增 `fixtures/api-setup.fixture.ts`，让 UI spec 可直接注入 `apiSetup`。
5. 新增 `menuPreset` 组合方法。
6. 补加收 client 和 CRUD 服务。

## 验收标准

- UI spec 可以通过 fixture 直接调用 `apiSetup`。
- 税费、折扣、菜单、菜单组、分类、商品、选项支持参数化 CRUD。
- `menuPreset.create()` 能创建至少一个可用于 UI 点餐的完整菜单套餐。
- 所有创建出的资源都能自动清理，显式删除不会二次清理。
- 不存在物理删除或 `{ force: true }` 设计。
- 现有 API endpoint 用例能继续通过。

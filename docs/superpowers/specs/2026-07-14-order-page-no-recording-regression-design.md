# 点单页面无需录制用例设计

## 目标

在 `tests/py-migrate/order-page-regression.spec.ts` 新建一个独立的 Playwright Test 回归文件，实现覆盖矩阵中 4 条 `待补断言` 和 8 条 `可直接实现` 场景。新文件只使用仓库已经确认的真实 Page、Flow、fixture 与 API 契约，不混入 50 条仍需录制的场景。

## 范围

| 分组 | 矩阵编号 | Jira | 状态 | 处理方式 |
|---|---:|---|---|---|
| 菜单切换 | 1 | POS-15602 | 待补断言 | 迁移同 Jira 旧用例，增加当前菜单组断言 |
| 备注 | 8 | POS-42888 | 待补断言 | 新增目标用例，保留不同 Jira 的 POS-24394 |
| 分单与小费 | 9 | POS-39762 | 可直接实现 | 新增加小费、平分、合并后的金额断言 |
| 分单与小费 | 20 | POS-16303 | 可直接实现 | 迁移同 Jira 旧用例，改为保存后从 Recall 平分订单 |
| 分单与小费 | 21 | POS-16314 | 可直接实现 | 迁移同 Jira 旧用例，改为按菜接收到新子单，不伪装为拖拽 |
| 分单与小费 | 22 | POS-16315 | 可直接实现 | 新增按座位分单用例 |
| 分单与小费 | 23 | POS-16316 | 可直接实现 | 迁移同 Jira 旧用例，改为保存后按固定金额 2 与 8.6 分单 |
| 分单与小费 | 24 | POS-16318 | 待补断言 | 迁移同 Jira 旧用例，补持久化撤销后的总额断言 |
| 分单与小费 | 25 | POS-16325 | 可直接实现 | 迁移同 Jira 旧用例，改为堂食保存后按菜平分 |
| 数量与合单 | 37 | POS-32905 | 待补断言 | 迁移同 Jira 旧用例，补 Count 原文断言 |
| 数量与合单 | 49 | POS-33244 | 可直接实现 | 新增小数数量订单与普通订单合单用例 |
| 数量与合单 | 51 | POS-33600 | 可直接实现 | 新增改价 6.50、数量 1.5 与整数分金额断言 |

### 2026-07-14 重新分类

POS-42886 与 POS-28674 不进入本设计，改由 `ORDER-PAGE-049`、`ORDER-PAGE-050` 录制。真实 UI 验证证明 `pos-ui-option-__custom_discount__` 打开的是正向 `Custom Charge`：普通菜 8.80 输入 10% 后得到 9.68 并显示 `Charge(10%) $0.88`；改价 5.85 后输入 50% 得到 8.78。该入口不能代表 Discount，且当前缺少真实折扣入口、弹窗和结果的稳定 DOM 契约。

## 文件边界

### 新建测试文件

`tests/py-migrate/order-page-regression.spec.ts` 是 12 条场景的唯一入口，包含四个中文 `describe`：

1. `菜单切换回归`
2. `备注回归`
3. `分单与小费回归`
4. `数量与合单回归`

所有测试标题、`test.step` 和测试级报告步骤使用中文；Jira Key 保留在标题和 Playwright 原生 `annotation` 中。标签使用现有业务标签，例如 `@点单`、`@分单`、`@小费`、`@现金支付`。

### 修改已有测试文件

- `tests/py-migrate/order.service.spec.ts`
  - 删除迁入新文件并按目标路径重写的 POS-15602、POS-16303、POS-16314、POS-16316、POS-16318、POS-16325、POS-32905 测试体。
  - 保留 POS-15641 及其他不在本批次范围内的场景。
- `tests/py-migrate/split-order-operation.spec.ts`
  - 保留 POS-23204 与 POS-24394；它们分别覆盖清空加收和复制订单，不是本批次 Jira 的等价重复。

### Page 对象增量

- `pages/order-dishes/order-dishes-locators.ts`
  - 根据 POS-15602 成功 trace 中的真实 DOM，集中定义当前菜单组标签 `#grplist .grplistbtAct .grplistbtText` 和 Count 原值 `#ododttcnt`。
  - 两个 locator 都只使用本页当前实际暴露的单一 legacy DOM 契约，不增加 frame/host、属性别名或多语言候选链。
- `pages/order-dishes/order-dishes-menu.section.ts`
  - 增加 `readSelectedMenuGroupName(): Promise<string>`，返回当前选中菜单组名称。
  - 只使用页面实际暴露的稳定选中态契约；不得新增 `.or()`、候选属性列表、语言正则或父页面 fallback。
  - 方法使用中文 `@step(...)`。
- `pages/order-dishes/order-dishes-reads.section.ts`
  - 增加 `readCountText(): Promise<string>`，返回点单页 Count 的原始文本，不转换为 number。
  - 复用现有集中式价格汇总 locator，不新增散落选择器。
  - 方法使用中文 `@step(...)`。
- `pages/order-dishes.page.ts`
  - 作为薄 facade 暴露上述两个 API，不承载解析或业务逻辑。

Recall 侧不新增数量 API，直接复用 `RecallOrderItem.quantity` / `orderDetails.items[].quantity` 的 `string | null`。

### 测试数据

复用并扩展 `test-data/order-service.ts`。固定菜品、菜单、备注、数量、分单金额和数量类期望整数分金额放在测试数据层；本设计不包含 POS-42886、POS-28674 的折扣比例或期望金额，spec 只保留场景编排和断言。动态订单标识由现有保存响应或 Recall 读取能力产生，不在测试体内使用 `Date.now()`。

## 页面与业务编排

- 所有场景从 POS 首页进入，通过 `HomeFlow` 建立员工上下文。
- To Go、堂食、选桌、Recall、Payment 和 Split 均使用现有 Flow；不打开内部 URL 或 hash。
- Page 只负责点击、填写和窄读取；选择策略、保存后精确回开、分单金额守恒、合单前后对照由 Flow 或测试编排负责。
- 每个场景保存并复用精确订单号，不能用“第一条订单”代替目标订单，除非现有 API 返回的就是本场景刚保存的唯一目标。
- 涉及输入后立即确认的 Page 动作必须遵守至少 200ms 的输入稳定等待；不得使用 `waitForTimeout`。

## 断言设计

- POS-15602：切换后当前菜单组为目标组，并保留原有菜名、价格和 Recall 回查。
- POS-42888：Modify 输入备注后保存，Recall 目标菜 additions 精确包含该备注。
- POS-39762：按源步骤加 2.00 小费后平分并合并，断言指定子单 Tips 为 1.00、合并后 Tips 为 2.00。
- POS-16303、POS-16314、POS-16315、POS-16316、POS-16318、POS-16325：统一断言子单数量、菜品或座位归属、子单金额、支付状态以及金额守恒；每条只覆盖标题要求的分单模式。
- POS-32905：点单页 Count 原文必须为 `4` 且不含小数点；Recall 数量直接断言 `3`、`1`。
- POS-33244：合单后小数菜仍为 2.55，另一菜数量和价格不变，Subtotal 等于合单前两单之和。
- POS-33600：改价显示 6.50、数量显示 1.5、目标行金额为 975 分；保存前与 Recall 的整数分结果一致。

价格断言优先使用 Page 层已经返回的 number。需要避免浮点误差时，测试将金额统一换算为整数分再比较，不在 spec 中重复解析货币字符串。

## 失败处理与清理

- 找不到稳定选中态或页面实际 DOM 与审计矩阵不一致时，停止该场景实现并把它重新标记为录制需求；不得堆叠 fallback locator 让测试通过。
- 配置和临时数据必须通过 API fixture / `ResourceRegistry` 清理。
- 测试失败时保留 Playwright trace、截图和原始断言上下文；不使用条件跳过或 `test.fail(...)` 掩盖失败。
- 各测试独立创建订单，不依赖前一测试留下的页面或业务数据。

## TDD 与验证

Page API 的实现遵循 Red-Green-Refactor：先在新 spec 中使用期望 API，运行 TypeScript/目标测试确认因 API 缺失失败，再添加最小 Page 实现并重新运行。其余场景只新增测试，不修改产品行为；测试本身是交付物，因此直接用真实 UI 运行验证既有业务契约。

验证顺序：

1. `npx.cmd playwright test tests/py-migrate/order-page-regression.spec.ts --list`
2. 按四个 `describe` 分组定向运行新 spec，保存每组通过/失败证据。
3. `npx.cmd tsc --noEmit`
4. `npm.cmd run test:scripts`
5. 运行受迁移影响的现有 py-migrate 用例发现检查，确认无重复 Jira 测试。
6. `git diff --check`

若 POS 测试环境不可达，结构、类型和用例发现验证仍需通过；UI 运行失败必须按真实环境阻塞报告，不能宣称用例通过。

## 非目标

- 不实现 50 条 `需要录制` 场景。
- 不重构无关 Page/Flow。
- 不为现有 locator 增加多语言或候选 selector 链。
- 不改变产品配置、测试运行器或 Playwright 项目结构。

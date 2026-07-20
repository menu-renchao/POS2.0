# Playwright 待补充录制清单

本文档记录当前自动化中缺少真实页面 DOM 契约、需要人工录制补充的场景。

订单操作回归当前共有 **6 条 skipped**：其中 **5 条需要录制**，归并为 **1 组录制请求**（报表 Fee/Unpaid 5 条）；POS-32954 因“POS NG 不适用”保留 skip 但不需要录制。点单页面提示词当前剩余 **43 条**一对一录制请求。

## 提交格式

1. 每个场景单独录制为一个 `test('test', async ({ page }) => { ... })`。
2. 请把脚本放在三反引号 `ts` 代码块中，避免 `_`、`*` 等字符被 Markdown 转义。
3. 保留录制生成的原始 `data-testid`，动态订单 ID 可以保留，自动化落地时会替换为运行期订单号。
4. 不需要补录登录、License 选择等已有公共流程，除非问题就发生在这些步骤。
5. 若页面显示的业务结果与预期不同，请同时附一张最终页面截图并注明实际结果。

## 待补充

### 1. POS-31081 / POS-30566 / POS-32004 / POS-32016 / POS-32023：报表首页 Fee 与 Unpaid

当前卡点：`readReportFeeAmount()` 和 `readReportHomeUnpaidAmount()` 仍是空实现，不知道从 POS Home 如何进入报表以及两个金额的真实 test id。`POS-32004`、`POS-32016`、`POS-32023` 还需要用 Fee 校验计小费加收在合单前后的变化。

已确认入口行为：点击 POS Home 的 Report 后会再次弹出员工口令，输入 `11` 后主页面进入 `#thirdApp`，报表加载在 `https://cloud.menusifucloudqa.com/report/...` iframe。自动读取该外部云报表可能涉及业务数据外传风险，不能继续通过诊断脚本抓取 DOM，因此仍需您在现有环境手工录制。

请录制以下完整过程：

1. 从 POS Home 点击 Report，输入员工口令 `11` 并确认。
2. 保留录制器生成的外部报表 iframe `contentFrame()` 路径。
3. 定位并读取 `Fee` 金额。
4. 定位并读取 `Unpaid` 金额。
5. 返回 POS Home。
6. 若报表需要日期、员工、班次或门店筛选，请完整录制筛选操作。
7. 若页面需要手动刷新才能看到最新订单，请录制刷新按钮及刷新完成后的稳定信号。

最终脚本中请保留两个金额元素的断言，例如：

```ts
await expect(page.getByTestId('fee-amount')).toBeVisible();
await expect(page.getByTestId('unpaid-amount')).toBeVisible();
```

示例 test id 仅用于说明，必须以录制得到的真实值为准。

## 点单页面提示词待补充

以下 43 条需求与点单页面提示词覆盖矩阵严格一一对应。已完成或已转为非录制状态的条目均已移除；其余录制编号保持原顺序和映射，不重编号。

录制提交格式统一沿用本文档顶部“提交格式”，不在各条目中重复。

### ORDER-PAGE-001：提示词 2 POS-15605 点单页面菜单--组 中文展示

- Jira：`POS-15605`。
- 已知前置：可切换系统语言的员工上下文、配置了中英文名称的目标菜单组和 To Go 入口；录制前保存默认语言，结束后返回 POS 首页并恢复默认语言。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页建立员工上下文，切换系统语言为中文，进入 To Go 点单页读取菜单组列表，断言配置的中文组名后返回首页并恢复默认语言；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言中文组名可见且恢复后默认语言生效。
- 请保留证据：语言按钮、语言弹层选项/选中态、菜单组按钮的稳定 DOM，以及语言切换请求或本地持久化值和菜单响应中的组 ID/中英文名；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：缺少语言弹层选项/选中态、中文菜单组按钮和语言持久化或切换请求的真实契约，现有用例无法证明中文组名展示及默认语言恢复。
- 录制返回后计划补充：`pages/home.page.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/language.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/home.page.ts` 负责语言切换/读取，`pages/order-dishes/order-dishes-menu.section.ts` 负责组列表读取，`flows/language.flow.ts` 负责首页进入与 finally 恢复。

### ORDER-PAGE-007：提示词 11 连续创建两个不输入姓名的pick up订单，修改其中一个食客姓名，另一个不受影响

- Jira：`POS-42943`。
- 已知前置：两笔不填写姓名的 Pick Up 订单、普通菜、两笔独立订单号/customerId、用于第一笔订单的唯一食客姓名及客户信息编辑权限。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页连续创建两笔不填姓名的 Pick Up 并分别保存订单号，Recall 按单号打开第一笔进入客户/食客编辑，填写唯一姓名并保存，再分别回开两笔订单；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言第一笔为新姓名、第二笔仍为空且订单号互不混淆。
- 请保留证据：两次创建响应的订单号/customerId、Recall 卡片与客户信息 DOM、编辑姓名入口/输入/保存 DOM 及更新请求中订单/customer 关联；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：缺少两笔匿名 Pick Up 的独立订单号/customerId、单笔食客姓名编辑入口和两单客户信息隔离回查契约。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-customer.dialog.ts`、`pages/recall/recall-order-details.dialog.ts`、`flows/order-customer.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-customer.dialog.ts` 负责姓名编辑，`pages/recall/recall-order-details.dialog.ts` 负责按单读取客户信息，`flows/order-customer.flow.ts` 负责双单创建、精确定位和隔离校验。

### ORDER-PAGE-008：提示词 13 POS-15737 点单界面菜单--类，类的中文展示

- Jira：`POS-15737`。
- 已知前置：可切换中文的员工上下文、具有中文名称的目标类别及其“蒙古鸡”菜品、To Go 入口和 Recall 回查条件；保存默认语言并在结束后恢复。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页建立员工上下文，切换中文，进入 To Go，读取类别列表并选择目标中文类别，添加“蒙古鸡”、保存后在 Recall 回查，最后返回首页恢复默认语言；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言目标类别中文名、菜品中文名及 Recall 名称/价格。
- 请保留证据：语言弹层/选中态、类别按钮/当前类别 DOM，语言持久化或切换请求、菜单响应中的类别中英文名与菜品归属、订单保存响应；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：缺少中文语言状态、类别按钮/当前类别选中态，以及菜单响应中类别中英文名与“蒙古鸡”归属的真实契约。
- 录制返回后计划补充：`pages/home.page.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/language.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/home.page.ts` 负责语言切换，`pages/order-dishes/order-dishes-menu.section.ts` 负责类别列表/选中态，`flows/language.flow.ts` 负责编排与 finally 恢复。

### ORDER-PAGE-009：提示词 15 POS-15759 点单界面菜单--option 创建类的option,包含二级option，点单时选择了类的option，未选二级option

- Jira：`POS-15759`。
- 已知前置：To Go 订单、绑定类级一级/二级 option 且二级允许跳过的真实类别和菜品、一级 option 价格数据，以及可按订单号 Recall 回查的数据。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 To Go，切到带类级 nested option 的真实类别/菜品，选择一级 option 后明确跳过二级 option，完成面板离开/保存并在 Recall 回查；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言点单页与 Recall 仅包含一级 option 且金额符合配置。
- 请保留证据：一级选择后出现的二级区域、跳过/关闭/确认控件与选中态 DOM，菜单响应的父子 option 关系、保存请求中仅一级 option 的 payload、Recall additions DOM；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：现有可选参数不能证明用户真实跳过类级二级 option，缺少二级区域、跳过/关闭动作及保存请求仅含一级 option 的契约。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责显式跳过二级 option 的页面动作，`flows/order-dishes.flow.ts` 负责类级 option 完整保存回查。

### ORDER-PAGE-010：提示词 16 POS-15760 点单界面菜单--option 创建菜的option,包含二级option，点单时选择了菜的option，未选二级option

- Jira：`POS-15760`。
- 已知前置：To Go 订单、绑定菜级一级/二级 option 且二级允许跳过的真实菜品、一级 option 价格数据，以及可按订单号 Recall 回查的数据。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 To Go，选择带菜级 nested option 的真实菜品，选择一级菜级 option、跳过二级并保存，Recall 按订单号回查；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言只回显一级菜级 option 且价格正确。
- 请保留证据：菜级 option 面板与二级区域/跳过控件 DOM，菜单响应的菜品-option 父子关系、订单请求中仅一级 option 的 payload、两页 additions DOM；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：缺少菜级 nested option 选择一级后显式跳过二级的页面动作，以及保存 payload 仅包含一级 option 的证据。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责菜级 option/跳过动作，`flows/order-dishes.flow.ts` 负责下单保存回查，`test-data/order-service.ts` 固化真实 ID/名称。

### ORDER-PAGE-011：提示词 17 POS-15761 点单界面菜单--option 创建菜的option，点单时选择了菜的option

- Jira：`POS-15761`。
- 已知前置：To Go 订单、绑定单层可选菜级 option 的真实菜品、option 名称与价格配置，以及可按订单号 Recall 回查的数据。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 To Go，定位带单层菜级 option 的真实菜品，选择目标 option、保存并按订单号在 Recall 回查；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言两页 option 名称和价格与配置一致。
- 请保留证据：菜品卡与菜级 option 面板/选中态 DOM，菜单响应中的 item-option 绑定、订单保存请求的 option payload、点单页和 Recall additions DOM；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：缺少单层菜级 option 面板/选中态、item-option 绑定关系和点单页与 Recall 回显价格的一致性契约。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责菜级 option 选择/读取，`flows/order-dishes.flow.ts` 负责保存回查，`test-data/order-service.ts` 固化真实菜品和 option。

### ORDER-PAGE-012：提示词 18 POS-15762 点单界面菜单--option 创建菜的option，点单时未选择菜的option

- Jira：`POS-15762`。
- 已知前置：To Go 订单、绑定非必选菜级 option 且允许不选直接完成点单的真实菜品、option required/min 规则，以及可按订单号 Recall 回查的数据。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 To Go，选择带可选菜级 option 的真实菜品，不选任何 option，使用真实关闭/跳过动作完成点单、保存并按订单号在 Recall 回查；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言订单可保存且点单页/Recall 均无该菜 option。
- 请保留证据：可选规则、面板关闭/跳过控件与无选中态 DOM，菜单响应中的 required/min 规则、订单请求无 option payload、两页无 additions DOM；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：缺少可选菜级 option 的真实关闭/跳过动作、无选中态，以及保存请求不携带 option 且订单仍可保存的契约。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责跳过/关闭与无选中读取，`flows/order-dishes.flow.ts` 负责保存回查，`test-data/order-service.ts` 固化可选规则数据。

### ORDER-PAGE-013：提示词 19 POS-15763 点单界面菜单--option 创建菜的option,包含二级option，点单时选择了菜的option，和二级option

- Jira：`POS-15763`。
- 已知前置：To Go 订单、绑定菜级一级/二级 option 的真实菜品、两级 option 的父子关系与价格数据，以及可按订单号 Recall 回查的数据。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 To Go，选择带菜级 nested option 的真实菜品，依次选择一级和二级 option、保存并按订单号在 Recall 回查；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言点单页与 Recall 按实际顺序回显两级 option 且价格正确。
- 请保留证据：一级/二级面板、父子切换和选中态 DOM，菜单响应的 item-option-suboption 关系、保存请求中的两级 option ID/顺序、两页 additions DOM；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：缺少菜级一级/二级 option 的父子转场、选择顺序、保存 payload 和两页 additions 回显契约。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责两级菜级 option 选择/读取，`flows/order-dishes.flow.ts` 负责保存回查，`test-data/order-service.ts` 固化父子数据。

### ORDER-PAGE-015：提示词 27 test_open_food_keyboard_multi_language

- Jira：无。
- 已知前置：Open Food 键盘语言/布局配置原值及更新/恢复权限、To Go 入口、可区分切换前后布局的字符与 Open Food 名称；结束后恢复配置并刷新 POS。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页记录并切换真实 Open Food 键盘语言/布局配置，刷新 POS，进入 To Go，打开 Open Food，读取初始语言/布局，点击屏幕键盘语言切换控件，确认布局状态已变化；必须点击录制到的屏幕键盘按键输入一个只有切换后布局才能区分的字符，不得用 `fill` 绕过键盘，再确认并读取点单行名称，最后返回首页恢复原配置；当前缺失的准确 UI 动作是“读取/切换 Open Food 屏幕键盘语言布局，并用该布局按键输入区分字符”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 同时断言语言/布局状态已切换、屏幕键盘输入值包含区分字符且订单行名称一致。
- 请保留证据：后台配置项名称、ID、旧值/新值与查询/更新/恢复请求，Open Food 弹框、语言切换控件、切换前后语言/布局标识、区分字符按键、Name 输入框、确认按钮和订单行稳定 DOM，以及菜单/草稿请求中的菜名；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：读取/切换 Open Food 屏幕键盘语言布局，并用该布局按键输入区分字符。
- 录制返回后计划补充：`api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/system-configuration.setup.ts` 负责配置及 finally 恢复，`pages/order-dishes/order-dishes-menu.section.ts` 负责键盘语言/布局读取、真实按键输入和名称读取，`flows/order-dishes.flow.ts` 负责编排。

### ORDER-PAGE-017：提示词 30 POS-31045：选择的套餐子菜包含多个option，点单页面连续删除option正常

- Jira：`POS-31045`。
- 已知前置：堂食无桌订单、套餐 `diy_combo1_adjustable`、同一套餐子菜上的多个可删除 option，以及可区分套餐主菜、子菜和 option 的菜单数据。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入堂食无桌，选择 diy_combo1_adjustable，在同一套餐子菜上选择多个 option 后确认，记录订单行 option 数量，连续点击每个 option 的真实删除控件并观察子菜保留、option 逐个消失，最后退出回首页；当前缺失的准确 UI 动作是“在点单订单行连续删除套餐子菜 option”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言初始 option 列表、每次删除后的数量和最终子菜仍在但 options 为空。
- 请保留证据：菜单响应中的套餐/子菜/option ID 关系，套餐选择面板、订单行层级、每个 option 行及删除控件的稳定 DOM，删除前后订单草稿状态或保存 payload；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：在点单订单行连续删除套餐子菜 option。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-menu.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责套餐选择与订单行 option 删除动作，`pages/order-dishes/order-dishes-reads.section.ts` 负责窄读取，`flows/order-dishes.flow.ts` 负责编排。

### ORDER-PAGE-018：提示词 31 POS-30762：切换pos菜单模式后，搜索检查，默认搜索菜品 Broccoli Garlic Sauce

- Jira：`POS-30762`。
- 已知前置：POS/EMENU 菜单模式原值及更新/恢复权限、堂食无桌订单、POS 模式菜 `Broccoli Garlic Sauce`、EMENU 模式菜 `All you can eat item`；结束后恢复原模式并刷新 POS。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页读取原菜单模式，经真实配置入口切为 POS 并刷新，进入堂食无桌搜索 Broccoli Garlic Sauce、断言并选择结果、清空搜索后退出；再切为 EMENU，重新进入点单页搜索 All you can eat item，断言展示 `All you can eat 菜品`，最后恢复原模式；当前缺失的准确 UI 动作是“切换 POS/EMENU 菜单模式，并在两种模式下使用真实 Search Menu 输入/结果/清空控件”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言两种模式的精确结果文本。
- 请保留证据：菜单模式配置项名称、ID、旧值/POS/EMENU 值与查询/更新/恢复请求，搜索入口、输入框、清空按钮、结果卡稳定 DOM，以及菜单响应中的菜品 ID/模式；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：切换 POS/EMENU 菜单模式，并在两种模式下使用真实 Search Menu 输入/结果/清空控件。
- 录制返回后计划补充：`api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/system-configuration.setup.ts` 负责配置及恢复，`pages/order-dishes/order-dishes-menu.section.ts` 负责单一真实搜索契约，`flows/order-dishes.flow.ts` 负责模式切换后的点单编排。

### ORDER-PAGE-019：提示词 32 POS-31662：点单页面，选择菜品，点击modify，添加任意global option，点击add，新增数量成功，页面右侧继续展示modify页面

- Jira：`POS-31662`。
- 已知前置：堂食无桌订单、普通非套餐菜、可选 global option 和 Modify 权限；录制前确认 option 初始数量，动作结束后返回 POS 首页。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入堂食无桌，加普通菜并打开 Modify，选择一个真实 global option，点击该 option 的 Add，读取数量增加和订单行回显，并在动作后确认右侧 Modify 面板仍可见，最后退出回首页；当前缺失的准确 UI 动作是“global option 的 Add 加量及加量后面板保持”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言数量增加、option 在订单行可见且面板持续可见。
- 请保留证据：菜单响应中的 global option ID/名称，Modify 面板根节点、option 卡、Add 控件、数量与订单 addition 行稳定 DOM，以及动作前后草稿/保存 payload；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：global option 的 Add 加量及加量后面板保持。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-modifier.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-modifier.section.ts` 负责 Add/数量/面板读取，`pages/order-dishes/order-dishes-reads.section.ts` 负责订单 addition 读取，`flows/order-dishes.flow.ts` 负责编排。

### ORDER-PAGE-020：提示词 33 POS-31663：点单页面，选择菜品，点击modify，添加任意global option，点击count，增加数量，新增数量成功，页面右侧继续展 示modify页面，点击count修改数量为0，点单列表不再展示该global option，页面右侧继续展示modify页面

- Jira：`POS-31663`。
- 已知前置：堂食无桌订单、普通非套餐菜、可选 global option、Count 输入权限及目标数量 `5`/`0`；动作结束后返回 POS 首页。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入堂食无桌，加普通菜并打开 Modify，选择 global option，点击 Count 输入 5 并确认数量/订单行/面板，再次点击 Count 输入 0，确认 option 从订单行消失且 Modify 面板仍可见，最后返回首页；当前缺失的准确 UI 动作是“global option Count 设置 5 再设置 0，并保持面板”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言数量 5、归零后 option 不可见和两个阶段面板均可见。
- 请保留证据：global option ID/名称，面板、Count 控件、数字输入弹框/确认按钮、数量标识、订单 addition 行的稳定 DOM，以及动作前后草稿/保存 payload；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：global option Count 设置 5 再设置 0，并保持面板。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-modifier.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-modifier.section.ts` 负责 Count/数量/面板动作与读取，reads section 负责订单行，`flows/order-dishes.flow.ts` 负责编排。

### ORDER-PAGE-021：提示词 34 POS-31664：点单页面，选择菜品，点击modify，添加任意global option，点击count，增加数量为2，页面右侧继续展示modify页 面，点击reduce，页面右侧继续展示modify页面，减少至0，点单列表不再展示该global option，页面右侧继续展示modify页面

- Jira：`POS-31664`。
- 已知前置：堂食无桌订单、普通非套餐菜、可选 global option、Count/Reduce 操作权限及初始目标数量 `2`；动作结束后返回 POS 首页。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入堂食无桌，加普通菜并打开 Modify，选择 global option，用 Count 设为 2，逐次点击 Reduce 读到 1 和 0，每次确认面板仍可见，最终确认订单行不再展示 option 后回首页；当前缺失的准确 UI 动作是“global option Count 设 2 后用 Reduce 逐次减到 0”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言 2→1→0、归零移除和各阶段面板可见。
- 请保留证据：global option ID/名称，面板、Count 弹框、Reduce 控件、数量标识、订单 addition 行稳定 DOM，以及每一步草稿/保存 payload；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：global option Count 设 2 后用 Reduce 逐次减到 0。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-modifier.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-modifier.section.ts` 负责 Count/Reduce/数量/面板，reads section 负责订单行，`flows/order-dishes.flow.ts` 负责编排。

### ORDER-PAGE-022：提示词 35 下单页和订单详情卡片上展示用户信息

- Jira：`POS-31409`。
- 已知前置：堂食无桌订单、唯一客户姓名、普通菜、可保存回查的订单号及客户信息编辑权限；需能读取 Recall 详情卡片并从 Edit 返回点单页。
- 请从 POS 首页开始录制：
  1. `tests/py-migrate/order.service.spec.ts:432` 的 POS-31409 候选创建 Pick Up 并只断言 Recall 详情中的客户姓名，未覆盖提示词要求的堂食、订单详情卡片和编辑后的下单页。最小录制路径：从 POS 首页创建堂食订单，通过真实客户入口录入唯一姓名并加菜保存，按订单号进入 Recall，读取订单详情卡片姓名，点击 Edit 回到点单页再次读取姓名，最后返回首页；当前缺失的准确 UI 动作是“堂食录入客户姓名，以及 Recall 卡片和编辑点单页两处读取姓名”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 同时断言卡片和编辑页姓名等于输入。
- 请保留证据：堂食客户入口/输入框、Recall 卡片、Edit 按钮、点单页姓名区域稳定 DOM，订单创建/更新响应中的 orderNumber、customerId 和姓名；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：堂食录入客户姓名，以及 Recall 卡片和编辑点单页两处读取姓名。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-customer.dialog.ts`、`pages/recall/recall-reads.section.ts`、`flows/order-customer.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-customer.dialog.ts` 负责堂食录入/编辑页读取，`pages/recall/recall-reads.section.ts` 负责卡片姓名读取，`flows/order-customer.flow.ts` 负责编排保存、精确定位和编辑。

### ORDER-PAGE-023：提示词 36 POS-33447：Search Menu设置关闭，进入点单页面，页面不再展示搜索输入框，页面展示无违和 POS-33456：Search Menu设置开启，recall进入订单编辑页面，页面展示搜索输入框，可正常搜索，默认搜索菜品Broccoli Garlic Sauce

- Jira：`POS-33447, POS-33456`。
- 已知前置：Search Menu 开关原值及更新/恢复权限、堂食无桌订单、普通菜、可精确回开的订单号和搜索目标 `Broccoli Garlic Sauce`；需保留源步骤 `print` 的触发条件以确认其真实含义，结束后恢复开关并刷新 POS。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页读取 Search Menu 原值，关闭后刷新并进入堂食无桌，断言搜索入口/输入框不存在后，按源步骤执行或观察 `print`，记录其真实入口、目标、提示和请求，再保存可编辑订单；返回首页开启 Search Menu 并刷新，从 Recall 精确打开该订单 Edit，断言搜索输入框出现，搜索并选择 Broccoli Garlic Sauce，最后恢复原开关；当前缺失的准确 UI 动作是“Search Menu 开关关闭/开启、Recall 编辑页搜索框隐藏/显示和搜索，以及源步骤 `print` 的真实含义与结果”；
  2. 对源步骤 `print` 不预设“打印订单”“打印提示”或“调试输出”等含义；请在 Search Menu 关闭态完整录制实际可执行动作、提示/状态变化和网络请求，并明确无法执行时的页面状态；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 分别断言关闭态不可见、开启态可见且精确结果文本。
- 请保留证据：配置项名称、ID、旧值/关/开值及查询/更新/恢复请求，搜索入口、输入、结果卡、Recall Edit 与 `print` 入口/结果稳定 DOM，订单号、菜单响应及打印相关请求；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：缺少 Search Menu 开关关闭/开启、Recall 编辑页搜索框隐藏/显示和搜索的稳定契约；源步骤 `print` 未说明目标与预期，必须通过录制确认该中间动作或状态，不能静默省略。
- 录制返回后计划补充：`api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/recall.flow.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/system-configuration.setup.ts` 负责开关恢复，`pages/order-dishes/order-dishes-menu.section.ts` 负责搜索可见性/输入/结果，`flows/recall.flow.ts` 负责按单进入编辑，`flows/order-dishes.flow.ts` 负责两种配置状态的点单编排。

### ORDER-PAGE-024：提示词 40 POS-34106 点单页面，礼品卡实体卡新增页面，手机号输入框，手机号输入正确，可新建卡成功

- Jira：`POS-34106`。
- 已知前置：可创建实体卡的礼品卡服务、唯一手机号、普通菜和具备清理权限的后台账号。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页建立员工上下文，进入堂食无桌、添加普通菜并进入结账页，打开实体礼品卡新增页，填写唯一手机号和姓名 `test` 后提交，读取卡号/姓名/手机号，再回首页进入后台按卡号删除测试卡；前置数据：可创建实体卡的礼品卡服务、唯一手机号、普通菜和具备清理权限的后台账号。当前缺失的准确 UI 动作是“从结账页打开实体礼品卡新增页，填写手机号并提交”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言新卡创建成功且三项读取值与输入/响应一致，并确认清理成功。
- 请保留证据：礼品卡入口、新增页、手机号/姓名输入、提交结果和卡号字段稳定 DOM，创建/查询/删除请求中的 cardId、卡号、姓名和手机号；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：从结账页打开实体礼品卡新增页，填写手机号并提交。
- 录制返回后计划补充：`pages/payment.page.ts`、`flows/gift-card.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/payment.page.ts` 负责结账页礼品卡动作与读取，`flows/gift-card.flow.ts` 负责编排创建、比对和 finally 清理。

### ORDER-PAGE-025：提示词 41 POS-34873 用户无Edit Order->Void Printed Item权限，删除hold的菜品（reduce删除），输入有权限的密码，可删除成功 系统中在staff中预置了用户1（非boss权限），以防与其他用户冲突

- Jira：`POS-34873`。
- 已知前置：两名独立员工、可恢复的角色权限、普通菜和可用厨房打印链路。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页读取并暂存指定非 Boss 员工的口令与 `Edit Order -> Void Printed Item` 权限，设置受限员工和授权员工后刷新 POS，以受限员工进入堂食无桌、添加两道菜并把目标菜制作为 Hold 且已打印状态，保存后从 Recall 精确打开同单编辑，选中目标行点击 Reduce，先断言权限提示阻止删除，再输入授权员工口令、保存并回查数量，最后恢复员工口令/权限；前置数据：两名独立员工、可恢复的角色权限、普通菜和可用厨房打印链路。当前缺失的准确 UI 动作是“创建 Hold 且已打印的菜品，并在该行 Reduce 后完成权限口令授权”；不得由 Recall 订单级 Void API 推断；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言未授权时目标行仍在、授权后目标行删除且最终数量正确。
- 请保留证据：员工/角色权限查询更新恢复请求、Hold/打印与订单更新响应、目标菜状态、Reduce、权限提示/口令输入及授权结果 DOM；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：创建 Hold 且已打印的菜品，并在该行 Reduce 后完成权限口令授权。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-kitchen.section.ts`、`pages/order-dishes/order-dishes-void.section.ts`、`flows/employee-permission.flow.ts`、`flows/order-kitchen.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-kitchen.section.ts` 负责 Hold/打印动作，`pages/order-dishes/order-dishes-void.section.ts` 负责行级 Reduce 权限弹框，`flows/employee-permission.flow.ts` 负责员工切换及 finally 恢复，`flows/order-kitchen.flow.ts` 负责订单状态编排。

### ORDER-PAGE-026：提示词 42 POS-35325 用户无Edit Order->Void Printed Item权限，删除延迟送厨的菜品（count数量减少），输入有权限的密码，可删除成功 系统中在staff中预置了用户1（非boss权限），以防与其他用户冲突

- Jira：`POS-35325`。
- 已知前置：两名独立员工、可恢复的角色权限、普通菜和支持 Delay 的厨房打印链路。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页读取并暂存指定非 Boss 员工的口令与 `Edit Order -> Void Printed Item` 权限，配置受限/授权员工并刷新 POS，以受限员工进入堂食无桌、添加两道菜并把目标菜制作为 Delay 且已打印状态，保存后从 Recall 精确打开同单编辑，用 Count 把目标行数量设为 0，先断言权限提示阻止变更，再输入授权员工口令、保存并回查数量，最后恢复口令/权限；前置数据：两名独立员工、可恢复的角色权限、普通菜和支持 Delay 的厨房打印链路。当前缺失的准确 UI 动作是“创建 Delay 且已打印的菜品，并在 Count=0 后完成权限口令授权”；不得由 Hold 或 Recall 订单级 Void API 推断；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言未授权时数量不变、授权后目标行删除且最终数量正确。
- 请保留证据：员工/权限查询更新恢复请求、Delay/打印与订单更新响应、Count=0、权限提示/口令输入及授权结果 DOM；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：创建 Delay 且已打印的菜品，并在 Count=0 后完成权限口令授权。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-kitchen.section.ts`、`pages/order-dishes/order-dishes-void.section.ts`、`flows/employee-permission.flow.ts`、`flows/order-kitchen.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-kitchen.section.ts` 负责 Delay/打印动作，`pages/order-dishes/order-dishes-void.section.ts` 负责行级 Count 权限弹框，`flows/employee-permission.flow.ts` 负责员工切换及 finally 恢复，`flows/order-kitchen.flow.ts` 负责订单状态编排。

### ORDER-PAGE-027：提示词 43 POS-34895 设置不自动合并相同菜，点单页面选中相同菜，1菜1行，不合并

- Jira：`POS-34895`。
- 已知前置：可重复添加的普通菜，以及两项配置各自可更新/恢复的账号权限。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页分别读取并暂存源步骤中的两项配置，先执行“相同菜品不自动合并”，再执行“相同菜品分开展示开关”，记录每次动作后实际请求并刷新 POS，进入堂食无桌连续三次添加同一普通菜，读取每一订单行后保存并回首页，finally 按相反顺序恢复两项原值并刷新；前置数据：可重复添加的普通菜，以及两项配置各自可更新/恢复的账号权限。当前缺失的准确 UI 动作是“逐项执行不自动合并与分开展示开关，并由网络证据判断它们是两个配置还是同一配置的不同操作”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言存在 3 行同名菜且每行数量均为 1，并断言 finally 后两项配置均恢复。
- 请保留证据：两次配置动作各自的入口 DOM、准确名称、ID、类型、旧值/新值、请求响应与刷新结果（若 ID 相同也必须保留证明），同名菜行稳定 DOM/行标识、菜单 itemId 和保存 payload；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：逐项执行不自动合并与分开展示开关，并由网络证据判断它们是两个配置还是同一配置的不同操作。
- 录制返回后计划补充：`api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/system-configuration.setup.ts` 负责逐项配置及 finally 恢复，`pages/order-dishes/order-dishes-reads.section.ts` 负责同名行窄读取，`flows/order-dishes.flow.ts` 负责编排重复点菜。

### ORDER-PAGE-028：提示词 44 POS-34903 设置相同菜合并显示(状态一致的)，已经存在不含有option的菜（已送厨），新加菜分开显示

- Jira：`POS-34903`。
- 已知前置：无 option 的可送厨房普通菜、可用厨房链路，以及三项配置入口的更新/恢复权限。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页逐项读取并暂存源步骤中的三项配置，依次执行“状态一致的相同菜自动合并”“相同菜品分开展示开关”，刷新 POS 后进入后台再执行“相同菜品合并展示开关”，记录每次动作的独立请求响应并再次刷新；随后进入堂食无桌添加无 option 普通菜、送厨并保存订单号，从 Recall 精确打开同单编辑后再次添加同一菜，读取两条菜行的数量/送厨状态，保存回首页，finally 执行源步骤的“不自动合并”并按相反顺序恢复三项原值后刷新。前置数据：无 option 的可送厨房普通菜、可用厨房链路，以及三项配置入口的更新/恢复权限。当前缺失的准确 UI 动作是“分别执行状态一致合并、分开展示和后台合并展示三项配置，并由网络证据决定是否实际落到同一配置”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言已送厨和新加菜分为两行且各自状态/数量正确，并确认全部配置恢复。
- 请保留证据：三项入口 DOM，各自准确名称、ID、类型、旧值/新值、请求响应及刷新结果（相同 ID 也需逐次证明），Send/Recall Edit、两条同名菜行与状态 DOM，保存/送厨响应中的 itemId、数量和 kitchen 状态；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：分别执行状态一致合并、分开展示和后台合并展示三项配置，并由网络证据决定是否实际落到同一配置。
- 录制返回后计划补充：`api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-kitchen.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/system-configuration.setup.ts` 负责三项配置及 finally 恢复，`pages/order-dishes/order-dishes-reads.section.ts` 负责行状态读取，`flows/order-kitchen.flow.ts` 负责送厨、精确回开与恢复编排。

### ORDER-PAGE-029：提示词 45 POS-34910 设置相同菜合并显示(包含已送厨），相同菜已送厨，编辑后继续加相同菜，加入到已送厨的一行， 保持合并展示，显示出 X In Kitchen，菜品字体红色

- Jira：`POS-34910`。
- 已知前置：可送厨房普通菜、可用厨房链路，以及两项配置入口的更新/恢复权限。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页分别读取并暂存源步骤中的两项配置，先执行“相同菜品包含已送厨时也合并到同一行”，再执行“相同菜品分开展示开关”，记录每次动作的独立请求响应并刷新；进入堂食无桌添加目标菜、送厨并保存订单号，从 Recall 精确打开同单编辑后再次添加同一菜，读取合并行数量和 `X In Kitchen` 文案，按源步骤执行或观察 `print` 并记录其真实入口、目标、提示和请求，再读取菜名字体颜色并保存回首页，finally 执行源步骤的“不自动合并”并按相反顺序恢复两项原值后刷新。前置数据：可送厨房普通菜、可用厨房链路，以及两项配置入口的更新/恢复权限。当前缺失的准确 UI 动作是“逐项执行包含已送厨合并与分开展示开关，读取合并行厨房数量标记/红色样式，并确认源步骤 `print` 的真实含义与结果”；必须由网络证据判断两项动作的真实配置关系；
  2. 对源步骤 `print` 不预设打印对象或成功条件；请在读取数量和 `X In Kitchen` 后完整录制实际动作、提示/状态变化和打印请求，并明确它是否影响后续菜名、颜色或保存结果；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言只有 1 条同名行、总数量正确、厨房数量标记出现、菜名字体为产品定义红色，并确认配置恢复。
- 请保留证据：两项入口 DOM，各自准确名称、ID、类型、旧值/新值、请求响应与刷新结果，Send/Recall Edit、合并菜行、`X In Kitchen` 节点、`print` 入口/结果和计算样式 DOM，保存/送厨响应中的 itemId、总数量和厨房数量及打印相关请求；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：缺少包含已送厨合并、分开展示、厨房数量标记和红色样式的稳定契约；源步骤 `print` 未说明打印对象与预期，必须通过录制确认该中间动作或状态，不能静默省略。
- 录制返回后计划补充：`api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-kitchen.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/system-configuration.setup.ts` 负责逐项配置及 finally 恢复，`pages/order-dishes/order-dishes-reads.section.ts` 负责合并行/状态/样式读取，`flows/order-kitchen.flow.ts` 负责送厨、精确回开与恢复编排。

### ORDER-PAGE-030：提示词 46 POS-34842 Automatically redirect after reduce items开关关闭，相连两个菜属于不同类别，当前选中菜品减到没有时，停留 原category

- Jira：`POS-34842`。
- 已知前置：同菜单组下两个相邻类别及各自普通菜、可恢复的跳转配置。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页读取原配置，经系统配置 API 关闭 `Automatically redirect after reduce items` 并刷新，进入堂食无桌，从类别 A/B 各加一菜，保持类别 B 为当前类别并选中 B 菜，点击 Reduce 直至该菜消失，读取当前类别和剩余菜，再回首页 finally 恢复配置；前置数据：同菜单组下两个相邻类别及各自普通菜、可恢复的跳转配置。当前缺失的准确 UI 动作是“关闭真实自动跳转配置，并在减完当前菜后读取仍选中的原类别”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言 B 菜消失、A 菜保留且当前类别仍为 B。
- 请保留证据：配置准确名称、ID、类型、旧值/关闭值及更新恢复请求，类别按钮选中态、两菜订单行、Reduce 与减完后的菜单 DOM，草稿/订单响应中的类别和数量；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：关闭真实自动跳转配置，并在减完当前菜后读取仍选中的原类别。
- 录制返回后计划补充：`api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/system-configuration.setup.ts` 负责配置恢复，`pages/order-dishes/order-dishes-menu.section.ts` 负责 Reduce 与当前类别读取，`flows/order-dishes.flow.ts` 负责跨类别编排。

### ORDER-PAGE-031：提示词 47 POS-33186 点单，修改菜的数量为小于1的小数，减菜正常

- Jira：`POS-33186`。
- 已知前置：支持小数数量的普通菜、To Go 入口和可读取原始数量的订单行。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 To Go，添加普通菜，通过 Count 输入经业务确认的小于 1 小数，读取数量后点击 Reduce 一次，再读取订单行数量/是否移除并返回首页；前置数据：支持小数数量的普通菜。源标题要求“小于 1”，但源步骤写 `num=1.25`，两者业务边界冲突；当前缺失的准确 UI 动作和预期是“输入真实小于 1 的数量后执行 Reduce，确认按步长减少还是直接移除”，不得把 `1.25` 猜作等价；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 按确认规则断言 Reduce 后数量或移除状态。
- 请保留证据：Count 小数输入/确认、Reduce、动作前后数量 DOM，订单草稿/更新请求中的 quantity 和产品负责人确认的目标值/减量规则；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：源标题要求数量“小于 1”，但源步骤写 `num=1.25`，两者业务边界冲突；需确认真实输入值，并确认 Reduce 后按步长减少还是直接移除。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-menu.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责 Count/Reduce，`pages/order-dishes/order-dishes-reads.section.ts` 负责原始数量读取，`flows/order-dishes.flow.ts` 负责编排。

### ORDER-PAGE-032：提示词 48 POS-33241 点单，包含小数数量的菜，拖拽分单正常，母单和子单菜的小数数量展示正常，价格正确

- Jira：`POS-33241`。
- 已知前置：支持小数数量的普通菜、另一道可区分菜品及可进入分单的未支付订单。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 To Go，添加目标菜并把数量改为 `2.55`，读取分单前菜品数量/单价/Subtotal，再添加另一菜并保存订单号；从 Recall 精确打开同单进入分单页，使用真实鼠标拖拽把目标菜从母单拖到新子单，提交后分别打开母单和子单读取菜品数量/价格/Subtotal。前置数据：支持小数数量的普通菜、另一道可区分菜品及可进入分单的未支付订单。现有 `clickDish + clickAddSuborder` 只证明点击选择后新建子单，不等价于源目标/步骤明确要求的拖拽；当前缺失的准确 UI 动作是“从稳定 drag source 拖到稳定 drop target 并等待业务状态落定”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言拖动后目标菜从母单移除并在子单以 `2.55` 和原价格展示、另一菜保留在母单、两单 Subtotal 之和等于分单前金额。
- 请保留证据：分单页稳定 drag source/drop target DOM 与边界框、拖动前后订单/分单请求 payload 中的 orderId/itemId/quantity/price、母子单 DOM 快照和提交响应；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：从稳定 drag source 拖到稳定 drop target 并等待业务状态落定。
- 录制返回后计划补充：`pages/split-order.page.ts`、`flows/split-order.flow.ts`、`flows/recall.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/split-order.page.ts` 新增原始拖拽动作与拖后状态读取，`flows/split-order.flow.ts` 负责编排拖拽、提交及母子单回查，`flows/recall.flow.ts` 负责按单进入分单。

### ORDER-PAGE-033：提示词 50 POS-33600 点单，选择指定价格的菜，修改菜的数量为指定小数，保存订单成功

- Jira：`POS-33600`。
- 已知前置：支持小数数量与改价的目标菜、源价格 `650` 分、数量 `2.55`、两份追加普通菜、To Go 入口及可按订单号 Recall 回查的订单。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 To Go，添加目标菜，按源 `price=650` 的“分”单位调用 `changeOrderedDishPrice(..., 6.50)` 美元，把数量改为 `2.55`，再添加两次普通菜，读取各行单价/数量/Subtotal 后保存并按订单号在 Recall 回查。前置数据：支持小数数量与改价的目标菜、追加菜的整数分菜单价，以及确认产品金额舍入规则的业务依据。`650分 × 2.55 = 1657.5分` 产生半分，仓库没有产品每行/整单舍入口径；当前缺失的准确业务预期是“目标行先舍为多少整数分，以及追加两行前后在哪一层汇总舍入”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 按录制确认的每行与整单整数分规则断言保存前及 Recall 金额完全一致。该行与 51 的 `1.5 + 一次追加` 输入边界不同，仍分别保留。
- 请保留证据：改价键盘显示 `$6.50`、数量 `2.55`、三条订单行 DOM，保存前/Recall 的整数分单价与 Subtotal，订单 payload/响应中的 unitPrice、quantity、lineAmount、subtotal 和 roundingAmount；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：`650分 × 2.55 = 1657.5分` 产生半分，仓库没有产品逐行或整单的舍入口径；需录制确认目标行整数分金额及追加两行后的汇总舍入层级。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-reads.section.ts` 负责行金额/数量读取，`flows/order-dishes.flow.ts` 负责编排改价、加菜与回查。

### ORDER-PAGE-034：提示词 52 POS-35129 点单，选择指定价格的菜，修改菜的数量为指定小数，保存订单成功

- Jira：`POS-35129`。
- 已知前置：支持小数数量的普通菜、候选指定价格、数量 `2.55`、To Go 入口及可保存并按订单号 Recall 回查的订单。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 To Go，添加固定测试菜并把数量改为 `2.55`，先读取点单行数量/价格；随后按业务确认结果决定是否还要执行指定改价、保存订单并按订单号在 Recall 回查，最后返回首页。前置数据：支持小数数量的普通菜、候选指定价格及可保存回查的 To Go 订单。标题/业务目标明确要求“指定价格”和“保存成功”，但详细步骤只改数量并读取点单行；当前缺失的准确动作和预期是“是否执行改价、是否必须保存/Recall，以及最终只断言点单行还是断言持久化金额”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 按确认结果断言点单行数量/价格，并在要求保存时追加 Recall 数量、价格和订单状态断言。
- 请保留证据：源步骤 Count DOM 与数量/价格，候选改价键盘、Save、订单号和 Recall DOM，草稿/保存请求响应及业务负责人确认的最终断言口径；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：标题和业务目标要求“指定价格”并“保存成功”，但源详细步骤只改数量并读取点单行；需确认是否执行改价、是否保存/Recall，以及最终断言点单行还是持久化金额。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-menu.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责 Count/候选改价/Save 页面动作，reads section 负责数量价格读取，`flows/order-dishes.flow.ts` 负责编排确认后的完整路径。

### ORDER-PAGE-035：提示词 53 POS-35660 开启相同菜合并展示开关，点单，修改菜的数量为小数，给菜添加调味正常

- Jira：`POS-35660`。
- 已知前置：支持小数数量和改价的普通菜、可计数全局调味及可恢复配置。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页读取原配置，经系统配置 API 开启“状态一致的相同菜合并”并刷新，进入 To Go 添加目标菜、改价为 `795`、读取单价、把数量改为 `2.3`，打开 Modify 选择真实全局调味并把 count 设为 2，读取订单行数量/调味/总额，保存后按订单号在 Recall 回查，finally 恢复配置；前置数据：支持小数数量和改价的普通菜、可计数全局调味及可恢复配置。当前缺失的准确 UI 动作是“按真实配置名开启合并，并在 Modify 中把全局调味 count 设为 2”；现有 Modify 仅能单次选择 option；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：`tests/py-migrate/order.service.spec.ts` 断言菜品数量 2.3、单价 7.95、调味数量 2、两页 additions 一致且总额按产品规则计算。
- 请保留证据：配置准确名称/ID/旧值/新值与更新恢复请求，Modify option/Count 控件及数量 DOM，菜单数据中的 item/option ID，保存 payload 与 Recall additions；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：按真实配置名开启合并，并在 Modify 中把全局调味 count 设为 2。
- 录制返回后计划补充：`api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-modifier.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/system-configuration.setup.ts` 负责配置恢复，`pages/order-dishes/order-dishes-modifier.section.ts` 负责调味 Count，reads section 负责数量/价格/additions，`flows/order-dishes.flow.ts` 负责编排。

### ORDER-PAGE-036：提示词 54 POS-22640 自定义类型-POS点单点击自定义类型 Delivery，点单，打单成功

- Jira：`POS-22640`。
- 已知前置：启用且映射到 Delivery 的自定义订单类型、可打印订单和明确的打印输出目录。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页建立员工上下文，点击真实自定义订单类型入口并选择 Delivery，录入 name=`pos-test`、phone=`01234567890` 和有效地址，添加 ITEM/ITEM2、保存订单号，从首页进入 Recall 精确打开该单并点击 Print，记录打印前后文件数后返回首页。前置数据：启用且映射到 Delivery 的自定义订单类型、可打印订单和明确的打印输出目录；现有 `HomePage.enterDelivery`/`TakeoutFlow.startDeliveryOrder` 只覆盖首页固定 Delivery 卡片，不等价于自定义类型入口，`RecallOrderDetailsDialog.clickPrintInOrderDetails` 只点击按钮且没有打印成功/文件结果契约。当前缺失的准确 UI 动作是“选择自定义订单类型 Delivery”，并缺打印完成信号；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：保存订单的自定义类型为目标 Delivery，打印请求成功且输出文件数恰好增加 1；不得用 Report Overview 数据替代打印断言。
- 请保留证据：自定义类型入口/列表/选中态、Delivery 字段、Recall Print 控件稳定 DOM，自定义类型 ID 与 Delivery 映射配置，保存请求中的 orderType/customOrderTypeId、打印请求响应或原生桥消息及输出目录 before/after；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：选择自定义订单类型 Delivery。
- 录制返回后计划补充：`pages/home.page.ts`、`pages/delivery.page.ts`、`pages/recall/recall-order-details.dialog.ts`、`flows/takeout.flow.ts`、`flows/recall.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/home.page.ts` 负责自定义类型入口，`pages/delivery.page.ts` 负责客户字段，`pages/recall/recall-order-details.dialog.ts` 负责打印动作/结果，`flows/takeout.flow.ts` 负责编排自定义 Delivery，`flows/recall.flow.ts` 负责编排精确回开和打印。

### ORDER-PAGE-037：提示词 55 POS-36286 POS首页delivery下单，添加用户信息进入订单页面，点击退出直接退出点单页

- Jira：`POS-36286`。
- 已知前置：无同名待处理订单、唯一且可追踪的 Delivery 客户数据、name=`pos-test`、phone=`01234567890`、有效地址，以及可进入点单页但不添加菜品的员工上下文。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页建立员工上下文，点击固定 Delivery 入口，录入 name=`pos-test`、phone=`01234567890` 和有效地址进入点单页，不添加菜品，点击该 Delivery 路径实际显示的退出控件，记录是否出现确认弹窗及真实选择，观察客户数据是否已产生草稿/客户/订单请求，最终回到 POS 首页。前置数据：无同名待处理订单且可追踪本次唯一客户数据；库存 To Go 用例调用 `exitOrderPage` 不能证明 Delivery 填写客户/地址后的退出行为，现有方法通过 Back/iframe/`#odBack` 候选定位、只在瞬时可见时点确认且不等待首页后置，不能作为稳定 DOM 契约。当前缺失的准确 UI 动作是“Delivery 客户信息进入点单页后使用专属退出路径，并处理实际确认分支”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：按录制确认的退出分支离开 `orderDishes` 并显示 POS 首页稳定信号，同时断言客户/草稿请求及残留状态符合真实产品契约。
- 请保留证据：Delivery 信息字段和 Start Order、点单页退出按钮、确认弹窗/按钮、首页固定功能卡的稳定 DOM，进入点单页和退出前后的 customer/order draft 请求响应、customerId/orderId/地址字段及是否取消/清理草稿；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：库存 To Go 用例的 `exitOrderPage` 不能证明 Delivery 填写客户/地址后的退出行为；现有 Back/iframe/`#odBack` 候选定位没有稳定首页后置，需确认 Delivery 专属退出控件及实际确认分支。
- 录制返回后计划补充：`pages/delivery.page.ts`、`pages/order-dishes/order-dishes-navigation.ts`、`flows/takeout.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/delivery.page.ts` 负责 Delivery 录入，`pages/order-dishes/order-dishes-navigation.ts` 负责单一退出 locator、确认分支及返回 `HomePage` 后置，`flows/takeout.flow.ts` 负责编排 Delivery 进入和退出结果。

### ORDER-PAGE-038：提示词 56 POS-36255 菜名名称与number（如均为AA）相同时，点单页面搜索只能搜到一个AA

- Jira：`POS-36255`。
- 已知前置：可写入并清理的可见菜单组/分类、创建和删除临时菜的权限，以及 name、number 均为 `AA`、price=`10.0` 的隔离临时菜数据。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页通过 API 清理同名临时菜，创建 name 与 number 均为 `AA`、price=`10.0` 且挂到当前可见菜单/组/分类的临时菜，刷新配置后从首页进入 To Go，在真实 Search Menu 输入 `AA`，读取全部结果卡及业务 ID，退出回首页并按 ID 清理。前置数据：可写入并清理的菜单分类；`apiSetup.saleItem.create/delete` 已有通用 CRUD，但 `SaleItemApiRequest` 未建模 number 字段，`OrderDishesMenuSection.searchAndClickDish` 只用候选 locator 找首个结果并点击，不能证明唯一结果。当前缺失的准确 UI 动作是“读取搜索结果集合/数量”，并缺 name=number 的真实创建 payload；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：页面只渲染 1 个文本为 `AA` 的结果，且其 itemId 等于临时菜而非按 name/number 重复的两条结果。
- 请保留证据：临时菜创建/删除请求中的 name、number、posName、categoryId 与返回 itemId，刷新后的菜单/搜索响应，Search Menu 按钮、输入框、结果容器和每个结果卡的稳定 DOM/业务 ID；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：`SaleItemApiRequest` 尚未建模 number 字段，现有搜索方法只通过候选 locator 点击首个结果；缺少 name=number 的真实创建 payload，以及搜索结果集合、数量和业务 ID 的读取契约。
- 录制返回后计划补充：`api/setup/menu.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/menu.setup.ts` 负责临时菜生命周期，`pages/order-dishes/order-dishes-menu.section.ts` 负责搜索输入和窄结果读取，`flows/order-dishes.flow.ts` 负责编排刷新、搜索与退出。

### ORDER-PAGE-039：提示词 57 POS-37804 无note权限用户，套餐子菜加note出权限提示

- Jira：`POS-37804`。
- 已知前置：受限员工、有授权员工和包含可编辑子菜的套餐。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页前置保存指定员工原口令/权限，修改口令并移除真实 Note 权限，刷新后退出当前员工、以受限口令进入，创建无桌堂食，添加 `diy_combo1_adjustable`，进入套餐编辑并选择第一条套餐子菜，触发子菜 Note，先读取权限提示，再输入有权限员工口令，填写“备注信息”，最后恢复员工口令和权限。前置数据：受限员工、有授权员工和包含可编辑子菜的套餐；现有套餐 API 仅能在套餐选择面板选 section item/确认，仓库没有员工 Note 权限 setup、套餐子菜 Note 控件或授权弹窗契约。当前缺失的准确 UI 动作是“在套餐子菜行打开 Note 并完成受限到授权的弹窗流程”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：受限员工操作被阻止且出现真实无权限提示，正确授权口令后备注写入目标子菜而非套餐主菜。
- 请保留证据：员工/角色权限查询、更新、恢复请求的权限键和原/新值，套餐 parent 与 subitem 独立 DOM、子菜 Note 控件、权限提示/口令输入/确认控件，以及授权前后订单草稿 payload 中的 subitemId/note；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：在套餐子菜行打开 Note 并完成受限到授权的弹窗流程。
- 录制返回后计划补充：`api/setup/employee-permission.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/employee-permission.flow.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：后台 API/setup 负责员工与权限恢复，`pages/order-dishes/order-dishes-menu.section.ts` 负责套餐子菜/Note/授权弹窗页面动作，`flows/employee-permission.flow.ts` 负责员工切换与 finally 恢复，`flows/order-dishes.flow.ts` 负责套餐编排。

### ORDER-PAGE-040：提示词 58 必选类功能优化，未满足条件时无法提交，且自动跳转

- Jira：`POS-42060`。
- 已知前置：可编辑的 KDS 分类、属于该类的 Mongolian Chicken 和另一普通菜。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 Admin 菜单管理，保存目标分类原配置后把 `KDS` 配为必选类及真实最低选择规则，回首页刷新，创建无桌堂食并只添加不满足必选类的普通菜，点击 Save，读取当前分类名和 URL；再添加 `Mongolian Chicken` 满足规则，重新保存并恢复后台配置。前置数据：可编辑的 KDS 分类、属于该类的 Mongolian Chicken 和另一普通菜；现有 Page 可保存/切换分类，但没有必选类配置字段、未满足时的提示/自动跳转或当前分类读取 API。当前缺失的准确 UI 动作是“配置必选类并在失败保存后观察自动跳到 KDS”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：第一次 Save 被阻止、URL 仍包含 `orderDishes` 且当前分类为 `KDS`；添加目标菜后 Save 成功、URL 不再包含 `orderDishes`，finally 恢复原配置。
- 请保留证据：Admin 分类编辑控件、必选/最小数值及保存控件 DOM，分类详情/更新/恢复请求中的准确字段和旧值/新值，Save 响应，失败前后类别选中态、提示和 URL；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：配置必选类并在失败保存后观察自动跳到 KDS。
- 录制返回后计划补充：`api/setup/menu.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`pages/order-dishes/order-dishes-navigation.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/menu.setup.ts` 负责分类配置与恢复，`pages/order-dishes/order-dishes-menu.section.ts` 负责当前分类读取，navigation 负责保存结果，`flows/order-dishes.flow.ts` 负责编排两阶段提交。

### ORDER-PAGE-041：提示词 59 category未勾选“限制折扣”导致该category下所有菜品可以参与整单按比例加收

- Jira：`POS-42958`。
- 已知前置：至少两道同分类可区分菜、另一分类对照菜和可用百分比加收。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 Admin 菜单管理，记录目标 category 的“限制折扣”原值后取消勾选并保存，回首页刷新，创建无桌堂食，添加该 category 下两道可区分普通菜 A/B（若只能使用动态分类，则先读取并固化完整分类成员集合），再添加一条其他分类菜作为排除对照；打开整单 Charge、应用明确百分比加收，逐项读取参与态、eligible base、加收金额和 Subtotal，最后恢复配置。前置数据：至少两道同分类可区分菜、另一分类对照菜和可用百分比加收；现有 `OrderDishesFlow.applyCustomCharge`/价格汇总可执行整单加收，但 Category API 没有“限制折扣”的准确字段和值，单一道菜也不能证明标题要求的“所有菜品”。当前缺失的准确 UI 动作是“取消限制折扣并逐项证明同分类全部成员进入 proportional whole-order charge 基数”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：A/B（或录制读取的全部分类成员）各自都计入 eligible base，排除对照按其自身分类规则处理，整单加收基数等于所有应参与行金额之和，加收金额按确认比例和舍入规则精确计算，finally 恢复分类配置。
- 请保留证据：Admin checkbox/保存 DOM，分类查询/更新/恢复请求的准确字段、ID、旧值/false，菜单响应中的 categoryId→完整 itemId 集合，A/B/对照菜订单行与 Charge 参与态 DOM，订单草稿/加收请求响应中每个 itemId、eligible 标志/金额、rate、eligible base 和 charge amount；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：取消限制折扣并逐项证明同分类全部成员进入 proportional whole-order charge 基数。
- 录制返回后计划补充：`api/setup/menu.setup.ts`、`pages/order-dishes/order-dishes-charge.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/menu.setup.ts` 负责分类配置恢复与成员读取，`pages/order-dishes/order-dishes-charge.section.ts` 负责逐行参与态，reads section 负责行金额/汇总，`flows/order-dishes.flow.ts` 负责编排多菜对照。

### ORDER-PAGE-042：提示词 60 新UI点单页面，category正常展示配置的POS NAME

- Jira：`POS-42097`。
- 已知前置：可创建/删除分类与菜品的 API 权限、可见菜单组、后台名称 A、POS NAME B、price=`1.0` 的隔离临时菜，以及结束后按 ID 清理分类和菜品的条件。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页前置创建独立临时 category（后台名称 A、POS NAME B）及 price=`1.0` 的临时菜并关联到可见菜单组，进入 Admin 菜单管理核对/保存 POS NAME，回首页刷新，创建无桌堂食、切换目标菜单组，读取类别卡文本并选择后读取当前类别，最后按 ID 清理菜品和 category。前置数据：可创建/删除分类与菜品的 API 权限；`apiSetup.category.create` 虽接受通用 overrides，但 `CategoryApiRequest` 未建模 posName，现有 `switchMenuCategory` 只按给定文本点击且没有当前类别窄读取，不能证明 UI 用 POS NAME 而非 name/displayName。当前缺失的准确 UI 动作是“读取 category 卡片和选中态实际展示字段”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：新 UI 类别卡和当前类别均展示 B，不展示后台名称 A，且点击 B 后临时菜可见。
- 请保留证据：分类创建/更新/删除请求中的 name、posName、displayName、menuGroupId 与返回 categoryId，菜单刷新响应中三种名称，类别卡/选中态/关联菜品稳定 DOM；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：`CategoryApiRequest` 尚未建模 posName，现有 `switchMenuCategory` 只能按给定文本点击且没有当前类别窄读取；需确认 category 卡片和选中态究竟展示 posName、name 还是 displayName。
- 录制返回后计划补充：`api/setup/menu.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`api/setup/menu.setup.ts` 负责临时分类/菜生命周期，`pages/order-dishes/order-dishes-menu.section.ts` 负责类别列表和当前类别读取，`flows/order-dishes.flow.ts` 负责编排。

### ORDER-PAGE-043：提示词 61 套餐的子菜支持改价

- Jira：`POS-42061`。
- 已知前置：可改价套餐及员工改价权限。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页创建无桌堂食，快速添加包含子菜且允许改价的套餐，进入套餐编辑，明确选择一个 subitem，打开该子菜的 Price 动作、输入目标价格并确认，读取套餐主菜、目标子菜和订单总额。前置数据：可改价套餐及员工改价权限；现有 `changeOrderedDishPrice` 通过普通已点菜行解析，套餐 API 只有选择 section item/确认，没有选择已点套餐子菜或子菜 Price 控件，因此不能把主菜改价当作子菜改价。当前缺失的准确 UI 动作是“在套餐层级中选中 subitem 并对其改价”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：只有目标套餐子菜价格变为输入值，套餐主菜价格未被误改，订单总额按子菜价差更新。
- 请保留证据：套餐 parent/subitem 各自稳定 DOM 和业务 ID、子菜选中态、Price 控件/数字弹窗、动作前后草稿 payload 的 comboItemId/subitemId/unitPrice 及总额；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：在套餐层级中选中 subitem 并对其改价。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-menu.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责套餐子菜选择与改价，reads section 负责父子价格窄读取，`flows/order-dishes.flow.ts` 负责套餐编排。

### ORDER-PAGE-044：提示词 62 按菜分单后子单打折，打折界面整单金额检查

- Jira：`POS-36254`。
- 已知前置：可分单未支付订单及可精确定位的母/子单号。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页刷新后创建无桌堂食并添加三道可区分普通菜，在 Split 页面按源步骤真实拖拽菜品建立子单并提交、保存母单号；从首页进入 Recall，精确打开指定子单，先读取该子单菜品列表和价格汇总，再点击 Edit 并记录真实转场落点，在编辑后的实际页面打开 Discount，最后读取该折扣界面的 Whole Order 金额。前置数据：可分单未支付订单及可精确定位的母/子单号；现有 `SplitOrderFlow.splitOrderByItems/moveDishes` 是点击选择而非拖拽，`RecallFlow.openDiscount` 绕过了源要求的“读子单菜品→Edit→Discount”路径，也不能证明 Discount 面板由 Recall 拥有。当前缺失的准确 UI 动作是“真实拖拽分单，以及从指定子单详情经 Edit 转场后打开 Discount 并读取 Whole Order”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：指定子单菜品列表与拖拽结果一致，Edit 后在真实目标页面打开 Discount，Whole Order 金额严格等于录制并经产品确认的母单或子单业务基准，不得用最终折后总额代替。
- 请保留证据：稳定 drag source/drop target DOM/边界框，分单请求响应的母子单号、itemId、母单/子单金额，Recall 指定子单菜品列表与 Edit 控件，Edit 前后 URL/frame/page 根节点，转场后 Discount 入口、面板、Whole Order 金额 DOM及请求响应；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：真实拖拽分单，以及从指定子单详情经 Edit 转场后打开 Discount 并读取 Whole Order。
- 录制返回后计划补充：`pages/split-order.page.ts`、`flows/split-order.flow.ts`、`pages/recall/recall-order-details.dialog.ts`、`pages/order-dishes/order-dishes-charge.section.ts`、`flows/recall.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/split-order.page.ts` 负责拖拽，`flows/split-order.flow.ts` 负责提交；`pages/recall/recall-order-details.dialog.ts` 只负责指定子单读取和 Edit；Discount 动作/读数归属由录制后的真实转场决定（若回到点单页则由 order-dishes charge section 负责，若为独立页面则建立专用 Page），`flows/recall.flow.ts` 负责编排完整转场。

### ORDER-PAGE-045：提示词 63 自定义类型-报表显示Report-Overview-预览显示自定义类型的报表数据-数据正确

- Jira：`POS-22657`。
- 已知前置：目标自定义 Delivery 订单类型、云报表账号/服务、Cloud Report 配置原值及更新/恢复权限、name=`pos-test`、phone=`01234567890`、有效地址和普通菜。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页记录 Cloud Report 原配置并启用，按源顺序打开/读取 Report Overview 的 `cloud report amount` 基线，单独读取启用后出现的“打印提示信息”及其真实位置/文案，再回首页刷新 POS 使配置生效；随后从首页创建自定义 Delivery 订单（name=`pos-test`、phone=`01234567890`）、加菜并保存，从首页再次打开 Cloud Report，切换真实 report frame/window，在 Report Overview 选择目标自定义订单类型并读取最终数据；最后恢复原配置并再次刷新 POS。前置数据：目标自定义订单类型、云报表账号/服务和可恢复配置；`ReportPage` 当前为空，`HomePage.enterReport` 只点击入口，自定义类型入口也缺失。“打印提示信息”疑似源步骤误写，但在产品确认前必须保留为独立中间断言，不能替代或合并最终 Overview 数据断言。当前缺失的准确 UI 动作是“启用后读取 amount/打印提示、刷新，再进入 frame 选择类型并读最终报表”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：启用阶段 amount 可读且打印提示符合录制结果（若确认源误写则记录产品结论后调整）；最终 Report Overview 中目标类型数量/金额相对基线按新订单精确增加并与保存订单一致；finally 恢复配置且刷新生效。
- 请保留证据：Cloud Report 配置 ID/旧值/新值及启用/恢复请求，两次 POS 刷新信号，Overview amount 单元、打印提示容器/文案/触发时机、Report 入口、frame/window、Overview tab、订单类型筛选和数据单元稳定 DOM，订单保存 payload 的 customOrderTypeId/amount 与报表查询响应的类型 ID、时间范围、数量/金额；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：`ReportPage` 当前为空，首页仅有 Report 入口，自定义类型入口也缺失；源步骤“打印提示信息”的归属和含义不明确，需独立录制 amount、打印提示、刷新、frame 切换、类型筛选和最终 Overview 数据，不得用提示替代报表断言。
- 录制返回后计划补充：`api/setup/system-configuration.setup.ts`、`pages/home.page.ts`、`pages/report.page.ts`、`flows/report.flow.ts`、`flows/takeout.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：system configuration setup 负责配置恢复，`pages/home.page.ts` 负责两次刷新和首页提示（若提示实属其他页则按录制归属），`pages/report.page.ts` 负责 amount/frame/筛选/读数，`flows/report.flow.ts` 负责编排启用、基线、提示、刷新、增量与恢复，`flows/takeout.flow.ts` 负责自定义 Delivery。

### ORDER-PAGE-046：提示词 64 系统语言为中文，点单搜索框输入菜的首字母返回对应的菜

- Jira：`POS-43827`。
- 已知前置：可编辑目标菜、中文语言资源和可恢复默认语言。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页进入 Admin 菜品/分类配置，记录目标菜原中英文名并设置可确认首字母为 `ptc` 的中文名，回首页将系统语言切为 Chinese，创建无桌堂食，在 Search Menu 输入 `ptc`，读取全部结果并选择目标菜，退出回首页后恢复默认语言和菜品配置。前置数据：可编辑目标菜、中文语言资源和可恢复默认语言；现有 Home 只有 language 图标 locator，没有语言选项/当前状态 API，搜索 API 只能按完整 dishName 找首个结果。当前缺失的准确 UI 动作是“切换并读取中文状态后按中文首字母搜索”，不能用中文名称展示或一般英文搜索替代；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：语言状态确为中文，输入 `ptc` 只返回并可选择配置中文名对应的目标菜，订单行展示该中文名，finally 恢复语言与配置。
- 请保留证据：Admin 菜品中英文名字段和更新恢复请求，语言按钮/Chinese 选项/选中态、本地持久化或切换请求，搜索输入/结果卡稳定 DOM，菜单/搜索响应中的 itemId、中文名和首字母索引字段；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：切换并读取中文状态后按中文首字母搜索。
- 录制返回后计划补充：`pages/home.page.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`api/setup/menu.setup.ts`、`flows/language.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：`pages/home.page.ts` 负责语言切换/读取，`pages/order-dishes/order-dishes-menu.section.ts` 负责搜索结果读取，`api/setup/menu.setup.ts` 负责菜品配置恢复，`flows/language.flow.ts` 负责编排 finally。

### ORDER-PAGE-047：提示词 65 套餐设置display all one time，子菜不可重复选，规则设置max，点单保存combo后，可正常编辑，修改子菜

- Jira：`POS-43956`。
- 已知前置：可配置的 combo、至少 max+1 个候选子菜和可恢复配置。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页记录套餐原配置，在后台/API 将目标套餐设为 `display all one time`、子菜不可重复且规则为明确 max，刷新后创建无桌堂食，打开 combo 验证全量一次展示和重复选择限制，按 max 选满并保存订单号；从 Recall 精确打开并 Edit，进入套餐编辑替换一个 subitem，保存后回查，finally 恢复配置。前置数据：可配置的 combo、至少 max+1 个候选子菜和可恢复配置；现有 combo API 只能按 section/dish 点击并确认，没有这些规则的配置 setup、重复限制读数或已保存套餐的 subitem 编辑动作。当前缺失的准确 UI 动作是“在 display-all/max/non-repeat 规则下编辑已保存 combo 子菜”；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：初次选择不能重复且不超过 max，保存成功；编辑后仅目标 subitem 被替换，parent 和其他 subitems 不变，Recall 回显与更新 payload 一致。
- 请保留证据：三项配置各自准确字段/ID/旧值/新值与更新恢复请求，combo section、候选卡、已选数量/禁用态、Confirm、Recall Edit、订单行 parent/subitem 独立 DOM，以及保存/更新 payload 的 comboId、ruleId、subitemIds；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：在 display-all/max/non-repeat 规则下编辑已保存 combo 子菜。
- 录制返回后计划补充：`api/setup/combo.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`flows/recall.flow.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：套餐配置 API/setup 负责规则与恢复，`pages/order-dishes/order-dishes-menu.section.ts` 负责 combo 选择/编辑，reads section 负责 parent/subitem 窄读取，`flows/order-dishes.flow.ts` 负责保存、精确回开和 finally。

### ORDER-PAGE-048：提示词 66 combo子菜没有option，选择子菜返回主菜可正常选择option

- Jira：`POS-43823`。
- 已知前置：可创建/删除 combo 关系、主菜 option、无 option 子菜和普通菜 option。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页用 API 创建隔离套餐主菜、无 option 子菜、套餐主菜 option 关系，以及一条带自身 option 的普通非套餐对照菜，确认刷新后创建无桌堂食；打开 combo、选择无 option subitem，记录返回套餐主菜 option 面板并选择 parent option、确认套餐订单行；随后按源步骤添加普通非套餐菜，打开/选择它自己的 option，分别读取两条订单行和面板状态，退出后按 ID 清理全部临时数据。前置数据：可创建/删除 combo 关系、主菜 option、无 option 子菜和普通菜 option；现有 `apiSetup.saleItem` 只有普通菜 CRUD，未提供 combo/option 关系 setup，套餐面板也只有 section item/确认。当前缺失的准确 UI 动作是“无 option 子菜返回 combo parent option 后，再添加普通非套餐菜作为 option 对照”；该对照用于排除普通菜 option 面板/状态被误认成 combo parent option；
  2. 逐一展示上述完整路径中的中间弹窗、控件状态、页面转场、配置生效与恢复动作，不得省略标题对应的业务步骤；
  3. 在最终断言所在页面读取并保留以下结果：combo option 的 owner 是套餐主菜且 subitem additions 为空；普通菜 option 仅归属普通菜订单行；两个面板/ownerId/回显互不混淆，证明返回后的可选 option 确为 combo parent option。
- 请保留证据：临时 combo parent/subitem/parentOption 与 ordinaryItem/ordinaryOption 的创建删除请求和各自 ID，菜单响应中的 owner 关系，combo subitem 卡、自动返回状态、parent option 面板、普通菜 option 面板、两条订单行层级 DOM，两个阶段草稿 payload 中 option.ownerItemId；同时保留目标元素原始的 data-testid、role、label、可见文本，以及影响最终结果的关键网络请求、配置旧值/新值和恢复结果。
- 当前阻塞：无 option 子菜返回 combo parent option 后，再添加普通非套餐菜作为 option 对照。
- 录制返回后计划补充：`api/setup/combo.setup.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` 中的以下职责：套餐配置 API/setup 负责临时关系生命周期，`pages/order-dishes/order-dishes-menu.section.ts` 负责两类 option 面板与转场，reads section 负责套餐/普通菜订单行窄读取，`flows/order-dishes.flow.ts` 负责编排对照与清理。

### ORDER-PAGE-049：提示词 7 POS-42886 菜品操作改价时可以选择单菜折扣

- Jira：`POS-42886`。
- 已知前置：可从 POS 首页进入点单页、折前 Subtotal 为 8.80 的普通菜，以及产品真实支持的单菜 Discount 入口；不得把 `Custom Charge` 当作 Discount。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页建立员工上下文，进入堂食无桌点单并添加目标普通菜，读取并保留折前 Subtotal 8.80；选中目标菜后进入真实单菜折扣入口，记录该入口的作用域与选中目标；在真实折扣弹窗中选择百分比、输入 10 并确认，读取折后 Subtotal 7.92；保存订单，再从 Recall 精确打开该订单并复核目标菜折扣明细与 Subtotal 7.92；
  2. 逐一展示真实折扣入口、目标菜选中态、作用域、弹窗标题和模式、百分比选择、数字输入、确认动作、保存与 Recall 转场，不得使用 `pos-ui-option-__custom_discount__` 打开的 `Custom Charge` 弹窗替代；
  3. 在最终断言所在页面保留折前 8.80、10% 折扣金额、折后 7.92 与 Recall 一致性证据，并明确结果不是 9.68 或 `Charge(10%) $0.88`。
- 请保留证据：真实单菜 Discount 入口、作用域、目标菜选中态、弹窗内稳定 data-testid/role/label、百分比模式、输入方式、确认按钮、折扣前后数值，以及保存/Recall 请求响应中的订单号、目标 itemId、折扣类型/比例/金额和最终 Subtotal。
- 当前阻塞：真实 UI 已证明现有 `pos-ui-option-__custom_discount__` 只打开正向 `Custom Charge`；10% 后 Subtotal 从 8.80 变为 9.68，现有契约不能代表 Discount，且缺少真实折扣入口、弹窗和结果 DOM 契约。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-discount.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order-page-regression.spec.ts` 中的以下职责：Page 负责真实单菜折扣入口、弹窗动作与窄读取，Flow 负责编排选菜、保存和 Recall 回查，spec 断言 8.80 的 10% 折扣按产品规则得到 7.92。

### ORDER-PAGE-050：提示词 28 POS-28674 特殊价格的菜-设置50%折扣，保存订单

- Jira：`POS-28674`。
- 已知前置：可从 POS 首页进入点单页、支持把目标菜改价为 5.85，以及产品真实支持的单菜 50% Discount 入口；不得把 `Custom Charge` 当作 Discount。
- 请从 POS 首页开始录制：
  1. 最小录制路径：从 POS 首页建立员工上下文，进入堂食无桌点单并添加目标菜；通过真实改价入口把目标菜改为 5.85，读取并保留改价结果；选中该菜进入真实单菜折扣入口，在真实折扣弹窗中选择百分比、输入 50 并确认，读取按产品舍入后的 Subtotal 2.92；保存订单，再从 Recall 精确打开该订单并复核目标菜改价、50% 折扣明细与 Subtotal 2.92；
  2. 逐一展示改价入口与确认、真实折扣入口、目标菜选中态、作用域、弹窗标题和模式、百分比选择、数字输入、确认动作、保存与 Recall 转场，不得使用 `Custom Charge` 弹窗替代；
  3. 在最终断言所在页面保留改价 5.85、50% 折扣金额、按产品舍入后的 2.92 与 Recall 一致性证据，并明确结果不是 8.78 Charge。
- 请保留证据：真实改价与单菜 Discount 入口、作用域、目标菜选中态、弹窗内稳定 data-testid/role/label、百分比模式、输入方式、确认按钮、折扣前后数值，以及保存/Recall 请求响应中的订单号、目标 itemId、改价、折扣类型/比例/金额和最终 Subtotal。
- 当前阻塞：把目标菜改价为 5.85 后调用现有 50% 接口，Subtotal 实际为 8.78；现有 `Custom Charge` 契约不能代表 Discount，且缺少真实 50% 折扣入口、作用域、弹窗与保存/Recall 结果契约。
- 录制返回后计划补充：`pages/order-dishes/order-dishes-discount.section.ts`、`flows/order-dishes.flow.ts`、`tests/py-migrate/order-page-regression.spec.ts` 中的以下职责：Page 负责改价后真实单菜折扣入口、弹窗动作与窄读取，Flow 负责编排改价、折扣、保存和 Recall 回查，spec 断言 5.85 的 50% 折扣按产品舍入得到 2.92。

## 已收到，无需重复录制

### Recall 分单、合单、移菜和退款

此前已收到 Recall 平分、合单、移菜到已有订单、移菜到新订单、按金额退款等录制。除非后续定位到新的具体 DOM 缺口，否则不再要求重复录制。

## 无需录制且已完成

以下用例已于 2026-07-10 至 2026-07-13 使用 Playwright Chromium headless 真实运行通过，无需提供录制：

- POS-31301：通过 `pos-ui-option-__custom_discount__` 清空单菜自定义折扣。
- POS-30756：现金支付后追加 Tips 并转服务员。
- POS-32955：Open Food 使用自定义中英文名称创建菜品后，加收页 Item 模式完整展示该名称；已于 2026-07-13 真实运行通过。
- POS-32934：分单页展示 `Add Suborder`，点击后新增当前母单下的第 2 个子单；无需验证语言切换步骤 4/5/6，已于 2026-07-13 真实运行通过。
- POS-19389：座位分单子单应用固定 `$5.00` Custom Discount 后，Tips 按 Subtotal 重新分配且总额保持 `$6.00`；已于 2026-07-13 真实运行通过。
- POS-23322：Payment 页设置 `$1.00` Tips 后现金支付 `$5.00`，Balance due 从 `$10.86` 变为 `$5.86`，Recall 状态为 `Semi-Paid`；已于 2026-07-13 真实运行通过。
- POS-19380：按金额分单半支付后，两次执行 Unsplit 时捕获 2 秒 Toast 并校验阻断文案；已于 2026-07-13 真实运行通过。
- POS-22813：含整单 5% 加收的送厨订单按菜拆为两个子单，逐个编辑清空加收并现金结清，最终两个子单均不再显示 Charge；已于 2026-07-13 真实运行通过。
- POS-32903：Delivery 地址包含 `&` 时送厨接口返回 `200`；已改用 `POST /print/kitchen/ticket` 响应作为成功凭据，并验证在 POS-32002 后连续运行通过。
- POS-34555：分两次现金付款，第二次产生找零后支付成功。
- POS-27164：仍满足订单类型条件时保留历史手动加收。
- POS-27169：后台删除配置后保留历史手动加收金额。
- POS-27176：自动加收不再满足订单类型条件时移除。
- POS-27182：后台删除配置后移除自动加收。
- POS-32002：关闭合单重算时保留计税固定金额自动加收。
- POS-32006：关闭合单重算时不自动新增满足人数条件的服务加收。
- POS-32017：开启合单重算时，Delivery 源单合并 Dine In 目标单后移除不再满足订单类型的 Delivery 自动加收。
- POS-32031：A、B 两单分别包含自动、预置手动和自定义加收时，合单重算后保留三类测试加收且金额正确；环境长期加收 `213` 已从测试管理明细中隔离。
- POS-27303：修改和删除加收配置后合单仍累加两笔历史加收。
- POS-27314：修改自动加收后移菜并保留源订单原加收。
- POS-27317：将菜品移动到已有手动加收订单并保持加收明细。
- POS-27324：修改自动加收后移单并保留源订单原加收金额。
- POS-27325：删除自动加收后移单并保留源订单原加收金额。
- POS-27229：自动加收配置修改后从详情页分单并按子单分摊历史加收。
- POS-27258：复制订单时保留满足人数条件的自动加收。
- POS-27287：复制订单时保留已改为自动触发的手动加收。
- POS-19368：修改一个座位分单子单 Tips 时另一个子单 Tips 保持不变。
- POS-19374：按金额分单半支付后保持分单状态。
- POS-19377：撤销未支付的按金额分单。
- POS-19383：平分后修改子单 Tips，再撤销分单并校验 Tips。
- POS-19386：座位分单子单减菜后按 subtotal 重算 Tips。
- POS-21845：按多个金额拆分订单并在 Recall 保持子单总额。
- POS-21855：订单作废时展示 7 个作废原因。
- POS-23204：清空整单折扣和单菜折扣后对应明细消失。
- POS-23671：合并不含税加收订单后总额等于两笔原订单之和。
- POS-23672：合并计税加收订单后总额等于两笔原订单之和。
- POS-19517：两笔现金支付流水分别退款后生成对应负向流水。
- POS-24394：复制带自定义调味的订单后总额保持不变。
- POS-25235：To Go 平分子单现金结清后追加 `$1.00` Tips。
- POS-27190：自动加收配置修改后从详情页送厨并保留原加收金额。
- POS-27191：手动加收配置修改后从编辑页送厨并保留原加收金额。
- 环境配置：Restaurant Hour `id=1`（`All Day`）已由 `06:00–23:30` 永久修正为 `00:00–23:59`，恢复深夜时段的自动化菜单可用性。

## 不需要录制

以下项目需要配置值、产品规则确认或产品修复，不属于页面录制问题：

### 当前 `test.fail(...)` 预期失败（25 条）

以下用例的断言实际失败时，Playwright 会因“符合预期失败”而将用例整体显示为 Passed。

#### 手动加收配置变更（6 条）

- POS-27156：后台改名后历史手动加收应保留旧名称还是使用新名称。
- POS-27157：后台将手动固定 `$10` 加收改为 `10%` 后，重新编辑仍保留历史 `$10`，未按新配置重算为 `$0.88`。
- POS-27158：后台将手动 `10%` 加收改为固定 `$10` 后，重新编辑仍保留历史 `10%` 金额 `$0.88`。
- POS-27159：后台将手动固定加收由 `$10` 改为 `$20` 后，重新编辑仍保留历史 `$10`。
- POS-27163：后台将手动固定加收改为计税后，重新编辑税额仍为 `$0.88`，未高于修改前税额。
- POS-27165：后台将手动加收改为仅 Delivery 后，Dine In 历史订单重新编辑仍保留 `$10`，未按订单类型条件隐藏。

#### 自动加收配置变更（6 条）

- POS-27170：保存前 API 含 `auto_test_fixed $10`，后台改名后重新编辑未显示 `new_name_auto`，仅剩环境加收 `213 $1.06`。
- POS-27171：后台将自动固定 `$10` 加收改为 `10%` 后，重新编辑的小计为 `$8.80`，但目标加收重算为 `$1.06`，未按小计计算为 `$0.88`。
- POS-27172：后台将自动 `10%` 加收改为固定 `$10` 后，重新编辑目标加收未生效，仅应用环境 `213` 的 `12%` 加收 `$1.06`。
- POS-27173：后台将自动固定加收由 `$10` 改为 `$20` 后，重新编辑目标加收未生效，仅应用环境 `213` 的 `12%` 加收 `$1.06`。
- POS-27174：后台将自动百分比加收由 `10%` 改为 `20%` 后，重新编辑目标加收未生效，仅应用环境 `213` 的 `12%` 加收 `$1.06`，未重算为 `$1.76`。
- POS-27177：API 读回目标配置仍为固定 `$10` 且 `taxed=true`；重新编辑后目标加收丢失，仅应用环境 `213` 的 `12%` 加收 `$1.06`。

#### 配置变更后的保存或分单（2 条）

- POS-27192：自动加收配置修改后从编辑页保存会丢失新加收。
- POS-27248：自动加收配置修改后从编辑页平分订单会丢失加收。

#### 复制订单（5 条）

- POS-27257：复制自动加收订单后仍保留旧加收名称和金额，未按后台新配置重算。
- POS-27259：复制自动加收订单后仍保留旧加收，未按后台人数条件移除。
- POS-27271：Delivery 源订单保存前未生成目标自动加收 `auto_test1`，无法进入修改 `minMileage` 后复制订单的断言。
- POS-27286：复制自动加收订单后未按后台触发方式改为手动而移除旧加收。
- POS-27288：复制手动加收订单后仍保留旧加收，未按后台订单类型条件移除。

#### 支付后分单限制（2 条）

- POS-19365：已支付共享菜后作废另一子单时，产品未返回需求中的阻断提示，当前以预期失败保留覆盖。
- POS-19371：半支付座位分单点击 Unsplit 后，产品未返回需求中的阻断提示，当前以预期失败保留覆盖。

#### 合单加收（2 条）

- POS-32006：合单重新计算后未新增满足人数条件的自动服务加收。
- POS-32008：预置自动加收未出现在 POS 加收弹窗。

#### 金额精度与税额配置（2 条）

- POS-32963：`100 × 1.015%` 实际显示 `$1.01`，预期 `$1.02`。
- POS-33063：已修正 `DINE_IN` 枚举、预置刷新顺序并处理延迟配置通知，但点单页仍只生成环境加收 `213`，测试创建的自动服务加收未稳定生效，不需要录制。

### 不属于 `test.fail(...)` 的当前问题

- POS-27160：普通 Failed。重新进入编辑页时正确保留历史 `$0.88`；打开 Charge 弹窗及确认后仍为 `$0.88`，均未按后台 `20%` 配置更新为 `$1.76`。
- POS-32954：POS NG 不适用，保留 skip，不需要录制。
- POS-32016：现有实现只创建 Delivery 源单和 To Go 目标单，缺少原需求的两笔 Delivery 改价、报表 Fee 与小费校验，需重写数据构造。

## 最近运行记录

- 2026-07-11 完整运行 75 条：57 passed、15 skipped、3 unexpected failed，耗时 27.1 分钟；39 条 skipped 已降为 15 条。
- 三条非预期失败为 POS-23671、POS-23672、POS-27303。修复合单重算配置隔离及价格明细展开后，三条均已分别真实复跑通过。
- POS-32017 修正为 Delivery 源单合并 Dine In 目标单并移除多余里程条件后真实运行通过；当前 skipped 进一步降为 14 条。
- POS-32031 已使用结构化 API 数据分别构造 A、B 两单的三类加收并真实运行通过；当前 skipped 进一步降为 13 条。
- POS-32955 已按录制的 Open Food 入口补齐页面对象并真实运行通过；当前 skipped 进一步降为 12 条。
- POS-32934 已按精简后的范围校验 `Add Suborder` 及动态母单号下的第 2 个子单；当前 skipped 进一步降为 11 条。
- POS-19389 已补齐固定金额 Custom Discount，并校验 Tips 按 Subtotal 分配且总额不变；当前 skipped 进一步降为 10 条。
- POS-23322 已按 Payment 页真实路径完成 Tips 与部分现金支付校验；当前 skipped 进一步降为 9 条。
- POS-32954 已确认 POS NG 不适用，继续保留 skip，但从待录制清单移除。
- POS-19380 已按录制补齐两次 Unsplit 和 2 秒 Toast 捕获；当前 skipped 进一步降为 8 条。
- POS-22813 已按录制改为按菜分单并逐个清空加收后现金结清；当前 skipped 进一步降为 7 条。
- POS-27160 已按用例规则补齐编辑页初始金额、Charge 弹窗金额及确认后金额三阶段校验，并取消预期失败标记；真实复跑在后两阶段收到 `$0.88`，用例正确显示 Failed。
- 后台加收订单类型现统一标准化为 `DINE_IN`、`DELIVERY`、`PICK_UP`、`TO_GO`，创建与更新路径均有 API 单元测试覆盖。
- 25 条已确认产品或配置问题的用例使用 `test.fail(...)` 真实执行，不再计入 skipped；断言实际失败时整体显示 Passed，产品修复后若意外通过则会主动报告失败。

## 维护规则

- 收到有效录制后，将对应条目移动到“已收到，无需重复录制”。
- 用例真实跑通后，从本文档删除该条目的录制细节，仅在完成记录中保留 issue 和通过日期。
- 如果失败点是产品行为或后台配置，不新增录制请求，直接记录实际结果和待确认项。

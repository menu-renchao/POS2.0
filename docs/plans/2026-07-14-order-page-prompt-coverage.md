# 点单页面提示词覆盖矩阵

## 数据源

- 提示词：`C:\Users\nhqrt\Desktop\test_order_page_playwright_prompts.md`
- 设计：`docs/superpowers/specs/2026-07-14-order-page-prompt-regression-design.md`
- 基线：66 条，编号 1～66。

## 状态口径

| 状态 | 完成证据 |
|---|---|
| 已等价覆盖 | 具体 spec、中文测试标题和关键断言均与提示词等价 |
| 待补断言 | 已有路径可执行，但缺少提示词要求的核心可观察结果 |
| 可直接实现 | 真实 Page/Flow API 和稳定 DOM 契约已经存在 |
| 需要录制 | 缺真实路径、DOM、配置入口或业务预期；关联唯一录制编号 |
| 产品异常 | 已有可重复执行证据证明实际结果与需求冲突 |
| 环境阻塞 | 缺账号、权限、数据、打印目录或外部服务，并记录恢复条件 |

Task 2 仅完成状态分类和逐行录制证据定义；所有 `需要录制` 行暂写 `待 Task 6 分配`，由 Task 6 按全矩阵顺序生成正式录制编号与录制条目。

## 汇总

| 已等价覆盖 | 待补断言 | 可直接实现 | 需要录制 | 产品异常 | 环境阻塞 | 总数 |
|---:|---:|---:|---:|---:|---:|---:|
| 2 | 3 | 1 | 13 | 0 | 0 | 66 |

## 明细

| 编号 | Jira | 标题 | 业务域 | 状态 | 覆盖或缺口证据 | 计划落点 | 录制编号 | 最近验证 |
|---:|---|---|---|---|---|---|---|---|
| 1 | POS-15602 | POS-15602 点单页面菜单---组---切换组 | 菜单与语言 | 待补断言 | tests/py-migrate/order.service.spec.ts:44 的候选用例经 `OrderDishesFlow.addRegularDish` 实际点击菜单组和类别，但最终只断言 Recall 菜名与价格，缺少切换后当前组为“自动化菜单组”的可观察断言；目标：在 `pages/order-dishes/order-dishes-menu.section.ts` 增加当前组读取/断言，并在 `tests/py-migrate/order.service.spec.ts` 补断言 | `pages/order-dishes/order-dishes-menu.section.ts`、`tests/py-migrate/order.service.spec.ts` | — | 2026-07-14：完整审计候选测试与 Page/Flow |
| 2 | POS-15605 | POS-15605 点单页面菜单--组 中文展示 | 菜单与语言 | 需要录制 | 最小录制路径：从 POS 首页建立员工上下文，切换系统语言为中文，进入 To Go 点单页读取菜单组列表，断言配置的中文组名后返回首页并恢复默认语言；保留证据：语言按钮、语言弹层选项/选中态、菜单组按钮的稳定 DOM，以及语言切换请求或本地持久化值和菜单响应中的组 ID/中英文名；最终断言：`tests/py-migrate/order.service.spec.ts` 断言中文组名可见且恢复后默认语言生效；职责：`pages/home.page.ts` 负责语言切换/读取，`pages/order-dishes/order-dishes-menu.section.ts` 负责组列表读取，`flows/language.flow.ts` 负责首页进入与 finally 恢复 | `pages/home.page.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/language.flow.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：定义中文组完整录制路径与证据 |
| 3 | POS-15641 | POS-15641 点单页面菜单--类--组下多个类时，进行类切换 | 菜单与语言 | 需要录制 | 最小录制路径：从 POS 首页进入 To Go，选择一个真实包含至少两个类别的菜单组，先选类别 A 再切到类别 B，确认当前类别与菜品区域变化，添加 B 类菜品、保存并在 Recall 回查；保留证据：菜单响应中同组的两个类别 ID/名称/菜品归属、类别按钮选中态与菜品卡 DOM、保存订单请求/响应；最终断言：`tests/py-migrate/order.service.spec.ts` 同时断言 B 类选中、A/B 切换后菜品集合变化及 Recall 菜品名称/价格；职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责类别列表/选中态/菜品读取，`flows/order-dishes.flow.ts` 负责双类别切换与下单回查 | `pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：确认候选仅使用单一类别并定义双类别录制 |
| 4 | — | Seperate the same dishes开关开启，订单送厨后编辑页面，选择菜品，点击加1，存单后检查订单上的税率正确 | 送厨与合并菜 | 需要录制 | 最小录制路径：从 POS 首页前置开启 Separate same dishes 并刷新 POS，进入堂食无桌订单连续添加目标菜、读取税额 `$1.20`、送厨/保存，Recall 打开同一订单进入真实编辑页，对目标菜加 1 后再保存并回查税额 `$1.80`，最后恢复开关；保留证据：配置查询/更新/恢复请求的配置名、ID、旧值/新值，分行菜品 DOM、Send/Save 与 Recall Edit DOM，订单保存/编辑响应中的数量和税额；最终断言：`tests/py-migrate/order.service.spec.ts` 在首次保存前断言 `$1.20`、编辑保存后 Recall 断言数量与 `$1.80`；职责：`api/setup/system-configuration.setup.ts` 负责开关及恢复，`pages/order-dishes/order-dishes-reads.section.ts` 负责数量/税额读取，`flows/order-kitchen.flow.ts` 负责送厨、Recall 编辑和 finally 恢复 | `api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-reads.section.ts`、`flows/order-kitchen.flow.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：确认缺开关、真实送厨编辑与恢复证据 |
| 5 | — | 后台点单前确认客户信息，客户姓名必填，电话必填，点支付按钮后弹出输入电话号码和客户姓名的弹框 | 客户信息 | 需要录制 | 最小录制路径：从 POS 首页前置开启“点单前确认客户信息”、姓名必填和电话必填，刷新后进入堂食无桌、加菜并点 Pay，分别触发缺姓名/电话提示，再填写完整信息确认进入 Payment，最后返回首页并恢复配置；保留证据：三个配置项的查询/更新/恢复请求和旧值/新值，客户弹框、姓名/电话输入、字段错误、确认按钮与 Payment 到达标识 DOM；最终断言：`tests/py-migrate/order.service.spec.ts` 断言缺字段时被阻止、完整填写后弹框消失且 Payment 加载；职责：`api/setup/system-configuration.setup.ts` 负责配置及恢复，`pages/order-dishes/order-dishes-customer.dialog.ts` 负责弹框读写/校验，`flows/order-customer.flow.ts` 负责编排支付前校验 | `api/setup/system-configuration.setup.ts`、`pages/order-dishes/order-dishes-customer.dialog.ts`、`flows/order-customer.flow.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：定义客户必填完整录制路径与证据 |
| 6 | — | 没有删菜权限的用户点单后删菜，弹出权限提示框提示没有权限，输入正确的密码可正常删菜 | 权限与 Void | 需要录制 | 最小录制路径：从 POS 首页退出当前员工，以无删菜权限员工口令进入，切英文后新建堂食无桌、加菜并整单送厨，Recall 打开同一订单编辑并删除菜品，断言无权限提示，输入有权限口令后保存、选择 Void 原因，再回查菜品状态并恢复员工/语言/权限；保留证据：员工与角色权限查询/更新/恢复请求，送厨和订单更新响应，删除按钮、权限提示文本/口令输入、Void 原因弹框及菜品状态 DOM；最终断言：`tests/py-migrate/order.service.spec.ts` 断言未授权时不可删除、授权后目标菜状态符合需求；职责：`pages/order-dishes/order-dishes-void.section.ts` 负责单行 Void/权限/原因 DOM，`flows/employee-permission.flow.ts` 负责员工切换、授权与 finally 恢复，`flows/order-kitchen.flow.ts` 负责送厨和 Recall 编辑 | `pages/order-dishes/order-dishes-void.section.ts`、`flows/employee-permission.flow.ts`、`flows/order-kitchen.flow.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：定义受限员工删菜完整录制路径与证据 |
| 7 | — | 菜品操作改价时可以选择单菜折扣 | 改价折扣备注 | 待补断言 | tests/py-migrate/split-order-operation.spec.ts:2711 已经对单菜应用 10% 折扣，但只断言折扣明细 `Charge(10%)` 的出现/清除，且已知问题注解明确未校验订单总额；缺少提示词要求的 `价格1 × 0.9 = 价格2` 数值断言，目标为该 spec 的单菜折扣场景 | `tests/py-migrate/split-order-operation.spec.ts` | — | 2026-07-14：完整审计单菜折扣测试与 Charge Flow |
| 8 | — | 点Modify可以输入菜品的备注，保存订单后，菜品后面的备注信息正确 | 改价折扣备注 | 待补断言 | tests/py-migrate/split-order-operation.spec.ts:2824 已通过 Modify 添加自定义调味并保存，但最终仅比较复制前后总额，未读取 Recall 菜品 additions 校验备注文本；目标：在该 spec 或 `tests/py-migrate/order.service.spec.ts` 补保存后备注回显断言 | `tests/py-migrate/split-order-operation.spec.ts`、`tests/py-migrate/order.service.spec.ts` | — | 2026-07-14：完整审计 Modify、保存和 Recall 能力 |
| 9 | — | 点单，加小费，平分订单，合并子单，订单小费金额正常 | 分单与小费 | 可直接实现 | `pages/order-dishes/order-dishes-tip.section.ts` 已有小费输入，`flows/split-order.flow.ts:28` 已有平分，`:171` 已有合并，`pages/recall.page.ts:198` 可读 Tips；真实路径与读数契约完整，可直接新增断言分单后 `1.00`、合并后 `2.00` 的用例 | `tests/py-migrate/order.service.spec.ts` | — | 2026-07-14：核对小费、平分、合并及 Recall 读数 API |
| 10 | — | open Food 点单，不选择任何税，可以成功完成付款 | Open Food | 需要录制 | 最小录制路径：从 POS 首页进入堂食无桌，打开 Open Food，输入名称/价格并明确保持“不选择任何税”，完成现金全额付款，按保存的订单号进入 Recall 并校验订单状态 `Paid`；保留证据：Open Food 弹框税项控件/默认态 DOM、创建菜品或订单请求中的 taxId/税标志及响应税额、现金支付响应、Recall 订单状态 DOM；最终断言：`tests/py-migrate/order.service.spec.ts` 断言 Open Food 税额为 0 且 Recall 订单状态为 `Paid`；职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责 Open Food 税项选择/读取，`flows/order-dishes.flow.ts` 负责无税 Open Food 下单，现有 `flows/payment.flow.ts` 负责现金支付 | `pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`flows/payment.flow.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：确认现有 API 无 no-tax 契约并定义录制证据 |
| 11 | — | 连续创建两个不输入姓名的pick up订单，修改其中一个食客姓名，另一个不受影响 | 客户信息 | 需要录制 | 最小录制路径：从 POS 首页连续创建两笔不填姓名的 Pick Up 并分别保存订单号，Recall 按单号打开第一笔进入客户/食客编辑，填写唯一姓名并保存，再分别回开两笔订单；保留证据：两次创建响应的订单号/customerId、Recall 卡片与客户信息 DOM、编辑姓名入口/输入/保存 DOM 及更新请求中订单/customer 关联；最终断言：`tests/py-migrate/order.service.spec.ts` 断言第一笔为新姓名、第二笔仍为空且订单号互不混淆；职责：`pages/order-dishes/order-dishes-customer.dialog.ts` 负责姓名编辑，`pages/recall/recall-order-details.dialog.ts` 负责按单读取客户信息，`flows/order-customer.flow.ts` 负责双单创建、精确定位和隔离校验 | `pages/order-dishes/order-dishes-customer.dialog.ts`、`pages/recall/recall-order-details.dialog.ts`、`flows/order-customer.flow.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：定义匿名 Pick Up 双单完整录制路径与证据 |
| 12 | POS-15643 | POS-15643 点单页面菜单--类，带option的类 | Option | 已等价覆盖 | tests/py-migrate/order.service.spec.ts:901；[POS-15643 POS-15758 POS-15759] 应能在分类菜品上选择 option 和二级 option 并在 Recall 正确回显；关键断言：点单页与 Recall 的菜品 additions 均等于 `[free option, free suboption]`，Recall 菜品价格等于点单页价格且订单仅有该菜 | 无需新增 | — | 2026-07-14：完整审计测试、helper 与 Page DOM |
| 13 | POS-15737 | POS-15737 点单界面菜单--类，类的中文展示 | 菜单与语言 | 需要录制 | 最小录制路径：从 POS 首页建立员工上下文，切换中文，进入 To Go，读取类别列表并选择目标中文类别，添加“蒙古鸡”、保存后在 Recall 回查，最后返回首页恢复默认语言；保留证据：语言弹层/选中态、类别按钮/当前类别 DOM，语言持久化或切换请求、菜单响应中的类别中英文名与菜品归属、订单保存响应；最终断言：`tests/py-migrate/order.service.spec.ts` 断言目标类别中文名、菜品中文名及 Recall 名称/价格；职责：`pages/home.page.ts` 负责语言切换，`pages/order-dishes/order-dishes-menu.section.ts` 负责类别列表/选中态，`flows/language.flow.ts` 负责编排与 finally 恢复 | `pages/home.page.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/language.flow.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：定义中文类别完整录制路径与证据 |
| 14 | POS-15758 | POS-15758 点单界面菜单--option 创建类的option,包含二级option | Option | 已等价覆盖 | tests/py-migrate/order.service.spec.ts:901；[POS-15643 POS-15758 POS-15759] 应能在分类菜品上选择 option 和二级 option 并在 Recall 正确回显；关键断言：点单页与 Recall 的菜品 additions 均等于 `[free option, free suboption]`，Recall 菜品价格等于点单页价格且订单仅有该菜 | 无需新增 | — | 2026-07-14：完整审计测试、helper 与 Page DOM |
| 15 | POS-15759 | POS-15759 点单界面菜单--option 创建类的option,包含二级option，点单时选择了类的option，未选二级option | Option | 需要录制 | 最小录制路径：从 POS 首页进入 To Go，切到带类级 nested option 的真实类别/菜品，选择一级 option 后明确跳过二级 option，完成面板离开/保存并在 Recall 回查；保留证据：一级选择后出现的二级区域、跳过/关闭/确认控件与选中态 DOM，菜单响应的父子 option 关系、保存请求中仅一级 option 的 payload、Recall additions DOM；最终断言：`tests/py-migrate/order.service.spec.ts` 断言点单页与 Recall 仅包含一级 option 且金额符合配置；职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责显式跳过二级 option 的页面动作，`flows/order-dishes.flow.ts` 负责类级 option 完整保存回查 | `pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：确认可选参数不能证明跳过二级的真实契约 |
| 16 | POS-15760 | POS-15760 点单界面菜单--option 创建菜的option,包含二级option，点单时选择了菜的option，未选二级option | Option | 需要录制 | 最小录制路径：从 POS 首页进入 To Go，选择带菜级 nested option 的真实菜品，选择一级菜级 option、跳过二级并保存，Recall 按订单号回查；保留证据：菜级 option 面板与二级区域/跳过控件 DOM，菜单响应的菜品-option 父子关系、订单请求中仅一级 option 的 payload、两页 additions DOM；最终断言：`tests/py-migrate/order.service.spec.ts` 断言只回显一级菜级 option 且价格正确；职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责菜级 option/跳过动作，`flows/order-dishes.flow.ts` 负责下单保存回查，`test-data/order-service.ts` 固化真实 ID/名称 | `pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：定义菜级一级选中二级跳过录制证据 |
| 17 | POS-15761 | POS-15761 点单界面菜单--option 创建菜的option，点单时选择了菜的option | Option | 需要录制 | 最小录制路径：从 POS 首页进入 To Go，定位带单层菜级 option 的真实菜品，选择目标 option、保存并按订单号在 Recall 回查；保留证据：菜品卡与菜级 option 面板/选中态 DOM，菜单响应中的 item-option 绑定、订单保存请求的 option payload、点单页和 Recall additions DOM；最终断言：`tests/py-migrate/order.service.spec.ts` 断言两页 option 名称和价格与配置一致；职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责菜级 option 选择/读取，`flows/order-dishes.flow.ts` 负责保存回查，`test-data/order-service.ts` 固化真实菜品和 option | `pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：定义单层菜级 option 完整录制证据 |
| 18 | POS-15762 | POS-15762 点单界面菜单--option 创建菜的option，点单时未选择菜的option | Option | 需要录制 | 最小录制路径：从 POS 首页进入 To Go，选择带可选菜级 option 的真实菜品，不选任何 option，使用真实关闭/跳过动作完成点单、保存并按订单号在 Recall 回查；保留证据：可选规则、面板关闭/跳过控件与无选中态 DOM，菜单响应中的 required/min 规则、订单请求无 option payload、两页无 additions DOM；最终断言：`tests/py-migrate/order.service.spec.ts` 断言订单可保存且点单页/Recall 均无该菜 option；职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责跳过/关闭与无选中读取，`flows/order-dishes.flow.ts` 负责保存回查，`test-data/order-service.ts` 固化可选规则数据 | `pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：定义菜级 option 全跳过完整录制证据 |
| 19 | POS-15763 | POS-15763 点单界面菜单--option 创建菜的option,包含二级option，点单时选择了菜的option，和二级option | Option | 需要录制 | 最小录制路径：从 POS 首页进入 To Go，选择带菜级 nested option 的真实菜品，依次选择一级和二级 option、保存并按订单号在 Recall 回查；保留证据：一级/二级面板、父子切换和选中态 DOM，菜单响应的 item-option-suboption 关系、保存请求中的两级 option ID/顺序、两页 additions DOM；最终断言：`tests/py-migrate/order.service.spec.ts` 断言点单页与 Recall 按实际顺序回显两级 option 且价格正确；职责：`pages/order-dishes/order-dishes-menu.section.ts` 负责两级菜级 option 选择/读取，`flows/order-dishes.flow.ts` 负责保存回查，`test-data/order-service.ts` 固化父子数据 | `pages/order-dishes/order-dishes-menu.section.ts`、`flows/order-dishes.flow.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` | 待 Task 6 分配 | 2026-07-14：定义菜级 nested option 完整录制证据 |
| 20 | POS-16303 | POS-16303 点单页面订单-订单底部功能--平分订单 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 21 | POS-16314 | POS-16314 点单页面订单-订单底部功能--拖动分单 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 22 | POS-16315 | POS-16315 点单页面订单-订单底部功能--按座位分单 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 23 | POS-16316 | POS-16316 点单页面订单-订单底部功能--自定义分单 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 24 | POS-16318 | POS-16318 点单页面订单-订单底部功能--分单 撤销分单 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 25 | POS-16325 | POS-16325 点单页面订单-订单底部功能--分单，平分菜 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 26 | POS-16324 | POS-16324 点单页点击分单后支付部分子单，查看订单信息 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 27 | — | test_open_food_keyboard_multi_language | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 28 | POS-28674 | POS-28674 特殊价格的菜-设置50%折扣，保存订单 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 29 | POS-30575 | POS-30575：delivery点单，输入用户信息，进入点单页面点击info,info信息预输入的一致 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 30 | POS-31045 | POS-31045：选择的套餐子菜包含多个option，点单页面连续删除option正常 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 31 | POS-30762 | POS-30762：切换pos菜单模式后，搜索检查，默认搜索菜品 Broccoli Garlic Sauce | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 32 | POS-31662 | POS-31662：点单页面，选择菜品，点击modify，添加任意global option，点击add，新增数量成功，页面右侧继续展示modify页面 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 33 | POS-31663 | POS-31663：点单页面，选择菜品，点击modify，添加任意global option，点击count，增加数量，新增数量成功，页面右侧继续展 示modify页面，点击count修改数量为0，点单列表不再展示该global option，页面右侧继续展示modify页面 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 34 | POS-31664 | POS-31664：点单页面，选择菜品，点击modify，添加任意global option，点击count，增加数量为2，页面右侧继续展示modify页 面，点击reduce，页面右侧继续展示modify页面，减少至0，点单列表不再展示该global option，页面右侧继续展示modify页面 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 35 | — | 下单页和订单详情卡片上展示用户信息 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 36 | POS-33447, POS-33456 | POS-33447：Search Menu设置关闭，进入点单页面，页面不再展示搜索输入框，页面展示无违和 POS-33456：Search Menu设置开启，recall进入订单编辑页面，页面展示搜索输入框，可正常搜索，默认搜索菜品Broccoli Garlic Sauce | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 37 | POS-32905 | POS-32905 点单，菜的总数累加为整数，count不带小数点，保存订单成功 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 38 | POS-33110 | POS-33110 pos点单，点单页面加小费，输入的小费金额大于订单total的50%，弹框提示，点击yes，加小费成功 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 39 | POS-33122 | POS-33122 pos点单，信用卡全额付款，付款后加小费，输入的小费金额大于订单total的50%，弹框提示，点击yes，加小费成功 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 40 | POS-34106 | POS-34106 点单页面，礼品卡实体卡新增页面，手机号输入框，手机号输入正确，可新建卡成功 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 41 | POS-34873 | POS-34873 用户无Edit Order->Void Printed Item权限，删除hold的菜品（reduce删除），输入有权限的密码，可删除成功 系统中在staff中预置了用户1（非boss权限），以防与其他用户冲突 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 42 | POS-35325 | POS-35325 用户无Edit Order->Void Printed Item权限，删除延迟送厨的菜品（count数量减少），输入有权限的密码，可删除成功 系统中在staff中预置了用户1（非boss权限），以防与其他用户冲突 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 43 | POS-34895 | POS-34895 设置不自动合并相同菜，点单页面选中相同菜，1菜1行，不合并 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 44 | POS-34903 | POS-34903 设置相同菜合并显示(状态一致的)，已经存在不含有option的菜（已送厨），新加菜分开显示 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 45 | POS-34910 | POS-34910 设置相同菜合并显示(包含已送厨），相同菜已送厨，编辑后继续加相同菜，加入到已送厨的一行， 保持合并展示，显示出 X In Kitchen，菜品字体红色 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 46 | POS-34842 | POS-34842 Automatically redirect after reduce items开关关闭，相连两个菜属于不同类别，当前选中菜品减到没有时，停留 原category | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 47 | POS-33186 | POS-33186 点单，修改菜的数量为小于1的小数，减菜正常 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 48 | POS-33241 | POS-33241 点单，包含小数数量的菜，拖拽分单正常，母单和子单菜的小数数量展示正常，价格正确 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 49 | POS-33244 | POS-33244 点单，包含小数数量的菜，合单，订单菜的数量和价格正确 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 50 | POS-33600 | POS-33600 点单，选择指定价格的菜，修改菜的数量为指定小数，保存订单成功 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 51 | POS-33600 | POS-33600 点单，选择指定价格的菜，修改菜的数量为指定小数，保存订单成功 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 52 | POS-35129 | POS-35129 点单，选择指定价格的菜，修改菜的数量为指定小数，保存订单成功 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 53 | POS-35660 | POS-35660 开启相同菜合并展示开关，点单，修改菜的数量为小数，给菜添加调味正常 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 54 | POS-22640 | POS-22640 自定义类型-POS点单点击自定义类型 Delivery，点单，打单成功 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 55 | POS-36286 | POS-36286 POS首页delivery下单，添加用户信息进入订单页面，点击退出直接退出点单页 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 56 | POS-36255 | POS-36255 菜名名称与number（如均为AA）相同时，点单页面搜索只能搜到一个AA | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 57 | POS-37804 | POS-37804 无note权限用户，套餐子菜加note出权限提示 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 58 | — | 必选类功能优化，未满足条件时无法提交，且自动跳转 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 59 | — | category未勾选“限制折扣”导致该category下所有菜品可以参与整单按比例加收 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 60 | — | 新UI点单页面，category正常展示配置的POS NAME | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 61 | — | 套餐的子菜支持改价 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 62 | — | 按菜分单后子单打折，打折界面整单金额检查 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 63 | — | 自定义类型-报表显示Report-Overview-预览显示自定义类型的报表数据-数据正确 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 64 | — | 系统语言为中文，点单搜索框输入菜的首字母返回对应的菜 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 65 | — | 套餐设置display all one time，子菜不可重复选，规则设置max，点单保存combo后，可正常编辑，修改子菜 | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
| 66 | — | combo子菜没有option，选择子菜返回主菜可正常选择option | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |

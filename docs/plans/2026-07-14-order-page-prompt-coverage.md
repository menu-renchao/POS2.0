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

## 汇总

| 已等价覆盖 | 待补断言 | 可直接实现 | 需要录制 | 产品异常 | 环境阻塞 | 总数 |
|---:|---:|---:|---:|---:|---:|---:|
| 2 | 5 | 3 | 9 | 0 | 0 | 66 |

## 明细

| 编号 | Jira | 标题 | 业务域 | 状态 | 覆盖或缺口证据 | 计划落点 | 录制编号 | 最近验证 |
|---:|---|---|---|---|---|---|---|---|
| 1 | POS-15602 | POS-15602 点单页面菜单---组---切换组 | 菜单与语言 | 待补断言 | tests/py-migrate/order.service.spec.ts:44 的候选用例经 `OrderDishesFlow.addRegularDish` 实际点击菜单组和类别，但最终只断言 Recall 菜名与价格，缺少切换后当前组为“自动化菜单组”的可观察断言；目标：在 `pages/order-dishes/order-dishes-menu.section.ts` 增加当前组读取/断言，并在 `tests/py-migrate/order.service.spec.ts` 补断言 | `pages/order-dishes/order-dishes-menu.section.ts`、`tests/py-migrate/order.service.spec.ts` | — | 2026-07-14：完整审计候选测试与 Page/Flow |
| 2 | POS-15605 | POS-15605 点单页面菜单--组 中文展示 | 菜单与语言 | 需要录制 | `pages/home.page.ts` 仅能确认语言按钮可见，`pages/order-dishes/order-dishes-menu.section.ts` 无菜单组列表读取；恢复条件：录制中文切换弹层、中文组名、组列表稳定 DOM 及恢复默认语言路径 | `pages/home.page.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/language.flow.ts` | 待 Task 6 分配 | 2026-07-14：确认语言切换与组列表 DOM 契约缺失 |
| 3 | POS-15641 | POS-15641 点单页面菜单--类--组下多个类时，进行类切换 | 菜单与语言 | 待补断言 | tests/py-migrate/order.service.spec.ts:50 的候选用例经 `OrderDishesFlow.addRegularDish` 实际切换组和类别，但最终只断言 Recall 菜名与价格，缺少多类别切换后当前类别正确的断言；目标：在 `pages/order-dishes/order-dishes-menu.section.ts` 增加当前类别读取/断言，并在 `tests/py-migrate/order.service.spec.ts` 补断言 | `pages/order-dishes/order-dishes-menu.section.ts`、`tests/py-migrate/order.service.spec.ts` | — | 2026-07-14：完整审计候选测试与 Page/Flow |
| 4 | — | Seperate the same dishes开关开启，订单送厨后编辑页面，选择菜品，点击加1，存单后检查订单上的税率正确 | 菜单与语言 | 待补断言 | tests/py-migrate/order.service.spec.ts:203 已覆盖堂食无桌、保存、Recall 编辑加 1 和再次保存，但仅断言税率比例近似不变及 Subtotal 一致，未断言提示词要求的编辑前税额 `$1.20`、编辑后税额 `$1.80`；目标：在该用例补固定税额断言并绑定对应测试数据/开关前置 | `tests/py-migrate/order.service.spec.ts`、`test-data/order-service.ts` | — | 2026-07-14：完整审计税额测试及其读数 API |
| 5 | — | 后台点单前确认客户信息，客户姓名必填，电话必填，点支付按钮后弹出输入电话号码和客户姓名的弹框 | 客户信息 | 需要录制 | 当前无“点单前确认客户信息”后台配置 API，也无支付前姓名/电话必填弹框 Page/Flow；恢复条件：录制配置入口与恢复值、点击 Pay 后弹框稳定 DOM、缺字段提示及完整信息提交后的消失条件 | `pages/order-dishes/order-dishes-customer.dialog.ts`、`flows/order-customer.flow.ts` | 待 Task 6 分配 | 2026-07-14：确认配置与客户必填弹框契约缺失 |
| 6 | — | 没有删菜权限的用户点单后删菜，弹出权限提示框提示没有权限，输入正确的密码可正常删菜 | 权限与 Void | 需要录制 | `pages/order-dishes/order-dishes-menu.section.ts` 仅有普通减菜动作，缺已送厨菜品 Void、无权限提示、授权口令和删菜原因 DOM；恢复条件：录制受限员工/授权员工数据、权限弹框与原因弹框稳定 DOM、授权后菜品状态 | `pages/order-dishes/order-dishes-void.section.ts`、`flows/employee-permission.flow.ts` | 待 Task 6 分配 | 2026-07-14：确认菜品 Void 权限链路缺失 |
| 7 | — | 菜品操作改价时可以选择单菜折扣 | 改价折扣备注 | 待补断言 | tests/py-migrate/split-order-operation.spec.ts:2711 已经对单菜应用 10% 折扣，但只断言折扣明细 `Charge(10%)` 的出现/清除，且已知问题注解明确未校验订单总额；缺少提示词要求的 `价格1 × 0.9 = 价格2` 数值断言，目标为该 spec 的单菜折扣场景 | `tests/py-migrate/split-order-operation.spec.ts` | — | 2026-07-14：完整审计单菜折扣测试与 Charge Flow |
| 8 | — | 点Modify可以输入菜品的备注，保存订单后，菜品后面的备注信息正确 | 改价折扣备注 | 待补断言 | tests/py-migrate/split-order-operation.spec.ts:2824 已通过 Modify 添加自定义调味并保存，但最终仅比较复制前后总额，未读取 Recall 菜品 additions 校验备注文本；目标：在该 spec 或 `tests/py-migrate/order.service.spec.ts` 补保存后备注回显断言 | `tests/py-migrate/split-order-operation.spec.ts`、`tests/py-migrate/order.service.spec.ts` | — | 2026-07-14：完整审计 Modify、保存和 Recall 能力 |
| 9 | — | 点单，加小费，平分订单，合并子单，订单小费金额正常 | 分单与小费 | 可直接实现 | `pages/order-dishes/order-dishes-tip.section.ts` 已有小费输入，`flows/split-order.flow.ts:28` 已有平分，`:171` 已有合并，`pages/recall.page.ts:198` 可读 Tips；真实路径与读数契约完整，可直接新增断言分单后 `1.00`、合并后 `2.00` 的用例 | `tests/py-migrate/order.service.spec.ts` | — | 2026-07-14：核对小费、平分、合并及 Recall 读数 API |
| 10 | — | open Food 点单，不选择任何税，可以成功完成付款 | Open Food | 可直接实现 | `pages/order-dishes/order-dishes-menu.section.ts:345` 已用稳定 Open Food DOM 完成名称/价格输入，`PaymentFlow.payByCash` 已覆盖现金全额结账，`RecallFlow.searchOrders` 可按 `RecallOrderStatuses.paid` 筛选并精确打开订单；不触发税选择即可直接实现并断言 `Paid` | `tests/py-migrate/order.service.spec.ts` | — | 2026-07-14：核对 Open Food、现金支付与 Recall 状态筛选 API |
| 11 | — | 连续创建两个不输入姓名的pick up订单，修改其中一个食客姓名，另一个不受影响 | 客户信息 | 需要录制 | `TakeoutFlow.startPickUpOrder` 只能在新建 Pick Up 时填写信息，当前点单页/Recall 无编辑食客姓名入口；恢复条件：录制两个匿名 Pick Up 的区分字段、食客姓名编辑入口与稳定 DOM、修改后两单各自姓名的读取位置 | `pages/order-dishes/order-dishes-customer.dialog.ts`、`flows/order-customer.flow.ts` | 待 Task 6 分配 | 2026-07-14：确认 Pick Up 食客姓名编辑契约缺失 |
| 12 | POS-15643 | POS-15643 点单页面菜单--类，带option的类 | Option | 已等价覆盖 | tests/py-migrate/order.service.spec.ts:901；[POS-15643 POS-15758 POS-15759] 应能在分类菜品上选择 option 和二级 option 并在 Recall 正确回显；关键断言：点单页与 Recall 的菜品 additions 均等于 `[free option, free suboption]`，Recall 菜品价格等于点单页价格且订单仅有该菜 | 无需新增 | — | 2026-07-14：完整审计测试、helper 与 Page DOM |
| 13 | POS-15737 | POS-15737 点单界面菜单--类，类的中文展示 | 菜单与语言 | 需要录制 | `pages/home.page.ts` 无语言切换动作，`pages/order-dishes/order-dishes-menu.section.ts` 无类别列表/当前类别中文读取；恢复条件：录制中文切换弹层、目标类别中文名、类别列表稳定 DOM 及恢复默认语言路径 | `pages/home.page.ts`、`pages/order-dishes/order-dishes-menu.section.ts`、`flows/language.flow.ts` | 待 Task 6 分配 | 2026-07-14：确认语言切换与类别中文 DOM 契约缺失 |
| 14 | POS-15758 | POS-15758 点单界面菜单--option 创建类的option,包含二级option | Option | 已等价覆盖 | tests/py-migrate/order.service.spec.ts:901；[POS-15643 POS-15758 POS-15759] 应能在分类菜品上选择 option 和二级 option 并在 Recall 正确回显；关键断言：点单页与 Recall 的菜品 additions 均等于 `[free option, free suboption]`，Recall 菜品价格等于点单页价格且订单仅有该菜 | 无需新增 | — | 2026-07-14：完整审计测试、helper 与 Page DOM |
| 15 | POS-15759 | POS-15759 点单界面菜单--option 创建类的option,包含二级option，点单时选择了类的option，未选二级option | Option | 可直接实现 | `pages/order-dishes/order-dishes-menu.section.ts:426` 的 `selectCategoryOption(option, suboption?)` 支持省略二级 option，`tests/py-migrate/order.service.spec.ts:152` 的 round-trip helper 也会在省略时断言仅回显一级 option；真实 DOM 与断言契约完整 | `tests/py-migrate/order.service.spec.ts` | — | 2026-07-14：核对可选 suboption 与两页回显 helper |
| 16 | POS-15760 | POS-15760 点单界面菜单--option 创建菜的option,包含二级option，点单时选择了菜的option，未选二级option | Option | 需要录制 | 现有 `selectCategoryOption` 和 `orderServiceCategoryOptions` 仅由类级 option 实测，缺菜级嵌套 option 菜品数据及其 DOM 区分；恢复条件：录制菜级一级/二级 option 面板、选择一级但不选二级后的保存行为和 Recall additions | `pages/order-dishes/order-dishes-menu.section.ts`、`test-data/order-service.ts` | 待 Task 6 分配 | 2026-07-14：确认菜级 option 数据与 DOM 契约缺失 |
| 17 | POS-15761 | POS-15761 点单界面菜单--option 创建菜的option，点单时选择了菜的option | Option | 需要录制 | 当前没有经实测的菜级 option 菜品、选项名称或独立 Page API；恢复条件：录制菜级 option 面板稳定 DOM、目标菜/option 数据及点单页与 Recall 的预期 additions | `pages/order-dishes/order-dishes-menu.section.ts`、`test-data/order-service.ts` | 待 Task 6 分配 | 2026-07-14：确认菜级 option 数据与 DOM 契约缺失 |
| 18 | POS-15762 | POS-15762 点单界面菜单--option 创建菜的option，点单时未选择菜的option | Option | 需要录制 | 当前没有可识别为“带可选菜级 option”的测试菜，也未确定不选择 option 时如何关闭/离开面板及保存后的预期；恢复条件：录制跳过菜级 option 的真实交互、稳定 DOM 和 Recall 无 additions 的结果 | `pages/order-dishes/order-dishes-menu.section.ts`、`test-data/order-service.ts` | 待 Task 6 分配 | 2026-07-14：确认跳过菜级 option 的路径与预期缺失 |
| 19 | POS-15763 | POS-15763 点单界面菜单--option 创建菜的option,包含二级option，点单时选择了菜的option，和二级option | Option | 需要录制 | 类级 nested option 测试不能证明菜级 nested option 的入口和回显；恢复条件：录制菜级一级/二级 option 的稳定 DOM、目标数据，以及选择两级后点单页和 Recall additions 的实际顺序 | `pages/order-dishes/order-dishes-menu.section.ts`、`test-data/order-service.ts` | 待 Task 6 分配 | 2026-07-14：确认菜级 nested option 数据与 DOM 契约缺失 |
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

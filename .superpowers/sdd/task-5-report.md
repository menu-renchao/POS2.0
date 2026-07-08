状态：DONE_WITH_CONCERNS

改动文件：
- `flows/recall.flow.ts`
- `pages/recall/recall-order-details.dialog.ts`
- `tests/py-migrate/split-order-operation.spec.ts`
- `docs/superpowers/plans/2026-07-08-split-order-operation-regression.md`
- `.superpowers/sdd/task-5-report.md`

提交 hash：
- `e792e9e`：新增 POS-19368 测试与 RecallFlow tips 封装。
- 待提交：移除误回流的 POS-19365、补 Recall Tips 菜单/弹窗等待、更新计划与报告。

运行命令与结果：
1. `npx.cmd tsc --noEmit`
   - 结果：通过。
2. `npm.cmd test -- tests/py-migrate/split-order-operation.spec.ts -g "POS-19368"`
   - 结果：业务流程跑完，仅在浏览器上下文关闭时失败。
   - 失败摘要：`browserContext.close: spawn EPERM`。
   - 观察：失败快照显示修改后另一个子单详情仍可读取 Tips，未出现业务断言失败。

修复记录：
- 按用户要求继续暂缓 POS-19365，移除了 Task 5 提交中误回流的 POS-19365 用例。
- 19368 改用平分订单生成两个子单，不依赖座位显示/座位分单。
- `addTwoRegularDishes(...)` 不再依赖当前页面不可见的 Add Line 按钮。
- Recall 订单详情 More 菜单中的 Tips 按钮改为条件等待。
- Tips 输入弹窗改为支持“包含 Tips 标题但 dialog 名称为订单号”的真实 DOM。

担忧：
- 当前环境仍稳定出现 `browserContext.close: spawn EPERM` 清理失败，导致 Playwright 命令退出码为失败；该问题与本用例业务断言无关，但会影响自动化命令结果。

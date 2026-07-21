# Jenkins UI 流水线测试范围设计

## 目标

`Jenkinsfile.ui` 只展示并执行 UI 自动化测试，不展示或执行 `tests/api` 下的 API 测试。UI 测试为准备数据而使用的 API 初始化与辅助代码继续保留。

## 范围边界

- UI 测试范围以 Playwright `py-migrate` 项目及 `tests/py-migrate` 目录为准。
- 用例树生成、手动筛选和定时构建都应用相同的 UI 范围。
- `all` 表示全部 UI 测试，不再表示仓库内全部 Playwright 测试。
- 文件参数只接受 `tests/py-migrate/**/*.spec.ts`；API 测试路径和其他目录路径必须被拒绝。
- 不删除或禁用 UI 用例依赖的全局初始化、接口客户端或数据准备逻辑。
- `Jenkinsfile.api` 和 API 测试本身不在本次修改范围内。

## 实现方案

用例树生成命令显式传入 `tests/py-migrate` 和 `--project=py-migrate`，使缓存中的文件与用例标题只来自 UI 项目。实际测试命令同时限定目标目录和 Playwright 项目，形成生成阶段与执行阶段的双重隔离。

`Jenkinsfile.ui` 的动态参数回退扫描固定在 `tests/py-migrate`。运行阶段校验用户选择的文件必须位于该目录，并在未选择具体文件时默认执行全部 UI 用例。

为支持用例树生成命令传入 Playwright 过滤参数，生成脚本应把收到的命令行参数透传给 `playwright test --list`。未传参数时保持现有行为，避免影响其他调用方。

## 验证

- 生成 UI 用例树后，缓存中不存在 `tests/api` 路径或 `api` 套件。
- Playwright 列表命令只列出 `py-migrate` 项目下的测试。
- 静态检查确认 `Jenkinsfile.ui` 的执行命令包含 UI 项目限定，且文件校验拒绝 `tests/api`。
- 运行项目现有的 TypeScript/脚本测试，确认参数透传没有破坏生成脚本或其他配置。

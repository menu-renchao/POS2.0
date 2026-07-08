# 系统配置通用接口设计

## 背景

POS 自动化需要在测试前或测试过程中切换系统配置，例如 `IS_SKIP_TABLE` 和 `OVERTIME_WORNING`。抓包请求可以直接调用 `/api/system/configuration/update`，但浏览器 Cookie、固定配置 ID 和手写 payload 不适合长期维护。

## 目标

- 通过现有 API 登录体系调用系统配置接口，不保存浏览器 Cookie。
- 使用 `/api/system/configuration/list?fetchDetails=true&adminRequest=true` 动态读取 `name -> id/dataType/value` 映射。
- 对测试代码暴露按配置名批量更新的语义入口。
- 更新后检查业务响应里的 `failedSystemConfigurationIds`，必要时再读回验证。
- 支持返回恢复函数，方便用例结束后恢复旧配置。

## 设计

新增 `SystemConfigurationApiClient`，只封装真实接口：

- `listSystemConfigurations(params)`
- `updateSystemConfigurations(data)`
- `fetchSystemConfiguration(params)`

新增 `SystemConfigurationSetupService`，负责测试友好的配置写入：

- `listIndex()` 读取并缓存配置索引。
- `updateManyByName(values, options)` 根据配置名批量更新。
- `updateByName(name, value, options)` 更新单个配置。

服务层从列表响应中定位配置项，自动补齐 `id/name/dataType`，并把布尔、整数、浮点数、日期和字符串值转为接口接受的 `value`。更新响应如果包含失败 ID，则抛出明确错误。默认 `userAuth.userId` 为 `1`，调用方可覆盖。

## 非目标

- 不维护静态配置 ID 表。
- 不直接使用抓包里的 `JSESSIONID` 或 `remember-me`。
- 不通过深链页面或 UI 操作修改系统配置。

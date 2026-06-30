# API 测试目录说明

`tests/api` 只放可执行的 Playwright API 测试。按用途分目录：

- `business/`：真实业务接口测试。会访问测试环境 API，覆盖只读链路或在 `API_ENABLE_DESTRUCTIVE=true` 时执行写接口闭环。
- `contracts/`：契约和覆盖矩阵测试。用于确认 Swagger 首批接口、覆盖等级、用例文件映射和契约烟测入口。
- `unit/`：API 自动化自身的工具测试。只验证配置解析、客户端路径、响应信封、资源登记、测试数据工厂和 fixture，不代表真实业务接口跑通。
- `maintenance/`：维护类接口测试。用于清理自动化残留数据，默认不作为业务覆盖入口。

新增接口测试时优先判断是否会真实调用业务接口。真实调用放 `business/`；只验证自动化框架能力放 `unit/`；只验证接口契约或覆盖矩阵放 `contracts/`；清理脚本放 `maintenance/`。

# API 支撑代码目录说明

`api/` 是 API 自动化支撑代码，不是 Playwright spec 目录。

- `clients/`：按业务域封装接口调用方法。每个方法保留 Swagger path 和用途注释，测试用例通过 client 发请求。
- `core/`：API 自动化基础能力，包括认证、请求上下文、响应信封校验、资源登记和测试 ID 生成。
- `contracts/`：接口覆盖矩阵和契约覆盖数据。这里描述哪些接口由哪些 spec 覆盖，不直接执行测试。

真实接口用例放在 `tests/api/business/`。工具和矩阵的单元测试放在 `tests/api/unit/` 或 `tests/api/contracts/`。

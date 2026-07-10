# API Endpoint 测试接入说明

Endpoint 测试用于验证单个接口的正向、异常和边界场景。业务链路回归仍放在 `tests/api/business/`。

## 新增接口步骤

1. 在 `api/contracts/first-batch-api-cases.ts` 确认接口覆盖等级是 `positive-business` 或 `positive-crud`。
2. 在对应 `tests/api/endpoints/<domain>/` 文件中新增 `describe` 或 `test`。
3. 使用 `tests/api/support/endpoint-fixture.ts` 导出的 `test` 和 `expect`。
4. 如需前置数据，优先使用 `endpointResources`。
5. 调用领域 client，不直接拼接 URL。
6. 使用 `expectApiOk`、`expectApiRejected`、`expectApiBusinessError` 或 `expectHttpStatus` 断言响应。异常场景优先用 `expectApiRejected`，它同时支持 HTTP 非 2xx 和业务 envelope `code != 0`。
7. 手工删除资源后调用 `resourceRegistry.markCleaned(type, id)`，避免 teardown 重复清理。
8. 更新覆盖矩阵的 `endpointStatus` 和 `endpointSpecFile`。

## 模板

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectApiRejected } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('领域名称 endpoint', () => {
  test(toEndpointTitle('POST', '/api/example/save', '应能保存示例资源'), async ({
    exampleApi,
    endpointResources,
  }) => {
    const resource = await endpointResources.createExampleResource();

    await test.step('调用 POST /api/example/save', async () => {
      await expectApiOk(
        await exampleApi.saveExample({ id: resource.id }),
        { method: 'POST', path: '/api/example/save' },
      );
    });
  });

  test(toEndpointTitle('POST', '/api/example/save', '缺少必填字段应返回异常'), async ({
    exampleApi,
  }) => {
    await test.step('提交空示例资源并校验拒绝响应', async () => {
      await expectApiRejected(
        await exampleApi.saveExample({}),
        { method: 'POST', path: '/api/example/save' },
      );
    });
  });
});
```

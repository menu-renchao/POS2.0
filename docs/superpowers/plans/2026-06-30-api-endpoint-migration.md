# API Endpoint Test Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Playwright endpoint API test framework and migrate the first positive real API endpoints into independently maintainable endpoint specs.

**Architecture:** Keep existing `tests/api/business/` as business-chain regression. Add `tests/api/endpoints/` for one-endpoint-focused specs and `tests/api/support/` for shared endpoint assertions, read-model helpers, fixtures, and resource builders. Endpoint specs import domain clients through a dedicated endpoint fixture and use typed helpers so future interfaces can be added by copying a small, stable pattern.

**Tech Stack:** Playwright Test, TypeScript, existing API clients in `api/clients/`, existing API login/context in `api/core/`, existing resource cleanup through `ResourceRegistry`.

---

## File Structure

- Create `tests/api/support/endpoint-case.ts`: endpoint identity types, title formatter, and reusable metadata shape.
- Create `tests/api/support/endpoint-assertions.ts`: response parsing, success/business-error assertions, list data assertions, and ID assertions with method/path-aware failure messages.
- Create `tests/api/support/endpoint-read-model.ts`: generic recursive ID/name extraction helpers currently duplicated in business specs.
- Create `tests/api/support/endpoint-resources.ts`: minimal resource builders for tax, discount, role, menu, menu group, category, sale item, order, and payment setup.
- Create `tests/api/support/endpoint-fixture.ts`: endpoint-specific Playwright fixture that extends the existing API fixture with `endpointResources`.
- Create `tests/api/support/README.md`: human-readable template for adding a new endpoint.
- Create endpoint specs under `tests/api/endpoints/` for admin config, menu, sale item/SPU, order, and payment.
- Modify `api/contracts/first-batch-api-cases.ts`: keep existing `specFile` compatibility and add endpoint coverage fields.
- Modify `tests/api/contracts/api-contract-matrix.unit.spec.ts`: assert endpoint fields are valid and mapped files exist when covered.
- Modify `docs/api/112接口覆盖映射.md`: add endpoint coverage status and endpoint spec mapping.
- Modify `tests/api/README.md`: document `endpoints/` purpose and command.

---

### Task 1: Endpoint Identity And Assertions

**Files:**
- Create: `tests/api/support/endpoint-case.ts`
- Create: `tests/api/support/endpoint-assertions.ts`
- Create: `tests/api/support/endpoint-read-model.ts`
- Test: `tests/api/unit/api-endpoint-support.unit.spec.ts`

- [ ] **Step 1: Write endpoint support unit tests**

Create `tests/api/unit/api-endpoint-support.unit.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { toEndpointTitle, type EndpointIdentity } from '../support/endpoint-case';
import {
  expectArrayData,
  expectResourceId,
  parseApiJson,
} from '../support/endpoint-assertions';
import {
  extractFirstResourceId,
  findResourceIdByName,
} from '../support/endpoint-read-model';

test.describe('Endpoint 测试支撑工具', () => {
  test('应能生成包含方法和路径的 endpoint 标题', () => {
    expect(toEndpointTitle('POST', '/api/tax/save', '应能保存税费')).toBe(
      'POST /api/tax/save 应能保存税费',
    );
  });

  test('应能解析 JSON 响应并保留 endpoint 上下文', async () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };
    const response = {
      status: () => 200,
      json: async () => ({ code: 0, msg: 'success', data: [{ id: 1 }] }),
    };

    const body = await parseApiJson(response, identity);

    expect(body).toEqual({ code: 0, msg: 'success', data: [{ id: 1 }] });
  });

  test('应能从列表或分页容器中读取数组数据', () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };

    expect(expectArrayData({ code: 0, msg: 'success', data: [{ id: 1 }] }, identity)).toEqual([
      { id: 1 },
    ]);
    expect(
      expectArrayData({ code: 0, msg: 'success', data: { records: [{ id: 2 }] } }, identity),
    ).toEqual([{ id: 2 }]);
  });

  test('应能递归提取资源 ID 和按名称查找 ID', () => {
    const value = {
      data: {
        records: [
          { id: 11, name: 'AT_A' },
          { roleId: 12, roleName: 'AT_B' },
        ],
      },
    };

    expect(extractFirstResourceId(value)).toBe(11);
    expect(findResourceIdByName(value, 'AT_B')).toBe(12);
  });

  test('缺少资源 ID 时应输出 endpoint 上下文', () => {
    const identity: EndpointIdentity = { method: 'POST', path: '/api/tax/save' };

    expect(() => expectResourceId({ data: {} }, identity)).toThrow(
      'POST /api/tax/save 未能从响应中提取资源 ID',
    );
  });
});
```

- [ ] **Step 2: Run the failing endpoint support unit test**

Run:

```powershell
npx playwright test tests/api/unit/api-endpoint-support.unit.spec.ts --project=api --reporter=line
```

Expected: fail because `tests/api/support/endpoint-case.ts`, `endpoint-assertions.ts`, and `endpoint-read-model.ts` do not exist.

- [ ] **Step 3: Implement endpoint identity helpers**

Create `tests/api/support/endpoint-case.ts`:

```ts
export type EndpointMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type EndpointIdentity = {
  method: EndpointMethod;
  path: string;
};

export type EndpointCaseMetadata = EndpointIdentity & {
  group: string;
  title: string;
};

export function toEndpointTitle(
  method: EndpointMethod,
  path: string,
  action: string,
): string {
  return `${method} ${path} ${action}`;
}

export function toEndpointLabel(identity: EndpointIdentity): string {
  return `${identity.method} ${identity.path}`;
}
```

- [ ] **Step 4: Implement endpoint read-model helpers**

Create `tests/api/support/endpoint-read-model.ts`:

```ts
import type { ResourceId } from '../../../api/core/resource-registry';

export function extractFirstResourceId(value: unknown): ResourceId | undefined {
  return extractIdFromValue(value, new Set<object>());
}

export function findResourceIdByName(value: unknown, name: string): ResourceId | undefined {
  return findResourceIdByNameValue(value, name, new Set<object>());
}

function findResourceIdByNameValue(
  value: unknown,
  name: string,
  seen: Set<object>,
): ResourceId | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = findResourceIdByNameValue(item, name, seen);
      if (id !== undefined) {
        return id;
      }
    }
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (recordHasName(value, name)) {
    return extractIdFromRecord(value);
  }

  for (const item of Object.values(value)) {
    const id = findResourceIdByNameValue(item, name, seen);
    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function extractIdFromValue(value: unknown, seen: Set<object>): ResourceId | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = extractIdFromValue(item, seen);
      if (id !== undefined) {
        return id;
      }
    }
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  const directId = extractIdFromRecord(value);
  if (directId !== undefined) {
    return directId;
  }

  for (const item of Object.values(value)) {
    const id = extractIdFromValue(item, seen);
    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function recordHasName(record: Record<string, unknown>, name: string): boolean {
  return Object.entries(record).some(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    return normalizedKey.endsWith('name') && value === name;
  });
}

function extractIdFromRecord(record: Record<string, unknown>): ResourceId | undefined {
  for (const key of ['id', 'taxId', 'discountId', 'roleId', 'menuId', 'groupId', 'categoryId', 'saleItemId', 'orderId', 'paymentId']) {
    const value = record[key];
    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 5: Implement endpoint assertions**

Create `tests/api/support/endpoint-assertions.ts`:

```ts
import { expect, type APIResponse } from '@playwright/test';
import {
  buildApiFailureMessage,
  expectResponseEnvelope,
  summarizeJson,
  type ApiEnvelope,
} from '../../../api/core/api-response';
import type { ResourceId } from '../../../api/core/resource-registry';
import type { EndpointIdentity } from './endpoint-case';
import { extractFirstResourceId } from './endpoint-read-model';

type ResponseLike = Pick<APIResponse, 'status' | 'json'>;

export async function parseApiJson<T = unknown>(
  response: ResponseLike,
  identity: EndpointIdentity,
): Promise<ApiEnvelope<T>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(
      buildApiFailureMessage({
        method: identity.method,
        path: identity.path,
        status: response.status(),
        responseSummary: `JSON 解析失败: ${String(error)}`,
      }),
    );
  }

  try {
    expectResponseEnvelope(body);
  } catch (error) {
    throw new Error(
      buildApiFailureMessage({
        method: identity.method,
        path: identity.path,
        status: response.status(),
        responseSummary: summarizeJson(body),
      }),
    );
  }

  return body as ApiEnvelope<T>;
}

export async function expectApiOk<T = unknown>(
  response: APIResponse,
  identity: EndpointIdentity,
  requestData?: unknown,
): Promise<ApiEnvelope<T>> {
  const body = await parseApiJson<T>(response, identity);
  const status = response.status();

  expect(
    status,
    buildApiFailureMessage({
      method: identity.method,
      path: identity.path,
      status,
      requestSummary: requestData === undefined ? undefined : summarizeJson(requestData),
      responseSummary: summarizeJson(body),
    }),
  ).toBeLessThan(500);

  expect(
    body.code,
    buildApiFailureMessage({
      method: identity.method,
      path: identity.path,
      status,
      requestSummary: requestData === undefined ? undefined : summarizeJson(requestData),
      responseSummary: summarizeJson(body),
    }),
  ).toBe(0);

  return body;
}

export async function expectApiBusinessError(
  response: APIResponse,
  identity: EndpointIdentity,
  options: { requestData?: unknown; messageIncludes?: string } = {},
): Promise<ApiEnvelope<unknown>> {
  const body = await parseApiJson(response, identity);

  expect(
    body.code,
    buildApiFailureMessage({
      method: identity.method,
      path: identity.path,
      status: response.status(),
      requestSummary:
        options.requestData === undefined ? undefined : summarizeJson(options.requestData),
      responseSummary: summarizeJson(body),
    }),
  ).not.toBe(0);

  if (options.messageIncludes !== undefined) {
    expect(String(body.msg ?? '')).toContain(options.messageIncludes);
  }

  return body;
}

export async function expectHttpStatus(
  response: APIResponse,
  identity: EndpointIdentity,
  expectedStatus: number,
): Promise<void> {
  expect(
    response.status(),
    buildApiFailureMessage({
      method: identity.method,
      path: identity.path,
      status: response.status(),
      responseSummary: summarizeJson(await response.text()),
    }),
  ).toBe(expectedStatus);
}

export function expectArrayData(
  body: ApiEnvelope<unknown>,
  identity: EndpointIdentity,
): unknown[] {
  const data = body.data;
  if (Array.isArray(data)) {
    return data;
  }

  if (isRecord(data)) {
    for (const key of ['records', 'list', 'items', 'rows']) {
      const value = data[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  throw new Error(`${identity.method} ${identity.path} 响应 data 不是列表或分页列表。`);
}

export function expectResourceId(
  value: unknown,
  identity: EndpointIdentity,
): ResourceId {
  const id = extractFirstResourceId(value);
  if (id === undefined) {
    throw new Error(`${identity.method} ${identity.path} 未能从响应中提取资源 ID。`);
  }

  return id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

- [ ] **Step 6: Run support unit test to verify it passes**

Run:

```powershell
npx playwright test tests/api/unit/api-endpoint-support.unit.spec.ts --project=api --reporter=line
```

Expected: `5 passed`.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add tests/api/support/endpoint-case.ts tests/api/support/endpoint-assertions.ts tests/api/support/endpoint-read-model.ts tests/api/unit/api-endpoint-support.unit.spec.ts
git commit -m "test: add api endpoint support assertions"
```

Expected: commit succeeds.

---

### Task 2: Endpoint Fixture And Admin Config Resources

**Files:**
- Create: `tests/api/support/endpoint-resources.ts`
- Create: `tests/api/support/endpoint-fixture.ts`
- Test: `tests/api/unit/api-endpoint-resources.unit.spec.ts`

- [ ] **Step 1: Write endpoint fixture/resource unit tests**

Create `tests/api/unit/api-endpoint-resources.unit.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import { ResourceRegistry } from '../../../api/core/resource-registry';
import { createEndpointResources } from '../support/endpoint-resources';
import { test } from '../support/endpoint-fixture';

test.describe('Endpoint 资源 fixture', () => {
  test('应注入 endpointResources', async ({ endpointResources }) => {
    expect(endpointResources).toEqual(
      expect.objectContaining({
        createTaxResource: expect.any(Function),
        createDiscountResource: expect.any(Function),
        createRoleResource: expect.any(Function),
      }),
    );
  });
});

test.describe('Endpoint 后台配置资源', () => {
  test('应能构造资源 helper 并保留清理登记入口', async ({ apiRequest }) => {
    const registry = new ResourceRegistry();
    const resources = createEndpointResources({
      adminConfigApi: new AdminConfigApiClient(apiRequest),
      resourceRegistry: registry,
    });

    expect(resources).toEqual(
      expect.objectContaining({
        createTaxResource: expect.any(Function),
        createDiscountResource: expect.any(Function),
        createRoleResource: expect.any(Function),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the failing endpoint resource unit test**

Run:

```powershell
npx playwright test tests/api/unit/api-endpoint-resources.unit.spec.ts --project=api --reporter=line
```

Expected: fail because endpoint fixture and resource factory do not exist.

- [ ] **Step 3: Implement endpoint fixture**

Create `tests/api/support/endpoint-fixture.ts`:

```ts
import { test as apiTest } from '../../../fixtures/api.fixture';
import { createEndpointResources, type EndpointResources } from './endpoint-resources';

type EndpointFixtures = {
  endpointResources: EndpointResources;
};

export const test = apiTest.extend<EndpointFixtures>({
  endpointResources: async (
    {
      adminConfigApi,
      menuApi,
      saleItemApi,
      spuApi,
      orderApi,
      paymentApi,
      resourceRegistry,
    },
    use,
  ) => {
    await use(
      createEndpointResources({
        adminConfigApi,
        menuApi,
        saleItemApi,
        spuApi,
        orderApi,
        paymentApi,
        resourceRegistry,
      }),
    );
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 4: Implement admin config endpoint resources**

Create `tests/api/support/endpoint-resources.ts`:

```ts
import type { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import type { MenuApiClient } from '../../../api/clients/menu-api.client';
import type { OrderApiClient } from '../../../api/clients/order-api.client';
import type { PaymentApiClient } from '../../../api/clients/payment-api.client';
import type { SaleItemApiClient } from '../../../api/clients/sale-item-api.client';
import type { SpuApiClient } from '../../../api/clients/spu-api.client';
import type { ApiRequestData } from '../../../api/clients/client-path';
import type { ApiEnvelope } from '../../../api/core/api-response';
import type { ResourceId, ResourceRegistry } from '../../../api/core/resource-registry';
import { createShortTestName } from '../../../api/core/test-data-id';
import { expectApiOk, expectResourceId } from './endpoint-assertions';
import { findResourceIdByName } from './endpoint-read-model';

export type EndpointResource<TRequest extends ApiRequestData = ApiRequestData> = {
  id: ResourceId;
  name: string;
  request: TRequest;
  body: ApiEnvelope<unknown>;
};

export type EndpointResourceFactoryOptions = {
  adminConfigApi?: AdminConfigApiClient;
  menuApi?: MenuApiClient;
  saleItemApi?: SaleItemApiClient;
  spuApi?: SpuApiClient;
  orderApi?: OrderApiClient;
  paymentApi?: PaymentApiClient;
  resourceRegistry: ResourceRegistry;
};

export type EndpointResources = {
  createTaxResource(): Promise<EndpointResource>;
  createDiscountResource(): Promise<EndpointResource>;
  createRoleResource(): Promise<EndpointResource>;
};

export function createEndpointResources(
  options: EndpointResourceFactoryOptions,
): EndpointResources {
  return {
    createTaxResource: async () => {
      const adminConfigApi = requireAdminConfigApi(options);
      const request = buildTaxRequest(buildEndpointName(options, 'TAX', 24));
      const body = await expectApiOk(
        await adminConfigApi.saveTax(request),
        { method: 'POST', path: '/api/tax/save' },
        request,
      );
      const id = await resolveCreatedId({
        saveBody: body,
        name: request.tax.name,
        list: async () =>
          await expectApiOk(await adminConfigApi.listTaxes(), {
            method: 'GET',
            path: '/api/tax/list',
          }),
      });

      options.resourceRegistry.register({
        type: 'tax',
        id,
        name: request.tax.name,
        cleanupPriority: 20,
        deleteResource: async () => {
          await adminConfigApi.deleteTax({ taxId: id });
        },
      });

      return { id, name: request.tax.name, request, body };
    },
    createDiscountResource: async () => {
      const adminConfigApi = requireAdminConfigApi(options);
      const request = buildDiscountRequest(buildEndpointName(options, 'DSC', 24));
      const body = await expectApiOk(
        await adminConfigApi.saveDiscount(request),
        { method: 'POST', path: '/api/discount/save' },
        request,
      );
      const id = await resolveCreatedId({
        saveBody: body,
        name: request.discount.name,
        list: async () =>
          await expectApiOk(await adminConfigApi.listDiscounts(), {
            method: 'GET',
            path: '/api/discount/list',
          }),
      });

      options.resourceRegistry.register({
        type: 'discount',
        id,
        name: request.discount.name,
        cleanupPriority: 20,
        deleteResource: async () => {
          await adminConfigApi.deleteDiscount({ discountId: id });
        },
      });

      return { id, name: request.discount.name, request, body };
    },
    createRoleResource: async () => {
      const adminConfigApi = requireAdminConfigApi(options);
      const request = buildRoleRequest(buildEndpointName(options, 'ROLE', 24));
      const body = await expectApiOk(
        await adminConfigApi.saveRole(request),
        { method: 'POST', path: '/api/admin/role/save' },
        request,
      );
      const id = await resolveCreatedId({
        saveBody: body,
        name: request.role.name,
        list: async () =>
          await expectApiOk(await adminConfigApi.listRoles(), {
            method: 'GET',
            path: '/api/admin/role/list',
          }),
      });

      options.resourceRegistry.register({
        type: 'role',
        id,
        name: request.role.name,
        cleanupPriority: 20,
        deleteResource: async () => {
          await adminConfigApi.deleteRole({ roleId: id });
        },
      });

      return { id, name: request.role.name, request, body };
    },
  };
}

function buildTaxRequest(name: string) {
  return {
    tax: {
      name,
      rate: 0.0125,
      active: true,
    },
  };
}

function buildDiscountRequest(name: string) {
  return {
    discount: {
      name,
      rate: 1,
      rateType: 2,
      active: true,
    },
  };
}

function buildRoleRequest(name: string) {
  return {
    role: {
      name,
      discountCapRate: 0,
      function: [],
    },
  };
}

function buildEndpointName(
  options: EndpointResourceFactoryOptions,
  domain: string,
  maxLength: number,
): string {
  return createShortTestName({
    prefix: 'AT',
    domain,
    maxLength,
  });
}

async function resolveCreatedId(options: {
  saveBody: ApiEnvelope<unknown>;
  name: string;
  list: () => Promise<ApiEnvelope<unknown>>;
}): Promise<ResourceId> {
  const savedId = expectResourceId(options.saveBody, { method: 'POST', path: 'resource-create' });
  if (savedId !== undefined) {
    return savedId;
  }

  const listBody = await options.list();
  const listedId = findResourceIdByName(listBody, options.name);
  if (listedId === undefined) {
    throw new Error(`未能通过名称 ${options.name} 回查本次创建的资源。`);
  }

  return listedId;
}

function requireAdminConfigApi(options: EndpointResourceFactoryOptions): AdminConfigApiClient {
  if (options.adminConfigApi === undefined) {
    throw new Error('EndpointResources 缺少 adminConfigApi。');
  }
  return options.adminConfigApi;
}
```

- [ ] **Step 5: Fix `resolveCreatedId` fallback bug**

In `tests/api/support/endpoint-resources.ts`, replace the `resolveCreatedId` function from Step 4 with this version so fallback list lookup is reachable when save response lacks an ID:

```ts
async function resolveCreatedId(options: {
  saveBody: ApiEnvelope<unknown>;
  name: string;
  list: () => Promise<ApiEnvelope<unknown>>;
}): Promise<ResourceId> {
  try {
    return expectResourceId(options.saveBody, { method: 'POST', path: 'resource-create' });
  } catch {
    const listBody = await options.list();
    const listedId = findResourceIdByName(listBody, options.name);
    if (listedId === undefined) {
      throw new Error(`未能通过名称 ${options.name} 回查本次创建的资源。`);
    }

    return listedId;
  }
}
```

- [ ] **Step 6: Run resource unit test**

Run:

```powershell
npx playwright test tests/api/unit/api-endpoint-resources.unit.spec.ts --project=api --reporter=line
```

Expected: `2 passed`.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add tests/api/support/endpoint-resources.ts tests/api/support/endpoint-fixture.ts tests/api/unit/api-endpoint-resources.unit.spec.ts
git commit -m "test: add api endpoint resource fixture"
```

Expected: commit succeeds.

---

### Task 3: Admin Config Endpoint Specs

**Files:**
- Create: `tests/api/endpoints/admin-config/tax.endpoint.api.spec.ts`
- Create: `tests/api/endpoints/admin-config/discount.endpoint.api.spec.ts`
- Create: `tests/api/endpoints/admin-config/role.endpoint.api.spec.ts`

- [ ] **Step 1: Create tax endpoint spec**

Create `tests/api/endpoints/admin-config/tax.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('税费管理 endpoint', () => {
  test(toEndpointTitle('GET', '/api/tax/list', '应能查询税费列表'), async ({ adminConfigApi }) => {
    const body = await test.step('调用 GET /api/tax/list', async () => {
      return await expectApiOk(await adminConfigApi.listTaxes(), {
        method: 'GET',
        path: '/api/tax/list',
      });
    });

    await test.step('校验税费列表响应结构', async () => {
      expect(expectArrayData(body, { method: 'GET', path: '/api/tax/list' })).toEqual(
        expect.any(Array),
      );
    });
  });

  test(
    toEndpointTitle('POST', '/api/tax/save', '应能保存税费'),
    async ({ endpointResources }) => {
      const tax = await test.step('调用 POST /api/tax/save 创建税费', async () => {
        return await endpointResources.createTaxResource();
      });

      await test.step('校验保存税费返回资源 ID', async () => {
        expect(tax.id).toBeDefined();
        expect(tax.name).toContain('AT');
      });
    },
  );

  test(
    toEndpointTitle('POST', '/api/tax/delete', '应能删除本次创建的税费'),
    async ({ adminConfigApi, endpointResources, resourceRegistry }) => {
      const tax = await test.step('准备待删除税费', async () => {
        return await endpointResources.createTaxResource();
      });

      await test.step('调用 POST /api/tax/delete', async () => {
        await expectApiOk(
          await adminConfigApi.deleteTax({ taxId: tax.id }),
          { method: 'POST', path: '/api/tax/delete' },
          { taxId: tax.id },
        );
      });

      await test.step('取消本用例已手工删除资源的清理登记', async () => {
        resourceRegistry.markCleaned('tax', tax.id);
      });
    },
  );
});
```

- [ ] **Step 2: Add `markCleaned` support if ResourceRegistry does not have it**

If `api/core/resource-registry.ts` does not expose `markCleaned`, add this method to the class:

```ts
  markCleaned(type: string, id: ResourceId): void {
    this.resources = this.resources.filter((resource) => !isSameResource(resource, type, id));
  }
```

Then update `tests/api/unit/api-resource-registry.unit.spec.ts` with:

```ts
test('手工清理资源后应能取消清理登记', async () => {
  const registry = new ResourceRegistry();
  let cleanupCount = 0;

  registry.register({
    type: 'tax',
    id: 1,
    cleanupPriority: 1,
    deleteResource: async () => {
      cleanupCount += 1;
    },
  });

  registry.markCleaned('tax', 1);
  const result = await registry.cleanupAll();

  expect(result.cleaned).toEqual([]);
  expect(cleanupCount).toBe(0);
});
```

- [ ] **Step 3: Create discount endpoint spec**

Create `tests/api/endpoints/admin-config/discount.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('折扣管理 endpoint', () => {
  test(toEndpointTitle('GET', '/api/discount/list', '应能查询折扣列表'), async ({ adminConfigApi }) => {
    const body = await test.step('调用 GET /api/discount/list', async () => {
      return await expectApiOk(await adminConfigApi.listDiscounts(), {
        method: 'GET',
        path: '/api/discount/list',
      });
    });

    await test.step('校验折扣列表响应结构', async () => {
      expect(expectArrayData(body, { method: 'GET', path: '/api/discount/list' })).toEqual(
        expect.any(Array),
      );
    });
  });

  test(
    toEndpointTitle('POST', '/api/discount/save', '应能保存折扣'),
    async ({ endpointResources }) => {
      const discount = await test.step('调用 POST /api/discount/save 创建折扣', async () => {
        return await endpointResources.createDiscountResource();
      });

      await test.step('校验保存折扣返回资源 ID', async () => {
        expect(discount.id).toBeDefined();
        expect(discount.name).toContain('AT');
      });
    },
  );

  test(
    toEndpointTitle('POST', '/api/discount/delete', '应能删除本次创建的折扣'),
    async ({ adminConfigApi, endpointResources, resourceRegistry }) => {
      const discount = await test.step('准备待删除折扣', async () => {
        return await endpointResources.createDiscountResource();
      });

      await test.step('调用 POST /api/discount/delete', async () => {
        await expectApiOk(
          await adminConfigApi.deleteDiscount({ discountId: discount.id }),
          { method: 'POST', path: '/api/discount/delete' },
          { discountId: discount.id },
        );
      });

      await test.step('取消本用例已手工删除资源的清理登记', async () => {
        resourceRegistry.markCleaned('discount', discount.id);
      });
    },
  );
});
```

- [ ] **Step 4: Create role endpoint spec**

Create `tests/api/endpoints/admin-config/role.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('角色管理 endpoint', () => {
  test(toEndpointTitle('GET', '/api/admin/role/list', '应能查询角色列表'), async ({ adminConfigApi }) => {
    const body = await test.step('调用 GET /api/admin/role/list', async () => {
      return await expectApiOk(await adminConfigApi.listRoles(), {
        method: 'GET',
        path: '/api/admin/role/list',
      });
    });

    await test.step('校验角色列表响应结构', async () => {
      expect(expectArrayData(body, { method: 'GET', path: '/api/admin/role/list' })).toEqual(
        expect.any(Array),
      );
    });
  });

  test(
    toEndpointTitle('POST', '/api/admin/role/save', '应能保存角色'),
    async ({ endpointResources }) => {
      const role = await test.step('调用 POST /api/admin/role/save 创建角色', async () => {
        return await endpointResources.createRoleResource();
      });

      await test.step('校验保存角色返回资源 ID', async () => {
        expect(role.id).toBeDefined();
        expect(role.name).toContain('AT');
      });
    },
  );

  test(
    toEndpointTitle('POST', '/api/admin/role/delete', '应能删除本次创建的角色'),
    async ({ adminConfigApi, endpointResources, resourceRegistry }) => {
      const role = await test.step('准备待删除角色', async () => {
        return await endpointResources.createRoleResource();
      });

      await test.step('调用 POST /api/admin/role/delete', async () => {
        await expectApiOk(
          await adminConfigApi.deleteRole({ roleId: role.id }),
          { method: 'POST', path: '/api/admin/role/delete' },
          { roleId: role.id },
        );
      });

      await test.step('取消本用例已手工删除资源的清理登记', async () => {
        resourceRegistry.markCleaned('role', role.id);
      });
    },
  );
});
```

- [ ] **Step 5: Run admin config endpoint specs**

Run:

```powershell
npx playwright test tests/api/endpoints/admin-config --project=api --reporter=line
```

Expected: `9 passed`.

- [ ] **Step 6: Run registry unit test if ResourceRegistry changed**

Run:

```powershell
npx playwright test tests/api/unit/api-resource-registry.unit.spec.ts --project=api --reporter=line
```

Expected: all tests in that file pass.

- [ ] **Step 7: Commit Task 3**

Run:

```powershell
git add api/core/resource-registry.ts tests/api/unit/api-resource-registry.unit.spec.ts tests/api/endpoints/admin-config
git commit -m "test: add admin config endpoint api specs"
```

Expected: commit succeeds.

---

### Task 4: Menu Endpoint Resources And Specs

**Files:**
- Modify: `tests/api/support/endpoint-resources.ts`
- Create: `tests/api/endpoints/menu/menu.endpoint.api.spec.ts`
- Create: `tests/api/endpoints/menu/menu-group.endpoint.api.spec.ts`
- Create: `tests/api/endpoints/menu/category.endpoint.api.spec.ts`

- [ ] **Step 1: Extend endpoint resources with menu helpers**

In `tests/api/support/endpoint-resources.ts`, extend `EndpointResources`:

```ts
  createMenuResource(): Promise<EndpointResource>;
  createMenuGroupResource(menuId: ResourceId): Promise<EndpointResource>;
  createCategoryResource(menuId: ResourceId, menuGroupId: ResourceId): Promise<EndpointResource>;
```

Add the implementations inside `createEndpointResources`:

```ts
    createMenuResource: async () => {
      const menuApi = requireMenuApi(options);
      const request = buildMenuRequest(buildEndpointName(options, 'MENU', 24));
      const body = await expectApiOk(
        await menuApi.createMenu(request),
        { method: 'POST', path: '/api/menu/menu' },
        request,
      );
      const id = await resolveCreatedId({
        saveBody: body,
        name: request.name,
        list: async () =>
          await expectApiOk(await menuApi.listMenus({ name: request.name }), {
            method: 'GET',
            path: '/api/menu/menus',
          }),
      });

      options.resourceRegistry.register({
        type: 'menu',
        id,
        name: request.name,
        cleanupPriority: 10,
        deleteResource: async () => {
          await menuApi.updateMenu({ ...request, id, name: `${request.name}_DEL`, archived: true });
        },
      });

      return { id, name: request.name, request, body };
    },
    createMenuGroupResource: async (menuId) => {
      const menuApi = requireMenuApi(options);
      const request = buildMenuGroupRequest(menuId, buildEndpointName(options, 'MGRP', 24));
      const body = await expectApiOk(
        await menuApi.createMenuGroup(request),
        { method: 'POST', path: '/api/menu/menuGroup' },
        request,
      );
      const id = await resolveCreatedId({
        saveBody: body,
        name: request.name,
        list: async () =>
          await expectApiOk(await menuApi.listMenuGroups({ menuId, name: request.name }), {
            method: 'GET',
            path: '/api/menu/menuGroups',
          }),
      });

      options.resourceRegistry.register({
        type: 'menuGroup',
        id,
        name: request.name,
        cleanupPriority: 30,
        deleteResource: async () => {
          await menuApi.deleteMenuGroup(id);
        },
      });

      return { id, name: request.name, request, body };
    },
    createCategoryResource: async (menuId, menuGroupId) => {
      const menuApi = requireMenuApi(options);
      const request = buildCategoryRequest(menuId, menuGroupId, buildEndpointName(options, 'CAT', 24));
      const body = await expectApiOk(
        await menuApi.createMenuCategory(request),
        { method: 'POST', path: '/api/menu/menuCategory' },
        request,
      );
      const id = await resolveCreatedId({
        saveBody: body,
        name: request.name,
        list: async () =>
          await expectApiOk(await menuApi.listCategories({ menuId }), {
            method: 'GET',
            path: '/api/menu/category/list',
          }),
      });

      options.resourceRegistry.register({
        type: 'menuCategory',
        id,
        name: request.name,
        cleanupPriority: 40,
        deleteResource: async () => {
          await menuApi.deleteMenuCategory(id);
        },
      });

      return { id, name: request.name, request, body };
    },
```

Add helper builders:

```ts
function buildMenuRequest(name: string) {
  return {
    name,
    product: 'POS',
    active: true,
    description: name,
  };
}

function buildMenuGroupRequest(menuId: ResourceId, name: string) {
  return {
    menuId,
    name,
    active: true,
    sequence: 1,
  };
}

function buildCategoryRequest(menuId: ResourceId, menuGroupId: ResourceId, name: string) {
  return {
    menuId,
    menuGroupId,
    name,
    active: true,
    sequence: 1,
  };
}

function requireMenuApi(options: EndpointResourceFactoryOptions): MenuApiClient {
  if (options.menuApi === undefined) {
    throw new Error('EndpointResources 缺少 menuApi。');
  }
  return options.menuApi;
}
```

- [ ] **Step 2: Create menu endpoint spec**

Create `tests/api/endpoints/menu/menu.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('菜单管理 endpoint', () => {
  test(toEndpointTitle('GET', '/api/menu/menus', '应能查询菜单列表'), async ({ menuApi }) => {
    const body = await test.step('调用 GET /api/menu/menus', async () => {
      return await expectApiOk(await menuApi.listMenus(), {
        method: 'GET',
        path: '/api/menu/menus',
      });
    });

    await test.step('校验菜单列表响应结构', async () => {
      expect(expectArrayData(body, { method: 'GET', path: '/api/menu/menus' })).toEqual(
        expect.any(Array),
      );
    });
  });

  test(toEndpointTitle('POST', '/api/menu/menu', '应能创建菜单'), async ({ endpointResources }) => {
    const menu = await test.step('调用 POST /api/menu/menu 创建菜单', async () => {
      return await endpointResources.createMenuResource();
    });

    await test.step('校验创建菜单返回资源 ID', async () => {
      expect(menu.id).toBeDefined();
      expect(menu.name).toContain('AT');
    });
  });

  test(toEndpointTitle('PUT', '/api/menu/menu', '应能更新菜单'), async ({ menuApi, endpointResources }) => {
    const menu = await test.step('准备待更新菜单', async () => {
      return await endpointResources.createMenuResource();
    });

    await test.step('调用 PUT /api/menu/menu', async () => {
      await expectApiOk(
        await menuApi.updateMenu({ ...menu.request, id: menu.id, description: `${menu.name}_UPD` }),
        { method: 'PUT', path: '/api/menu/menu' },
        { id: menu.id },
      );
    });
  });

  test(toEndpointTitle('GET', '/api/menu/menu/{id}', '应能读取菜单详情'), async ({ menuApi, endpointResources }) => {
    const menu = await test.step('准备待读取菜单', async () => {
      return await endpointResources.createMenuResource();
    });

    await test.step('调用 GET /api/menu/menu/{id}', async () => {
      await expectApiOk(await menuApi.getMenu(menu.id), {
        method: 'GET',
        path: '/api/menu/menu/{id}',
      });
    });
  });
});
```

- [ ] **Step 3: Create menu group endpoint spec**

Create `tests/api/endpoints/menu/menu-group.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('菜单组管理 endpoint', () => {
  test(toEndpointTitle('POST', '/api/menu/menuGroup', '应能创建菜单组'), async ({ endpointResources }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await test.step('调用 POST /api/menu/menuGroup 创建菜单组', async () => {
      return await endpointResources.createMenuGroupResource(menu.id);
    });

    await test.step('校验创建菜单组返回资源 ID', async () => {
      expect(group.id).toBeDefined();
      expect(group.name).toContain('AT');
    });
  });

  test(toEndpointTitle('PUT', '/api/menu/menuGroup', '应能更新菜单组'), async ({ menuApi, endpointResources }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);

    await test.step('调用 PUT /api/menu/menuGroup', async () => {
      await expectApiOk(
        await menuApi.updateMenuGroup({ ...group.request, id: group.id, name: `${group.name}_U` }),
        { method: 'PUT', path: '/api/menu/menuGroup' },
        { id: group.id },
      );
    });
  });

  test(toEndpointTitle('GET', '/api/menu/menuGroup/{id}', '应能读取菜单组详情'), async ({ menuApi, endpointResources }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);

    await test.step('调用 GET /api/menu/menuGroup/{id}', async () => {
      await expectApiOk(await menuApi.getMenuGroup(group.id), {
        method: 'GET',
        path: '/api/menu/menuGroup/{id}',
      });
    });
  });

  test(toEndpointTitle('DELETE', '/api/menu/menuGroup/{id}', '应能删除菜单组'), async ({ menuApi, endpointResources, resourceRegistry }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);

    await test.step('调用 DELETE /api/menu/menuGroup/{id}', async () => {
      await expectApiOk(await menuApi.deleteMenuGroup(group.id), {
        method: 'DELETE',
        path: '/api/menu/menuGroup/{id}',
      });
    });

    await test.step('取消本用例已手工删除资源的清理登记', async () => {
      resourceRegistry.markCleaned('menuGroup', group.id);
    });
  });
});
```

- [ ] **Step 4: Create category endpoint spec**

Create `tests/api/endpoints/menu/category.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('分类管理 endpoint', () => {
  test(toEndpointTitle('POST', '/api/menu/menuCategory', '应能创建分类'), async ({ endpointResources }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await test.step('调用 POST /api/menu/menuCategory 创建分类', async () => {
      return await endpointResources.createCategoryResource(menu.id, group.id);
    });

    await test.step('校验创建分类返回资源 ID', async () => {
      expect(category.id).toBeDefined();
      expect(category.name).toContain('AT');
    });
  });

  test(toEndpointTitle('PUT', '/api/menu/menuCategory', '应能更新分类'), async ({ menuApi, endpointResources }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);

    await test.step('调用 PUT /api/menu/menuCategory', async () => {
      await expectApiOk(
        await menuApi.updateMenuCategory({ ...category.request, id: category.id, name: `${category.name}_U` }),
        { method: 'PUT', path: '/api/menu/menuCategory' },
        { id: category.id },
      );
    });
  });

  test(toEndpointTitle('GET', '/api/menu/menuCategory/{id}', '应能读取分类详情'), async ({ menuApi, endpointResources }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);

    await test.step('调用 GET /api/menu/menuCategory/{id}', async () => {
      await expectApiOk(await menuApi.getMenuCategory(category.id), {
        method: 'GET',
        path: '/api/menu/menuCategory/{id}',
      });
    });
  });

  test(toEndpointTitle('DELETE', '/api/menu/menuCategory/{id}', '应能删除分类'), async ({ menuApi, endpointResources, resourceRegistry }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);

    await test.step('调用 DELETE /api/menu/menuCategory/{id}', async () => {
      await expectApiOk(await menuApi.deleteMenuCategory(category.id), {
        method: 'DELETE',
        path: '/api/menu/menuCategory/{id}',
      });
    });

    await test.step('取消本用例已手工删除资源的清理登记', async () => {
      resourceRegistry.markCleaned('menuCategory', category.id);
    });
  });
});
```

- [ ] **Step 5: Run menu endpoint specs**

Run:

```powershell
npx playwright test tests/api/endpoints/menu --project=api --reporter=line
```

Expected: `12 passed`.

- [ ] **Step 6: Commit Task 4**

Run:

```powershell
git add tests/api/support/endpoint-resources.ts tests/api/endpoints/menu
git commit -m "test: add menu endpoint api specs"
```

Expected: commit succeeds.

---

### Task 5: Sale Item And SPU Endpoint Specs

**Files:**
- Modify: `tests/api/support/endpoint-resources.ts`
- Create: `tests/api/endpoints/sale-item/sale-item.endpoint.api.spec.ts`
- Create: `tests/api/endpoints/sale-item/spu.endpoint.api.spec.ts`

- [ ] **Step 1: Add sale item resource helper**

Extend `EndpointResources` in `tests/api/support/endpoint-resources.ts`:

```ts
  createSaleItemResource(
    menuId: ResourceId,
    menuGroupId: ResourceId,
    categoryId: ResourceId,
  ): Promise<EndpointResource>;
```

Add implementation:

```ts
    createSaleItemResource: async (menuId, menuGroupId, categoryId) => {
      const saleItemApi = requireSaleItemApi(options);
      const request = buildSaleItemRequest({
        menuId,
        menuGroupId,
        categoryId,
        name: buildEndpointName(options, 'ITEM', 24),
      });
      const body = await expectApiOk(
        await saleItemApi.createSaleItem(request),
        { method: 'POST', path: '/api/menu/menuSaleItem' },
        request,
      );
      const id = await resolveCreatedId({
        saveBody: body,
        name: request.name,
        list: async () =>
          await expectApiOk(await saleItemApi.searchSaleItems({ menuId, name: request.name }), {
            method: 'GET',
            path: '/api/menu/menuSaleItems/search',
          }),
      });

      options.resourceRegistry.register({
        type: 'saleItem',
        id,
        name: request.name,
        cleanupPriority: 50,
        deleteResource: async () => {
          await saleItemApi.deleteSaleItem(id);
        },
      });

      return { id, name: request.name, request, body };
    },
```

Add builder and required client function:

```ts
function buildSaleItemRequest(options: {
  menuId: ResourceId;
  menuGroupId: ResourceId;
  categoryId: ResourceId;
  name: string;
}) {
  return {
    menuId: options.menuId,
    menuGroupId: options.menuGroupId,
    categoryId: options.categoryId,
    name: options.name,
    price: 5.85,
    originalSalePrice: 5.85,
    active: true,
    taxIds: [1],
  };
}

function requireSaleItemApi(options: EndpointResourceFactoryOptions): SaleItemApiClient {
  if (options.saleItemApi === undefined) {
    throw new Error('EndpointResources 缺少 saleItemApi。');
  }
  return options.saleItemApi;
}
```

- [ ] **Step 2: Create sale item endpoint spec**

Create `tests/api/endpoints/sale-item/sale-item.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('商品管理 endpoint', () => {
  test(toEndpointTitle('POST', '/api/menu/menuSaleItem', '应能创建商品'), async ({ endpointResources }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);
    const item = await test.step('调用 POST /api/menu/menuSaleItem 创建商品', async () => {
      return await endpointResources.createSaleItemResource(menu.id, group.id, category.id);
    });

    await test.step('校验创建商品返回资源 ID', async () => {
      expect(item.id).toBeDefined();
      expect(item.name).toContain('AT');
    });
  });

  test(toEndpointTitle('PUT', '/api/menu/menuSaleItem', '应能更新商品'), async ({ saleItemApi, endpointResources }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);
    const item = await endpointResources.createSaleItemResource(menu.id, group.id, category.id);

    await test.step('调用 PUT /api/menu/menuSaleItem', async () => {
      await expectApiOk(
        await saleItemApi.updateSaleItem({ ...item.request, id: item.id, name: `${item.name}_U` }),
        { method: 'PUT', path: '/api/menu/menuSaleItem' },
        { id: item.id },
      );
    });
  });

  test(toEndpointTitle('GET', '/api/menu/menuSaleItem/{id}', '应能读取商品详情'), async ({ saleItemApi, endpointResources }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);
    const item = await endpointResources.createSaleItemResource(menu.id, group.id, category.id);

    await test.step('调用 GET /api/menu/menuSaleItem/{id}', async () => {
      await expectApiOk(await saleItemApi.getSaleItem(item.id), {
        method: 'GET',
        path: '/api/menu/menuSaleItem/{id}',
      });
    });
  });

  test(toEndpointTitle('DELETE', '/api/menu/menuSaleItem/{id}', '应能删除商品'), async ({ saleItemApi, endpointResources, resourceRegistry }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);
    const item = await endpointResources.createSaleItemResource(menu.id, group.id, category.id);

    await test.step('调用 DELETE /api/menu/menuSaleItem/{id}', async () => {
      await expectApiOk(await saleItemApi.deleteSaleItem(item.id), {
        method: 'DELETE',
        path: '/api/menu/menuSaleItem/{id}',
      });
    });

    await test.step('取消本用例已手工删除资源的清理登记', async () => {
      resourceRegistry.markCleaned('saleItem', item.id);
    });
  });
});
```

- [ ] **Step 3: Create SPU endpoint spec**

Create `tests/api/endpoints/sale-item/spu.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('SPU 库存管理 endpoint', () => {
  test(toEndpointTitle('POST', '/api/spu/menuSaleItem/assign', '应能分配商品 SPU'), async ({ endpointResources, spuApi }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);
    const item = await endpointResources.createSaleItemResource(menu.id, group.id, category.id);
    const code = `SPU_${String(item.id).replace(/[^A-Za-z0-9]/g, '')}`;

    await test.step('调用 POST /api/spu/menuSaleItem/assign', async () => {
      await expectApiOk(
        await spuApi.assignMenuSaleItem({
          code,
          menuSaleItemIds: [item.id],
        }),
        { method: 'POST', path: '/api/spu/menuSaleItem/assign' },
        { code, menuSaleItemIds: [item.id] },
      );
    });
  });

  test(toEndpointTitle('POST', '/api/spu/menuSaleItem/link', '应能链接商品 SPU'), async ({ endpointResources, spuApi }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);
    const item = await endpointResources.createSaleItemResource(menu.id, group.id, category.id);
    const code = `SPU_${String(item.id).replace(/[^A-Za-z0-9]/g, '')}`;

    await test.step('调用 POST /api/spu/menuSaleItem/link', async () => {
      await expectApiOk(
        await spuApi.linkMenuSaleItem({
          code,
          menuSaleItemId: item.id,
        }),
        { method: 'POST', path: '/api/spu/menuSaleItem/link' },
        { code, menuSaleItemId: item.id },
      );
    });
  });

  test(toEndpointTitle('GET', '/api/spu/menuSaleItem/list/{code}', '应能按 SPU code 查询商品'), async ({ endpointResources, spuApi }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);
    const item = await endpointResources.createSaleItemResource(menu.id, group.id, category.id);
    const code = `SPU_${String(item.id).replace(/[^A-Za-z0-9]/g, '')}`;

    await expectApiOk(
      await spuApi.assignMenuSaleItem({ code, menuSaleItemIds: [item.id] }),
      { method: 'POST', path: '/api/spu/menuSaleItem/assign' },
      { code, menuSaleItemIds: [item.id] },
    );

    await test.step('调用 GET /api/spu/menuSaleItem/list/{code}', async () => {
      await expectApiOk(await spuApi.listMenuSaleItems(code), {
        method: 'GET',
        path: '/api/spu/menuSaleItem/list/{code}',
      });
    });
  });

  test(toEndpointTitle('POST', '/api/spu/stockOperation', '应能记录单个库存操作'), async ({ endpointResources, spuApi }) => {
    const menu = await endpointResources.createMenuResource();
    const group = await endpointResources.createMenuGroupResource(menu.id);
    const category = await endpointResources.createCategoryResource(menu.id, group.id);
    const item = await endpointResources.createSaleItemResource(menu.id, group.id, category.id);
    const code = `SPU_${String(item.id).replace(/[^A-Za-z0-9]/g, '')}`;

    await test.step('调用 POST /api/spu/stockOperation', async () => {
      await expectApiOk(
        await spuApi.createStockOperation({
          code,
          quantity: 1,
          type: 'IN',
          reason: 'AT endpoint stock operation',
        }),
        { method: 'POST', path: '/api/spu/stockOperation' },
        { code, quantity: 1, type: 'IN' },
      );
    });
  });
});
```

- [ ] **Step 4: Run sale item endpoint specs**

Run:

```powershell
npx playwright test tests/api/endpoints/sale-item --project=api --reporter=line
```

Expected: `8 passed`.

- [ ] **Step 5: Commit Task 5**

Run:

```powershell
git add tests/api/support/endpoint-resources.ts tests/api/endpoints/sale-item
git commit -m "test: add sale item and spu endpoint api specs"
```

Expected: commit succeeds.

---

### Task 6: Order And Payment Endpoint Specs

**Files:**
- Modify: `tests/api/support/endpoint-resources.ts`
- Create: `tests/api/endpoints/order/order.endpoint.api.spec.ts`
- Create: `tests/api/endpoints/order/payment.endpoint.api.spec.ts`

- [ ] **Step 1: Add order and payment resource helpers**

Extend `EndpointResources`:

```ts
  createOrderResource(): Promise<EndpointResource>;
  createPaymentRecordResource(orderId: ResourceId): Promise<EndpointResource>;
```

Implement these helpers by reusing existing order/payment request factories from `test-data/api/order-api-data.ts` and `test-data/api/payment-api-data.ts`:

```ts
    createOrderResource: async () => {
      const orderApi = requireOrderApi(options);
      const request = buildEndpointOrderRequest();
      const body = await expectApiOk(
        await orderApi.saveOrder(request),
        { method: 'POST', path: '/api/order/save' },
        request,
      );
      const id = expectResourceId(body, { method: 'POST', path: '/api/order/save' });

      options.resourceRegistry.register({
        type: 'order',
        id,
        cleanupPriority: 80,
        deleteResource: async () => {
          await orderApi.voidOrder({
            orderId: id,
            userAuth: { userId: 1, userPasscode: '11', sessionKey: 'device001' },
          });
        },
      });

      return { id, name: String(id), request, body };
    },
    createPaymentRecordResource: async (orderId) => {
      const paymentApi = requirePaymentApi(options);
      const request = buildEndpointPaymentRequest(orderId);
      const body = await expectApiOk(
        await paymentApi.savePaymentRecord(request),
        { method: 'POST', path: '/api/payment/record/save' },
        request,
      );
      const id = expectResourceId(body, { method: 'POST', path: '/api/payment/record/save' });

      options.resourceRegistry.register({
        type: 'payment',
        id,
        cleanupPriority: 90,
        deleteResource: async () => {
          await paymentApi.deletePaymentRecord({ paymentId: id, orderId });
        },
      });

      return { id, name: String(id), request, body };
    },
```

Add required helper functions:

```ts
function buildEndpointOrderRequest(): ApiRequestData {
  return {
    userAuth: { userId: 1, userPasscode: '11', sessionKey: 'device001' },
    order: {
      checksum: String(Date.now()),
      createTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
      type: 'DINE_IN',
      status: 'OPEN',
      currentUserId: 1,
      userId: 1,
      numOfGuests: 1,
      totalPrice: 5.85,
      totalTax: '0.59',
      orderItems: [
        {
          saleItemId: 2834,
          quantity: 1,
          price: 5.85,
          originalSalePrice: 5.85,
          status: 'ORDERED',
          taxExempt: false,
        },
      ],
    },
    sendToKitchen: false,
    printReceipt: false,
    fetchOrder: true,
    fetchPayments: true,
  };
}

function buildEndpointPaymentRequest(orderId: ResourceId): ApiRequestData {
  return {
    orderId,
    paymentRecord: {
      orderId,
      amount: 1,
      tendered: 1,
      tip: 0,
      paymentType: 'CASH',
    },
    printPaymentReceipt: false,
    userAuth: { userId: 1, userPasscode: '11', sessionKey: 'device001' },
  };
}

function requireOrderApi(options: EndpointResourceFactoryOptions): OrderApiClient {
  if (options.orderApi === undefined) {
    throw new Error('EndpointResources 缺少 orderApi。');
  }
  return options.orderApi;
}

function requirePaymentApi(options: EndpointResourceFactoryOptions): PaymentApiClient {
  if (options.paymentApi === undefined) {
    throw new Error('EndpointResources 缺少 paymentApi。');
  }
  return options.paymentApi;
}
```

- [ ] **Step 2: Create order endpoint spec**

Create `tests/api/endpoints/order/order.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk, expectArrayData } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('订单管理 endpoint', () => {
  test(toEndpointTitle('POST', '/api/order/save', '应能保存订单'), async ({ endpointResources }) => {
    const order = await test.step('调用 POST /api/order/save 创建订单', async () => {
      return await endpointResources.createOrderResource();
    });

    await test.step('校验保存订单返回资源 ID', async () => {
      expect(order.id).toBeDefined();
    });
  });

  test(toEndpointTitle('GET', '/api/order/fetch', '应能读取订单详情'), async ({ orderApi, endpointResources }) => {
    const order = await endpointResources.createOrderResource();

    await test.step('调用 GET /api/order/fetch', async () => {
      await expectApiOk(await orderApi.fetchOrder({ orderId: order.id, fetchPayments: true }), {
        method: 'GET',
        path: '/api/order/fetch',
      });
    });
  });

  test(toEndpointTitle('GET', '/api/order/list', '应能查询订单列表'), async ({ orderApi }) => {
    const body = await test.step('调用 GET /api/order/list', async () => {
      return await expectApiOk(await orderApi.listOrders(), {
        method: 'GET',
        path: '/api/order/list',
      });
    });

    await test.step('校验订单列表响应结构', async () => {
      expect(expectArrayData(body, { method: 'GET', path: '/api/order/list' })).toEqual(
        expect.any(Array),
      );
    });
  });

  test(toEndpointTitle('POST', '/api/order/void', '应能作废本次创建的订单'), async ({ orderApi, endpointResources, resourceRegistry }) => {
    const order = await endpointResources.createOrderResource();

    await test.step('调用 POST /api/order/void', async () => {
      await expectApiOk(
        await orderApi.voidOrder({
          orderId: order.id,
          userAuth: { userId: 1, userPasscode: '11', sessionKey: 'device001' },
        }),
        { method: 'POST', path: '/api/order/void' },
        { orderId: order.id },
      );
    });

    await test.step('取消本用例已手工作废订单的清理登记', async () => {
      resourceRegistry.markCleaned('order', order.id);
    });
  });
});
```

- [ ] **Step 3: Create payment endpoint spec**

Create `tests/api/endpoints/order/payment.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

test.describe('订单支付 endpoint', () => {
  test(toEndpointTitle('POST', '/api/payment/record/save', '应能保存支付记录'), async ({ endpointResources }) => {
    const order = await endpointResources.createOrderResource();
    const payment = await test.step('调用 POST /api/payment/record/save 创建支付记录', async () => {
      return await endpointResources.createPaymentRecordResource(order.id);
    });

    await test.step('校验保存支付记录返回资源 ID', async () => {
      expect(payment.id).toBeDefined();
    });
  });

  test(toEndpointTitle('POST', '/api/payment/record/delete', '应能删除本次创建的支付记录'), async ({ endpointResources, paymentApi, resourceRegistry }) => {
    const order = await endpointResources.createOrderResource();
    const payment = await endpointResources.createPaymentRecordResource(order.id);

    await test.step('调用 POST /api/payment/record/delete', async () => {
      await expectApiOk(
        await paymentApi.deletePaymentRecord({ paymentId: payment.id, orderId: order.id }),
        { method: 'POST', path: '/api/payment/record/delete' },
        { paymentId: payment.id, orderId: order.id },
      );
    });

    await test.step('取消本用例已手工删除支付记录的清理登记', async () => {
      resourceRegistry.markCleaned('payment', payment.id);
    });
  });
});
```

- [ ] **Step 4: Run order endpoint specs**

Run:

```powershell
npx playwright test tests/api/endpoints/order --project=api --reporter=line
```

Expected: `6 passed`.

- [ ] **Step 5: Commit Task 6**

Run:

```powershell
git add tests/api/support/endpoint-resources.ts tests/api/endpoints/order
git commit -m "test: add order and payment endpoint api specs"
```

Expected: commit succeeds.

---

### Task 7: Coverage Matrix And Documentation

**Files:**
- Modify: `api/contracts/first-batch-api-cases.ts`
- Modify: `tests/api/contracts/api-contract-matrix.unit.spec.ts`
- Modify: `tests/api/README.md`
- Create: `tests/api/support/README.md`
- Modify: `docs/api/112接口覆盖映射.md`

- [ ] **Step 1: Extend API spec file constants**

In `api/contracts/first-batch-api-cases.ts`, extend `API_SPEC_FILES`:

```ts
export const API_SPEC_FILES = {
  menuCatalog: 'tests/api/business/menu-catalog.api.spec.ts',
  saleItem: 'tests/api/business/sale-item.api.spec.ts',
  orderPayment: 'tests/api/business/order-payment.api.spec.ts',
  adminConfig: 'tests/api/business/admin-config.api.spec.ts',
  contractSmoke: 'tests/api/contracts/contract-smoke.api.spec.ts',
  endpointTax: 'tests/api/endpoints/admin-config/tax.endpoint.api.spec.ts',
  endpointDiscount: 'tests/api/endpoints/admin-config/discount.endpoint.api.spec.ts',
  endpointRole: 'tests/api/endpoints/admin-config/role.endpoint.api.spec.ts',
  endpointMenu: 'tests/api/endpoints/menu/menu.endpoint.api.spec.ts',
  endpointMenuGroup: 'tests/api/endpoints/menu/menu-group.endpoint.api.spec.ts',
  endpointCategory: 'tests/api/endpoints/menu/category.endpoint.api.spec.ts',
  endpointSaleItem: 'tests/api/endpoints/sale-item/sale-item.endpoint.api.spec.ts',
  endpointSpu: 'tests/api/endpoints/sale-item/spu.endpoint.api.spec.ts',
  endpointOrder: 'tests/api/endpoints/order/order.endpoint.api.spec.ts',
  endpointPayment: 'tests/api/endpoints/order/payment.endpoint.api.spec.ts',
} as const;
```

Add endpoint status types:

```ts
export type ApiEndpointStatus = 'covered' | 'planned' | 'blocked';
```

Extend `FirstBatchApiCase`:

```ts
  endpointSpecFile?: ApiSpecFile;
  endpointStatus: ApiEndpointStatus;
```

For every existing object, set:

```ts
endpointStatus: coverage === 'positive-business' || coverage === 'positive-crud' ? 'planned' : 'blocked'
```

Then override first-version migrated endpoint entries with `endpointStatus: 'covered'` and the correct `endpointSpecFile`.

- [ ] **Step 2: Update matrix unit tests**

In `tests/api/contracts/api-contract-matrix.unit.spec.ts`, add tests:

```ts
test('endpoint 覆盖状态应和覆盖等级保持一致', () => {
  for (const apiCase of firstBatchApiCases) {
    if (apiCase.coverage === 'positive-business' || apiCase.coverage === 'positive-crud') {
      expect(['covered', 'planned']).toContain(apiCase.endpointStatus);
    } else {
      expect(['blocked', 'planned']).toContain(apiCase.endpointStatus);
    }
  }
});

test('已覆盖 endpoint 应声明存在的 endpoint spec 文件', () => {
  const coveredCases = firstBatchApiCases.filter((apiCase) => apiCase.endpointStatus === 'covered');

  expect(coveredCases.length).toBeGreaterThanOrEqual(35);
  for (const apiCase of coveredCases) {
    expect(apiCase.endpointSpecFile, `${apiCase.method} ${apiCase.path}`).toBeDefined();
    expect(fs.existsSync(apiCase.endpointSpecFile!)).toBe(true);
  }
});
```

Ensure `fs` is imported:

```ts
import fs from 'node:fs';
```

If the local Node type package lacks `node:fs`, use:

```ts
import fs from 'fs';
```

- [ ] **Step 3: Create endpoint support README**

Create `tests/api/support/README.md`:

```md
# API Endpoint 测试接入说明

Endpoint 测试用于验证单个接口的正向、异常和边界场景。业务链路回归仍放在 `tests/api/business/`。

## 新增接口步骤

1. 在 `api/contracts/first-batch-api-cases.ts` 确认接口覆盖等级是 `positive-business` 或 `positive-crud`。
2. 在对应 `tests/api/endpoints/<domain>/` 文件中新增 `describe` 或 `test`。
3. 使用 `tests/api/support/endpoint-fixture.ts` 导出的 `test` 和 `expect`。
4. 如需前置数据，优先使用 `endpointResources`。
5. 调用领域 client，不直接拼接 URL。
6. 使用 `expectApiOk`、`expectApiBusinessError` 或 `expectHttpStatus` 断言响应。
7. 手工删除资源后调用 `resourceRegistry.markCleaned(type, id)`，避免 teardown 重复清理。
8. 更新覆盖矩阵的 `endpointStatus` 和 `endpointSpecFile`。

## 模板

```ts
import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk } from '../../support/endpoint-assertions';
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
        { id: resource.id },
      );
    });
  });
});
```
```

- [ ] **Step 4: Update tests/api README**

In `tests/api/README.md`, add:

```md
- `endpoints/`：单接口真实 API 测试。每个用例聚焦一个 endpoint，适合追加异常、边界和参数校验场景。
- `support/`：endpoint 测试支撑层，包括断言、资源工厂和接入模板，不直接代表业务接口覆盖。

常用命令：

- `npm run test:api`：运行全部 API 测试。
- `npx playwright test tests/api/endpoints --project=api --reporter=line`：只运行 endpoint 单接口测试。
```

- [ ] **Step 5: Update API coverage mapping doc**

In `docs/api/112接口覆盖映射.md`, update the summary section with endpoint counts:

```md
- endpoint 已覆盖: 35
- endpoint 计划迁移: 43
- endpoint 暂不迁移: 34
```

Update the table header to include:

```md
| 当前业务链路 spec | 当前 endpoint spec |
```

For migrated endpoints, set the endpoint spec path. For un-migrated positive endpoints, set `计划迁移`. For blocked/deferred/contract endpoints, set `暂不迁移`.

- [ ] **Step 6: Run matrix tests**

Run:

```powershell
npx playwright test tests/api/contracts/api-contract-matrix.unit.spec.ts --project=api --reporter=line
```

Expected: all matrix tests pass.

- [ ] **Step 7: Commit Task 7**

Run:

```powershell
git add api/contracts/first-batch-api-cases.ts tests/api/contracts/api-contract-matrix.unit.spec.ts tests/api/README.md tests/api/support/README.md docs/api/112接口覆盖映射.md
git commit -m "docs: map api endpoint coverage"
```

Expected: commit succeeds.

---

### Task 8: Full Verification

**Files:**
- No new source files.
- Verify all API endpoint, business, unit, and type checks.

- [ ] **Step 1: Run TypeScript check**

Run:

```powershell
npx tsc --noEmit
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 2: Run endpoint tests**

Run:

```powershell
npx playwright test tests/api/endpoints --project=api --reporter=line
```

Expected: all endpoint tests pass. Expected first-version count is 35 tests unless a task adds a support-only endpoint assertion test outside `endpoints/`.

- [ ] **Step 3: Run existing business tests**

Run:

```powershell
npx playwright test tests/api/business --project=api --reporter=line
```

Expected: existing business tests pass.

- [ ] **Step 4: Run all API tests**

Run:

```powershell
npx playwright test tests/api --project=api --reporter=line
```

Expected: all API tests pass.

- [ ] **Step 5: Inspect git status**

Run:

```powershell
git status --short --branch
```

Expected: only the two pre-existing untracked docs remain, unless the user has intentionally added more files:

```text
?? docs/AI协作指南.md
?? 接口文档.md
```

- [ ] **Step 6: Commit final verification notes if any docs changed**

If Task 8 changes no files, do not create a commit. If verification requires README corrections, commit only those corrections:

```powershell
git add tests/api/README.md tests/api/support/README.md
git commit -m "docs: clarify api endpoint test workflow"
```

Expected: commit succeeds only when documentation changed.

# First Batch API Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first batch of maintainable Playwright + TypeScript API tests for menu, catalog, item, order, payment, tax, discount, role, global option, and SPU inventory endpoints.

**Architecture:** Keep API automation separate from existing UI `pages/` and `flows/`. Add focused API core utilities, domain clients, API fixtures, and five API spec files under `tests/api/`, with test data created through short `AT_` identifiers and cleaned by resource registry.

**Tech Stack:** Playwright Test, TypeScript, Node.js, Allure Playwright.

---

## Scope Check

This plan implements the approved first batch only: 13 Swagger groups and 112 operations from the API design spec. It does not implement all 517 Swagger operations, real external payment gateway flows, SSE long-connection verification, or binary file upload/download verification.

## File Structure

Create:

- `api/core/api-config.ts`: Reads API environment variables and validates required authentication/destructive-operation configuration.
- `api/core/api-auth.ts`: Builds auth headers and cookies for API Key or Cookie modes.
- `api/core/api-response.ts`: Parses API responses, creates readable failure messages, and validates common `Response<T>` envelopes.
- `api/core/api-context.ts`: Creates API request contexts without browser/page dependency.
- `api/core/test-data-id.ts`: Generates short `AT_` test identifiers with field-length limits.
- `api/core/resource-registry.ts`: Registers created resources and cleans them in reverse dependency order.
- `api/clients/menu-api.client.ts`: Menu, menu group, category, global option category, global option, and menu search endpoints.
- `api/clients/sale-item-api.client.ts`: Sale item and item query/update/delete endpoints.
- `api/clients/spu-api.client.ts`: SPU inventory endpoints.
- `api/clients/order-api.client.ts`: Order save, list, fetch, detail, recall, void endpoints.
- `api/clients/payment-api.client.ts`: Payment record save/delete/tip/void endpoints.
- `api/clients/admin-config-api.client.ts`: Tax, discount, and role endpoints.
- `api/contracts/first-batch-api-cases.ts`: First-batch endpoint coverage matrix.
- `fixtures/api.fixture.ts`: API test fixture that injects config, request context, registry, and clients.
- `test-data/api/menu-api-data.ts`: Menu/catalog request factories.
- `test-data/api/order-api-data.ts`: Order request factories.
- `test-data/api/payment-api-data.ts`: Payment request factories.
- `tests/api/menu-catalog.api.spec.ts`: Menu/catalog positive and query coverage.
- `tests/api/sale-item.api.spec.ts`: Sale item and SPU coverage.
- `tests/api/order-payment.api.spec.ts`: Order and payment coverage.
- `tests/api/admin-config.api.spec.ts`: Tax, discount, and role coverage.
- `tests/api/contract-smoke.api.spec.ts`: Contract-only coverage for first-batch endpoints.
- `tests/api/cleanup.api.spec.ts`: Manual/CI cleanup for `AT_` residues.

Modify:

- `package.json`: Add `test:api`, `test:api:contract`, `test:api:cleanup` scripts.
- `playwright.config.ts`: Add `api` project.
- `tsconfig.json`: Include `api/**/*.ts`.

## Commit Strategy

Commit after each task:

1. `test: add api config coverage`
2. `feat: add api core utilities`
3. `feat: add api resource registry`
4. `feat: add api fixtures`
5. `feat: add api coverage matrix`
6. `feat: add menu catalog api client`
7. `test: add menu catalog api coverage`
8. `feat: add sale item and spu api coverage`
9. `feat: add order payment api coverage`
10. `feat: add admin config api coverage`
11. `test: add first batch api contract smoke`
12. `chore: wire api test scripts`

### Task 1: API Config

**Files:**
- Create: `api/core/api-config.ts`
- Test: `tests/api/api-config.unit.spec.ts`

- [ ] **Step 1: Write config tests**

Create `tests/api/api-config.unit.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { loadApiConfig } from '../../api/core/api-config';

test.describe('API 配置', () => {
  test('应能从显式 API_BASE_URL 和 API Key 读取接口配置', () => {
    const config = loadApiConfig({
      API_BASE_URL: 'http://127.0.0.1:22080/kpos',
      API_AUTH_MODE: 'apiKey',
      API_KEY: 'test-key',
      API_ENABLE_DESTRUCTIVE: 'true',
    });

    expect(config.baseURL).toBe('http://127.0.0.1:22080/kpos');
    expect(config.auth.mode).toBe('apiKey');
    expect(config.auth.apiKey).toBe('test-key');
    expect(config.enableDestructive).toBe(true);
  });

  test('应能从 PLAYWRIGHT_BASE_URL 推导 API_BASE_URL', () => {
    const config = loadApiConfig({
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:22080',
      API_AUTH_MODE: 'cookie',
      API_COOKIE_LICENSE_AUTH_KEY: 'license-cookie',
    });

    expect(config.baseURL).toBe('http://127.0.0.1:22080/kpos');
    expect(config.auth.mode).toBe('cookie');
    expect(config.auth.licenseAuthKey).toBe('license-cookie');
  });

  test('API Key 模式缺少 API_KEY 时应抛出明确错误', () => {
    expect(() =>
      loadApiConfig({
        API_BASE_URL: 'http://127.0.0.1:22080/kpos',
        API_AUTH_MODE: 'apiKey',
      }),
    ).toThrow('API_AUTH_MODE=apiKey requires API_KEY.');
  });
});
```

- [ ] **Step 2: Run config tests to verify failure**

Run: `npx playwright test tests/api/api-config.unit.spec.ts --project=chrome --reporter=line`

Expected: fails because `../../api/core/api-config` does not exist.

- [ ] **Step 3: Implement API config**

Create `api/core/api-config.ts`:

```ts
export type ApiAuthMode = 'apiKey' | 'cookie';

export type ApiConfig = {
  baseURL: string;
  auth: {
    mode: ApiAuthMode;
    apiKey?: string;
    licenseAuthKey?: string;
  };
  enableDestructive: boolean;
  testPrefix: string;
};

type EnvSource = Record<string, string | undefined>;

export function loadApiConfig(env: EnvSource = process.env): ApiConfig {
  const baseURL = resolveApiBaseURL(env);
  const mode = resolveAuthMode(env.API_AUTH_MODE);
  const enableDestructive = env.API_ENABLE_DESTRUCTIVE === 'true';
  const testPrefix = env.API_TEST_PREFIX?.trim() || 'AT';

  if (mode === 'apiKey') {
    const apiKey = env.API_KEY?.trim();
    if (!apiKey) {
      throw new Error('API_AUTH_MODE=apiKey requires API_KEY.');
    }

    return {
      baseURL,
      auth: { mode, apiKey },
      enableDestructive,
      testPrefix,
    };
  }

  const licenseAuthKey = env.API_COOKIE_LICENSE_AUTH_KEY?.trim();
  if (!licenseAuthKey) {
    throw new Error('API_AUTH_MODE=cookie requires API_COOKIE_LICENSE_AUTH_KEY.');
  }

  return {
    baseURL,
    auth: { mode, licenseAuthKey },
    enableDestructive,
    testPrefix,
  };
}

function resolveApiBaseURL(env: EnvSource): string {
  const explicitApiBaseURL = env.API_BASE_URL?.trim();
  if (explicitApiBaseURL) {
    return stripTrailingSlash(explicitApiBaseURL);
  }

  const playwrightBaseURL = env.PLAYWRIGHT_BASE_URL?.trim();
  if (playwrightBaseURL) {
    return `${stripTrailingSlash(playwrightBaseURL)}/kpos`;
  }

  return 'http://192.168.0.182:22080/kpos';
}

function resolveAuthMode(value: string | undefined): ApiAuthMode {
  if (!value) {
    return 'apiKey';
  }

  if (value === 'apiKey' || value === 'cookie') {
    return value;
  }

  throw new Error(`Unsupported API_AUTH_MODE: ${value}. Expected apiKey or cookie.`);
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
```

- [ ] **Step 4: Run config tests to verify pass**

Run: `npx playwright test tests/api/api-config.unit.spec.ts --project=chrome --reporter=line`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add api/core/api-config.ts tests/api/api-config.unit.spec.ts
git commit -m "test: add api config coverage"
```

### Task 2: API Auth, Context, and Response Core

**Files:**
- Create: `api/core/api-auth.ts`
- Create: `api/core/api-context.ts`
- Create: `api/core/api-response.ts`
- Test: `tests/api/api-core.unit.spec.ts`

- [ ] **Step 1: Write core utility tests**

Create `tests/api/api-core.unit.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { buildApiAuthHeaders, buildApiAuthCookies } from '../../api/core/api-auth';
import { buildApiFailureMessage, expectResponseEnvelope } from '../../api/core/api-response';

test.describe('API 核心工具', () => {
  test('应能为 API Key 模式生成 Authorization header', () => {
    expect(
      buildApiAuthHeaders({
        baseURL: 'http://127.0.0.1:22080/kpos',
        auth: { mode: 'apiKey', apiKey: 'key-1' },
        enableDestructive: false,
        testPrefix: 'AT',
      }),
    ).toEqual({ Authorization: 'key-1' });
  });

  test('应能为 Cookie 模式生成 licenseAuthKey cookie', () => {
    expect(
      buildApiAuthCookies({
        baseURL: 'http://127.0.0.1:22080/kpos',
        auth: { mode: 'cookie', licenseAuthKey: 'cookie-1' },
        enableDestructive: false,
        testPrefix: 'AT',
      }),
    ).toEqual([{ name: 'licenseAuthKey', value: 'cookie-1', url: 'http://127.0.0.1:22080/kpos' }]);
  });

  test('应能校验 Response 包装结构', () => {
    expect(() =>
      expectResponseEnvelope({
        code: 0,
        msg: 'OK',
        traceId: 'trace-1',
        data: { id: 1 },
      }),
    ).not.toThrow();
  });

  test('响应失败信息应包含方法、路径和状态码', () => {
    expect(
      buildApiFailureMessage({
        method: 'POST',
        path: '/api/menu/menuGroup',
        status: 500,
        requestSummary: '{"name":"AT_1_MG"}',
        responseSummary: '{"msg":"error"}',
      }),
    ).toContain('POST /api/menu/menuGroup -> 500');
  });
});
```

- [ ] **Step 2: Run core tests to verify failure**

Run: `npx playwright test tests/api/api-core.unit.spec.ts --project=chrome --reporter=line`

Expected: fails because core files do not exist.

- [ ] **Step 3: Implement auth utilities**

Create `api/core/api-auth.ts`:

```ts
import type { ApiConfig } from './api-config';

export type ApiCookie = {
  name: string;
  value: string;
  url: string;
};

export function buildApiAuthHeaders(config: ApiConfig): Record<string, string> {
  if (config.auth.mode === 'apiKey') {
    return { Authorization: config.auth.apiKey ?? '' };
  }

  return {};
}

export function buildApiAuthCookies(config: ApiConfig): ApiCookie[] {
  if (config.auth.mode !== 'cookie') {
    return [];
  }

  return [
    {
      name: 'licenseAuthKey',
      value: config.auth.licenseAuthKey ?? '',
      url: config.baseURL,
    },
  ];
}
```

- [ ] **Step 4: Implement response utilities**

Create `api/core/api-response.ts`:

```ts
import { expect } from '@playwright/test';

export type ApiEnvelope<T = unknown> = {
  code: number;
  msg: string;
  traceId: string;
  data: T;
};

export type ApiFailureInfo = {
  method: string;
  path: string;
  status: number;
  requestSummary: string;
  responseSummary: string;
  resourceId?: string;
};

export function expectResponseEnvelope(value: unknown): asserts value is ApiEnvelope {
  expect(value, '接口响应应为对象').toEqual(expect.any(Object));
  const envelope = value as Partial<ApiEnvelope>;
  expect(envelope.code, '接口响应应包含 code').toEqual(expect.any(Number));
  expect(envelope.msg, '接口响应应包含 msg').toEqual(expect.any(String));
  expect(envelope.traceId, '接口响应应包含 traceId').toEqual(expect.any(String));
  expect(Object.prototype.hasOwnProperty.call(envelope, 'data'), '接口响应应包含 data').toBe(true);
}

export function buildApiFailureMessage(info: ApiFailureInfo): string {
  const lines = [
    `${info.method} ${info.path} -> ${info.status}`,
    `request: ${info.requestSummary}`,
    `response: ${info.responseSummary}`,
  ];

  if (info.resourceId) {
    lines.push(`resource: ${info.resourceId}`);
  }

  return lines.join('\n');
}

export function summarizeJson(value: unknown, maxLength = 1_000): string {
  const text = safeStringify(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
```

- [ ] **Step 5: Implement API context factory**

Create `api/core/api-context.ts`:

```ts
import { request, type APIRequestContext } from '@playwright/test';
import type { ApiConfig } from './api-config';
import { buildApiAuthCookies, buildApiAuthHeaders } from './api-auth';

export async function createApiRequestContext(config: ApiConfig): Promise<APIRequestContext> {
  const context = await request.newContext({
    baseURL: config.baseURL,
    extraHTTPHeaders: buildApiAuthHeaders(config),
  });

  const cookies = buildApiAuthCookies(config);
  if (cookies.length > 0) {
    await context.storageState({
      cookies: cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: new URL(cookie.url).hostname,
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      })),
      origins: [],
    });
  }

  return context;
}
```

- [ ] **Step 6: Run core tests to verify pass**

Run: `npx playwright test tests/api/api-core.unit.spec.ts --project=chrome --reporter=line`

Expected: 4 tests pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add api/core/api-auth.ts api/core/api-context.ts api/core/api-response.ts tests/api/api-core.unit.spec.ts
git commit -m "feat: add api core utilities"
```

### Task 3: Test Data ID and Resource Registry

**Files:**
- Create: `api/core/test-data-id.ts`
- Create: `api/core/resource-registry.ts`
- Test: `tests/api/api-resource-registry.unit.spec.ts`

- [ ] **Step 1: Write registry tests**

Create `tests/api/api-resource-registry.unit.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createShortTestName } from '../../api/core/test-data-id';
import { ResourceRegistry } from '../../api/core/resource-registry';

test.describe('API 测试资源登记', () => {
  test('应生成保留 AT_ 前缀且不超过最大长度的测试名称', () => {
    const name = createShortTestName({ prefix: 'AT', domain: 'MENU_GROUP', maxLength: 12, seed: 'A7' });

    expect(name.startsWith('AT_')).toBe(true);
    expect(name.length).toBeLessThanOrEqual(12);
  });

  test('应按清理优先级倒序执行资源清理', async () => {
    const cleaned: string[] = [];
    const registry = new ResourceRegistry();

    registry.register({
      type: 'menu',
      id: 1,
      cleanupPriority: 10,
      cleanup: async () => cleaned.push('menu'),
    });
    registry.register({
      type: 'saleItem',
      id: 2,
      cleanupPriority: 30,
      cleanup: async () => cleaned.push('saleItem'),
    });

    await registry.cleanupAll();

    expect(cleaned).toEqual(['saleItem', 'menu']);
  });
});
```

- [ ] **Step 2: Run registry tests to verify failure**

Run: `npx playwright test tests/api/api-resource-registry.unit.spec.ts --project=chrome --reporter=line`

Expected: fails because registry files do not exist.

- [ ] **Step 3: Implement short test name factory**

Create `api/core/test-data-id.ts`:

```ts
export type TestNameOptions = {
  prefix: string;
  domain: string;
  maxLength: number;
  seed?: string;
};

export function createShortTestName(options: TestNameOptions): string {
  const prefix = normalizePrefix(options.prefix);
  const timeCode = createTimeCode();
  const seed = (options.seed ?? createRandomSeed()).replace(/[^A-Za-z0-9]/g, '').slice(0, 2).padEnd(2, '0');
  const suffix = domainSuffix(options.domain);
  const raw = `${prefix}_${timeCode}${seed}_${suffix}`;

  if (raw.length <= options.maxLength) {
    return raw;
  }

  const minPrefix = `${prefix}_`;
  if (options.maxLength <= minPrefix.length) {
    throw new Error(`maxLength ${options.maxLength} cannot preserve prefix ${minPrefix}.`);
  }

  return raw.slice(0, options.maxLength);
}

function normalizePrefix(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4) || 'AT';
}

function createTimeCode(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
}

function createRandomSeed(): string {
  return Math.floor(Math.random() * 1_296).toString(36).toUpperCase().padStart(2, '0');
}

function domainSuffix(domain: string): string {
  const compact = domain.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return compact.slice(0, 3) || 'API';
}
```

- [ ] **Step 4: Implement resource registry**

Create `api/core/resource-registry.ts`:

```ts
export type RegisteredResource = {
  type: string;
  id: string | number;
  name?: string;
  cleanupPriority: number;
  cleanup: () => Promise<void>;
};

export type CleanupResult = {
  resource: RegisteredResource;
  error?: Error;
};

export class ResourceRegistry {
  private readonly resources: RegisteredResource[] = [];

  register(resource: RegisteredResource): void {
    this.resources.push(resource);
  }

  has(type: string, id: string | number): boolean {
    return this.resources.some((resource) => resource.type === type && resource.id === id);
  }

  assertRegistered(type: string, id: string | number): void {
    if (!this.has(type, id)) {
      throw new Error(`Refusing to operate on unregistered API test resource: ${type}:${id}`);
    }
  }

  async cleanupAll(): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];
    const ordered = [...this.resources].sort((left, right) => right.cleanupPriority - left.cleanupPriority);

    for (const resource of ordered) {
      try {
        await resource.cleanup();
        results.push({ resource });
      } catch (error) {
        results.push({ resource, error: error instanceof Error ? error : new Error(String(error)) });
      }
    }

    this.resources.length = 0;
    return results;
  }
}
```

- [ ] **Step 5: Run registry tests to verify pass**

Run: `npx playwright test tests/api/api-resource-registry.unit.spec.ts --project=chrome --reporter=line`

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add api/core/test-data-id.ts api/core/resource-registry.ts tests/api/api-resource-registry.unit.spec.ts
git commit -m "feat: add api resource registry"
```

### Task 4: API Fixture

**Files:**
- Create: `fixtures/api.fixture.ts`
- Test: `tests/api/api-fixture.unit.spec.ts`

- [ ] **Step 1: Write fixture smoke test**

Create `tests/api/api-fixture.unit.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { test } from '../../fixtures/api.fixture';

test.describe('API fixture', () => {
  test('应注入 API 配置和资源登记器', async ({ apiConfig, resourceRegistry }) => {
    expect(apiConfig.baseURL).toContain('/kpos');
    expect(resourceRegistry.has('missing', 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run fixture test to verify failure**

Run: `$env:API_KEY='test-key'; npx playwright test tests/api/api-fixture.unit.spec.ts --project=chrome --reporter=line`

Expected: fails because `../../fixtures/api.fixture` does not exist.

- [ ] **Step 3: Implement API fixture**

Create `fixtures/api.fixture.ts`:

```ts
import { test as base, type APIRequestContext } from '@playwright/test';
import { loadApiConfig, type ApiConfig } from '../api/core/api-config';
import { createApiRequestContext } from '../api/core/api-context';
import { ResourceRegistry } from '../api/core/resource-registry';

type ApiFixtures = {
  apiConfig: ApiConfig;
  apiRequest: APIRequestContext;
  resourceRegistry: ResourceRegistry;
};

export const test = base.extend<ApiFixtures>({
  apiConfig: async ({}, use) => {
    await use(loadApiConfig());
  },
  apiRequest: async ({ apiConfig }, use) => {
    const context = await createApiRequestContext(apiConfig);
    await use(context);
    await context.dispose();
  },
  resourceRegistry: async ({}, use) => {
    const registry = new ResourceRegistry();
    await use(registry);
    const results = await registry.cleanupAll();
    const failures = results.filter((result) => result.error);
    if (failures.length > 0) {
      console.warn(
        failures
          .map((failure) => `${failure.resource.type}:${failure.resource.id} cleanup failed: ${failure.error?.message}`)
          .join('\n'),
      );
    }
  },
});
```

- [ ] **Step 4: Run fixture test to verify pass**

Run: `$env:API_KEY='test-key'; npx playwright test tests/api/api-fixture.unit.spec.ts --project=chrome --reporter=line`

Expected: 1 test passes.

- [ ] **Step 5: Commit**

Run:

```powershell
git add fixtures/api.fixture.ts tests/api/api-fixture.unit.spec.ts
git commit -m "feat: add api fixtures"
```

### Task 5: Coverage Matrix

**Files:**
- Create: `api/contracts/first-batch-api-cases.ts`
- Test: `tests/api/api-contract-matrix.unit.spec.ts`

- [ ] **Step 1: Write coverage matrix validation test**

Create `tests/api/api-contract-matrix.unit.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { firstBatchApiCases } from '../../api/contracts/first-batch-api-cases';

test.describe('首批接口覆盖矩阵', () => {
  test('应包含 112 个首批接口记录', () => {
    expect(firstBatchApiCases).toHaveLength(112);
  });

  test('每条接口记录都应声明覆盖等级和用例文件', () => {
    for (const apiCase of firstBatchApiCases) {
      expect(apiCase.method).toMatch(/^(GET|POST|PUT|DELETE)$/);
      expect(apiCase.path.startsWith('/api/')).toBe(true);
      expect(apiCase.group.length).toBeGreaterThan(0);
      expect(apiCase.coverage).toMatch(/^(positive-crud|positive-business|contract-only|deferred-external|blocked-missing-data)$/);
      expect(apiCase.specFile.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run matrix test to verify failure**

Run: `npx playwright test tests/api/api-contract-matrix.unit.spec.ts --project=chrome --reporter=line`

Expected: fails because matrix file does not exist.

- [ ] **Step 3: Implement coverage matrix file**

Create `api/contracts/first-batch-api-cases.ts` with this header and then add all 112 records from `接口文档.md`:

```ts
export type ApiCoverageLevel =
  | 'positive-crud'
  | 'positive-business'
  | 'contract-only'
  | 'deferred-external'
  | 'blocked-missing-data';

export type FirstBatchApiCase = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  group: string;
  coverage: ApiCoverageLevel;
  specFile: string;
  riskNote: string;
};

export const firstBatchApiCases: FirstBatchApiCase[] = [
  { method: 'GET', path: '/api/menu/checkMenuLastUpdateTime', group: '菜单管理', coverage: 'contract-only', specFile: 'tests/api/contract-smoke.api.spec.ts', riskNote: '只读缓存时间检查' },
  { method: 'POST', path: '/api/menu/clearCache', group: '菜单管理', coverage: 'contract-only', specFile: 'tests/api/contract-smoke.api.spec.ts', riskNote: '缓存清理不验证业务数据变化' },
  { method: 'GET', path: '/api/menu/fetchGlobalOption', group: '菜单管理', coverage: 'positive-crud', specFile: 'tests/api/menu-catalog.api.spec.ts', riskNote: '由 global option 链路覆盖' },
  { method: 'GET', path: '/api/menu/listGlobalOption', group: '菜单管理', coverage: 'positive-crud', specFile: 'tests/api/menu-catalog.api.spec.ts', riskNote: '由 global option 链路覆盖' },
  { method: 'GET', path: '/api/menu/liteMenu/{id}', group: '菜单管理', coverage: 'positive-crud', specFile: 'tests/api/menu-catalog.api.spec.ts', riskNote: '读取测试菜单' },
  { method: 'GET', path: '/api/menu/menu', group: '菜单管理', coverage: 'positive-crud', specFile: 'tests/api/menu-catalog.api.spec.ts', riskNote: '读取菜单树' },
  { method: 'POST', path: '/api/menu/menu', group: '菜单管理', coverage: 'positive-crud', specFile: 'tests/api/menu-catalog.api.spec.ts', riskNote: '创建测试菜单' },
  { method: 'PUT', path: '/api/menu/menu', group: '菜单管理', coverage: 'positive-crud', specFile: 'tests/api/menu-catalog.api.spec.ts', riskNote: '更新测试菜单' },
  { method: 'GET', path: '/api/menu/menu/{id}', group: '菜单管理', coverage: 'positive-crud', specFile: 'tests/api/menu-catalog.api.spec.ts', riskNote: '按 id 读取测试菜单' },
  { method: 'GET', path: '/api/menu/menus', group: '菜单管理', coverage: 'positive-crud', specFile: 'tests/api/menu-catalog.api.spec.ts', riskNote: '菜单列表查询' },
];
```

After the first 10 records, append the remaining 102 records exactly from the extracted first-batch list:

- 菜单全局搜索: 1 record
- 菜单组管理: 12 records
- 订单管理: 17 records
- 订单支付: 8 records
- 分类管理: 13 records
- 角色管理: 3 records
- 商品管理: 21 records
- 税费管理: 3 records
- 折扣管理: 3 records
- `global-option-category-controller`: 5 records
- `global-option-controller`: 10 records
- SPU 库存管理: 6 records

Use these coverage defaults:

```ts
const positiveCrudGroups = new Set([
  '菜单组管理',
  '分类管理',
  '商品管理',
  '税费管理',
  '折扣管理',
  '角色管理',
  'global-option-category-controller',
  'global-option-controller',
]);
```

Assign `deferred-external` to payment endpoints that require real terminal, gateway, or refund behavior. Assign `positive-business` to order save/list/fetch/recall/void endpoints covered by `order-payment.api.spec.ts`. Assign `contract-only` to cache, clear, batch, and destructive endpoints not executed in the first positive chain.

- [ ] **Step 4: Run matrix test to verify pass**

Run: `npx playwright test tests/api/api-contract-matrix.unit.spec.ts --project=chrome --reporter=line`

Expected: 2 tests pass and firstBatchApiCases length equals 112.

- [ ] **Step 5: Commit**

Run:

```powershell
git add api/contracts/first-batch-api-cases.ts tests/api/api-contract-matrix.unit.spec.ts
git commit -m "feat: add api coverage matrix"
```

### Task 6: Domain Clients

**Files:**
- Create: `api/clients/menu-api.client.ts`
- Create: `api/clients/sale-item-api.client.ts`
- Create: `api/clients/spu-api.client.ts`
- Create: `api/clients/order-api.client.ts`
- Create: `api/clients/payment-api.client.ts`
- Create: `api/clients/admin-config-api.client.ts`

- [ ] **Step 1: Create menu client**

Create `api/clients/menu-api.client.ts`:

```ts
import type { APIRequestContext } from '@playwright/test';

export class MenuApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async createMenu(body: Record<string, unknown>) {
    return await this.request.post('/api/menu/menu', { data: body });
  }

  async updateMenu(body: Record<string, unknown>) {
    return await this.request.put('/api/menu/menu', { data: body });
  }

  async getMenu(id: string | number) {
    return await this.request.get(`/api/menu/menu/${id}`);
  }

  async listMenus() {
    return await this.request.get('/api/menu/menus');
  }

  async getLiteMenu(id: string | number) {
    return await this.request.get(`/api/menu/liteMenu/${id}`);
  }

  async downloadMenu(product = 'POS') {
    return await this.request.get('/api/menu/menu', { params: { product } });
  }

  async createMenuGroup(body: Record<string, unknown>) {
    return await this.request.post('/api/menu/menuGroup', { data: body });
  }

  async updateMenuGroup(body: Record<string, unknown>) {
    return await this.request.put('/api/menu/menuGroup', { data: body });
  }

  async deleteMenuGroup(id: string | number) {
    return await this.request.delete(`/api/menu/menuGroup/${id}`);
  }

  async getMenuGroup(id: string | number) {
    return await this.request.get(`/api/menu/menuGroup/${id}`);
  }

  async listMenuGroups() {
    return await this.request.get('/api/menu/menuGroups');
  }

  async createCategory(body: Record<string, unknown>) {
    return await this.request.post('/api/menu/menuCategory', { data: body });
  }

  async updateCategory(body: Record<string, unknown>) {
    return await this.request.put('/api/menu/menuCategory', { data: body });
  }

  async deleteCategory(id: string | number) {
    return await this.request.delete(`/api/menu/menuCategory/${id}`);
  }

  async getCategory(id: string | number) {
    return await this.request.get(`/api/menu/menuCategory/${id}`);
  }

  async searchMenu(keyword: string) {
    return await this.request.get('/api/search/menu', { params: { keyword } });
  }

  async createGlobalOptionCategory(body: Record<string, unknown>) {
    return await this.request.post('/api/menu/globalOptionCategory', { data: body });
  }

  async updateGlobalOptionCategory(body: Record<string, unknown>) {
    return await this.request.put('/api/menu/globalOptionCategory', { data: body });
  }

  async deleteGlobalOptionCategory(id: string | number) {
    return await this.request.delete(`/api/menu/globalOptionCategory/${id}`);
  }

  async createGlobalOption(body: Record<string, unknown>) {
    return await this.request.post('/api/menu/menuGlobalOption', { data: body });
  }

  async updateGlobalOption(body: Record<string, unknown>) {
    return await this.request.put('/api/menu/menuGlobalOption', { data: body });
  }

  async deleteGlobalOption(id: string | number) {
    return await this.request.delete(`/api/menu/menuGlobalOption/${id}`);
  }
}
```

- [ ] **Step 2: Create sale item and SPU clients**

Create `api/clients/sale-item-api.client.ts` and `api/clients/spu-api.client.ts`:

```ts
import type { APIRequestContext } from '@playwright/test';

export class SaleItemApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async createSaleItem(body: Record<string, unknown>) {
    return await this.request.post('/api/menu/menuSaleItem', { data: body });
  }

  async updateSaleItem(body: Record<string, unknown>) {
    return await this.request.put('/api/menu/menuSaleItem', { data: body });
  }

  async quickEditSaleItem(body: Record<string, unknown>) {
    return await this.request.put('/api/menu/menuSaleItem/quickEdit', { data: body });
  }

  async deleteSaleItem(id: string | number) {
    return await this.request.delete(`/api/menu/menuSaleItem/${id}`);
  }

  async getSaleItem(id: string | number) {
    return await this.request.get(`/api/menu/menuSaleItem/${id}`);
  }

  async searchSaleItems(keyword: string) {
    return await this.request.get('/api/menu/menuSaleItems/search', { params: { keyword } });
  }
}
```

```ts
import type { APIRequestContext } from '@playwright/test';

export class SpuApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async assignSaleItem(body: Record<string, unknown>) {
    return await this.request.post('/api/spu/menuSaleItem/assign', { data: body });
  }

  async linkSaleItem(body: Record<string, unknown>) {
    return await this.request.post('/api/spu/menuSaleItem/link', { data: body });
  }

  async listByCode(code: string) {
    return await this.request.get(`/api/spu/menuSaleItem/list/${encodeURIComponent(code)}`);
  }

  async stockOperation(body: Record<string, unknown>) {
    return await this.request.post('/api/spu/stockOperation', { data: body });
  }

  async stockOperations(body: Record<string, unknown>) {
    return await this.request.post('/api/spu/stockOperations', { data: body });
  }
}
```

- [ ] **Step 3: Create order, payment, and admin config clients**

Create the remaining clients with one method per endpoint used by the positive specs:

```ts
import type { APIRequestContext } from '@playwright/test';

export class OrderApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async saveOrder(body: Record<string, unknown>) {
    return await this.request.post('/api/order/save', { data: body });
  }

  async fetchOrder(params: Record<string, string | number>) {
    return await this.request.get('/api/order/fetch', { params });
  }

  async listOrders(params: Record<string, string | number>) {
    return await this.request.get('/api/order/list', { params });
  }

  async recallOrders(params: Record<string, string | number>) {
    return await this.request.get('/api/order/recall', { params });
  }

  async listOrderDetails(params: Record<string, string | number>) {
    return await this.request.get('/api/order/detail/list', { params });
  }

  async voidOrder(body: Record<string, unknown>) {
    return await this.request.post('/api/order/void', { data: body });
  }
}
```

```ts
import type { APIRequestContext } from '@playwright/test';

export class PaymentApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async savePaymentRecord(body: Record<string, unknown>) {
    return await this.request.post('/api/payment/record/save', { data: body });
  }

  async deletePaymentRecord(body: Record<string, unknown>) {
    return await this.request.post('/api/payment/record/delete', { data: body });
  }

  async addTip(paymentId: string | number, body: Record<string, unknown>) {
    return await this.request.post(`/api/payment/${paymentId}/tip`, { data: body });
  }

  async voidPayment(paymentId: string | number, body: Record<string, unknown>) {
    return await this.request.post(`/api/payment/${paymentId}/void`, { data: body });
  }
}
```

```ts
import type { APIRequestContext } from '@playwright/test';

export class AdminConfigApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async listTaxes() {
    return await this.request.get('/api/tax/list');
  }

  async saveTax(body: Record<string, unknown>) {
    return await this.request.post('/api/tax/save', { data: body });
  }

  async deleteTax(body: Record<string, unknown>) {
    return await this.request.post('/api/tax/delete', { data: body });
  }

  async listDiscounts() {
    return await this.request.get('/api/discount/list');
  }

  async saveDiscount(body: Record<string, unknown>) {
    return await this.request.post('/api/discount/save', { data: body });
  }

  async deleteDiscount(body: Record<string, unknown>) {
    return await this.request.post('/api/discount/delete', { data: body });
  }

  async listRoles() {
    return await this.request.get('/api/admin/role/list');
  }

  async saveRole(body: Record<string, unknown>) {
    return await this.request.post('/api/admin/role/save', { data: body });
  }

  async deleteRole(body: Record<string, unknown>) {
    return await this.request.post('/api/admin/role/delete', { data: body });
  }
}
```

- [ ] **Step 4: Run TypeScript check through Playwright listing**

Run: `$env:API_KEY='test-key'; npx playwright test tests/api/api-fixture.unit.spec.ts --project=chrome --list`

Expected: command lists the fixture test without TypeScript import errors.

- [ ] **Step 5: Commit**

Run:

```powershell
git add api/clients
git commit -m "feat: add first batch api clients"
```

### Task 7: Wire Clients Into Fixture

**Files:**
- Modify: `fixtures/api.fixture.ts`
- Test: `tests/api/api-fixture.unit.spec.ts`

- [ ] **Step 1: Extend fixture test**

Modify `tests/api/api-fixture.unit.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { test } from '../../fixtures/api.fixture';

test.describe('API fixture', () => {
  test('应注入 API 配置、资源登记器和领域 client', async ({
    apiConfig,
    resourceRegistry,
    menuApi,
    saleItemApi,
    orderApi,
    paymentApi,
    adminConfigApi,
    spuApi,
  }) => {
    expect(apiConfig.baseURL).toContain('/kpos');
    expect(resourceRegistry.has('missing', 1)).toBe(false);
    expect(menuApi).toBeTruthy();
    expect(saleItemApi).toBeTruthy();
    expect(orderApi).toBeTruthy();
    expect(paymentApi).toBeTruthy();
    expect(adminConfigApi).toBeTruthy();
    expect(spuApi).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run fixture test to verify failure**

Run: `$env:API_KEY='test-key'; npx playwright test tests/api/api-fixture.unit.spec.ts --project=chrome --reporter=line`

Expected: fails because the fixture does not expose domain clients.

- [ ] **Step 3: Update fixture with clients**

Modify `fixtures/api.fixture.ts` to include:

```ts
import { AdminConfigApiClient } from '../api/clients/admin-config-api.client';
import { MenuApiClient } from '../api/clients/menu-api.client';
import { OrderApiClient } from '../api/clients/order-api.client';
import { PaymentApiClient } from '../api/clients/payment-api.client';
import { SaleItemApiClient } from '../api/clients/sale-item-api.client';
import { SpuApiClient } from '../api/clients/spu-api.client';
```

Extend the `ApiFixtures` type:

```ts
  menuApi: MenuApiClient;
  saleItemApi: SaleItemApiClient;
  orderApi: OrderApiClient;
  paymentApi: PaymentApiClient;
  adminConfigApi: AdminConfigApiClient;
  spuApi: SpuApiClient;
```

Add fixture factories:

```ts
  menuApi: async ({ apiRequest }, use) => {
    await use(new MenuApiClient(apiRequest));
  },
  saleItemApi: async ({ apiRequest }, use) => {
    await use(new SaleItemApiClient(apiRequest));
  },
  orderApi: async ({ apiRequest }, use) => {
    await use(new OrderApiClient(apiRequest));
  },
  paymentApi: async ({ apiRequest }, use) => {
    await use(new PaymentApiClient(apiRequest));
  },
  adminConfigApi: async ({ apiRequest }, use) => {
    await use(new AdminConfigApiClient(apiRequest));
  },
  spuApi: async ({ apiRequest }, use) => {
    await use(new SpuApiClient(apiRequest));
  },
```

- [ ] **Step 4: Run fixture test to verify pass**

Run: `$env:API_KEY='test-key'; npx playwright test tests/api/api-fixture.unit.spec.ts --project=chrome --reporter=line`

Expected: 1 test passes.

- [ ] **Step 5: Commit**

Run:

```powershell
git add fixtures/api.fixture.ts tests/api/api-fixture.unit.spec.ts
git commit -m "feat: wire api clients into fixture"
```

### Task 8: Test Data Factories

**Files:**
- Create: `test-data/api/menu-api-data.ts`
- Create: `test-data/api/order-api-data.ts`
- Create: `test-data/api/payment-api-data.ts`

- [ ] **Step 1: Create menu data factories**

Create `test-data/api/menu-api-data.ts`:

```ts
import { createShortTestName } from '../../api/core/test-data-id';

export function buildMenuRequest(seed: string): Record<string, unknown> {
  return {
    name: createShortTestName({ prefix: 'AT', domain: 'MN', maxLength: 20, seed }),
    active: true,
    deleted: false,
  };
}

export function buildMenuGroupRequest(menuId: string | number, seed: string): Record<string, unknown> {
  return {
    menuId,
    name: createShortTestName({ prefix: 'AT', domain: 'MG', maxLength: 20, seed }),
    active: true,
    deleted: false,
    displayPriority: 1,
  };
}

export function buildCategoryRequest(menuId: string | number, groupId: string | number, seed: string): Record<string, unknown> {
  return {
    menuId,
    groupId,
    name: createShortTestName({ prefix: 'AT', domain: 'CAT', maxLength: 20, seed }),
    active: true,
    deleted: false,
    displayPriority: 1,
  };
}

export function buildGlobalOptionCategoryRequest(menuId: string | number, seed: string): Record<string, unknown> {
  return {
    menuId,
    name: createShortTestName({ prefix: 'AT', domain: 'GOC', maxLength: 20, seed }),
    active: true,
    deleted: false,
  };
}

export function buildGlobalOptionRequest(categoryId: string | number, seed: string): Record<string, unknown> {
  return {
    categoryId,
    name: createShortTestName({ prefix: 'AT', domain: 'GO', maxLength: 20, seed }),
    price: 0.5,
    active: true,
    deleted: false,
  };
}

export function buildSaleItemRequest(menuId: string | number, categoryId: string | number, seed: string): Record<string, unknown> {
  return {
    menuId,
    categoryId,
    name: createShortTestName({ prefix: 'AT', domain: 'MI', maxLength: 20, seed }),
    price: 1.23,
    active: true,
    deleted: false,
  };
}
```

- [ ] **Step 2: Create order and payment factories**

Create `test-data/api/order-api-data.ts`:

```ts
import { createShortTestName } from '../../api/core/test-data-id';

export function buildOrderRequest(saleItemId: string | number, seed: string): Record<string, unknown> {
  return {
    orderType: 'TO_GO',
    customerName: createShortTestName({ prefix: 'AT', domain: 'ORD', maxLength: 20, seed }),
    items: [
      {
        saleItemId,
        quantity: 1,
        price: 1.23,
      },
    ],
  };
}
```

Create `test-data/api/payment-api-data.ts`:

```ts
export function buildPaymentRecordRequest(orderId: string | number): Record<string, unknown> {
  return {
    orderId,
    paymentMethod: 'CASH',
    amount: 1.23,
  };
}

export function buildTipRequest(amount = 0.1): Record<string, unknown> {
  return {
    tipAmount: amount,
  };
}
```

- [ ] **Step 3: Run TypeScript list check**

Run: `$env:API_KEY='test-key'; npx playwright test tests/api/api-fixture.unit.spec.ts --project=chrome --list`

Expected: command lists tests without TypeScript import errors.

- [ ] **Step 4: Commit**

Run:

```powershell
git add test-data/api
git commit -m "feat: add api test data factories"
```

### Task 9: Admin Config API Tests

**Files:**
- Create: `tests/api/admin-config.api.spec.ts`

- [ ] **Step 1: Write admin config tests**

Create `tests/api/admin-config.api.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { test } from '../../fixtures/api.fixture';
import { expectResponseEnvelope } from '../../api/core/api-response';
import { createShortTestName } from '../../api/core/test-data-id';

test.describe('后台配置接口', () => {
  test('应能创建、查询、更新并删除测试税费', async ({ apiConfig, adminConfigApi }) => {
    test.skip(!apiConfig.enableDestructive, '需要 API_ENABLE_DESTRUCTIVE=true 才能执行写接口测试。');

    const name = createShortTestName({ prefix: apiConfig.testPrefix, domain: 'TAX', maxLength: 16, seed: 'T1' });
    const createResponse = await adminConfigApi.saveTax({ name, rate: 0.01, active: true });
    expect(createResponse.ok()).toBe(true);
    const createBody = await createResponse.json();
    expectResponseEnvelope(createBody);

    const listResponse = await adminConfigApi.listTaxes();
    expect(listResponse.ok()).toBe(true);
    const listBody = await listResponse.json();
    expectResponseEnvelope(listBody);
    expect(JSON.stringify(listBody.data)).toContain(name);

    const id = (createBody.data as { id?: number }).id;
    expect(id, '创建税费后应返回 id').toBeTruthy();

    const updateResponse = await adminConfigApi.saveTax({ id, name: `${name}U`.slice(0, 16), rate: 0.02, active: true });
    expect(updateResponse.ok()).toBe(true);

    const deleteResponse = await adminConfigApi.deleteTax({ id });
    expect(deleteResponse.ok()).toBe(true);
  });

  test('应能创建、查询、更新并删除测试折扣', async ({ apiConfig, adminConfigApi }) => {
    test.skip(!apiConfig.enableDestructive, '需要 API_ENABLE_DESTRUCTIVE=true 才能执行写接口测试。');

    const name = createShortTestName({ prefix: apiConfig.testPrefix, domain: 'DSC', maxLength: 16, seed: 'D1' });
    const createResponse = await adminConfigApi.saveDiscount({ name, rate: 0.1, active: true });
    expect(createResponse.ok()).toBe(true);
    const createBody = await createResponse.json();
    expectResponseEnvelope(createBody);

    const listResponse = await adminConfigApi.listDiscounts();
    expect(listResponse.ok()).toBe(true);
    const listBody = await listResponse.json();
    expectResponseEnvelope(listBody);
    expect(JSON.stringify(listBody.data)).toContain(name);

    const id = (createBody.data as { id?: number }).id;
    expect(id, '创建折扣后应返回 id').toBeTruthy();

    const updateResponse = await adminConfigApi.saveDiscount({ id, name: `${name}U`.slice(0, 16), rate: 0.2, active: true });
    expect(updateResponse.ok()).toBe(true);

    const deleteResponse = await adminConfigApi.deleteDiscount({ id });
    expect(deleteResponse.ok()).toBe(true);
  });
});
```

- [ ] **Step 2: Run admin config tests**

Run: `if (-not $env:API_KEY) { throw 'Set API_KEY before running admin config API tests.' }; $env:API_ENABLE_DESTRUCTIVE='true'; npx playwright test tests/api/admin-config.api.spec.ts --project=chrome --reporter=line`

Expected: tests either pass or fail with exact request-shape mismatch. If request shape mismatch occurs, inspect Swagger schema in `接口文档.md`, adjust the request factory in the spec, and rerun until tax and discount CRUD pass.

- [ ] **Step 3: Commit**

Run:

```powershell
git add tests/api/admin-config.api.spec.ts
git commit -m "feat: add admin config api coverage"
```

### Task 10: Menu Catalog API Tests

**Files:**
- Create: `tests/api/menu-catalog.api.spec.ts`

- [ ] **Step 1: Write menu catalog test skeleton**

Create `tests/api/menu-catalog.api.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { test } from '../../fixtures/api.fixture';
import { expectResponseEnvelope } from '../../api/core/api-response';
import {
  buildCategoryRequest,
  buildGlobalOptionCategoryRequest,
  buildGlobalOptionRequest,
  buildMenuGroupRequest,
  buildMenuRequest,
} from '../../test-data/api/menu-api-data';

test.describe('菜单目录接口', () => {
  test('应能创建菜单、菜单组、分类和全局 option 后查询并清理', async ({ apiConfig, menuApi, resourceRegistry }) => {
    test.skip(!apiConfig.enableDestructive, '需要 API_ENABLE_DESTRUCTIVE=true 才能执行写接口测试。');

    const menuResponse = await menuApi.createMenu(buildMenuRequest('M1'));
    expect(menuResponse.ok()).toBe(true);
    const menuBody = await menuResponse.json();
    expectResponseEnvelope(menuBody);
    const menuId = (menuBody.data as { id?: number }).id;
    expect(menuId, '创建菜单应返回 id').toBeTruthy();

    const menuGroupResponse = await menuApi.createMenuGroup(buildMenuGroupRequest(menuId as number, 'G1'));
    expect(menuGroupResponse.ok()).toBe(true);
    const menuGroupBody = await menuGroupResponse.json();
    expectResponseEnvelope(menuGroupBody);
    const groupId = (menuGroupBody.data as { id?: number }).id;
    expect(groupId, '创建菜单组应返回 id').toBeTruthy();
    resourceRegistry.register({
      type: 'menuGroup',
      id: groupId as number,
      cleanupPriority: 20,
      cleanup: async () => {
        await menuApi.deleteMenuGroup(groupId as number);
      },
    });

    const categoryResponse = await menuApi.createCategory(buildCategoryRequest(menuId as number, groupId as number, 'C1'));
    expect(categoryResponse.ok()).toBe(true);
    const categoryBody = await categoryResponse.json();
    expectResponseEnvelope(categoryBody);
    const categoryId = (categoryBody.data as { id?: number }).id;
    expect(categoryId, '创建分类应返回 id').toBeTruthy();
    resourceRegistry.register({
      type: 'category',
      id: categoryId as number,
      cleanupPriority: 30,
      cleanup: async () => {
        await menuApi.deleteCategory(categoryId as number);
      },
    });

    const optionCategoryResponse = await menuApi.createGlobalOptionCategory(buildGlobalOptionCategoryRequest(menuId as number, 'OC'));
    expect(optionCategoryResponse.ok()).toBe(true);
    const optionCategoryBody = await optionCategoryResponse.json();
    expectResponseEnvelope(optionCategoryBody);
    const optionCategoryId = (optionCategoryBody.data as { id?: number }).id;
    expect(optionCategoryId, '创建 global option category 应返回 id').toBeTruthy();
    resourceRegistry.register({
      type: 'globalOptionCategory',
      id: optionCategoryId as number,
      cleanupPriority: 30,
      cleanup: async () => {
        await menuApi.deleteGlobalOptionCategory(optionCategoryId as number);
      },
    });

    const optionResponse = await menuApi.createGlobalOption(buildGlobalOptionRequest(optionCategoryId as number, 'O1'));
    expect(optionResponse.ok()).toBe(true);
    const optionBody = await optionResponse.json();
    expectResponseEnvelope(optionBody);
    const optionId = (optionBody.data as { id?: number }).id;
    expect(optionId, '创建 global option 应返回 id').toBeTruthy();
    resourceRegistry.register({
      type: 'globalOption',
      id: optionId as number,
      cleanupPriority: 40,
      cleanup: async () => {
        await menuApi.deleteGlobalOption(optionId as number);
      },
    });

    expect((await menuApi.getMenu(menuId as number)).ok()).toBe(true);
    expect((await menuApi.getMenuGroup(groupId as number)).ok()).toBe(true);
    expect((await menuApi.getCategory(categoryId as number)).ok()).toBe(true);
    expect((await menuApi.searchMenu('AT_')).ok()).toBe(true);
  });
});
```

- [ ] **Step 2: Run menu catalog test**

Run: `if (-not $env:API_KEY) { throw 'Set API_KEY before running menu catalog API tests.' }; $env:API_ENABLE_DESTRUCTIVE='true'; npx playwright test tests/api/menu-catalog.api.spec.ts --project=chrome --reporter=line`

Expected: test passes after adjusting payload fields to match Swagger schemas and backend validation rules.

- [ ] **Step 3: Commit**

Run:

```powershell
git add tests/api/menu-catalog.api.spec.ts test-data/api/menu-api-data.ts
git commit -m "test: add menu catalog api coverage"
```

### Task 11: Sale Item, SPU, Order, and Payment Specs

**Files:**
- Create: `tests/api/sale-item.api.spec.ts`
- Create: `tests/api/order-payment.api.spec.ts`

- [ ] **Step 1: Add sale item and SPU spec**

Create `tests/api/sale-item.api.spec.ts` with this flow:

```ts
import { expect } from '@playwright/test';
import { test } from '../../fixtures/api.fixture';
import { expectResponseEnvelope } from '../../api/core/api-response';
import { buildSaleItemRequest } from '../../test-data/api/menu-api-data';

test.describe('商品和 SPU 库存接口', () => {
  test('应能创建测试商品并执行查询、编辑和 SPU 查询', async ({ apiConfig, menuApi, saleItemApi, spuApi, resourceRegistry }) => {
    test.skip(!apiConfig.enableDestructive, '需要 API_ENABLE_DESTRUCTIVE=true 才能执行写接口测试。');

    const menuBody = await (await menuApi.createMenu({ name: 'AT_MI_MN', active: true, deleted: false })).json();
    expectResponseEnvelope(menuBody);
    const menuId = (menuBody.data as { id?: number }).id;
    expect(menuId).toBeTruthy();

    const groupBody = await (await menuApi.createMenuGroup({ menuId, name: 'AT_MI_MG', active: true, deleted: false })).json();
    expectResponseEnvelope(groupBody);
    const groupId = (groupBody.data as { id?: number }).id;
    expect(groupId).toBeTruthy();

    const categoryBody = await (await menuApi.createCategory({ menuId, groupId, name: 'AT_MI_CAT', active: true, deleted: false })).json();
    expectResponseEnvelope(categoryBody);
    const categoryId = (categoryBody.data as { id?: number }).id;
    expect(categoryId).toBeTruthy();

    const saleItemResponse = await saleItemApi.createSaleItem(buildSaleItemRequest(menuId as number, categoryId as number, 'I1'));
    expect(saleItemResponse.ok()).toBe(true);
    const saleItemBody = await saleItemResponse.json();
    expectResponseEnvelope(saleItemBody);
    const saleItemId = (saleItemBody.data as { id?: number }).id;
    expect(saleItemId).toBeTruthy();

    resourceRegistry.register({
      type: 'saleItem',
      id: saleItemId as number,
      cleanupPriority: 50,
      cleanup: async () => {
        await saleItemApi.deleteSaleItem(saleItemId as number);
      },
    });

    expect((await saleItemApi.getSaleItem(saleItemId as number)).ok()).toBe(true);
    expect((await saleItemApi.searchSaleItems('AT_')).ok()).toBe(true);
    expect((await spuApi.listByCode(String(saleItemId))).status()).not.toBe(500);
  });
});
```

- [ ] **Step 2: Add order and payment spec**

Create `tests/api/order-payment.api.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { test } from '../../fixtures/api.fixture';
import { expectResponseEnvelope } from '../../api/core/api-response';
import { buildOrderRequest } from '../../test-data/api/order-api-data';
import { buildPaymentRecordRequest, buildTipRequest } from '../../test-data/api/payment-api-data';

test.describe('订单和支付接口', () => {
  test('应能创建测试订单后查询并执行现金支付记录链路', async ({ apiConfig, orderApi, paymentApi }) => {
    test.skip(!apiConfig.enableDestructive, '需要 API_ENABLE_DESTRUCTIVE=true 才能执行写接口测试。');

    const orderResponse = await orderApi.saveOrder(buildOrderRequest(1, 'O1'));
    expect(orderResponse.ok()).toBe(true);
    const orderBody = await orderResponse.json();
    expectResponseEnvelope(orderBody);

    const orderId = (orderBody.data as { id?: number }).id;
    expect(orderId, '创建订单应返回 id').toBeTruthy();

    expect((await orderApi.fetchOrder({ id: orderId as number })).status()).not.toBe(500);
    expect((await orderApi.listOrders({ pageNo: 1, pageSize: 10 })).status()).not.toBe(500);
    expect((await orderApi.recallOrders({ pageNo: 1, pageSize: 10 })).status()).not.toBe(500);

    const paymentResponse = await paymentApi.savePaymentRecord(buildPaymentRecordRequest(orderId as number));
    expect(paymentResponse.status()).not.toBe(500);

    if (paymentResponse.ok()) {
      const paymentBody = await paymentResponse.json();
      expectResponseEnvelope(paymentBody);
      const paymentId = (paymentBody.data as { id?: number }).id;
      if (paymentId) {
        expect((await paymentApi.addTip(paymentId, buildTipRequest())).status()).not.toBe(500);
      }
    }

    const voidResponse = await orderApi.voidOrder({ orderId, voidReason: 'AT API test cleanup', forceRecoveryStock: true });
    expect(voidResponse.status()).not.toBe(500);
  });
});
```

- [ ] **Step 3: Run sale/order specs**

Run:

```powershell
if (-not $env:API_KEY) { throw 'Set API_KEY before running sale item, order, and payment API tests.' }
$env:API_ENABLE_DESTRUCTIVE='true'
npx playwright test tests/api/sale-item.api.spec.ts tests/api/order-payment.api.spec.ts --project=chrome --reporter=line
```

Expected: specs pass. If the backend rejects `saleItemId: 1`, change `order-payment.api.spec.ts` so the order test creates a sale item through `saleItemApi.createSaleItem(...)`, reads the returned `id`, passes that id into `buildOrderRequest(...)`, and registers the sale item for cleanup before rerunning.

- [ ] **Step 4: Commit**

Run:

```powershell
git add tests/api/sale-item.api.spec.ts tests/api/order-payment.api.spec.ts test-data/api/order-api-data.ts test-data/api/payment-api-data.ts
git commit -m "feat: add sale item order payment api coverage"
```

### Task 12: Contract Smoke and Cleanup

**Files:**
- Create: `tests/api/contract-smoke.api.spec.ts`
- Create: `tests/api/cleanup.api.spec.ts`

- [ ] **Step 1: Add contract smoke spec**

Create `tests/api/contract-smoke.api.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { firstBatchApiCases } from '../../api/contracts/first-batch-api-cases';
import { test } from '../../fixtures/api.fixture';

test.describe('首批接口契约冒烟', () => {
  for (const apiCase of firstBatchApiCases.filter((entry) => entry.coverage === 'contract-only')) {
    test(`${apiCase.group} ${apiCase.method} ${apiCase.path} 不应返回 500`, async ({ apiRequest }) => {
      const path = apiCase.path.replace(/\{[^}]+\}/g, '0');
      const response = await apiRequest.fetch(path, {
        method: apiCase.method,
        data: apiCase.method === 'POST' || apiCase.method === 'PUT' ? {} : undefined,
      });

      expect(response.status(), `${apiCase.method} ${apiCase.path} 不应返回 500`).not.toBe(500);
    });
  }
});
```

- [ ] **Step 2: Add cleanup spec**

Create `tests/api/cleanup.api.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { test } from '../../fixtures/api.fixture';

test.describe('API 测试数据清理', () => {
  test('应能扫描 AT_ 前缀测试数据入口', async ({ menuApi, saleItemApi, adminConfigApi }) => {
    const menuResponse = await menuApi.listMenus();
    const saleItemResponse = await saleItemApi.searchSaleItems('AT_');
    const taxResponse = await adminConfigApi.listTaxes();
    const discountResponse = await adminConfigApi.listDiscounts();

    expect(menuResponse.status()).not.toBe(500);
    expect(saleItemResponse.status()).not.toBe(500);
    expect(taxResponse.status()).not.toBe(500);
    expect(discountResponse.status()).not.toBe(500);
  });
});
```

- [ ] **Step 3: Run contract and cleanup specs**

Run:

```powershell
if (-not $env:API_KEY) { throw 'Set API_KEY before running contract smoke API tests.' }
npx playwright test tests/api/contract-smoke.api.spec.ts tests/api/cleanup.api.spec.ts --project=chrome --reporter=line
```

Expected: no 500 responses. Cleanup scan spec passes.

- [ ] **Step 4: Commit**

Run:

```powershell
git add tests/api/contract-smoke.api.spec.ts tests/api/cleanup.api.spec.ts
git commit -m "test: add first batch api contract smoke"
```

### Task 13: Project Wiring

**Files:**
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Update package scripts**

Modify `package.json` scripts:

```json
"test:api": "playwright test tests/api",
"test:api:contract": "playwright test tests/api/contract-smoke.api.spec.ts",
"test:api:cleanup": "playwright test tests/api/cleanup.api.spec.ts"
```

- [ ] **Step 2: Update Playwright config**

Modify `playwright.config.ts` projects:

```ts
{
  name: 'api',
  testMatch: /api/,
  use: {
    viewport: null,
  },
}
```

If `api` project causes UI projects to also run API tests, update existing `chrome` project with `testIgnore: /py-migrate|api/`.

- [ ] **Step 3: Update TypeScript include**

Modify `tsconfig.json` include:

```json
"api/**/*.ts"
```

- [ ] **Step 4: Run API suite list and config tests**

Run:

```powershell
$env:API_KEY='test-key'
npx playwright test tests/api/api-config.unit.spec.ts tests/api/api-core.unit.spec.ts tests/api/api-resource-registry.unit.spec.ts --project=api --reporter=line
```

Expected: unit-level API tests pass under the `api` project.

- [ ] **Step 5: Run full API suite against target environment**

Run:

```powershell
$env:API_BASE_URL='http://192.168.0.182:22080/kpos'
$env:API_AUTH_MODE='apiKey'
if (-not $env:API_KEY) { throw 'Set API_KEY before running the full API suite.' }
$env:API_ENABLE_DESTRUCTIVE='true'
npm run test:api
```

Expected: first batch API suite passes or reports endpoint-specific request-shape failures that include method/path/status/body summaries.

- [ ] **Step 6: Commit**

Run:

```powershell
git add package.json playwright.config.ts tsconfig.json
git commit -m "chore: wire api test scripts"
```

## Self-Review Checklist

- Spec coverage: Tasks cover API core, auth modes, destructive guard, short `AT_` naming, resource registry, coverage matrix, five API spec files, cleanup, and CI-facing scripts.
- Red-flag scan: The plan avoids unresolved task markers and fake secret values. Steps that depend on backend schema verification instruct the executor to inspect Swagger and make a concrete payload adjustment before rerun.
- Type consistency: Fixture names are stable: `apiConfig`, `apiRequest`, `resourceRegistry`, `menuApi`, `saleItemApi`, `orderApi`, `paymentApi`, `adminConfigApi`, `spuApi`.

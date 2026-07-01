# API Setup CRUD Fixture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a UI-test-facing `apiSetup` fixture that provides parameterized CRUD for tax, discount, menu resources, and reusable menu presets for UI data setup.

**Architecture:** Keep HTTP-only behavior in API clients, request body construction in `test-data/api/*`, and test data orchestration in `tests/api/support/api-setup.ts`. The UI fixture exposes `apiSetup` while reusing `ResourceRegistry` for automatic cleanup. System deletes are soft deletes; no physical delete or force-delete branch is designed.

**Tech Stack:** Playwright Test, TypeScript, existing API request context, existing `ResourceRegistry`, existing endpoint assertion helpers.

---

## File Structure

- Create: `test-data/api/admin-config-api-data.ts`
  - Typed builders for tax, discount, and charge-shaped inputs.
- Modify: `test-data/api/menu-api-data.ts`
  - Add override-based builders for menu, menu group, category, global option category, global option, and sale item.
- Modify: `tests/api/unit/api-test-data.unit.spec.ts`
  - Unit tests for parameter overrides, default names, and bounded name generation.
- Create: `tests/api/support/api-setup.ts`
  - Resource CRUD modules and `menuPreset` orchestration.
- Create: `tests/api/unit/api-setup.unit.spec.ts`
  - Mock-client tests for CRUD calls, ID resolution, cleanup registration, and explicit delete cleanup marking.
- Create: `fixtures/api-setup.fixture.ts`
  - UI-facing fixture that exposes `apiSetup`.
- Modify: `tests/api/support/endpoint-resources.ts`
  - Delegate existing endpoint resource creation to `apiSetup` while preserving current endpoint spec API.
- Modify: `tests/api/unit/api-endpoint-resources.unit.spec.ts`
  - Update tests to assert compatibility remains intact.
- Create: `tests/api/unit/api-setup-fixture.unit.spec.ts`
  - Fixture contract test proving `apiSetup` can be created from Playwright fixtures.
- Pending input before charge CRUD implementation:
  - A captured successful charge list/save/update/delete request, or a reachable Swagger path for charge management. Current repository and tested Swagger paths do not expose a charge management API client.

---

### Task 1: Add Parameterized Admin Config Builders

**Files:**
- Create: `test-data/api/admin-config-api-data.ts`
- Modify: `tests/api/unit/api-test-data.unit.spec.ts`

- [ ] **Step 1: Write failing tests for tax and discount builders**

Add these imports to `tests/api/unit/api-test-data.unit.spec.ts`:

```ts
import {
  ADMIN_CONFIG_API_NAME_LIMITS,
  buildDiscountRequest,
  buildTaxRequest,
} from '../../../test-data/api/admin-config-api-data';
```

Add tests inside the existing `test.describe('API 测试数据 builder', () => { ... })` block:

```ts
  unitTest('buildTaxRequest 应支持参数覆盖并保持税费默认字段', () => {
    const request = buildTaxRequest({
      name: 'AT_TAX_CUSTOM',
      rate: 8.875,
      outRate: 9.25,
      taxIncrease: 'INCLUDED',
    });

    expect(request).toEqual({
      tax: {
        name: 'AT_TAX_CUSTOM',
        rate: 8.875,
        outRate: 9.25,
        taxIncrease: 'INCLUDED',
      },
    });
  });

  unitTest('buildDiscountRequest 应支持百分比和固定金额折扣参数', () => {
    expect(
      buildDiscountRequest({
        name: 'AT_DISC_RATE',
        rate: 10,
        rateType: 'percentage',
        description: 'UI discount',
      }),
    ).toEqual({
      name: 'AT_DISC_RATE',
      rate: 10,
      rateType: 2,
      description: 'UI discount',
    });

    expect(
      buildDiscountRequest({
        name: 'AT_DISC_AMOUNT',
        rate: 3,
        rateType: 'amount',
      }),
    ).toMatchObject({
      name: 'AT_DISC_AMOUNT',
      rate: 3,
      rateType: 1,
    });
  });

  unitTest('admin config 默认名称应符合字段长度限制', () => {
    const taxRequest = buildTaxRequest({ seed: 'tax-seed-001' });
    const discountRequest = buildDiscountRequest({ seed: 'discount-seed-001' });

    expect(String(taxRequest.tax.name).length).toBeLessThanOrEqual(ADMIN_CONFIG_API_NAME_LIMITS.tax);
    expect(String(discountRequest.name).length).toBeLessThanOrEqual(ADMIN_CONFIG_API_NAME_LIMITS.discount);
  });
```

- [ ] **Step 2: Run the failing builder tests**

Run:

```bash
npx playwright test tests/api/unit/api-test-data.unit.spec.ts --project=api --reporter=line
```

Expected: FAIL because `test-data/api/admin-config-api-data.ts`, `buildTaxRequest`, and `buildDiscountRequest` do not exist.

- [ ] **Step 3: Implement admin config builders**

Create `test-data/api/admin-config-api-data.ts`:

```ts
import { createShortTestName } from '../../api/core/test-data-id';

export type TaxIncreaseMode = 'DEFAULT' | 'INCLUDED';
export type DiscountRateType = 'percentage' | 'amount';

export type TaxRequestOptions = {
  name?: string;
  rate?: number;
  outRate?: number;
  taxIncrease?: TaxIncreaseMode;
  seed?: string | number;
};

export type DiscountRequestOptions = {
  name?: string;
  rate?: number;
  rateType?: DiscountRateType;
  description?: string;
  seed?: string | number;
};

export type TaxApiRequest = {
  tax: {
    name: string;
    rate: number;
    outRate: number;
    taxIncrease: TaxIncreaseMode;
  };
};

export type DiscountApiRequest = {
  name: string;
  rate: number;
  rateType: 1 | 2;
  description: string;
};

export const ADMIN_CONFIG_API_NAME_LIMITS = {
  tax: 16,
  discount: 16,
  charge: 16,
} as const;

export function buildTaxRequest(options: TaxRequestOptions = {}): TaxApiRequest {
  const name = options.name ?? buildApiTestName('TAX', ADMIN_CONFIG_API_NAME_LIMITS.tax, options.seed);
  const rate = options.rate ?? 1;

  return {
    tax: {
      name,
      rate,
      outRate: options.outRate ?? rate,
      taxIncrease: options.taxIncrease ?? 'DEFAULT',
    },
  };
}

export function buildDiscountRequest(options: DiscountRequestOptions = {}): DiscountApiRequest {
  const name = options.name ?? buildApiTestName('DSC', ADMIN_CONFIG_API_NAME_LIMITS.discount, options.seed);

  return {
    name,
    rate: options.rate ?? 10,
    rateType: toDiscountRateTypeCode(options.rateType ?? 'percentage'),
    description: options.description ?? name,
  };
}

function toDiscountRateTypeCode(rateType: DiscountRateType): 1 | 2 {
  return rateType === 'amount' ? 1 : 2;
}

function buildApiTestName(domain: string, maxLength: number, seed?: string | number): string {
  return createShortTestName({
    prefix: 'AT',
    domain,
    maxLength,
    seed: toShortSeed(seed, domain),
  });
}

function toShortSeed(seed: string | number | undefined, fallback: string): string {
  const normalized = String(seed ?? fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);

  return normalized || '0';
}
```

- [ ] **Step 4: Verify builder tests pass**

Run:

```bash
npx playwright test tests/api/unit/api-test-data.unit.spec.ts --project=api --reporter=line
```

Expected: PASS for all API test-data unit tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add test-data/api/admin-config-api-data.ts tests/api/unit/api-test-data.unit.spec.ts
git commit -m "test(api): add admin config data builders"
```

---

### Task 2: Parameterize Menu Data Builders

**Files:**
- Modify: `test-data/api/menu-api-data.ts`
- Modify: `tests/api/unit/api-test-data.unit.spec.ts`

- [ ] **Step 1: Write failing tests for menu override support**

Add tests to `tests/api/unit/api-test-data.unit.spec.ts`:

```ts
  unitTest('菜单 builder 应支持名称价格和启用状态覆盖', () => {
    expect(
      buildMenuRequest({
        name: 'AT_MENU_CUSTOM',
        active: true,
        enabled: true,
        productLine: 'POS',
      }),
    ).toMatchObject({
      name: 'AT_MENU_CUSTOM',
      displayName: 'AT_MENU_CUSTOM',
      active: true,
      enabled: true,
      productLine: 'POS',
    });

    expect(
      buildSaleItemRequest(101, {
        name: 'AT_ITEM_CUSTOM',
        price: 12.5,
        enabled: false,
      }),
    ).toMatchObject({
      menuCategoryId: 101,
      name: 'AT_ITEM_CUSTOM',
      displayName: 'AT_ITEM_CUSTOM',
      posName: 'AT_ITEM_CUSTOM',
      price: 12.5,
      enabled: false,
    });
  });
```

- [ ] **Step 2: Run failing menu builder test**

Run:

```bash
npx playwright test tests/api/unit/api-test-data.unit.spec.ts --project=api --reporter=line
```

Expected: FAIL because the current builders accept only `seed?: string | number`, not override objects.

- [ ] **Step 3: Update menu builder signatures**

Modify `test-data/api/menu-api-data.ts` so the public signatures accept either a seed or an options object:

```ts
export type MenuRequestOptions = {
  name?: string;
  displayName?: string;
  description?: string;
  productLine?: string;
  sequence?: number;
  enabled?: boolean;
  active?: boolean;
  seed?: string | number;
};

export type NamedMenuRequestOptions = MenuRequestOptions & {
  posName?: string;
};

export type SaleItemRequestOptions = NamedMenuRequestOptions & {
  price?: number;
};

type BuilderOptions<T> = T | string | number | undefined;
```

Update each builder to resolve options like this:

```ts
export function buildMenuRequest(options?: BuilderOptions<MenuRequestOptions>): MenuApiRequest {
  const resolved = resolveBuilderOptions(options);
  const name = resolved.name ?? buildApiTestName('MENU', MENU_API_NAME_LIMITS.menu, resolved.seed);

  return {
    name,
    displayName: resolved.displayName ?? name,
    description: resolved.description ?? name,
    productLine: resolved.productLine ?? DEFAULT_MENU_PRODUCT,
    sequence: resolved.sequence ?? 1,
    enabled: resolved.enabled ?? true,
    active: resolved.active ?? false,
  };
}
```

Use the same pattern for `buildMenuGroupRequest`, `buildCategoryRequest`, `buildGlobalOptionCategoryRequest`, `buildGlobalOptionRequest`, and `buildSaleItemRequest`.

Add this helper at the bottom of the file:

```ts
function resolveBuilderOptions<T extends { seed?: string | number }>(
  options: BuilderOptions<T>,
): T {
  if (typeof options === 'string' || typeof options === 'number') {
    return { seed: options } as T;
  }

  return (options ?? {}) as T;
}
```

- [ ] **Step 4: Verify menu builder tests pass**

Run:

```bash
npx playwright test tests/api/unit/api-test-data.unit.spec.ts --project=api --reporter=line
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add test-data/api/menu-api-data.ts tests/api/unit/api-test-data.unit.spec.ts
git commit -m "test(api): parameterize menu data builders"
```

---

### Task 3: Build Core apiSetup CRUD Service

**Files:**
- Create: `tests/api/support/api-setup.ts`
- Create: `tests/api/unit/api-setup.unit.spec.ts`

- [ ] **Step 1: Write failing tests for tax and discount CRUD**

Create `tests/api/unit/api-setup.unit.spec.ts`:

```ts
import { expect, test as unitTest } from '@playwright/test';
import { ResourceRegistry } from '../../../api/core/resource-registry';
import { createApiSetup } from '../support/api-setup';

unitTest.describe('apiSetup CRUD 服务', () => {
  unitTest('tax.create 应保存税费、解析 id 并登记清理', async () => {
    const registry = new ResourceRegistry();
    const calls: Array<{ name: string; payload: unknown }> = [];
    const setup = createApiSetup({
      resourceRegistry: registry,
      adminConfigApi: {
        saveTax: async (payload: unknown) => {
          calls.push({ name: 'saveTax', payload });
          return jsonResponse({ code: 0, msg: 'ok', data: { taxId: 101 } });
        },
        listTaxes: async () => jsonResponse({ code: 0, msg: 'ok', data: [] }),
        deleteTax: async (payload: unknown) => {
          calls.push({ name: 'deleteTax', payload });
          return jsonResponse({ code: 0, msg: 'ok', data: true });
        },
      },
    });

    const tax = await setup.tax.create({ name: 'AT_TAX_UI', rate: 8.875 });

    expect(tax).toMatchObject({ id: 101, name: 'AT_TAX_UI' });
    expect(registry.has('tax', 101)).toBe(true);
    expect(calls[0]).toMatchObject({
      name: 'saveTax',
      payload: { tax: { name: 'AT_TAX_UI', rate: 8.875, outRate: 8.875, taxIncrease: 'DEFAULT' } },
    });
  });

  unitTest('discount.delete 应调用软删除接口并标记资源已清理', async () => {
    const registry = new ResourceRegistry();
    registry.register({
      type: 'discount',
      id: 202,
      cleanup: async () => undefined,
    });
    const calls: unknown[] = [];
    const setup = createApiSetup({
      resourceRegistry: registry,
      adminConfigApi: {
        saveDiscount: async () => jsonResponse({ code: 0, msg: 'ok', data: { discountId: 202 } }),
        listDiscounts: async () => jsonResponse({ code: 0, msg: 'ok', data: [] }),
        deleteDiscount: async (payload: unknown) => {
          calls.push(payload);
          return jsonResponse({ code: 0, msg: 'ok', data: true });
        },
      },
    });

    await setup.discount.delete(202);

    expect(calls).toEqual([{ discountId: 202 }]);
    expect(registry.has('discount', 202)).toBe(false);
  });
});

function jsonResponse(body: unknown) {
  return {
    status: () => 200,
    json: async () => body,
  };
}
```

- [ ] **Step 2: Run failing apiSetup unit tests**

Run:

```bash
npx playwright test tests/api/unit/api-setup.unit.spec.ts --project=api --reporter=line
```

Expected: FAIL because `tests/api/support/api-setup.ts` does not exist.

- [ ] **Step 3: Implement minimal tax and discount CRUD**

Create `tests/api/support/api-setup.ts`:

```ts
import type { APIResponse } from '@playwright/test';
import type { ApiQueryParams, ApiRequestData } from '../../../api/clients/client-path';
import type { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import type { MenuApiClient } from '../../../api/clients/menu-api.client';
import type { SaleItemApiClient } from '../../../api/clients/sale-item-api.client';
import type { ResourceId, ResourceRegistry } from '../../../api/core/resource-registry';
import {
  buildDiscountRequest,
  buildTaxRequest,
  type DiscountRequestOptions,
  type TaxRequestOptions,
} from '../../../test-data/api/admin-config-api-data';
import { expectApiOk } from './endpoint-assertions';
import { extractFirstResourceId, findResourceIdByName } from './endpoint-read-model';

export type ApiSetupResource = {
  id: ResourceId;
  name: string;
  request: ApiRequestData;
  body: unknown;
};

export type ApiSetupOptions = {
  resourceRegistry: ResourceRegistry;
  adminConfigApi: Pick<
    AdminConfigApiClient,
    'saveTax' | 'listTaxes' | 'deleteTax' | 'saveDiscount' | 'listDiscounts' | 'deleteDiscount'
  >;
  menuApi?: MenuApiClient;
  saleItemApi?: SaleItemApiClient;
};

export type ApiSetup = ReturnType<typeof createApiSetup>;

export function createApiSetup(options: ApiSetupOptions) {
  return {
    tax: {
      create: async (input: TaxRequestOptions = {}) => {
        const request = buildTaxRequest(input);
        const name = request.tax.name;

        return await createResource({
          resourceRegistry: options.resourceRegistry,
          type: 'tax',
          name,
          request,
          saveIdentity: { method: 'POST', path: '/api/tax/save' },
          save: () => options.adminConfigApi.saveTax(request),
          listIdentity: { method: 'GET', path: '/api/tax/list' },
          list: () => options.adminConfigApi.listTaxes({ keyword: name }),
          cleanup: (id) => options.adminConfigApi.deleteTax({ taxId: id }),
        });
      },
      list: async (params?: ApiQueryParams) =>
        await expectApiOk(await options.adminConfigApi.listTaxes(params), { method: 'GET', path: '/api/tax/list' }),
      read: async (id: ResourceId) =>
        await expectApiOk(await options.adminConfigApi.listTaxes({ taxId: id, id }), { method: 'GET', path: '/api/tax/list' }),
      update: async (id: ResourceId, input: TaxRequestOptions = {}) => {
        const request = buildTaxRequest(input);
        return await expectApiOk(
          await options.adminConfigApi.saveTax({ ...request, tax: { ...request.tax, id, taxId: id } }),
          { method: 'POST', path: '/api/tax/save' },
        );
      },
      delete: async (id: ResourceId) => {
        const body = await expectApiOk(
          await options.adminConfigApi.deleteTax({ taxId: id }),
          { method: 'POST', path: '/api/tax/delete' },
        );
        options.resourceRegistry.markCleaned('tax', id);
        return body;
      },
    },
    discount: {
      create: async (input: DiscountRequestOptions = {}) => {
        const request = buildDiscountRequest(input);

        return await createResource({
          resourceRegistry: options.resourceRegistry,
          type: 'discount',
          name: request.name,
          request,
          saveIdentity: { method: 'POST', path: '/api/discount/save' },
          save: () => options.adminConfigApi.saveDiscount(request),
          listIdentity: { method: 'GET', path: '/api/discount/list' },
          list: () => options.adminConfigApi.listDiscounts({ keyword: request.name }),
          cleanup: (id) => options.adminConfigApi.deleteDiscount({ discountId: id }),
        });
      },
      list: async (params?: ApiQueryParams) =>
        await expectApiOk(await options.adminConfigApi.listDiscounts(params), { method: 'GET', path: '/api/discount/list' }),
      read: async (id: ResourceId) =>
        await expectApiOk(await options.adminConfigApi.listDiscounts({ discountId: id, id }), { method: 'GET', path: '/api/discount/list' }),
      update: async (id: ResourceId, input: DiscountRequestOptions = {}) => {
        const request = buildDiscountRequest(input);
        return await expectApiOk(
          await options.adminConfigApi.saveDiscount({ ...request, id, discountId: id }),
          { method: 'POST', path: '/api/discount/save' },
        );
      },
      delete: async (id: ResourceId) => {
        const body = await expectApiOk(
          await options.adminConfigApi.deleteDiscount({ discountId: id }),
          { method: 'POST', path: '/api/discount/delete' },
        );
        options.resourceRegistry.markCleaned('discount', id);
        return body;
      },
    },
  };
}

async function createResource(options: {
  resourceRegistry: ResourceRegistry;
  type: string;
  name: string;
  request: ApiRequestData;
  saveIdentity: { method: 'POST'; path: string };
  save: () => Promise<APIResponse>;
  listIdentity: { method: 'GET'; path: string };
  list: () => Promise<APIResponse>;
  cleanup: (id: ResourceId) => Promise<unknown>;
}): Promise<ApiSetupResource> {
  const saveBody = await expectApiOk(await options.save(), options.saveIdentity);
  let id = extractFirstResourceId(saveBody);

  if (id === undefined) {
    const listBody = await expectApiOk(await options.list(), options.listIdentity);
    id = findResourceIdByName(listBody.data, options.name);
  }

  if (id === undefined) {
    throw new Error(`${options.saveIdentity.path} 创建后未能通过响应或列表解析到资源 ID。`);
  }

  options.resourceRegistry.register({
    type: options.type,
    id,
    name: options.name,
    cleanup: () => options.cleanup(id),
  });

  return {
    id,
    name: options.name,
    request: options.request,
    body: saveBody,
  };
}
```

- [ ] **Step 4: Verify apiSetup unit tests pass**

Run:

```bash
npx playwright test tests/api/unit/api-setup.unit.spec.ts --project=api --reporter=line
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add tests/api/support/api-setup.ts tests/api/unit/api-setup.unit.spec.ts
git commit -m "test(api): add api setup admin config crud"
```

---

### Task 4: Add Menu CRUD and Menu Preset Service

**Files:**
- Modify: `tests/api/support/api-setup.ts`
- Modify: `tests/api/unit/api-setup.unit.spec.ts`

- [ ] **Step 1: Add failing tests for menu CRUD and preset creation**

Add a test to `tests/api/unit/api-setup.unit.spec.ts`:

```ts
  unitTest('menuPreset.create 应创建菜单组分类商品并返回 UI 可用上下文', async () => {
    const registry = new ResourceRegistry();
    const setup = createApiSetup({
      resourceRegistry: registry,
      adminConfigApi: minimalAdminConfigApi(),
      menuApi: {
        createMenu: async () => jsonResponse({ code: 0, msg: 'ok', data: { menuId: 11 } }),
        listMenus: async () => jsonResponse({ code: 0, msg: 'ok', data: [] }),
        updateMenu: async () => jsonResponse({ code: 0, msg: 'ok', data: true }),
        getMenu: async () => jsonResponse({ code: 0, msg: 'ok', data: { id: 11, name: 'AT_MENU' } }),
        createMenuGroup: async () => jsonResponse({ code: 0, msg: 'ok', data: { menuGroupId: 22 } }),
        listMenuGroups: async () => jsonResponse({ code: 0, msg: 'ok', data: [] }),
        getMenuGroup: async () => jsonResponse({ code: 0, msg: 'ok', data: { id: 22, name: 'AT_GROUP' } }),
        deleteMenuGroup: async () => jsonResponse({ code: 0, msg: 'ok', data: true }),
        createMenuCategory: async () => jsonResponse({ code: 0, msg: 'ok', data: { menuCategoryId: 33 } }),
        listCategories: async () => jsonResponse({ code: 0, msg: 'ok', data: [] }),
        getMenuCategory: async () => jsonResponse({ code: 0, msg: 'ok', data: { id: 33, name: 'AT_CAT' } }),
        updateMenuCategory: async () => jsonResponse({ code: 0, msg: 'ok', data: true }),
        deleteMenuCategory: async () => jsonResponse({ code: 0, msg: 'ok', data: true }),
      },
      saleItemApi: {
        createSaleItem: async () => jsonResponse({ code: 0, msg: 'ok', data: { menuSaleItemId: 44 } }),
        searchSaleItems: async () => jsonResponse({ code: 0, msg: 'ok', data: [] }),
        getSaleItem: async () => jsonResponse({ code: 0, msg: 'ok', data: { id: 44, name: 'AT_BURGER' } }),
        updateSaleItem: async () => jsonResponse({ code: 0, msg: 'ok', data: true }),
        deleteSaleItem: async () => jsonResponse({ code: 0, msg: 'ok', data: true }),
      },
    });

    const preset = await setup.menuPreset.create({
      menu: { name: 'AT_MENU' },
      group: { name: 'AT_GROUP' },
      category: { name: 'AT_CAT' },
      items: [{ name: 'AT_BURGER', price: 12.5 }],
    });

    expect(preset).toMatchObject({
      menu: { id: 11, name: 'AT_MENU' },
      menuGroup: { id: 22, name: 'AT_GROUP' },
      category: { id: 33, name: 'AT_CAT' },
      items: [{ id: 44, name: 'AT_BURGER' }],
    });
    expect(registry.has('menu', 11)).toBe(true);
    expect(registry.has('saleItem', 44)).toBe(true);
  });
```

Add this helper in the same test file:

```ts
function minimalAdminConfigApi() {
  return {
    saveTax: async () => jsonResponse({ code: 0, msg: 'ok', data: { taxId: 1 } }),
    listTaxes: async () => jsonResponse({ code: 0, msg: 'ok', data: [] }),
    deleteTax: async () => jsonResponse({ code: 0, msg: 'ok', data: true }),
    saveDiscount: async () => jsonResponse({ code: 0, msg: 'ok', data: { discountId: 2 } }),
    listDiscounts: async () => jsonResponse({ code: 0, msg: 'ok', data: [] }),
    deleteDiscount: async () => jsonResponse({ code: 0, msg: 'ok', data: true }),
  };
}
```

- [ ] **Step 2: Run failing menu setup tests**

Run:

```bash
npx playwright test tests/api/unit/api-setup.unit.spec.ts --project=api --reporter=line
```

Expected: FAIL because `menuPreset` is not implemented.

- [ ] **Step 3: Implement menu, menuGroup, category, saleItem CRUD and menuPreset**

In `tests/api/support/api-setup.ts`, add imports:

```ts
import {
  buildCategoryRequest,
  buildMenuGroupRequest,
  buildMenuRequest,
  buildSaleItemRequest,
  type CategoryApiRequest,
  type MenuApiRequest,
  type MenuGroupApiRequest,
  type SaleItemApiRequest,
} from '../../../test-data/api/menu-api-data';
```

Extend `createApiSetup()` with menu modules:

```ts
    menu: {
      create: async (input = {}) => {
        const menuApi = requireMenuApi(options);
        const request = buildMenuRequest(input);
        return await createResource({
          resourceRegistry: options.resourceRegistry,
          type: 'menu',
          name: request.name,
          request,
          saveIdentity: { method: 'POST', path: '/api/menu/menu' },
          save: () => menuApi.createMenu(request),
          listIdentity: { method: 'GET', path: '/api/menu/menus' },
          list: () => menuApi.listMenus({ name: request.name }),
          cleanup: (id) => menuApi.updateMenu({ ...request, id, enabled: false, active: false, deleted: true }),
        });
      },
      list: async (params?: ApiQueryParams) =>
        await expectApiOk(await requireMenuApi(options).listMenus(params), { method: 'GET', path: '/api/menu/menus' }),
      read: async (id: ResourceId) =>
        await expectApiOk(await requireMenuApi(options).getMenu(id), { method: 'GET', path: '/api/menu/menu/{id}' }),
      update: async (id: ResourceId, input: Partial<MenuApiRequest>) =>
        await expectApiOk(await requireMenuApi(options).updateMenu({ ...input, id }), { method: 'PUT', path: '/api/menu/menu' }),
      delete: async (id: ResourceId) => {
        const body = await expectApiOk(
          await requireMenuApi(options).updateMenu({ id, enabled: false, active: false, deleted: true }),
          { method: 'PUT', path: '/api/menu/menu' },
        );
        options.resourceRegistry.markCleaned('menu', id);
        return body;
      },
    },
```

Add equivalent modules for `menuGroup`, `category`, and `saleItem`, using existing client methods:

```ts
    menuGroup: {
      create: async (menuId: ResourceId, input = {}) => {
        const menuApi = requireMenuApi(options);
        const request = buildMenuGroupRequest(menuId, input);
        return await createResource({
          resourceRegistry: options.resourceRegistry,
          type: 'menuGroup',
          name: request.name,
          request,
          saveIdentity: { method: 'POST', path: '/api/menu/menuGroup' },
          save: () => menuApi.createMenuGroup(request),
          listIdentity: { method: 'GET', path: '/api/menu/menuGroups' },
          list: () => menuApi.listMenuGroups({ menuId, name: request.name }),
          cleanup: (id) => menuApi.deleteMenuGroup(id),
        });
      },
      read: async (id: ResourceId) =>
        await expectApiOk(await requireMenuApi(options).getMenuGroup(id), { method: 'GET', path: '/api/menu/menuGroup/{id}' }),
      list: async (params?: ApiQueryParams) =>
        await expectApiOk(await requireMenuApi(options).listMenuGroups(params), { method: 'GET', path: '/api/menu/menuGroups' }),
      update: async (id: ResourceId, input: Partial<MenuGroupApiRequest>) =>
        await expectApiOk(await requireMenuApi(options).updateMenuGroup({ ...input, id }), { method: 'PUT', path: '/api/menu/menuGroup' }),
      delete: async (id: ResourceId) => {
        const body = await expectApiOk(await requireMenuApi(options).deleteMenuGroup(id), { method: 'DELETE', path: '/api/menu/menuGroup/{id}' });
        options.resourceRegistry.markCleaned('menuGroup', id);
        return body;
      },
    },
```

Add `menuPreset.create`:

```ts
    menuPreset: {
      create: async (input: {
        menu?: Parameters<typeof buildMenuRequest>[0];
        group?: Parameters<typeof buildMenuGroupRequest>[1];
        category?: Parameters<typeof buildCategoryRequest>[2];
        items?: Array<Parameters<typeof buildSaleItemRequest>[1]>;
        tax?: TaxRequestOptions;
        discount?: DiscountRequestOptions;
      } = {}) => {
        const menu = await setup.menu.create(input.menu);
        const menuGroup = await setup.menuGroup.create(menu.id, input.group);
        const category = await setup.category.create(menu.id, menuGroup.id, input.category);
        const items = [];

        for (const itemInput of input.items ?? [{}]) {
          items.push(await setup.saleItem.create(menu.id, menuGroup.id, category.id, itemInput));
        }

        const tax = input.tax === undefined ? undefined : await setup.tax.create(input.tax);
        const discount = input.discount === undefined ? undefined : await setup.discount.create(input.discount);

        return { menu, menuGroup, category, items, tax, discount };
      },
      delete: async (preset: { menu?: ApiSetupResource; menuGroup?: ApiSetupResource; category?: ApiSetupResource; items?: ApiSetupResource[] }) => {
        for (const item of preset.items ?? []) {
          await setup.saleItem.delete(item.id);
        }
        if (preset.category !== undefined) {
          await setup.category.delete(preset.category.id);
        }
        if (preset.menuGroup !== undefined) {
          await setup.menuGroup.delete(preset.menuGroup.id);
        }
        if (preset.menu !== undefined) {
          await setup.menu.delete(preset.menu.id);
        }
      },
    },
```

Make `const setup = { ... }` inside `createApiSetup()` so `menuPreset` can call sibling modules.

Add guards:

```ts
function requireMenuApi(options: ApiSetupOptions): MenuApiClient {
  if (options.menuApi === undefined) {
    throw new Error('apiSetup menu/menuPreset 需要 menuApi。');
  }
  return options.menuApi;
}

function requireSaleItemApi(options: ApiSetupOptions): SaleItemApiClient {
  if (options.saleItemApi === undefined) {
    throw new Error('apiSetup saleItem/menuPreset 需要 saleItemApi。');
  }
  return options.saleItemApi;
}
```

- [ ] **Step 4: Verify menu setup unit tests pass**

Run:

```bash
npx playwright test tests/api/unit/api-setup.unit.spec.ts --project=api --reporter=line
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add tests/api/support/api-setup.ts tests/api/unit/api-setup.unit.spec.ts
git commit -m "test(api): add menu preset setup service"
```

---

### Task 5: Expose apiSetup as a UI Fixture

**Files:**
- Create: `fixtures/api-setup.fixture.ts`
- Create: `tests/api/unit/api-setup-fixture.unit.spec.ts`

- [ ] **Step 1: Write a fixture contract test**

Create `tests/api/unit/api-setup-fixture.unit.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { test } from '../../../fixtures/api-setup.fixture';

test.describe('apiSetup UI fixture', () => {
  test('应能向测试注入 apiSetup 模块', async ({ apiSetup }) => {
    expect(apiSetup.tax.create).toEqual(expect.any(Function));
    expect(apiSetup.discount.create).toEqual(expect.any(Function));
    expect(apiSetup.menuPreset.create).toEqual(expect.any(Function));
  });
});
```

- [ ] **Step 2: Run failing fixture contract test**

Run:

```bash
npx playwright test tests/api/unit/api-setup-fixture.unit.spec.ts --project=api --reporter=line
```

Expected: FAIL because `fixtures/api-setup.fixture.ts` does not exist.

- [ ] **Step 3: Implement the fixture**

Create `fixtures/api-setup.fixture.ts`:

```ts
import { test as apiTest } from './api.fixture';
import { createApiSetup, type ApiSetup } from '../tests/api/support/api-setup';

type ApiSetupFixture = {
  apiSetup: ApiSetup;
};

export const test = apiTest.extend<ApiSetupFixture>({
  apiSetup: async (
    { adminConfigApi, menuApi, saleItemApi, resourceRegistry },
    use,
  ) => {
    await use(
      createApiSetup({
        adminConfigApi,
        menuApi,
        saleItemApi,
        resourceRegistry,
      }),
    );
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 4: Verify fixture contract test passes**

Run:

```bash
npx playwright test tests/api/unit/api-setup-fixture.unit.spec.ts --project=api --reporter=line
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add fixtures/api-setup.fixture.ts tests/api/unit/api-setup-fixture.unit.spec.ts
git commit -m "test(api): expose api setup fixture"
```

---

### Task 6: Migrate endpointResources to apiSetup

**Files:**
- Modify: `tests/api/support/endpoint-resources.ts`
- Modify: `tests/api/unit/api-endpoint-resources.unit.spec.ts`

- [ ] **Step 1: Add compatibility tests**

In `tests/api/unit/api-endpoint-resources.unit.spec.ts`, add an assertion to the existing factory tests that `createTaxResource`, `createDiscountResource`, `createMenuResource`, and `createSaleItemResource` still return `{ id, name, request, body }` and register cleanup. Use existing mock helpers already in that file.

Add this specific expectation to the existing tax resource test:

```ts
    expect(resource).toMatchObject({
      id: 1001,
      name: expect.stringMatching(/^AT_/),
      request: expect.objectContaining({ tax: expect.any(Object) }),
      body: expect.objectContaining({ code: 0 }),
    });
```

- [ ] **Step 2: Run endpoint resource tests before migration**

Run:

```bash
npx playwright test tests/api/unit/api-endpoint-resources.unit.spec.ts --project=api --reporter=line
```

Expected: PASS before implementation changes; this locks compatibility.

- [ ] **Step 3: Delegate endpointResources to apiSetup**

In `tests/api/support/endpoint-resources.ts`, import `createApiSetup`:

```ts
import { createApiSetup } from './api-setup';
```

Inside `createEndpointResources(options)`, create setup once:

```ts
  const apiSetup = createApiSetup({
    adminConfigApi: options.adminConfigApi,
    menuApi: options.menuApi,
    saleItemApi: options.saleItemApi,
    resourceRegistry: options.resourceRegistry,
  });
```

Replace the tax and discount factories first:

```ts
    createTaxResource: async () => await apiSetup.tax.create(),
    createDiscountResource: async () => await apiSetup.discount.create(),
```

Then replace menu-related factories with the corresponding setup methods:

```ts
    createMenuResource: async () => await apiSetup.menu.create(),
    createMenuGroupResource: async (menuId: ResourceId) => await apiSetup.menuGroup.create(menuId),
    createCategoryResource: async (menuId: ResourceId, menuGroupId: ResourceId) =>
      await apiSetup.category.create(menuId, menuGroupId),
    createSaleItemResource: async (menuId: ResourceId, menuGroupId: ResourceId, categoryId: ResourceId) =>
      await apiSetup.saleItem.create(menuId, menuGroupId, categoryId),
```

Leave role, order, and payment factory logic unchanged in this task.

- [ ] **Step 4: Verify endpoint resource tests pass**

Run:

```bash
npx playwright test tests/api/unit/api-endpoint-resources.unit.spec.ts --project=api --reporter=line
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add tests/api/support/endpoint-resources.ts tests/api/unit/api-endpoint-resources.unit.spec.ts
git commit -m "test(api): reuse api setup in endpoint resources"
```

---

### Task 7: Validate Against Real API for Known Resources

**Files:**
- Create: `tests/api/endpoints/setup/api-setup-crud.endpoint.api.spec.ts`

- [ ] **Step 1: Write a real API CRUD smoke spec**

Create `tests/api/endpoints/setup/api-setup-crud.endpoint.api.spec.ts`:

```ts
import { expect, test } from '../../../fixtures/api-setup.fixture';

test.describe('API setup CRUD 真实接口', () => {
  test('应能通过 apiSetup 完成税费和折扣 CRUD', async ({ apiSetup }) => {
    const tax = await test.step('创建税费配置', async () =>
      await apiSetup.tax.create({ rate: 8.875 }),
    );
    await test.step('更新税费配置', async () => {
      await apiSetup.tax.update(tax.id, { name: tax.name, rate: 9.25 });
    });
    await test.step('查询税费配置列表', async () => {
      const body = await apiSetup.tax.list({ keyword: tax.name });
      expect(body.data).not.toBeUndefined();
    });
    await test.step('删除税费配置', async () => {
      await apiSetup.tax.delete(tax.id);
    });

    const discount = await test.step('创建折扣配置', async () =>
      await apiSetup.discount.create({ rate: 10, rateType: 'percentage' }),
    );
    await test.step('更新折扣配置', async () => {
      await apiSetup.discount.update(discount.id, { name: discount.name, rate: 15 });
    });
    await test.step('查询折扣配置列表', async () => {
      const body = await apiSetup.discount.list({ keyword: discount.name });
      expect(body.data).not.toBeUndefined();
    });
    await test.step('删除折扣配置', async () => {
      await apiSetup.discount.delete(discount.id);
    });
  });

  test('应能通过 apiSetup 创建和清理菜单套餐', async ({ apiSetup }) => {
    const preset = await apiSetup.menuPreset.create({
      menu: { active: false },
      group: {},
      category: {},
      items: [{ price: 12.5 }],
    });

    expect(preset.menu.id).not.toBeUndefined();
    expect(preset.items[0].id).not.toBeUndefined();

    await apiSetup.menuPreset.delete(preset);
  });
});
```

- [ ] **Step 2: Run the real API smoke spec**

Run against the dedicated test environment:

```bash
npx playwright test tests/api/endpoints/setup/api-setup-crud.endpoint.api.spec.ts --project=api --reporter=line
```

Expected: PASS. If an update/delete endpoint returns `code!=0`, inspect the response and adjust only the corresponding request builder or method payload.

- [ ] **Step 3: Run existing impacted endpoint specs**

Run:

```bash
npx playwright test tests/api/endpoints/admin-config/tax.endpoint.api.spec.ts tests/api/endpoints/admin-config/discount.endpoint.api.spec.ts tests/api/endpoints/menu/menu.endpoint.api.spec.ts tests/api/endpoints/menu/menu-group.endpoint.api.spec.ts tests/api/endpoints/menu/category.endpoint.api.spec.ts tests/api/endpoints/sale-item/sale-item.endpoint.api.spec.ts --project=api --reporter=line
```

Expected: PASS.

- [ ] **Step 4: Commit Task 7**

```bash
git add tests/api/endpoints/setup/api-setup-crud.endpoint.api.spec.ts
git commit -m "test(api): verify api setup crud against real api"
```

---

### Task 8: Charge CRUD Contract Gate

**Files:**
- Modify after contract is supplied: `api/clients/charge-api.client.ts`
- Modify after contract is supplied: `test-data/api/admin-config-api-data.ts`
- Modify after contract is supplied: `tests/api/support/api-setup.ts`
- Modify after contract is supplied: `tests/api/unit/api-setup.unit.spec.ts`

This task must not guess endpoint paths. Before implementing it, obtain one successful captured request for each charge operation:

- list/read charge
- save/create charge
- update charge
- delete charge

Current evidence:

- Repository search found no existing charge management API client.
- `http://192.168.0.182:22080/kpos/swagger-ui/index.html` returned 404 during plan writing.
- `http://192.168.0.182:22080/kpos/v3/api-docs`, `/kpos/v2/api-docs`, `/swagger-ui/index.html`, and `/v3/api-docs` did not expose reachable docs in the current session.

- [ ] **Step 1: Capture charge API contract**

Ask for captured cURL examples from the real UI for charge list, save, update, and delete. The examples must include URL, method, headers, and JSON body.

Expected: four captured requests are available in the thread or attached text.

- [ ] **Step 2: Add failing charge client/unit tests from captured paths**

Create `api/clients/charge-api.client.ts` with exact paths from the captured requests. Add a unit test in `tests/api/unit/api-setup.unit.spec.ts` asserting:

```ts
expect(apiSetup.charge.create).toEqual(expect.any(Function));
expect(apiSetup.charge.update).toEqual(expect.any(Function));
expect(apiSetup.charge.list).toEqual(expect.any(Function));
expect(apiSetup.charge.read).toEqual(expect.any(Function));
expect(apiSetup.charge.delete).toEqual(expect.any(Function));
```

Expected: FAIL until charge client and setup module are implemented.

- [ ] **Step 3: Implement charge CRUD using captured contract**

Use the captured request fields exactly. Keep method names:

```ts
apiSetup.charge.create(input)
apiSetup.charge.read(id)
apiSetup.charge.list(params)
apiSetup.charge.update(id, input)
apiSetup.charge.delete(id)
```

The implementation must:

- Use `buildChargeRequest(input)` from `test-data/api/admin-config-api-data.ts`.
- Register created charge resources with `ResourceRegistry`.
- Call `resourceRegistry.markCleaned('charge', id)` after explicit delete succeeds.
- Assert API responses with `expectApiOk`.

- [ ] **Step 4: Verify charge tests**

Run:

```bash
npx playwright test tests/api/unit/api-setup.unit.spec.ts --project=api --reporter=line
npx playwright test tests/api/endpoints/setup/api-setup-crud.endpoint.api.spec.ts --project=api --reporter=line
```

Expected: PASS including charge CRUD.

- [ ] **Step 5: Commit Task 8**

```bash
git add api/clients/charge-api.client.ts test-data/api/admin-config-api-data.ts tests/api/support/api-setup.ts tests/api/unit/api-setup.unit.spec.ts tests/api/endpoints/setup/api-setup-crud.endpoint.api.spec.ts
git commit -m "test(api): add charge setup crud"
```

---

### Task 9: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run unit tests**

```bash
npx playwright test tests/api/unit/api-test-data.unit.spec.ts tests/api/unit/api-setup.unit.spec.ts tests/api/unit/api-setup-fixture.unit.spec.ts tests/api/unit/api-endpoint-resources.unit.spec.ts --project=api --reporter=line
```

Expected: PASS.

- [ ] **Step 2: Run impacted real API specs**

```bash
npx playwright test tests/api/endpoints/setup/api-setup-crud.endpoint.api.spec.ts tests/api/endpoints/admin-config/tax.endpoint.api.spec.ts tests/api/endpoints/admin-config/discount.endpoint.api.spec.ts tests/api/endpoints/menu/menu.endpoint.api.spec.ts tests/api/endpoints/menu/menu-group.endpoint.api.spec.ts tests/api/endpoints/menu/category.endpoint.api.spec.ts tests/api/endpoints/sale-item/sale-item.endpoint.api.spec.ts --project=api --reporter=line
```

Expected: PASS in the dedicated test environment.

- [ ] **Step 3: Run TypeScript and diff checks**

```bash
npx tsc --noEmit
git diff --check
```

Expected: both commands exit 0. `git diff --check` may print Git line-ending warnings, but no whitespace errors.

- [ ] **Step 4: Commit any final adjustments**

```bash
git status --short
git add test-data/api/admin-config-api-data.ts test-data/api/menu-api-data.ts tests/api/support/api-setup.ts fixtures/api-setup.fixture.ts tests/api/support/endpoint-resources.ts tests/api/unit/api-test-data.unit.spec.ts tests/api/unit/api-setup.unit.spec.ts tests/api/unit/api-setup-fixture.unit.spec.ts tests/api/unit/api-endpoint-resources.unit.spec.ts tests/api/endpoints/setup/api-setup-crud.endpoint.api.spec.ts
git commit -m "test(api): finalize api setup crud fixture"
```

Expected: no uncommitted implementation changes remain after the final commit.

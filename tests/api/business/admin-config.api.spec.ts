import { expect, type APIResponse } from '@playwright/test';
import type { ApiRequestData } from '../../../api/clients/client-path';
import { expectResponseEnvelope, type ApiEnvelope } from '../../../api/core/api-response';
import type { ResourceId, ResourceRegistry } from '../../../api/core/resource-registry';
import { createShortTestName } from '../../../api/core/test-data-id';
import { test } from '../../../fixtures/api.fixture';
import discountListResponseSchema from '../schemas/admin-config/discount-list-response.schema.json';
import roleListResponseSchema from '../schemas/admin-config/role-list-response.schema.json';
import taxListResponseSchema from '../schemas/admin-config/tax-list-response.schema.json';
import { expectJsonSchema } from '../support/json-schema';

type AdminConfigResourceType = 'tax' | 'discount' | 'role';

const TAX_LIST_IDENTITY = { method: 'GET', path: '/api/tax/list' } as const;
const DISCOUNT_LIST_IDENTITY = { method: 'GET', path: '/api/discount/list' } as const;
const ROLE_LIST_IDENTITY = { method: 'GET', path: '/api/admin/role/list' } as const;

test.describe('后台配置接口', () => {
  test.describe('税费管理', () => {
    test('应能查询税费列表', async ({ adminConfigApi }) => {
      const body = await test.step('请求税费列表并校验响应信封', async () => {
        const response = await adminConfigApi.listTaxes();

        return await expectJsonEnvelope(response, `${TAX_LIST_IDENTITY.method} ${TAX_LIST_IDENTITY.path}`);
      });

      await test.step('校验税费列表响应 JSON schema', async () => {
        expectJsonSchema(body, taxListResponseSchema, `${TAX_LIST_IDENTITY.method} ${TAX_LIST_IDENTITY.path}`);
      });
    });

    test('应能保存并删除本次创建的测试税费', async ({
      adminConfigApi,
      resourceRegistry,
    }) => {
      const name = buildAdminConfigTestName('TAX');
      const saveBody = await test.step('保存测试税费并校验响应信封', async () => {
        const response = await adminConfigApi.saveTax(buildTaxRequest(name));

        return await expectJsonEnvelope(response, 'POST /api/tax/save');
      });

      const id = await resolveCreatedResourceId({
        name,
        saveBody,
        listLabel: 'GET /api/tax/list',
        listResource: async () => await adminConfigApi.listTaxes(),
      });

      if (id === undefined) {
        test.info().annotations.push({
          type: '说明',
          description: '保存税费响应和列表响应均未返回本次测试税费 id，跳过删除接口调用。',
        });
        return;
      }

      let deleted = false;
      registerCleanup({
        resourceRegistry,
        type: 'tax',
        id,
        name,
        cleanupPriority: 30,
        deleteResource: async () => {
          if (!deleted) {
            await adminConfigApi.deleteTax({ taxId: id });
          }
        },
      });

      await test.step('删除本次创建的测试税费并校验响应信封', async () => {
        const response = await adminConfigApi.deleteTax({ taxId: id });

        await expectJsonEnvelope(response, 'POST /api/tax/delete');
        deleted = true;
      });
    });
  });

  test.describe('折扣管理', () => {
    test('应能查询折扣列表', async ({ adminConfigApi }) => {
      const body = await test.step('请求折扣列表并校验响应信封', async () => {
        const response = await adminConfigApi.listDiscounts();

        return await expectJsonEnvelope(response, `${DISCOUNT_LIST_IDENTITY.method} ${DISCOUNT_LIST_IDENTITY.path}`);
      });

      await test.step('校验折扣列表响应 JSON schema', async () => {
        expectJsonSchema(body, discountListResponseSchema, `${DISCOUNT_LIST_IDENTITY.method} ${DISCOUNT_LIST_IDENTITY.path}`);
      });
    });

    test('应能保存并删除本次创建的测试折扣', async ({
      adminConfigApi,
      resourceRegistry,
    }) => {
      const name = buildAdminConfigTestName('DSC');
      const saveBody = await test.step('保存测试折扣并校验响应信封', async () => {
        const response = await adminConfigApi.saveDiscount(buildDiscountRequest(name));

        return await expectJsonEnvelope(response, 'POST /api/discount/save');
      });

      const id = await resolveCreatedResourceId({
        name,
        saveBody,
        listLabel: 'GET /api/discount/list',
        listResource: async () => await adminConfigApi.listDiscounts(),
      });

      if (id === undefined) {
        test.info().annotations.push({
          type: '说明',
          description: '保存折扣响应和列表响应均未返回本次测试折扣 id，跳过删除接口调用。',
        });
        return;
      }

      let deleted = false;
      registerCleanup({
        resourceRegistry,
        type: 'discount',
        id,
        name,
        cleanupPriority: 30,
        deleteResource: async () => {
          if (!deleted) {
            await adminConfigApi.deleteDiscount({ discountId: id });
          }
        },
      });

      await test.step('删除本次创建的测试折扣并校验响应信封', async () => {
        const response = await adminConfigApi.deleteDiscount({ discountId: id });

        await expectJsonEnvelope(response, 'POST /api/discount/delete');
        deleted = true;
      });
    });
  });

  test.describe('角色管理', () => {
    test('应能查询角色列表', async ({ adminConfigApi }) => {
      const body = await test.step('请求角色列表并校验响应信封', async () => {
        const response = await adminConfigApi.listRoles();

        return await expectJsonEnvelope(response, `${ROLE_LIST_IDENTITY.method} ${ROLE_LIST_IDENTITY.path}`);
      });

      await test.step('校验角色列表响应 JSON schema', async () => {
        expectJsonSchema(body, roleListResponseSchema, `${ROLE_LIST_IDENTITY.method} ${ROLE_LIST_IDENTITY.path}`);
      });
    });

    test('应能保存并删除本次创建的测试角色', async ({
      adminConfigApi,
      resourceRegistry,
    }) => {
      const name = buildAdminConfigTestName('ROLE');
      const saveBody = await test.step('保存测试角色并校验响应信封', async () => {
        const response = await adminConfigApi.saveRole(buildRoleRequest(name));

        return await expectJsonEnvelope(response, 'POST /api/admin/role/save');
      });

      const id = await resolveCreatedResourceId({
        name,
        saveBody,
        listLabel: 'GET /api/admin/role/list',
        listResource: async () => await adminConfigApi.listRoles(),
      });

      if (id === undefined) {
        test.info().annotations.push({
          type: '说明',
          description: '保存角色响应和列表响应均未返回本次测试角色 id，跳过删除接口调用。',
        });
        return;
      }

      let deleted = false;
      registerCleanup({
        resourceRegistry,
        type: 'role',
        id,
        name,
        cleanupPriority: 30,
        deleteResource: async () => {
          if (!deleted) {
            await adminConfigApi.deleteRole({ roleId: id });
          }
        },
      });

      await test.step('删除本次创建的测试角色并校验响应信封', async () => {
        const response = await adminConfigApi.deleteRole({ roleId: id });

        await expectJsonEnvelope(response, 'POST /api/admin/role/delete');
        deleted = true;
      });
    });
  });
});

async function expectJsonEnvelope(
  response: APIResponse,
  label: string,
): Promise<ApiEnvelope<unknown>> {
  expect(response.status(), `${label} 不应返回 500`).not.toBe(500);

  const body: unknown = await response.json();
  expectResponseEnvelope(body);
  expect(body.code, `${label} 应返回业务成功 code=0`).toBe(0);

  return body;
}

function buildAdminConfigTestName(domain: string): string {
  return createShortTestName({
    prefix: 'AT',
    domain,
    maxLength: 16,
  });
}

function buildTaxRequest(name: string): ApiRequestData {
  return {
    tax: {
      name,
      rate: 1,
      outRate: 1,
      taxIncrease: 'DEFAULT',
    },
  };
}

function buildDiscountRequest(name: string): ApiRequestData {
  return {
    name,
    rate: 10,
    rateType: 2,
    description: name,
  };
}

function buildRoleRequest(name: string): ApiRequestData {
  return {
    role: {
      name,
      discountCapRate: 0,
      function: [],
    },
  };
}

async function resolveCreatedResourceId(options: {
  name: string;
  saveBody: ApiEnvelope<unknown>;
  listLabel: string;
  listResource: () => Promise<APIResponse>;
}): Promise<ResourceId | undefined> {
  const savedId = extractResourceId(options.saveBody);

  if (savedId !== undefined) {
    return savedId;
  }

  return await test.step('从列表响应中定位本次创建记录 id', async () => {
    const listBody = await expectJsonEnvelope(await options.listResource(), options.listLabel);

    return findResourceIdByName(listBody.data, options.name);
  });
}

function registerCleanup(options: {
  resourceRegistry: ResourceRegistry;
  type: AdminConfigResourceType;
  id: ResourceId;
  name: string;
  cleanupPriority: number;
  deleteResource: () => Promise<unknown>;
}): void {
  options.resourceRegistry.register({
    type: options.type,
    id: options.id,
    name: options.name,
    cleanupPriority: options.cleanupPriority,
    cleanup: async () => {
      await options.deleteResource();
    },
  });
}

function extractResourceId(envelope: ApiEnvelope<unknown>): ResourceId | undefined {
  return extractIdFromValue(envelope.data) ?? extractIdFromValue(envelope);
}

function findResourceIdByName(value: unknown, name: string): ResourceId | undefined {
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

function recordHasName(record: Record<string, unknown>, name: string): boolean {
  return ['name', 'displayName', 'roleName', 'taxName', 'discountName'].some(
    (key) => record[key] === name,
  );
}

function extractIdFromValue(value: unknown): ResourceId | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return extractIdFromRecord(value) ?? extractIdFromValue(value.data);
}

function extractIdFromRecord(record: Record<string, unknown>): ResourceId | undefined {
  for (const key of ['id', 'taxId', 'discountId', 'roleId']) {
    const value = record[key];

    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

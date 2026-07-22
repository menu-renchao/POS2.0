import { expect, test, type APIResponse } from '@playwright/test';
import type { AdminConfigApiClient } from '../../../api/clients/admin-config-api.client';
import { ResourceRegistry } from '../../../api/core/resource-registry';
import { createStaffSetupService } from '../../../api/setup/staff.setup';

test.describe('员工角色数据预置服务', () => {
  test('应保留角色权限并按真实字段更新最大折扣且支持恢复', async () => {
    const adminConfigApi = createRoleApi();
    const service = createStaffSetupService({
      adminConfigApi: adminConfigApi.api as unknown as AdminConfigApiClient,
      resourceRegistry: new ResourceRegistry(),
    });

    const restore = await service.updateRoleDiscountCapRates(
      {
        Server: 20,
        Manager: 50,
        Boss: 100,
      },
      { verify: true },
    );

    expect(adminConfigApi.payloads.saveRole).toEqual([
      {
        role: {
          id: 3,
          name: 'Server',
          discountCapRate: 20,
          function: [{ id: 1 }, { id: 16 }],
        },
      },
      {
        role: {
          id: 2,
          name: 'Manager',
          discountCapRate: 50,
          function: [{ id: 1 }, { id: 16 }, { id: 35 }],
        },
      },
      {
        role: {
          id: 1,
          name: 'Boss',
          discountCapRate: 100,
          function: [{ id: 1 }, { id: 16 }, { id: 35 }, { id: 85 }],
        },
      },
    ]);
    expect(await service.readRoleDiscountCapRates(['Server', 'Manager', 'Boss'])).toEqual({
      Server: 20,
      Manager: 50,
      Boss: 100,
    });

    await restore();

    expect(await service.readRoleDiscountCapRates(['Server', 'Manager', 'Boss'])).toEqual({
      Server: 10,
      Manager: 25,
      Boss: 80,
    });
  });
});

function createRoleApi() {
  const roles = [
    {
      id: 1,
      name: 'Boss',
      discountCapRate: 80,
      function: [{ id: 1 }, { id: 16 }, { id: 35 }, { id: 85 }],
    },
    {
      id: 2,
      name: 'Manager',
      discountCapRate: 25,
      function: [{ id: 1 }, { id: 16 }, { id: 35 }],
    },
    {
      id: 3,
      name: 'Server',
      discountCapRate: 10,
      function: [{ id: 1 }, { id: 16 }],
    },
  ];
  const payloads = {
    saveRole: [] as unknown[],
  };

  return {
    payloads,
    api: {
      listRoles: async () => createApiResponse({ code: 0, msg: 'ok', data: roles }),
      saveRole: async (payload: unknown) => {
        payloads.saveRole.push(payload);
        const role = readRolePayload(payload);
        const currentRole = roles.find((candidate) => candidate.id === role.id);

        if (!currentRole) {
          return createApiResponse({ code: 1, msg: 'role not found' });
        }

        currentRole.discountCapRate = role.discountCapRate;
        return createApiResponse({ code: 0, msg: 'ok', data: { id: currentRole.id } });
      },
    },
  };
}

function readRolePayload(value: unknown): { id: number; discountCapRate: number } {
  if (!isRecord(value) || !isRecord(value.role)) {
    throw new Error('角色保存请求缺少 role。');
  }

  const { id, discountCapRate } = value.role;
  if (typeof id !== 'number' || typeof discountCapRate !== 'number') {
    throw new Error('角色保存请求缺少 id 或 discountCapRate。');
  }

  return { id, discountCapRate };
}

function createApiResponse(body: unknown): APIResponse {
  return {
    status: () => 200,
    json: async () => body,
  } as unknown as APIResponse;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

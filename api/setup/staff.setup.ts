import type { AdminConfigApiClient } from '../clients/admin-config-api.client';
import type { ResourceRegistry } from '../core/resource-registry';
import {
  buildRestrictedNoteEmployeeSeed,
  buildRestrictedVoidEmployeeSeed,
  type RestrictedNoteEmployeeSeed,
  type RestrictedVoidEmployeeSeed,
} from '../../test-data/api/staff-api-data';
import { createShortTestName } from '../core/test-data-id';
import {
  createSetupResource,
  expectOkEnvelope,
  type SetupResource,
} from './setup-resource';

export type StaffSetupOptions = {
  adminConfigApi: AdminConfigApiClient;
  resourceRegistry: ResourceRegistry;
};

export type CreatedRestrictedEmployee = SetupResource & Pick<RestrictedVoidEmployeeSeed, 'passcode'>;
export type CreatedNoteRestrictedEmployee = SetupResource &
  Pick<RestrictedNoteEmployeeSeed, 'passcode'>;

export type RoleDiscountCapRates = Record<string, number>;
export type RoleDiscountCapRateRestore = () => Promise<void>;

export type RoleDiscountCapRateUpdateOptions = {
  verify?: boolean;
};

export type StaffSetupService = {
  createWithoutKitchenVoidPermission: () => Promise<CreatedRestrictedEmployee>;
  createWithoutNotePermission: () => Promise<CreatedNoteRestrictedEmployee>;
  readRoleDiscountCapRates: (roleNames: readonly string[]) => Promise<RoleDiscountCapRates>;
  updateRoleDiscountCapRates: (
    rates: RoleDiscountCapRates,
    options?: RoleDiscountCapRateUpdateOptions,
  ) => Promise<RoleDiscountCapRateRestore>;
};

export function createStaffSetupService(options: StaffSetupOptions): StaffSetupService {
  const readRoles = async (): Promise<RoleRecord[]> => {
    const rolesBody = await expectOkEnvelope(await options.adminConfigApi.listRoles());
    const roles = Array.isArray(rolesBody.data) ? rolesBody.data : [];
    return roles.map(toRoleRecord).filter((role): role is RoleRecord => role !== undefined);
  };

  const updateRates = async (rates: RoleDiscountCapRates): Promise<void> => {
    const requestedEntries = Object.entries(rates);
    validateRoleDiscountCapRates(requestedEntries);
    const roles = await readRoles();

    for (const [roleName, discountCapRate] of requestedEntries) {
      const role = resolveRoleByName(roles, roleName);
      await expectOkEnvelope(
        await options.adminConfigApi.saveRole({
          role: {
            id: role.id,
            name: role.name,
            discountCapRate,
            function: role.functionIds.map((id) => ({ id })),
          },
        }),
      );
    }
  };

  const service: StaffSetupService = {
    createWithoutKitchenVoidPermission: async () => {
      const seed = buildRestrictedVoidEmployeeSeed();
      const resource = await createSetupResource({
        type: 'staff',
        name: seed.name,
        request: seed.request,
        resourceRegistry: options.resourceRegistry,
        save: () => options.adminConfigApi.saveStaff(seed.request),
        cleanup: (id) => options.adminConfigApi.deleteStaff({ staffId: id }),
      });

      return { ...resource, passcode: seed.passcode };
    },
    createWithoutNotePermission: async () => {
      const rolesBody = await expectOkEnvelope(await options.adminConfigApi.listRoles());
      const roles = Array.isArray(rolesBody.data) ? rolesBody.data : [];
      const serverRole = roles.find(
        (value) => isRecord(value) && value.id === 3 && value.name === 'Server',
      );

      if (!isRecord(serverRole) || !Array.isArray(serverRole.function)) {
        throw new Error('未能读取 Server 角色及其权限列表。');
      }

      const notePermission = serverRole.function.find(
        (value) => isRecord(value) && value.id === 16,
      );
      if (!notePermission) {
        throw new Error('Server 角色当前不包含 NOTE 权限 ID 16，无法建立移除权限的对照。');
      }

      const roleName = createShortTestName({
        prefix: 'AT',
        domain: 'NO_NOTE',
        maxLength: 16,
      });
      const roleRequest = {
        role: {
          name: roleName,
          discountCapRate:
            typeof serverRole.discountCapRate === 'number' ? serverRole.discountCapRate : 100,
          function: serverRole.function
            .filter((value) => isRecord(value) && value.id !== 16)
            .map((value) => ({ id: value.id })),
        },
      };
      const role = await createSetupResource({
        type: 'role',
        name: roleName,
        request: roleRequest,
        resourceRegistry: options.resourceRegistry,
        cleanupPriority: 20,
        save: () => options.adminConfigApi.saveRole(roleRequest),
        list: () => options.adminConfigApi.listRoles({ keyword: roleName }),
        cleanup: (id) => options.adminConfigApi.deleteRole({ roleId: id }),
      });
      const seed = buildRestrictedNoteEmployeeSeed(role.id);
      const employee = await createSetupResource({
        type: 'staff',
        name: seed.name,
        request: seed.request,
        resourceRegistry: options.resourceRegistry,
        cleanupPriority: 30,
        save: () => options.adminConfigApi.saveStaff(seed.request),
        cleanup: (id) => options.adminConfigApi.deleteStaff({ staffId: id }),
      });

      const permissionBody = await expectOkEnvelope(
        await options.adminConfigApi.checkPrivilege({
          passcode: seed.passcode,
          functionId: 16,
        }),
      );

      if (permissionBody.data !== false) {
        throw new Error('一次性员工仍具有 NOTE 权限，测试前置未生效。');
      }

      return { ...employee, passcode: seed.passcode };
    },
    readRoleDiscountCapRates: async (roleNames) => {
      const roles = await readRoles();
      return Object.fromEntries(
        roleNames.map((roleName) => {
          const role = resolveRoleByName(roles, roleName);
          return [roleName, role.discountCapRate];
        }),
      );
    },
    updateRoleDiscountCapRates: async (rates, updateOptions = {}) => {
      const roleNames = Object.keys(rates);
      const originalRates = await service.readRoleDiscountCapRates(roleNames);
      await updateRates(rates);

      if (updateOptions.verify) {
        await verifyRoleDiscountCapRates(service, rates);
      }

      return async () => {
        await updateRates(originalRates);

        if (updateOptions.verify) {
          await verifyRoleDiscountCapRates(service, originalRates);
        }
      };
    },
  };

  return service;
}

type RoleRecord = {
  id: string | number;
  name: string;
  discountCapRate: number;
  functionIds: Array<string | number>;
};

function toRoleRecord(value: unknown): RoleRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { id, name, discountCapRate, function: roleFunctions } = value;
  if (
    (typeof id !== 'number' && typeof id !== 'string') ||
    typeof name !== 'string' ||
    typeof discountCapRate !== 'number' ||
    !Array.isArray(roleFunctions)
  ) {
    return undefined;
  }

  const functionIds = roleFunctions
    .map((roleFunction) => (isRecord(roleFunction) ? roleFunction.id : undefined))
    .filter((functionId): functionId is string | number =>
      typeof functionId === 'number' || typeof functionId === 'string',
    );

  return { id, name, discountCapRate, functionIds };
}

function resolveRoleByName(roles: RoleRecord[], roleName: string): RoleRecord {
  const role = roles.find((candidate) => candidate.name === roleName);

  if (!role) {
    throw new Error(`未找到员工角色：${roleName}`);
  }

  return role;
}

function validateRoleDiscountCapRates(entries: Array<[string, number]>): void {
  if (entries.length === 0) {
    throw new Error('至少需要提供一个员工角色最大折扣配置。');
  }

  for (const [roleName, discountCapRate] of entries) {
    if (!roleName.trim()) {
      throw new Error('员工角色名称不能为空。');
    }

    if (!Number.isFinite(discountCapRate) || discountCapRate < 0 || discountCapRate > 100) {
      throw new Error(`员工角色 ${roleName} 的最大折扣必须在 0 到 100 之间。`);
    }
  }
}

async function verifyRoleDiscountCapRates(
  service: StaffSetupService,
  expectedRates: RoleDiscountCapRates,
): Promise<void> {
  const actualRates = await service.readRoleDiscountCapRates(Object.keys(expectedRates));

  for (const [roleName, expectedRate] of Object.entries(expectedRates)) {
    if (actualRates[roleName] !== expectedRate) {
      throw new Error(
        `员工角色 ${roleName} 最大折扣更新后校验失败，期望 ${expectedRate}，实际 ${String(actualRates[roleName])}。`,
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

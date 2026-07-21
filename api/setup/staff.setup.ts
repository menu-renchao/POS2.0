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

export type StaffSetupService = {
  createWithoutKitchenVoidPermission: () => Promise<CreatedRestrictedEmployee>;
  createWithoutNotePermission: () => Promise<CreatedNoteRestrictedEmployee>;
};

export function createStaffSetupService(options: StaffSetupOptions): StaffSetupService {
  return {
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
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

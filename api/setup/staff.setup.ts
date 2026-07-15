import type { AdminConfigApiClient } from '../clients/admin-config-api.client';
import type { ResourceRegistry } from '../core/resource-registry';
import {
  buildRestrictedVoidEmployeeSeed,
  type RestrictedVoidEmployeeSeed,
} from '../../test-data/api/staff-api-data';
import { createSetupResource, type SetupResource } from './setup-resource';

export type StaffSetupOptions = {
  adminConfigApi: AdminConfigApiClient;
  resourceRegistry: ResourceRegistry;
};

export type CreatedRestrictedEmployee = SetupResource & Pick<RestrictedVoidEmployeeSeed, 'passcode'>;

export type StaffSetupService = {
  createWithoutKitchenVoidPermission: () => Promise<CreatedRestrictedEmployee>;
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
  };
}

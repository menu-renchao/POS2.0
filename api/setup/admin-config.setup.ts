import type { AdminConfigApiClient } from '../clients/admin-config-api.client';
import type { ApiRequestData } from '../clients/client-path';
import type { ResourceId, ResourceRegistry } from '../core/resource-registry';
import {
  buildChargeSetupRequest,
  buildDiscountSetupRequest,
  buildTaxSetupRequest,
  type ChargeSetupOverrides,
  type DiscountSetupOverrides,
  type TaxSetupOverrides,
} from '../../test-data/api/admin-config-api-data';
import { createSetupResource, expectOkEnvelope, type SetupResource } from './setup-resource';

export type AdminConfigSetupOptions = {
  adminConfigApi: AdminConfigApiClient;
  resourceRegistry: ResourceRegistry;
};

export type TaxSetupService = {
  create: (overrides?: TaxSetupOverrides) => Promise<SetupResource>;
  read: (id: ResourceId) => Promise<unknown>;
  update: (id: ResourceId, overrides: TaxSetupOverrides) => Promise<SetupResource>;
  delete: (id: ResourceId) => Promise<void>;
};

export type DiscountSetupService = {
  create: (overrides?: DiscountSetupOverrides) => Promise<SetupResource>;
  read: (id: ResourceId) => Promise<unknown>;
  update: (id: ResourceId, overrides: DiscountSetupOverrides) => Promise<SetupResource>;
  delete: (id: ResourceId) => Promise<void>;
};

export type ChargeSetupService = {
  create: (overrides?: ChargeSetupOverrides) => Promise<SetupResource>;
  read: (id: ResourceId) => Promise<unknown>;
  update: (id: ResourceId, overrides: ChargeSetupOverrides) => Promise<SetupResource>;
  delete: (id: ResourceId) => Promise<void>;
};

export function createTaxSetupService(options: AdminConfigSetupOptions): TaxSetupService {
  return {
    create: async (overrides = {}) => {
      const request = buildTaxSetupRequest(overrides);
      const name = String(request.tax.name);

      return await createSetupResource({
        type: 'tax',
        name,
        request,
        resourceRegistry: options.resourceRegistry,
        save: () => options.adminConfigApi.saveTax(request),
        list: () => options.adminConfigApi.listTaxes({ keyword: name }),
        cleanup: (id) => options.adminConfigApi.deleteTax({ taxId: id }),
      });
    },
    read: async (id) => {
      const body = await expectOkEnvelope(await options.adminConfigApi.listTaxes({ taxId: id, id }));

      return body.data;
    },
    update: async (id, overrides) => {
      const request = mergeTaxUpdateRequest(id, overrides);
      const body = await expectOkEnvelope(await options.adminConfigApi.saveTax(request));

      return {
        id,
        name: String(request.tax.name ?? id),
        request,
        body,
      };
    },
    delete: async (id) => {
      await expectOkEnvelope(await options.adminConfigApi.deleteTax({ taxId: id }));
      options.resourceRegistry.markCleaned('tax', id);
    },
  };
}

export function createDiscountSetupService(
  options: AdminConfigSetupOptions,
): DiscountSetupService {
  return {
    create: async (overrides = {}) => {
      const request = buildDiscountSetupRequest(overrides);
      const name = String(request.name);

      return await createSetupResource({
        type: 'discount',
        name,
        request,
        resourceRegistry: options.resourceRegistry,
        save: () => options.adminConfigApi.saveDiscount(request),
        list: () => options.adminConfigApi.listDiscounts({ keyword: name }),
        cleanup: (id) => options.adminConfigApi.deleteDiscount({ discountId: id }),
      });
    },
    read: async (id) => {
      const body = await expectOkEnvelope(
        await options.adminConfigApi.listDiscounts({ discountId: id, id }),
      );

      return body.data;
    },
    update: async (id, overrides) => {
      const request = {
        ...buildDiscountSetupRequest(overrides),
        ...overrides,
        id,
        discountId: id,
      };
      const body = await expectOkEnvelope(await options.adminConfigApi.saveDiscount(request));

      return {
        id,
        name: String(request.name ?? id),
        request,
        body,
      };
    },
    delete: async (id) => {
      await expectOkEnvelope(await options.adminConfigApi.deleteDiscount({ discountId: id }));
      options.resourceRegistry.markCleaned('discount', id);
    },
  };
}

export function createChargeSetupService(options: AdminConfigSetupOptions): ChargeSetupService {
  return {
    create: async (overrides = {}) => {
      const request = buildChargeSetupRequest(overrides);
      const name = String(request.charge.name);

      return await createSetupResource({
        type: 'charge',
        name,
        request,
        resourceRegistry: options.resourceRegistry,
        save: () => options.adminConfigApi.saveCharge(request),
        list: () => options.adminConfigApi.listCharges({ keyword: name }),
        cleanup: (id) => options.adminConfigApi.deleteCharge({ chargeId: id }),
      });
    },
    read: async (id) => {
      const body = await expectOkEnvelope(
        await options.adminConfigApi.listCharges({ chargeId: id, id }),
      );

      return body.data;
    },
    update: async (id, overrides) => {
      const request = mergeChargeUpdateRequest(id, overrides);
      const body = await expectOkEnvelope(await options.adminConfigApi.saveCharge(request));

      return {
        id,
        name: String(request.charge.name ?? id),
        request,
        body,
      };
    },
    delete: async (id) => {
      await expectOkEnvelope(await options.adminConfigApi.deleteCharge({ chargeId: id }));
      options.resourceRegistry.markCleaned('charge', id);
    },
  };
}

function mergeTaxUpdateRequest(id: ResourceId, overrides: TaxSetupOverrides): ApiRequestData & { tax: Record<string, unknown> } {
  const request = buildTaxSetupRequest(overrides);

  return {
    tax: {
      ...request.tax,
      ...overrides,
      id,
      taxId: id,
    },
  };
}

function mergeChargeUpdateRequest(
  id: ResourceId,
  overrides: ChargeSetupOverrides,
): ApiRequestData & { charge: Record<string, unknown> } {
  const request = buildChargeSetupRequest(overrides);

  return {
    charge: {
      ...request.charge,
      id,
      chargeId: id,
    },
  };
}

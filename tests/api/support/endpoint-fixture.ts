import { test as apiTest } from '../../../fixtures/api.fixture';
import type { EndpointResources } from './endpoint-resources';
import { createEndpointResources } from './endpoint-resources';

export const test = apiTest.extend<{ endpointResources: EndpointResources }>({
  endpointResources: async ({
    adminConfigApi,
    menuApi,
    saleItemApi,
    resourceRegistry,
  }, use) => {
    await use(
      createEndpointResources({
        adminConfigApi,
        menuApi,
        saleItemApi,
        resourceRegistry,
      }),
    );
  },
});

export { expect } from '@playwright/test';

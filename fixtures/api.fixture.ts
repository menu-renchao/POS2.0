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
    const apiRequest = await createApiRequestContext(apiConfig);

    try {
      await use(apiRequest);
    } finally {
      try {
        await apiRequest.dispose();
      } catch (error) {
        console.warn('API request dispose failed.', error);
      }
    }
  },
  resourceRegistry: async ({}, use) => {
    const resourceRegistry = new ResourceRegistry();

    try {
      await use(resourceRegistry);
    } finally {
      const cleanupResult = await resourceRegistry.cleanupAll();

      if (cleanupResult.errors.length > 0) {
        const errorSummary = cleanupResult.errors
          .map(
            ({ resource, error }) => `${resource.type}:${String(resource.id)} ${error.message}`,
          )
          .join('; ');

        console.warn(
          `API resource cleanup finished with ${cleanupResult.errors.length} error(s): ${errorSummary}`,
        );
      }
    }
  },
});

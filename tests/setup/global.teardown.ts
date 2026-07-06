import { cleanupMenuResourcesAfterSession } from '../api/support/menu-hard-delete-cleanup';

async function globalTeardown(): Promise<void> {
  await cleanupMenuResourcesAfterSession();
}

export default globalTeardown;

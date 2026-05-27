import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ROOT = resolve(__dirname, '..', '..');
const STALE_DIRS = ['test-results'];

async function globalTeardown(): Promise<void> {
  for (const dir of STALE_DIRS) {
    const dirPath = resolve(PROJECT_ROOT, dir);

    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }
}

export default globalTeardown;

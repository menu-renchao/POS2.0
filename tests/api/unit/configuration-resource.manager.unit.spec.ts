import { expect, test } from '@playwright/test';
import { ResourceRegistry } from '../../../api/core/resource-registry';
import type { SystemConfigurationSetupService } from '../../../api/setup/system-configuration.setup';
import { ConfigurationResourceManager } from '../../../fixtures/configuration-resource.manager';

test.describe('系统配置资源管理器', () => {
  test('应按后进先出顺序恢复同一测试修改的配置', async () => {
    const restoreOrder: string[] = [];
    let updateSequence = 0;
    const systemConfiguration = {
      updateByName: async (name: string) => {
        updateSequence += 1;
        const currentSequence = updateSequence;
        return async () => {
          restoreOrder.push(`${name}:${currentSequence}`);
        };
      },
    } as Pick<SystemConfigurationSetupService, 'updateByName'>;
    const registry = new ResourceRegistry();
    const manager = new ConfigurationResourceManager(
      registry,
      systemConfiguration,
    );

    await manager.updateByName('FIRST', true);
    await manager.updateByName('SECOND', false);

    const cleanup = await registry.cleanupAll();

    expect(cleanup.errors).toEqual([]);
    expect(restoreOrder).toEqual(['SECOND:2', 'FIRST:1']);
  });

  test('配置更新失败时不应注册无效恢复任务', async () => {
    const systemConfiguration = {
      updateByName: async () => {
        throw new Error('update failed');
      },
    } as Pick<SystemConfigurationSetupService, 'updateByName'>;
    const registry = new ResourceRegistry();
    const manager = new ConfigurationResourceManager(
      registry,
      systemConfiguration,
    );

    await expect(manager.updateByName('FAILED', true)).rejects.toThrow(
      'update failed',
    );
    expect(await registry.cleanupAll()).toEqual({
      cleaned: [],
      errors: [],
    });
  });

  test('手工恢复后应注销兜底任务且重复恢复保持幂等', async () => {
    let restoreCount = 0;
    const systemConfiguration = {
      updateByName: async () => async () => {
        restoreCount += 1;
      },
    } as Pick<SystemConfigurationSetupService, 'updateByName'>;
    const registry = new ResourceRegistry();
    const manager = new ConfigurationResourceManager(
      registry,
      systemConfiguration,
    );

    const restore = await manager.updateByNameWithRestore('MANUAL', true);
    await restore();
    await restore();
    const cleanup = await registry.cleanupAll();

    expect(restoreCount).toBe(1);
    expect(cleanup).toEqual({ cleaned: [], errors: [] });
  });
});

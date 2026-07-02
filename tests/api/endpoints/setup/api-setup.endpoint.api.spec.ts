import { expect } from '@playwright/test';
import { test } from '../../../../fixtures/api.fixture';
import { registerMenuHardDeleteAfterAll } from '../../support/menu-hard-delete-cleanup';

registerMenuHardDeleteAfterAll(test);

test.describe('API 数据预置 endpoint', () => {
  test('应能通过 apiSetup 完成税费增删改查', async ({ apiSetup }) => {
    const tax = await test.step('创建税费预置数据', async () => {
      return await apiSetup.tax.create({ name: 'AT_TAX_SETUP', rate: 1.25 });
    });

    await test.step('读取税费预置数据', async () => {
      const data = await apiSetup.tax.read(tax.id);

      expect(data).toBeDefined();
    });

    await test.step('更新税费预置数据', async () => {
      const updated = await apiSetup.tax.update(tax.id, { name: tax.name, rate: 1.5 });

      expect(updated.id).toBe(tax.id);
    });

    await test.step('删除税费预置数据', async () => {
      await apiSetup.tax.delete(tax.id);
    });
  });

  test('应能通过 apiSetup 完成菜单增删改查', async ({ apiSetup }) => {
    const menu = await test.step('创建菜单预置数据', async () => {
      return await apiSetup.menu.create({ name: 'AT_MENU_SETUP', displayName: 'AT_MENU_SETUP' });
    });

    await test.step('读取菜单预置数据', async () => {
      const data = await apiSetup.menu.read(menu.id);

      expect(data).toBeDefined();
    });

    await test.step('更新菜单预置数据', async () => {
      const updated = await apiSetup.menu.update(menu.id, {
        name: menu.name,
        displayName: 'AT_MENU_SETUP_U',
      });

      expect(updated.id).toBe(menu.id);
    });

    await test.step('删除菜单预置数据', async () => {
      await apiSetup.menu.delete(menu.id);
    });
  });
});

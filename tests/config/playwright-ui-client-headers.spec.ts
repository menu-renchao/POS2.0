import { expect, test } from '@playwright/test';
import config from '../../playwright.config';

test.describe('Playwright UI 请求头配置', () => {
  test('应为 POS UI 浏览器项目配置客户端请求头', () => {
    const uiProjectNames = ['chrome', 'py-migrate'] as const;

    for (const projectName of uiProjectNames) {
      const project = config.projects?.find((candidate) => candidate.name === projectName);

      expect(project, `应存在 ${projectName} 项目`).toBeTruthy();
      expect(project?.use?.extraHTTPHeaders, `${projectName} 应配置客户端请求头`).toMatchObject({
        'x-client-sn': 'device001',
        'x-client-type': '0',
      });
    }
  });
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CODEGEN_CONTEXT_OPTIONS,
  CODEGEN_URL,
  runCodegen,
} from '../../scripts/codegen.mjs';

test('应为 Codegen 固定 POS 首页和客户端请求头', () => {
  assert.equal(CODEGEN_URL, 'http://192.168.247:22080/kpos/front/myhome.html');
  assert.deepEqual(CODEGEN_CONTEXT_OPTIONS.extraHTTPHeaders, {
    'x-client-sn': 'mansuper',
    'x-client-type': '0',
  });
});

test('应提供自定义 Codegen 与脚本测试入口', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );

  assert.equal(packageJson.scripts.codegen, 'node scripts/codegen.mjs');
  assert.equal(
    packageJson.scripts['test:scripts'],
    'node --test tests/scripts/codegen.unit.test.mjs tests/scripts/capture-case.unit.test.mjs tests/scripts/jenkinsfile-ui-scope.unit.test.mjs tests/scripts/check-ui-architecture.unit.test.mjs',
  );
  assert.equal(packageJson.scripts['capture:case'], 'node scripts/capture-case.mjs');
});

test('应抛出进入 Inspector 暂停前的浏览器断连异常', async () => {
  const startupError = new Error('browser disconnected before pause');
  const disconnectedBrowser = {
    async newContext() {
      throw startupError;
    },
    isConnected() {
      return false;
    },
    async close() {},
  };
  const browserType = {
    async launch() {
      return disconnectedBrowser;
    },
  };

  await assert.rejects(
    runCodegen(browserType),
    (error) => error === startupError,
  );
});

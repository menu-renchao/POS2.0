import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { CODEGEN_CONTEXT_OPTIONS, CODEGEN_URL } from '../../scripts/codegen.mjs';

test('应为 Codegen 固定 POS 首页和客户端请求头', () => {
  assert.equal(CODEGEN_URL, 'http://192.168.247:22080/kpos/front/myhome.html');
  assert.deepEqual(CODEGEN_CONTEXT_OPTIONS.extraHTTPHeaders, {
    'x-client-sn': 'mansuper',
    'x-client-type': '0',
  });
});

test('应通过自定义 Node 脚本启动 Codegen', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );

  assert.equal(packageJson.scripts.codegen, 'node scripts/codegen.mjs');
});

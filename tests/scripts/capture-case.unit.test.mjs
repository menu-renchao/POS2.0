import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  createCaptureContextOptions,
  createCapturePaths,
  normalizeCaseKey,
  parseCaptureArgs,
  renderRecordedScript,
} from '../../scripts/capture-case.mjs';

test('应规范化合法用例编号并拒绝不安全目录字符', () => {
  assert.equal(normalizeCaseKey('pos-16324'), 'POS-16324');
  assert.equal(normalizeCaseKey('ORDER-PAGE-014'), 'ORDER-PAGE-014');
  assert.throws(() => normalizeCaseKey('../POS-16324'), /仅支持字母、数字、点、下划线和连字符/);
  assert.throws(() => normalizeCaseKey(''), /必须提供用例编号/);
});

test('应沿用 POS 请求头并默认生成不含响应正文的最小 HAR', () => {
  const options = createCaptureContextOptions({ har: 'C:\\capture\\network.har' });

  assert.deepEqual(options.extraHTTPHeaders, {
    'x-client-sn': 'mansuper',
    'x-client-type': '0',
  });
  assert.deepEqual(options.recordHar, {
    content: 'omit',
    mode: 'minimal',
    path: 'C:\\capture\\network.har',
  });
});

test('应按用例编号和时间创建隔离的采集文件路径', () => {
  const paths = createCapturePaths({
    caseKey: 'POS-16324',
    now: new Date('2026-07-20T04:05:06.789Z'),
    outputRoot: path.join('C:', 'repo', 'playwright-captures'),
  });

  assert.equal(path.basename(paths.outputDir), '2026-07-20T04-05-06-789Z');
  assert.equal(path.basename(path.dirname(paths.outputDir)), 'POS-16324');
  assert.equal(path.basename(paths.recordedScript), 'recorded.spec.ts');
  assert.equal(path.basename(paths.trace), 'trace.zip');
  assert.equal(path.basename(paths.har), 'network.har');
  assert.equal(path.basename(paths.dom), 'visible-dom.json');
});

test('应解析用例编号、dry-run 和帮助参数', () => {
  assert.deepEqual(parseCaptureArgs(['pos-16324', '--dry-run']), {
    caseKey: 'POS-16324',
    dryRun: true,
    help: false,
  });
  assert.deepEqual(parseCaptureArgs(['--help']), {
    caseKey: null,
    dryRun: false,
    help: true,
  });
  assert.throws(() => parseCaptureArgs(['POS-1', '--unknown']), /未知参数/);
});

test('应把主页面和 iframe 操作渲染为可继续整理的 Playwright 脚本', () => {
  const script = renderRecordedScript('POS-16324', [
    {
      frameSelectors: [],
      locator: { kind: 'testId', value: 'bottom-button-splitOrderBtn' },
      type: 'click',
    },
    {
      frameSelectors: ['#splitPanelContainer iframe'],
      locator: { kind: 'testId', value: 'payBtn-1' },
      type: 'click',
    },
    {
      frameSelectors: ['#newLoginContainer iframe'],
      locator: { kind: 'role', name: 'Phone', role: 'textbox' },
      type: 'fill',
      value: '9322222222',
    },
  ]);

  assert.match(script, /test\('POS-16324：待整理的采集脚本'/);
  assert.match(script, /page\.getByTestId\('bottom-button-splitOrderBtn'\)\.click\(\)/);
  assert.match(
    script,
    /page\.locator\('#splitPanelContainer iframe'\)\.contentFrame\(\)\.getByTestId\('payBtn-1'\)\.click\(\)/,
  );
  assert.match(
    script,
    /page\.locator\('#newLoginContainer iframe'\)\.contentFrame\(\)\.getByRole\('textbox', \{ name: 'Phone', exact: true \}\)\.fill\('9322222222'\)/,
  );
});

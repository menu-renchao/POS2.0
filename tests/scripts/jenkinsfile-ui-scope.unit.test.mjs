import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const jenkinsfilePath = new URL('../../Jenkinsfile.ui', import.meta.url);

test('Jenkins UI 测试树应白名单缓存套件并拒绝路径遍历', async () => {
  const source = await readFile(jenkinsfilePath, 'utf8');
  assert.ok((source.match(/def isValidUiSpecPath = \{ String path ->/g) ?? []).length >= 3, 'Active Choices 和运行时均应验证 UI spec 路径');
  assert.ok((source.match(/path\.matches\('tests\/py-migrate\//g) ?? []).length >= 3, '路径必须匹配 UI spec 合约');
  assert.ok((source.match(/!path\.contains\('\/\/'\)/g) ?? []).length >= 3, '路径不得包含空段');
  assert.ok((source.match(/path\.split\('\/'\)\.every \{ segment -> segment != '\.' && segment != '\.\.' \}/g) ?? []).length >= 3, '路径不得包含遍历段');
  assert.match(source, /def suites = tree\.suites\.collect \{ it\.toString\(\) \}\.findAll \{ it in \['all', 'py-migrate'\] \}/);
  assert.match(source, /selectedSuite = \['all', 'py-migrate'\]\.contains\(selectedSuite\) \? selectedSuite : 'all'/);
  assert.ok((source.match(/findAll \{ isValidUiSpecPath\(it\.toString\(\)\) \}/g) ?? []).length >= 2, '缓存文件均应先过滤');
  assert.match(source, /selectedFiles = selectedFiles\.findAll \{ isValidUiSpecPath\(it\) \}/);
});

test('Jenkins UI 运行应使用分层执行项目且不清理非测试拥有的桌台订单', async () => {
  const source = await readFile(jenkinsfilePath, 'utf8');

  assert.doesNotMatch(source, /UI_CLEAR_TABLES_BEFORE_RUN/);
  assert.match(
    source,
    /jenkins:test-tree -- tests\/py-migrate --project=ui-isolated --project=ui-shared --project=ui-exclusive-config --project=ui-print --project=ui-slow/,
  );
  assert.match(
    source,
    /def projectFlags = '--project=ui-isolated --project=ui-shared --project=ui-exclusive-config --project=ui-print'/,
  );
  assert.match(source, /if \(isTimerBuild \|\| hasExplicitSelection\)/);
  assert.match(source, /script: "node node_modules\/@playwright\/test\/cli\.js test \$\{testTarget\} \$\{projectFlags\} --pass-with-no-tests/);
  assert.match(source, /script: "node node_modules\/@playwright\/test\/cli\.js test \$\{testTarget\} --project=ui-slow --pass-with-no-tests/);
  assert.match(source, /error "UI tests failed: regular=\$\{regularStatus\}, slow=\$\{slowStatus\}"/);
  assert.doesNotMatch(source, /--project=py-migrate/);
  assert.match(
    source,
    /POS_PRINT_OUTPUT_DIR = 'C:\\\\Users\\\\nhqrt\\\\\.menusifu\\\\POS\\\\data\\\\temp'/,
  );
});

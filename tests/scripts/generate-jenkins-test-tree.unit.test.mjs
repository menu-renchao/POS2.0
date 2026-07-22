import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const generator = resolve(repoRoot, 'scripts/generate-jenkins-test-tree.mjs');

test('应只生成 py-migrate UI 项目的 Jenkins 用例树', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'pos-ui-test-tree-'));
  const outputPath = join(tempDir, 'test-tree.json');

  try {
    const result = spawnSync(
      process.execPath,
      [generator, 'tests/py-migrate', '--project=py-migrate'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          JENKINS_TEST_TREE_OUTPUT: outputPath,
        },
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const tree = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.deepEqual(tree.suites, ['all', 'py-migrate']);
    assert.ok(tree.files.all.length > 0);
    assert.ok(tree.files.all.every((file) => file.startsWith('tests/py-migrate/')));
    assert.ok(!Object.keys(tree.cases).some((file) => file.startsWith('tests/api/')));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

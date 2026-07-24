import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeUiArchitectureSource,
  validateUiArchitectureBaseline,
} from '../../scripts/check-ui-architecture.mjs';

test('应识别候选 Locator、XPath 和硬等待', () => {
  const result = analyzeUiArchitectureSource(
    'pages/example.page.ts',
    `
      resolveVisibleLocator([page.getByTestId('save'), page.getByText('Save')]);
      page.getByTestId('save').or(page.getByText('Save'));
      page.locator('xpath=../button');
      page.waitForTimeout(500);
      waitForInputSettled();
      modal.querySelectorAll('button');
      const inputCandidates = [defaultInput, numberInput, amountInput];
      async function readFirstVisible(candidates: Locator[]) {}
      root.querySelectorAll('div, section, button');
      while (currentElement) {
        currentElement = currentElement.parentElement;
      }
    `,
    'pages',
  );

  assert.equal(result.counts.candidateLocatorResolvers, 3);
  assert.equal(result.counts.locatorOrFallbacks, 1);
  assert.equal(result.counts.xpathSelectors, 1);
  assert.equal(result.counts.hardWaits, 1);
  assert.equal(result.counts.inputWaitsWithoutLocator, 1);
  assert.equal(result.counts.broadDomTraversal, 3);
});

test('应识别 Flow 接收页面后又返回同一页面的隐式链式 API', () => {
  const result = analyzeUiArchitectureSource(
    'flows/recall.flow.ts',
    `
      async clearSearchConditions(
        recallPage: RecallPage,
      ): Promise<RecallPage> {
        await recallPage.clearAllSearchConditions();
        return recallPage;
      }
    `,
    'flows',
  );

  assert.equal(result.counts.samePageReturns, 1);
});

test('应识别 Flow 和 Spec 中的原始 Locator', () => {
  const flow = analyzeUiArchitectureSource(
    'flows/example.flow.ts',
    `page.getByRole('button', { name: 'Save' }).click();`,
    'flows',
  );
  const spec = analyzeUiArchitectureSource(
    'tests/py-migrate/example.spec.ts',
    `page.getByTestId('save').click();`,
    'specs',
  );

  assert.equal(flow.counts.rawLocatorCallsInFlows, 1);
  assert.equal(spec.counts.rawLocatorCallsInSpecs, 1);
});

test('应识别 Flow 接收聚合 Flow 容器的服务定位器参数', () => {
  const result = analyzeUiArchitectureSource(
    'flows/example.flow.ts',
    `
      async run(flows: Readonly<FlowFixtures>): Promise<void> {}
      async legacy(flows: TestFlows): Promise<void> {}
    `,
    'flows',
  );

  assert.equal(result.counts.flowServiceLocatorParameters, 2);
});

test('应识别 Spec 即时创建 Flow 和 Flow 默认创建依赖', () => {
  const spec = analyzeUiArchitectureSource(
    'tests/py-migrate/example.spec.ts',
    `const flow = new PaymentFlow();`,
    'specs',
  );
  const flow = analyzeUiArchitectureSource(
    'flows/example.flow.ts',
    `constructor(private readonly paymentFlow = new PaymentFlow()) {}`,
    'flows',
  );

  assert.equal(spec.counts.immediateFlowConstructorsInSpecs, 1);
  assert.equal(flow.counts.defaultConstructedFlowDependencies, 1);
});

test('应识别未声明独占执行的全局配置变更', () => {
  const result = analyzeUiArchitectureSource(
    'tests/py-migrate/example.spec.ts',
    `
      test('修改配置', async ({ apiSetup }) => {
        await apiSetup.systemConfiguration.updateByName('SETTING', true);
      });
    `,
    'specs',
  );

  assert.equal(result.counts.unclassifiedGlobalConfigMutations, 1);
});

test('债务数量超过递减基线时应失败', () => {
  const counts = {
    candidateLocatorResolvers: 2,
    locatorOrFallbacks: 0,
    xpathSelectors: 0,
    testIdAttributeAliases: 0,
    multilingualLocatorFallbacks: 0,
    rawLocatorCallsInFlows: 0,
    rawLocatorCallsInSpecs: 0,
    samePageReturns: 0,
    hardWaits: 0,
    inputWaitsWithoutLocator: 0,
    immediateFlowConstructorsInSpecs: 0,
    defaultConstructedFlowDependencies: 0,
    flowServiceLocatorParameters: 0,
    broadDomTraversal: 0,
    unclassifiedGlobalConfigMutations: 0,
  };
  const scan = {
    totals: counts,
    files: [{ file: 'pages/example.page.ts', counts }],
  };
  const maximums = { ...counts, candidateLocatorResolvers: 1 };

  assert.deepEqual(validateUiArchitectureBaseline(scan, { maximums }), [
    'candidateLocatorResolvers 从允许的 1 增加到 2。热点：pages/example.page.ts(2)',
  ]);
});

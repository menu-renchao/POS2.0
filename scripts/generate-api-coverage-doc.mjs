import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const SOURCE_FILE = 'api/contracts/first-batch-api-cases.ts';
const TARGET_FILE = 'docs/api/112接口覆盖映射.md';
const require = createRequire(import.meta.url);

const targetByGroup = new Map([
  ['菜单管理', '菜单配置真实链路'],
  ['菜单全局搜索', '菜单配置真实链路'],
  ['菜单组管理', '菜单配置真实链路'],
  ['分类管理', '菜单配置真实链路'],
  ['global-option-category-controller', '菜单配置真实链路'],
  ['global-option-controller', '菜单配置真实链路'],
  ['订单管理', '订单管理真实链路'],
  ['订单支付', '订单支付真实链路'],
  ['角色管理', '后台配置真实链路'],
  ['税费管理', '后台配置真实链路'],
  ['折扣管理', '后台配置真实链路'],
  ['商品管理', '商品与 SPU 库存真实链路'],
  ['SPU 库存管理', '商品与 SPU 库存真实链路'],
]);

const endpointStatusLabel = new Map([
  ['covered', 'endpoint 已覆盖'],
  ['planned', '计划迁移'],
  ['blocked', '暂不迁移'],
]);

const moduleExports = loadTypeScriptModule(SOURCE_FILE);
const apiCases = moduleExports.firstBatchApiCases;

const lines = [
  '# 112 接口覆盖映射',
  '',
  '生成时间：2026-07-01',
  '',
  '口径：业务链路 spec 记录当前真实业务覆盖入口；endpoint spec 记录已拆出的单接口测试入口；正向/异常/边界列来自 `api/contracts/first-batch-api-cases.ts` 的 `caseCoverage`。',
  '',
  '## 状态汇总',
  '',
  `- endpoint 已覆盖: ${countBy(apiCases, (apiCase) => apiCase.endpointStatus === 'covered')}`,
  `- endpoint 计划迁移: ${countBy(apiCases, (apiCase) => apiCase.endpointStatus === 'planned')}`,
  `- endpoint 暂不迁移: ${countBy(apiCases, (apiCase) => apiCase.endpointStatus === 'blocked')}`,
  `- 正向用例覆盖: ${countBy(apiCases, (apiCase) => apiCase.caseCoverage.positive)}`,
  `- 异常用例覆盖: ${countBy(apiCases, (apiCase) => apiCase.caseCoverage.negative)}`,
  `- 边界用例覆盖: ${countBy(apiCases, (apiCase) => apiCase.caseCoverage.boundary)}`,
  `- 已知异常缺口: ${countBy(apiCases, (apiCase) => Boolean(apiCase.caseCoverage.knownIssue))}`,
  '',
  '## 明细',
  '',
  '| 序号 | 分组 | 方法 | Path | 当前覆盖 | 正向 | 异常 | 边界 | 已知问题 | 目标业务链路 | 当前业务链路 spec | 当前 endpoint spec | 当前状态 | 下一步 |',
  '|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|',
];

apiCases.forEach((apiCase, index) => {
  lines.push([
    index + 1,
    apiCase.group,
    apiCase.method,
    code(apiCase.path),
    apiCase.coverage,
    coverageLabel(apiCase.caseCoverage.positive),
    coverageLabel(apiCase.caseCoverage.negative),
    coverageLabel(apiCase.caseCoverage.boundary),
    apiCase.caseCoverage.knownIssue ?? '',
    targetByGroup.get(apiCase.group) ?? '',
    code(apiCase.specFile),
    apiCase.endpointSpecFile ? code(apiCase.endpointSpecFile) : endpointStatusLabel.get(apiCase.endpointStatus),
    endpointStatusLabel.get(apiCase.endpointStatus),
    nextStep(apiCase),
  ].map(toCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
});

writeFileSync(TARGET_FILE, `${lines.join('\n')}\n`, 'utf8');

function loadTypeScriptModule(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    require,
  };

  vm.runInNewContext(transpiled, context, { filename: filePath });

  return module.exports;
}

function countBy(items, predicate) {
  return items.filter(predicate).length;
}

function coverageLabel(value) {
  return value ? '已覆盖' : '未覆盖';
}

function code(value) {
  return `\`${value}\``;
}

function nextStep(apiCase) {
  if (apiCase.caseCoverage.knownIssue) {
    return apiCase.caseCoverage.knownIssue;
  }
  if (apiCase.endpointStatus === 'covered') {
    return '已迁移为单接口 endpoint，继续按矩阵补异常和边界场景。';
  }
  if (apiCase.endpointStatus === 'planned') {
    return '按同领域 endpoint 模板迁移，并复用 endpointResources 创建隔离数据。';
  }

  return apiCase.riskNote;
}

function toCell(value) {
  return String(value).replaceAll('|', '\\|');
}

import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import {
  ALLOWED_API_GROUPS,
  API_SPEC_FILES,
  firstBatchApiCases,
  type ApiCoverageLevel,
} from '../../../api/contracts/first-batch-api-cases';

const NON_POSITIVE_COVERAGE_LEVELS: readonly ApiCoverageLevel[] = [
  'contract-only',
  'deferred-external',
  'blocked-missing-data',
];

test.describe('首批接口覆盖矩阵', () => {
  test('应包含 112 个首批接口记录', () => {
    expect(firstBatchApiCases).toHaveLength(112);
  });

  test('每条接口记录都应声明覆盖等级和用例文件', () => {
    const allowedSpecFiles = Object.values(API_SPEC_FILES);

    for (const apiCase of firstBatchApiCases) {
      expect(apiCase.method).toMatch(/^(GET|POST|PUT|DELETE)$/);
      expect(apiCase.path.startsWith('/api/')).toBe(true);
      expect(ALLOWED_API_GROUPS).toContain(apiCase.group);
      expect(apiCase.coverage).toMatch(/^(positive-crud|positive-business|contract-only|deferred-external|blocked-missing-data)$/);
      expect(allowedSpecFiles).toContain(apiCase.specFile);
      expect(apiCase.endpointStatus).toMatch(/^(covered|planned|blocked)$/);
      expect(typeof apiCase.caseCoverage.positive, `${apiCase.method} ${apiCase.path} 应声明正向覆盖状态`).toBe(
        'boolean',
      );
      expect(typeof apiCase.caseCoverage.negative, `${apiCase.method} ${apiCase.path} 应声明异常覆盖状态`).toBe(
        'boolean',
      );
      expect(typeof apiCase.caseCoverage.boundary, `${apiCase.method} ${apiCase.path} 应声明边界覆盖状态`).toBe(
        'boolean',
      );
      if (apiCase.caseCoverage.knownIssue !== undefined) {
        expect(apiCase.caseCoverage.knownIssue.trim().length, `${apiCase.method} ${apiCase.path} knownIssue 不应为空`).toBeGreaterThan(0);
      }
      if (apiCase.endpointSpecFile !== undefined) {
        expect(allowedSpecFiles).toContain(apiCase.endpointSpecFile);
      }

      if (NON_POSITIVE_COVERAGE_LEVELS.includes(apiCase.coverage)) {
        expect(apiCase.specFile).toBe(API_SPEC_FILES.contractSmoke);
      } else {
        expect(apiCase.specFile).not.toBe(API_SPEC_FILES.contractSmoke);
      }
    }
  });

  test('每个声明的用例文件都应存在', () => {
    for (const specFile of Object.values(API_SPEC_FILES)) {
      expect(existsSync(specFile), `${specFile} 应存在`).toBe(true);
    }
  });

  test('每条接口记录的方法和路径组合都应唯一', () => {
    const apiCaseKeys = firstBatchApiCases.map((apiCase) => `${apiCase.method} ${apiCase.path}`);

    expect(new Set(apiCaseKeys).size).toBe(firstBatchApiCases.length);
  });

  test('endpoint 覆盖状态应和覆盖等级保持一致', () => {
    for (const apiCase of firstBatchApiCases) {
      if (apiCase.coverage === 'positive-business' || apiCase.coverage === 'positive-crud') {
        expect(['covered', 'planned']).toContain(apiCase.endpointStatus);
      } else {
        expect(['blocked', 'planned']).toContain(apiCase.endpointStatus);
      }
    }
  });

  test('已覆盖 endpoint 应声明存在的 endpoint spec 文件', () => {
    const coveredCases = firstBatchApiCases.filter((apiCase) => apiCase.endpointStatus === 'covered');

    expect(coveredCases).toHaveLength(79);
    for (const apiCase of coveredCases) {
      expect(apiCase.endpointSpecFile, `${apiCase.method} ${apiCase.path}`).toBeDefined();
      expect(existsSync(apiCase.endpointSpecFile!), `${apiCase.endpointSpecFile} 应存在`).toBe(true);
    }
  });

  test('已覆盖 endpoint 至少应声明正向或异常用例覆盖', () => {
    for (const apiCase of firstBatchApiCases.filter((entry) => entry.endpointStatus === 'covered')) {
      expect(
        apiCase.caseCoverage.positive || apiCase.caseCoverage.negative,
        `${apiCase.method} ${apiCase.path} 至少应有正向或异常覆盖`,
      ).toBe(true);
    }
  });

  test('已知异常缺口应沉淀到矩阵，避免误放入普通回归', () => {
    expect(findApiCase('POST', '/api/discount/save')).toMatchObject({
      caseCoverage: {
        knownIssue: expect.stringContaining('空对象'),
      },
    });
    expect(findApiCase('DELETE', '/api/menu/menuSaleItem/{id}')).toMatchObject({
      caseCoverage: {
        knownIssue: expect.stringContaining('不存在商品'),
      },
    });
  });

  test('首批查询类边界用例应沉淀到矩阵', () => {
    for (const [method, path] of [
      ['GET', '/api/menu/menus'],
      ['GET', '/api/order/list'],
      ['GET', '/api/tax/list'],
      ['GET', '/api/discount/list'],
      ['GET', '/api/admin/role/list'],
      ['GET', '/api/menu/menuSaleItems/search'],
    ] as const) {
      expect(findApiCase(method, path)).toMatchObject({
        caseCoverage: {
          boundary: true,
        },
      });
    }
  });

  test('首批可执行查询类计划迁移接口应拆出 endpoint 单接口用例', () => {
    for (const [method, path, endpointSpecFile] of [
      ['GET', '/api/menu/fetchGlobalOption', API_SPEC_FILES.endpointMenu],
      ['GET', '/api/menu/listGlobalOption', API_SPEC_FILES.endpointMenu],
      ['GET', '/api/menu/liteMenu/{id}', API_SPEC_FILES.endpointMenu],
      ['GET', '/api/menu/menu', API_SPEC_FILES.endpointMenu],
      ['GET', '/api/search/menu', API_SPEC_FILES.endpointMenu],
      ['GET', '/api/menu/group/list', API_SPEC_FILES.endpointMenuGroup],
      ['GET', '/api/menu/group/saleItem/all', API_SPEC_FILES.endpointMenuGroup],
      ['POST', '/api/menu/menuGroup/batch/copy', API_SPEC_FILES.endpointMenuGroup],
      ['DELETE', '/api/menu/menuGroup/batch/delete', API_SPEC_FILES.endpointMenuGroup],
      ['GET', '/api/menu/menuGroups', API_SPEC_FILES.endpointMenuGroup],
      ['GET', '/api/menu/abstractCategorys', API_SPEC_FILES.endpointCategory],
      ['GET', '/api/menu/abstractCategorys/search', API_SPEC_FILES.endpointCategory],
      ['GET', '/api/menu/category/list', API_SPEC_FILES.endpointCategory],
      ['GET', '/api/menu/menu/{menuId}/menuCategories', API_SPEC_FILES.endpointCategory],
      ['PUT', '/api/menu/menuCategory/quickEdit', API_SPEC_FILES.endpointCategory],
      ['GET', '/api/menu/menuCategorys/searchByName', API_SPEC_FILES.endpointCategory],
      ['GET', '/api/menu/item/fetchSaleItem', API_SPEC_FILES.endpointSaleItem],
      ['GET', '/api/menu/item/listByCategory', API_SPEC_FILES.endpointSaleItem],
      ['GET', '/api/menu/item/listComboSaleItem', API_SPEC_FILES.endpointSaleItem],
      ['GET', '/api/menu/item/listItemOptions', API_SPEC_FILES.endpointSaleItem],
      ['POST', '/api/menu/menuSaleItem/batch/copy', API_SPEC_FILES.endpointSaleItem],
      [
        'POST',
        '/api/menu/menuSaleItem/batch/customizeMenuItemPriceAndMemberPrices',
        API_SPEC_FILES.endpointSaleItem,
      ],
      ['DELETE', '/api/menu/menuSaleItem/batch/delete', API_SPEC_FILES.endpointSaleItem],
      ['PUT', '/api/menu/menuSaleItem/batch/sequence', API_SPEC_FILES.endpointSaleItem],
      ['PUT', '/api/menu/menuSaleItem/batch/update', API_SPEC_FILES.endpointSaleItem],
      ['PUT', '/api/menu/menuSaleItem/batch/updateOutOfStock', API_SPEC_FILES.endpointSaleItem],
      ['PUT', '/api/menu/menuSaleItem/quickEdit', API_SPEC_FILES.endpointSaleItem],
      ['GET', '/api/menu/menuSaleItems/searchByName', API_SPEC_FILES.endpointSaleItem],
      ['GET', '/api/order/detail/list', API_SPEC_FILES.endpointOrder],
      ['POST', '/api/order/listOrdersByDateNumber', API_SPEC_FILES.endpointOrder],
      ['GET', '/api/order/recall', API_SPEC_FILES.endpointOrder],
      ['DELETE', '/api/payment/deletePaymentRecord', API_SPEC_FILES.endpointPayment],
      ['POST', '/api/payment/savePaymentRecord', API_SPEC_FILES.endpointPayment],
    ] as const) {
      expect(findApiCase(method, path)).toMatchObject({
        endpointStatus: 'covered',
        endpointSpecFile,
      });
    }
  });

  test('全局选项分类 CRUD 链路应拆出 endpoint 单接口用例', () => {
    for (const [method, path, endpointSpecFile] of [
      ['POST', '/api/menu/globalOptionCategory', API_SPEC_FILES.endpointGlobalOptionCategory],
      ['PUT', '/api/menu/globalOptionCategory', API_SPEC_FILES.endpointGlobalOptionCategory],
      ['DELETE', '/api/menu/globalOptionCategory/{id}', API_SPEC_FILES.endpointGlobalOptionCategory],
      ['GET', '/api/menu/globalOptionCategory/{id}', API_SPEC_FILES.endpointGlobalOptionCategory],
      [
        'GET',
        '/api/menu/menu/{menuId}/globalOptionCategories',
        API_SPEC_FILES.endpointGlobalOptionCategory,
      ],
    ] as const) {
      expect(findApiCase(method, path)).toMatchObject({
        endpointStatus: 'covered',
        endpointSpecFile,
      });
    }
  });

  test('全局选项 CRUD 链路应拆出 endpoint 单接口用例', () => {
    for (const [method, path, endpointSpecFile] of [
      ['POST', '/api/menu/menuGlobalOption', API_SPEC_FILES.endpointGlobalOption],
      ['PUT', '/api/menu/menuGlobalOption', API_SPEC_FILES.endpointGlobalOption],
      ['DELETE', '/api/menu/menuGlobalOption/{id}', API_SPEC_FILES.endpointGlobalOption],
      ['GET', '/api/menu/menuGlobalOption/{id}', API_SPEC_FILES.endpointGlobalOption],
      ['GET', '/api/menu/menuGlobalOptions/search', API_SPEC_FILES.endpointGlobalOption],
    ] as const) {
      expect(findApiCase(method, path)).toMatchObject({
        endpointStatus: 'covered',
        endpointSpecFile,
      });
    }
  });

  test('首批抓包接口应按真实业务可执行性更新覆盖等级', () => {
    expect(findApiCase('POST', '/api/menu/menuGroup/batch/copy')).toMatchObject({
      coverage: 'positive-business',
      specFile: API_SPEC_FILES.menuCatalog,
    });
    expect(findApiCase('DELETE', '/api/menu/menuGroup/batch/delete')).toMatchObject({
      coverage: 'positive-business',
      specFile: API_SPEC_FILES.menuCatalog,
    });
    expect(findApiCase('PUT', '/api/menu/menuSaleItem/batch/sequence')).toMatchObject({
      coverage: 'positive-business',
      specFile: API_SPEC_FILES.saleItem,
    });
    expect(findApiCase('PUT', '/api/menu/menuSaleItem/batch/update')).toMatchObject({
      coverage: 'positive-business',
      specFile: API_SPEC_FILES.saleItem,
    });
    expect(findApiCase('POST', '/api/payment/record/save/batch')).toMatchObject({
      coverage: 'contract-only',
      specFile: API_SPEC_FILES.contractSmoke,
    });
    expect(findApiCase('POST', '/api/order/save')).toMatchObject({
      endpointStatus: 'covered',
      endpointSpecFile: API_SPEC_FILES.endpointOrder,
    });
    expect(findApiCase('POST', '/api/payment/record/save')).toMatchObject({
      endpointStatus: 'covered',
      endpointSpecFile: API_SPEC_FILES.endpointPayment,
    });
  });
});

function findApiCase(method: string, path: string) {
  const apiCase = firstBatchApiCases.find((entry) => entry.method === method && entry.path === path);

  expect(apiCase, `${method} ${path} 应存在于首批接口矩阵`).toBeDefined();

  return apiCase;
}

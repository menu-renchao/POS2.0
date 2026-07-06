import { expect, test } from '@playwright/test';
import { toEndpointTitle, type EndpointIdentity } from '../support/endpoint-case';
import {
  expectArrayData,
  expectApiRejected,
  expectHttpStatus,
  expectResourceId,
  parseApiJson,
} from '../support/endpoint-assertions';
import { extractEndpointListData } from '../support/endpoint-list-data';
import {
  extractFirstResourceId,
  findResourceIdByName,
} from '../support/endpoint-read-model';
import { expectJsonSchema } from '../support/json-schema';
import { parseSpuCodeFromAssignResponse } from '../support/spu-code';

test.describe('Endpoint 测试支撑工具', () => {
  test('应能生成包含方法和路径的 endpoint 标题', () => {
    expect(toEndpointTitle('POST', '/api/tax/save', '应能保存税费')).toBe(
      'POST /api/tax/save 应能保存税费',
    );
  });

  test('应能解析 JSON 响应并保留 endpoint 上下文', async () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };
    const response = {
      status: () => 200,
      json: async () => ({ code: 0, msg: 'success', data: [{ id: 1 }] }),
    };

    const body = await parseApiJson(response, identity);

    expect(body).toEqual({ code: 0, msg: 'success', data: [{ id: 1 }] });
  });

  test('应从 SPU assign 响应中解析明确的正整数 code', () => {
    expect(parseSpuCodeFromAssignResponse({ code: 0, msg: 'ok', data: 12345 })).toBe('12345');
    expect(parseSpuCodeFromAssignResponse({ code: 0, msg: 'ok', data: { spuCode: '23456' } })).toBe('23456');
    expect(parseSpuCodeFromAssignResponse({ code: 0, msg: 'ok', data: { result: 'OK', data: 's00359' } })).toBe('s00359');
    expect(parseSpuCodeFromAssignResponse({ code: 0, msg: 'ok', data: { '9001': '34567' } })).toBe('34567');
  });

  test('SPU assign 响应解析不应误取业务 code、商品名或非数字 code', () => {
    expect(() =>
      parseSpuCodeFromAssignResponse({
        code: 0,
        msg: 'ok',
        data: {
          code: 0,
          name: 'AT_SPU_BAD',
          itemId: 9001,
        },
      }),
    ).toThrow('POST /api/spu/menuSaleItem/assign 响应未返回可用于库存操作的 SPU code。');
  });

  test('应能从列表或分页容器中读取数组数据', () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };

    expect(expectArrayData({ code: 0, msg: 'success', data: [{ id: 1 }] }, identity)).toEqual([
      { id: 1 },
    ]);
    expect(
      expectArrayData({ code: 0, msg: 'success', data: { records: [{ id: 2 }] } }, identity),
    ).toEqual([{ id: 2 }]);
  });

  test('应在解析 JSON 失败时保留 endpoint 上下文', async () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };
    const response = {
      status: () => 200,
      json: async () => {
        throw new Error('broken json');
      },
    };

    await expect(parseApiJson(response, identity)).rejects.toThrow(
      'GET /api/tax/list',
    );
    await expect(parseApiJson(response, identity)).rejects.toThrow('响应体解析失败');
  });

  test('应在响应不符合 envelope 时保留 endpoint 上下文', async () => {
    const identity: EndpointIdentity = { method: 'POST', path: '/api/tax/save' };
    const response = {
      status: () => 200,
      json: async () => ({ ok: true }),
    };

    await expect(parseApiJson(response, identity)).rejects.toThrow(
      'POST /api/tax/save',
    );
  });

  test('HTTP 状态码不符时应抛错并携带 endpoint 上下文', async () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };
    const response = {
      status: () => 500,
      json: async () => ({ code: 0, msg: 'success' }),
    };

    await expect(expectHttpStatus(response, identity)).rejects.toThrow('GET /api/tax/list -> 500');
    await expect(expectHttpStatus(response, identity)).rejects.toThrow('"expectedStatus":200');
    await expect(expectHttpStatus(response, identity)).rejects.toThrow('"body":{"code":0');
  });

  test('异常断言应接受业务错误响应', async () => {
    const identity: EndpointIdentity = { method: 'POST', path: '/api/tax/save' };
    const response = {
      status: () => 200,
      json: async () => ({ code: 40001, msg: 'name required', data: null }),
    };

    const body = await expectApiRejected(response, identity, { messageIncludes: 'required' });

    expect(body).toEqual({ code: 40001, msg: 'name required', data: null });
  });

  test('异常断言应接受 HTTP 错误响应', async () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/menu/menu/{id}' };
    const response = {
      status: () => 404,
      json: async () => ({ error: 'not found' }),
    };

    const body = await expectApiRejected(response, identity, {
      expectedStatus: 404,
      messageIncludes: 'not found',
    });

    expect(body).toEqual({ error: 'not found' });
  });

  test('异常断言不应把成功响应误判为异常', async () => {
    const identity: EndpointIdentity = { method: 'POST', path: '/api/tax/save' };
    const response = {
      status: () => 200,
      json: async () => ({ code: 0, msg: 'success', data: { id: 1 } }),
    };

    await expect(expectApiRejected(response, identity)).rejects.toThrow('POST /api/tax/save 应拒绝异常请求');
  });

  test('数组数据提取失败时应抛错并携带 endpoint 上下文', () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };

    expect(() =>
      expectArrayData({ code: 0, msg: 'success', data: { total: 10 } }, identity),
    ).toThrow('GET /api/tax/list 未能从响应中提取数组数据');
    expect(() =>
      expectArrayData({ code: 0, msg: 'success', data: { records: 'not-array' as any } }, identity),
    ).toThrow('GET /api/tax/list 未能从响应中提取数组数据');
  });

  test('应按固定优先级从响应 data 中提取列表数组', () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };

    expect(extractEndpointListData([{ id: 1, name: 'AT_FIRST' }], identity)).toEqual([
      { id: 1, name: 'AT_FIRST' },
    ]);
    expect(extractEndpointListData({ rows: [{ discountId: 2, discountName: 'AT_ROWS' }] }, identity)).toEqual([
      { discountId: 2, discountName: 'AT_ROWS' },
    ]);
    expect(
      extractEndpointListData(
        {
          records: [{ id: 3 }],
          list: [{ id: 4 }],
          items: [{ id: 5 }],
          rows: [{ id: 6 }],
        },
        identity,
      ),
    ).toEqual([{ id: 3 }]);
    expect(
      extractEndpointListData(
        {
          taxes: [{ id: 7, name: 'AT_SPECIFIC_TAX' }],
          records: [{ id: 8, name: 'AT_RECORDS_TAX' }],
        },
        identity,
      ),
    ).toEqual([{ id: 7, name: 'AT_SPECIFIC_TAX' }]);
    expect(
      extractEndpointListData({ taxes: [{ id: 11, name: 'AT_TAX' }] }, {
        method: 'GET',
        path: '/api/tax/list',
      }),
    ).toEqual([{ id: 11, name: 'AT_TAX' }]);
    expect(
      extractEndpointListData({ discounts: [{ id: 22, name: 'AT_DISC' }] }, {
        method: 'GET',
        path: '/api/discount/list',
      }),
    ).toEqual([{ id: 22, name: 'AT_DISC' }]);
    expect(
      extractEndpointListData({ menus: [{ id: 33, name: 'AT_MENU' }] }, {
        method: 'GET',
        path: '/api/menu/menus',
      }),
    ).toEqual([{ id: 33, name: 'AT_MENU' }]);
    expect(
      extractEndpointListData({ menuGroups: [{ id: 44, name: 'AT_MENU_GROUP' }] }, {
        method: 'GET',
        path: '/api/menu/menuGroups',
      }),
    ).toEqual([{ id: 44, name: 'AT_MENU_GROUP' }]);
  });

  test('列表提取失败时应保留 endpoint 上下文并避免递归匹配非目标数组', () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };

    expect(() =>
      extractEndpointListData({ wrapper: { records: [{ id: 1, name: 'AT_NESTED' }] } }, identity),
    ).toThrow('GET /api/tax/list 未能从响应 data 中提取列表数组（支持 data、taxes、discounts、menus、menuGroups、records、list、items、rows）');
  });

  test('列表项缺少对象或标识字段时应抛错', () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/tax/list' };

    expect(() => extractEndpointListData([1, 2, 3], identity)).toThrow('GET /api/tax/list 列表数组应为对象数组');
    expect(() =>
      extractEndpointListData([{ status: 'ok' }], identity),
    ).toThrow('GET /api/tax/list 列表数组应至少包含一个包含 id/name 相关字段的对象');
  });

  test('应能用 JSON schema 校验必须返回字段', () => {
    const schema = {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'object',
          required: ['taxes'],
          properties: {
            taxes: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'name'],
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };

    expectJsonSchema({ data: { taxes: [{ id: 1, name: 'State Tax' }] } }, schema, 'GET /api/tax/list');

    expect(() =>
      expectJsonSchema({ data: { taxes: [{ id: 1 }] } }, schema, 'GET /api/tax/list'),
    ).toThrow('GET /api/tax/list JSON schema 校验失败：$.data.taxes[0].name 缺少必须字段');
  });

  test('JSON schema 校验器不应静默忽略暂不支持的关键字', () => {
    expect(() =>
      expectJsonSchema(0, { type: 'number', minimum: 1 }, 'GET /api/tax/list'),
    ).toThrow('GET /api/tax/list JSON schema 定义不受支持：schema $.minimum 使用了暂不支持的 JSON schema 关键字');
  });

  test('支持更多资源 ID 键，避免误提取 envelope code', () => {
    const identity: EndpointIdentity = { method: 'GET', path: '/api/common' };
    const resourceIdKeys = [
      'menuGroupId',
      'menuCategoryId',
      'menuSaleItemId',
      'itemId',
      'globalOptionId',
      'globalOptionCategoryId',
      'optionId',
      'optionCategoryId',
      'spuId',
      'paymentRecordId',
    ] as const;

    resourceIdKeys.forEach((key, index) => {
      const value = {
        data: {
          [key]: index + 1,
          name: `AT_${key}`,
        },
      };

      expect(extractFirstResourceId(value)).toBe(index + 1);
      expect(findResourceIdByName(value, `AT_${key}`)).toBe(index + 1);
    });

    expect(() => expectArrayData({ code: 0, msg: 'success', data: {} }, identity)).toThrow(
      'GET /api/common 未能从响应中提取数组数据',
    );
    expect(extractFirstResourceId({ code: 0, msg: 'success', data: {} })).toBeUndefined();
    expect(() =>
      expectResourceId({ code: 0, msg: 'success', data: {} }, identity),
    ).toThrow('GET /api/common 未能从响应中提取资源 ID');
  });

  test('应能递归提取资源 ID 和按名称查找 ID', () => {
    const value = {
      data: {
        records: [
          { id: 11, name: 'AT_A' },
          { roleId: 12, roleName: 'AT_B' },
        ],
      },
    };

    expect(extractFirstResourceId(value)).toBe(11);
    expect(findResourceIdByName(value, 'AT_B')).toBe(12);
  });

  test('循环引用应不会导致递归死循环', () => {
    const root: { data: { records: Array<Record<string, unknown>> } } = { data: { records: [] } };
    const first: Record<string, unknown> = { name: 'AT_LOOP' };
    const second: Record<string, unknown> = { roleId: 99, roleName: 'AT_ROLE_LOOP' };

    first.self = second;
    second.self = first;
    root.data.records.push(first);

    expect(extractFirstResourceId(root)).toBe(99);
    expect(findResourceIdByName(root, 'AT_ROLE_LOOP')).toBe(99);
  });

  test('数组自引用应不会导致递归死循环', () => {
    const arr: unknown[] = [];
    arr.push(arr);

    expect(extractFirstResourceId(arr)).toBeUndefined();
    expect(findResourceIdByName(arr, 'NOT_FOUND')).toBeUndefined();
  });

  test('数组自引用应跳过自身引用并继续查找后续有效项', () => {
    const arr: unknown[] = [];
    arr.push(arr);
    arr.push({ id: 77, name: 'AT_NEXT' });

    expect(extractFirstResourceId(arr)).toBe(77);
    expect(findResourceIdByName(arr, 'AT_NEXT')).toBe(77);
  });

  test('循环引用且缺少 id 时应返回 undefined', () => {
    const node: Record<string, unknown> = {};
    node.self = node;

    expect(extractFirstResourceId(node)).toBeUndefined();
    expect(findResourceIdByName(node, 'NOT_FOUND')).toBeUndefined();
  });

  test('缺少资源 ID 时应输出 endpoint 上下文', () => {
    const identity: EndpointIdentity = { method: 'POST', path: '/api/tax/save' };

    expect(() => expectResourceId({ data: {} }, identity)).toThrow(
      'POST /api/tax/save 未能从响应中提取资源 ID',
    );
  });
});

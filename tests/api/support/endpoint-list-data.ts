import { toEndpointTitle, type EndpointIdentity } from './endpoint-case';

const LIST_DATA_KEYS = ['records', 'list', 'items', 'rows'] as const;
const TAX_LIST_DATA_KEY = 'taxes';
const DISCOUNT_LIST_DATA_KEY = 'discounts';
const MENU_LIST_DATA_KEY = 'menus';
const MENU_GROUP_LIST_DATA_KEY = 'menuGroups';

export function extractEndpointListData(
  data: unknown,
  identity: EndpointIdentity,
): Record<string, unknown>[] {
  const listData = resolveListData(data, identity.path);

  if (listData === undefined) {
    throw new Error(
      toEndpointTitle(
        identity.method,
        identity.path,
        '未能从响应 data 中提取列表数组（支持 data、taxes、discounts、menus、menuGroups、records、list、items、rows）',
      ),
    );
  }

  if (!isRecordArray(listData)) {
    throw new Error(toEndpointTitle(identity.method, identity.path, '列表数组应为对象数组'));
  }

  if (!hasIdentityLikeField(listData)) {
    throw new Error(
      toEndpointTitle(
        identity.method,
        identity.path,
        '列表数组应至少包含一个包含 id/name 相关字段的对象',
      ),
    );
  }

  return listData;
}

function resolveListData(data: unknown, path: string): unknown[] | undefined {
  if (Array.isArray(data)) {
    return data;
  }

  if (!isRecord(data)) {
    return undefined;
  }

  const keyOrder = resolveListDataKeys(path);
  for (const key of keyOrder) {
    const candidate = data[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  for (const key of LIST_DATA_KEYS) {
    const candidate = data[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolveListDataKeys(path: string): readonly string[] {
  if (path === '/api/tax/list') {
    return [TAX_LIST_DATA_KEY];
  }

  if (path === '/api/discount/list') {
    return [DISCOUNT_LIST_DATA_KEY];
  }

  if (path === '/api/menu/menus') {
    return [MENU_LIST_DATA_KEY];
  }

  if (path === '/api/menu/menuGroups') {
    return [MENU_GROUP_LIST_DATA_KEY];
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecordArray(value: unknown[]): value is Record<string, unknown>[] {
  return value.every(isRecord);
}

function hasIdentityLikeField(listData: Record<string, unknown>[]): boolean {
  if (listData.length === 0) {
    return true;
  }

  return listData.some((record) =>
    Object.keys(record).some((key) => {
      const normalizedKey = key.toLowerCase();
      return (
        key === 'id' ||
        key === 'name' ||
        key === 'displayName' ||
        normalizedKey.endsWith('id') ||
        normalizedKey.endsWith('name')
      );
    }),
  );
}

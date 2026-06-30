import type { ResourceId } from '../../../api/core/resource-registry';

const RESOURCE_ID_KEYS = [
  'id',
  'taxId',
  'discountId',
  'roleId',
  'menuId',
  'menuGroupId',
  'menuCategoryId',
  'menuSaleItemId',
  'itemId',
  'globalOptionId',
  'globalOptionCategoryId',
  'optionId',
  'optionCategoryId',
  'spuId',
  'groupId',
  'categoryId',
  'saleItemId',
  'orderId',
  'paymentId',
  'paymentRecordId',
];

const NAME_KEYS = [
  'name',
  'displayName',
  'customerName',
  'menuName',
  'menuGroupName',
  'categoryName',
  'menuCategoryName',
  'saleItemName',
  'roleName',
  'taxName',
  'discountName',
  'globalOptionName',
  'globalOptionCategoryName',
  'optionCategoryName',
  'optionName',
];

export function extractFirstResourceId(value: unknown): ResourceId | undefined {
  return extractFirstResourceIdValue(value, new Set<object>());
}

export function findResourceIdByName(value: unknown, name: string): ResourceId | undefined {
  return findResourceIdByNameValue(value, name, new Set<object>());
}

function extractFirstResourceIdValue(value: unknown, seen: Set<object>): ResourceId | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return undefined;
    }

    seen.add(value);
    return extractFirstResourceIdFromItems(value, seen);
  }

  const record = value as Record<string, unknown>;
  if (seen.has(record)) {
    return undefined;
  }
  seen.add(record);

  const directId = extractResourceIdFromRecord(record);
  if (directId !== undefined) {
    return directId;
  }

  for (const entry of Object.values(record)) {
    const nestedId = extractFirstResourceIdValue(entry, seen);
    if (nestedId !== undefined) {
      return nestedId;
    }
  }

  return undefined;
}

function extractFirstResourceIdFromItems(items: unknown[], seen: Set<object>): ResourceId | undefined {
  for (const item of items) {
    const nestedId = extractFirstResourceIdValue(item, seen);
    if (nestedId !== undefined) {
      return nestedId;
    }
  }

  return undefined;
}

function findResourceIdByNameValue(
  value: unknown,
  name: string,
  seen: Set<object>,
): ResourceId | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return undefined;
    }

    seen.add(value);
    return findResourceIdByNameInItems(value, name, seen);
  }

  const record = value as Record<string, unknown>;
  if (seen.has(record)) {
    return undefined;
  }
  seen.add(record);

  if (recordHasName(record, name)) {
    return extractResourceIdFromRecord(record);
  }

  for (const entry of Object.values(record)) {
    const nestedId = findResourceIdByNameValue(entry, name, seen);
    if (nestedId !== undefined) {
      return nestedId;
    }
  }

  return undefined;
}

function findResourceIdByNameInItems(
  items: unknown[],
  name: string,
  seen: Set<object>,
): ResourceId | undefined {
  for (const item of items) {
    const nestedId = findResourceIdByNameValue(item, name, seen);
    if (nestedId !== undefined) {
      return nestedId;
    }
  }

  return undefined;
}

function extractResourceIdFromRecord(record: Record<string, unknown>): ResourceId | undefined {
  for (const key of RESOURCE_ID_KEYS) {
    const value = record[key];

    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

function recordHasName(record: Record<string, unknown>, name: string): boolean {
  return NAME_KEYS.some((key) => record[key] === name);
}

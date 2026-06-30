import { createShortTestName } from '../../api/core/test-data-id';

export type ApiEntityId = string | number;
export type MenuApiRequest = Record<string, unknown> & {
  name: string;
};

export type MenuGroupApiRequest = MenuApiRequest & {
  menuId: ApiEntityId;
};

export type CategoryApiRequest = MenuApiRequest & {
  menuId: ApiEntityId;
  menuGroupId: ApiEntityId;
};

export type GlobalOptionCategoryApiRequest = MenuApiRequest & {
  menuId: ApiEntityId;
};

export type GlobalOptionApiRequest = MenuApiRequest & {
  globalOptionCategoryId: ApiEntityId;
  price: number;
};

export type SaleItemApiRequest = MenuApiRequest & {
  menuCategoryId: ApiEntityId;
  posName: string;
  price: number;
};

export const DEFAULT_MENU_PRODUCT = 'POS';

export const MENU_API_NAME_LIMITS = {
  menu: 24,
  menuGroup: 24,
  category: 24,
  globalOptionCategory: 24,
  globalOption: 24,
  saleItem: 24,
} as const;

export function buildMenuRequest(seed?: string | number): MenuApiRequest {
  const name = buildApiTestName('MENU', MENU_API_NAME_LIMITS.menu, seed);

  return {
    name,
    displayName: name,
    description: name,
    productLine: DEFAULT_MENU_PRODUCT,
    sequence: 1,
    enabled: true,
    active: false,
  };
}

export function buildMenuGroupRequest(
  menuId: ApiEntityId,
  seed?: string | number,
): MenuGroupApiRequest {
  const name = buildApiTestName('MENU_GROUP', MENU_API_NAME_LIMITS.menuGroup, seed);

  return {
    menuId,
    name,
    displayName: name,
    sequence: 1,
    enabled: true,
  };
}

export function buildCategoryRequest(
  menuId: ApiEntityId,
  menuGroupId: ApiEntityId,
  seed?: string | number,
): CategoryApiRequest {
  const name = buildApiTestName('CATEGORY', MENU_API_NAME_LIMITS.category, seed);

  return {
    menuId,
    menuGroupId,
    name,
    displayName: name,
    sequence: 1,
    enabled: true,
  };
}

export function buildGlobalOptionCategoryRequest(
  menuId: ApiEntityId,
  seed?: string | number,
): GlobalOptionCategoryApiRequest {
  const name = buildApiTestName('GLOBAL_OPTION_CATEGORY', MENU_API_NAME_LIMITS.globalOptionCategory, seed);

  return {
    menuId,
    name,
    displayName: name,
    sequence: 1,
    enabled: true,
  };
}

export function buildGlobalOptionRequest(
  globalOptionCategoryId: ApiEntityId,
  seed?: string | number,
): GlobalOptionApiRequest {
  const name = buildApiTestName('GLOBAL_OPTION', MENU_API_NAME_LIMITS.globalOption, seed);

  return {
    globalOptionCategoryId,
    name,
    displayName: name,
    price: 1,
    sequence: 1,
    enabled: true,
  };
}

export function buildSaleItemRequest(
  menuCategoryId: ApiEntityId,
  seed?: string | number,
): SaleItemApiRequest {
  const name = buildApiTestName('SALE_ITEM', MENU_API_NAME_LIMITS.saleItem, seed);

  return {
    menuCategoryId,
    name,
    displayName: name,
    posName: name,
    price: 10,
    sequence: 1,
    enabled: true,
  };
}

function buildApiTestName(domain: string, maxLength: number, seed?: string | number): string {
  return createShortTestName({
    prefix: 'AT',
    domain,
    maxLength,
    seed: toShortSeed(seed, domain),
  });
}

function toShortSeed(seed: string | number | undefined, fallback: string): string {
  const normalized = String(seed ?? fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);

  return normalized || '0';
}

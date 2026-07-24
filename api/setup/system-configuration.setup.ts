import type { SystemConfigurationApiClient } from '../clients/system-configuration-api.client';
import { expectOkEnvelope } from './setup-resource';

export type SystemConfigurationInputValue = string | number | boolean | Date | null;

export type SystemConfigurationIndexEntry = {
  id: number;
  name: string;
  value: unknown;
  dataType: string;
};

export type SystemConfigurationUpdateOptions = {
  userId?: number;
  verify?: boolean;
};

export type SystemConfigurationRestore = () => Promise<void>;

export type SystemConfigurationSetupService = {
  listIndex: () => Promise<Map<string, SystemConfigurationIndexEntry>>;
  updateByName: (
    name: string,
    value: SystemConfigurationInputValue,
    options?: SystemConfigurationUpdateOptions,
  ) => Promise<SystemConfigurationRestore>;
  updateManyByName: (
    values: Record<string, SystemConfigurationInputValue>,
    options?: SystemConfigurationUpdateOptions,
  ) => Promise<SystemConfigurationRestore>;
};

export type SystemConfigurationSetupOptions = {
  systemConfigurationApi?: SystemConfigurationApiClient;
};

type SystemConfigurationUpdateEntry = {
  id: number;
  name: string;
  value: string | number;
  dataType: string;
};

export function createSystemConfigurationSetupService(
  options: SystemConfigurationSetupOptions,
): SystemConfigurationSetupService {
  let cachedIndex: Map<string, SystemConfigurationIndexEntry> | undefined;

  const requireApi = (): SystemConfigurationApiClient => {
    if (!options.systemConfigurationApi) {
      throw new Error('systemConfigurationApi 未配置，无法更新系统配置。');
    }

    return options.systemConfigurationApi;
  };

  const loadIndex = async (forceRefresh = false) => {
    if (cachedIndex && !forceRefresh) {
      return cachedIndex;
    }

    const api = requireApi();
    const [frontendResponse, adminResponse] = await Promise.all([
      api.listSystemConfigurations({
        fetchDetails: true,
        adminRequest: false,
      }),
      api.listSystemConfigurations({
        fetchDetails: true,
        adminRequest: true,
      }),
    ]);
    const [frontendBody, adminBody] = await Promise.all([
      expectOkEnvelope(frontendResponse),
      expectOkEnvelope(adminResponse),
    ]);
    const frontendIndex = toConfigurationIndex(frontendBody.data);
    const adminIndex = toConfigurationIndex(adminBody.data);

    cachedIndex = new Map([...frontendIndex, ...adminIndex]);
    return cachedIndex;
  };

  const updateEntries = async (
    entries: SystemConfigurationUpdateEntry[],
    options: SystemConfigurationUpdateOptions = {},
  ) => {
    const api = requireApi();
    const body = await expectOkEnvelope(
      await api.updateSystemConfigurations({
        systemConfiguration: entries,
        userAuth: {
          userId: options.userId ?? 1,
        },
      }),
    );
    const failedIds = extractFailedSystemConfigurationIds(body.data);

    if (failedIds.length > 0) {
      throw new Error(`系统配置更新失败: ${failedIds.join(', ')}`);
    }

    cachedIndex = undefined;
  };

  const service: SystemConfigurationSetupService = {
    listIndex: async () => await loadIndex(),
    updateByName: async (name, value, options = {}) =>
      await service.updateManyByName({ [name]: value }, options),
    updateManyByName: async (values, options = {}) => {
      const index = await loadIndex();
      const requestedEntries = Object.entries(values).map(([name, value]) =>
        buildUpdateEntry(resolveIndexEntry(index, name), value),
      );
      const entries = requestedEntries.filter((entry) => {
        const currentValue = resolveIndexEntry(index, entry.name).value;
        return String(currentValue) !== String(entry.value);
      });
      const oldEntries = entries.map((entry) =>
        buildUpdateEntry(resolveIndexEntry(index, entry.name), resolveIndexEntry(index, entry.name).value),
      );

      if (entries.length === 0) {
        return async () => {};
      }

      await updateEntries(entries, options);

      if (options.verify) {
        await verifyUpdatedValues(entries);
      }

      return async () => {
        await updateEntries(oldEntries, options);
      };
    },
  };

  async function verifyUpdatedValues(entries: SystemConfigurationUpdateEntry[]): Promise<void> {
    const refreshedIndex = await loadIndex(true);

    for (const entry of entries) {
      const refreshedEntry = resolveIndexEntry(refreshedIndex, entry.name);

      if (String(refreshedEntry.value) !== String(entry.value)) {
        throw new Error(
          `系统配置 ${entry.name} 更新后校验失败，期望 ${String(entry.value)}，实际 ${String(
            refreshedEntry.value,
          )}。`,
        );
      }
    }
  }

  return service;
}

function buildUpdateEntry(
  entry: SystemConfigurationIndexEntry,
  value: SystemConfigurationInputValue | unknown,
): SystemConfigurationUpdateEntry {
  return {
    id: entry.id,
    name: entry.name,
    value: toSystemConfigurationValue(value, entry.dataType),
    dataType: entry.dataType,
  };
}

function toConfigurationIndex(value: unknown): Map<string, SystemConfigurationIndexEntry> {
  const configurations = extractSystemConfigurations(value);
  const index = new Map<string, SystemConfigurationIndexEntry>();

  for (const item of configurations) {
    const entry = toIndexEntry(item);

    if (entry) {
      index.set(entry.name, entry);
    }
  }

  return index;
}

function extractSystemConfigurations(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value) && Array.isArray(value.systemConfiguration)) {
    return value.systemConfiguration;
  }

  return [];
}

function toIndexEntry(value: unknown): SystemConfigurationIndexEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { id, name, dataType } = value;
  if (typeof id !== 'number' || typeof name !== 'string' || !name) {
    return undefined;
  }

  return {
    id,
    name,
    value: value.value,
    dataType: typeof dataType === 'string' && dataType ? dataType : 'String',
  };
}

function resolveIndexEntry(
  index: Map<string, SystemConfigurationIndexEntry>,
  name: string,
): SystemConfigurationIndexEntry {
  const entry = index.get(name);

  if (!entry) {
    throw new Error(`未找到系统配置: ${name}`);
  }

  return entry;
}

function toSystemConfigurationValue(
  value: SystemConfigurationInputValue | unknown,
  dataType: string,
): string | number {
  switch (dataType) {
    case 'Boolean':
      return toBooleanString(value);
    case 'Integer':
      return toNumberValue(value, dataType);
    case 'Double':
      return toNumberValue(value, dataType);
    case 'Date':
      return value instanceof Date ? value.toISOString() : String(value ?? '');
    case 'String':
    default:
      return String(value ?? '');
  }
}

function toBooleanString(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'false') {
      return normalized;
    }
  }

  return value ? 'true' : 'false';
}

function toNumberValue(value: unknown, dataType: string): string | number {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numberValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`系统配置 ${dataType} 值必须是数字: ${String(value)}`);
  }

  return dataType === 'Integer' ? Math.trunc(numberValue) : numberValue;
}

function extractFailedSystemConfigurationIds(value: unknown): Array<string | number> {
  if (!isRecord(value) || !Array.isArray(value.failedSystemConfigurationIds)) {
    return [];
  }

  return value.failedSystemConfigurationIds.filter(
    (id): id is string | number => typeof id === 'string' || typeof id === 'number',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

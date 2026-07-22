import type { LayoutConfigApiClient } from '../clients/layout-config-api.client';
import type { OrderTypeApiClient } from '../clients/order-type-api.client';
import type { ResourceRegistry } from '../core/resource-registry';
import { expectOkEnvelope } from './setup-resource';

export type CustomOrderTypeSetting = {
  id: number;
  name: string;
  displayName: string;
  shortName: string;
  orderType: string | null;
  defaultAreaId: number | null;
  type: 'CUSTOM';
};

export type HomeLayoutConfig = {
  id: number;
  name: string;
  positionIndex: number;
  layoutType: string;
  buttonType: string;
  icon: string | null;
  hide: boolean;
};

export type ConfigureCustomDeliveryOptions = {
  name?: string;
  displayName: string;
  shortName: string;
  positionIndex?: number;
};

export type ConfiguredCustomDelivery = {
  orderType: CustomOrderTypeSetting;
  layout: HomeLayoutConfig;
};

export type CustomOrderTypeSetupService = {
  configureDelivery: (
    options: ConfigureCustomDeliveryOptions,
  ) => Promise<ConfiguredCustomDelivery>;
};

export type CustomOrderTypeSetupOptions = {
  layoutConfigApi?: LayoutConfigApiClient;
  orderTypeApi?: OrderTypeApiClient;
  resourceRegistry: ResourceRegistry;
};

const DEFAULT_CUSTOM_ORDER_TYPE_NAME = 'CUSTOM_ORDER_TYPE1';
const MAIN_PANEL_LOCATION = 'MAIN_PANEL';

export function createCustomOrderTypeSetupService(
  options: CustomOrderTypeSetupOptions,
): CustomOrderTypeSetupService {
  const requireApis = () => {
    if (!options.orderTypeApi || !options.layoutConfigApi) {
      throw new Error('orderTypeApi 或 layoutConfigApi 未配置，无法设置自定义订单类型。');
    }

    return {
      orderTypeApi: options.orderTypeApi,
      layoutConfigApi: options.layoutConfigApi,
    };
  };

  return {
    configureDelivery: async ({
      name = DEFAULT_CUSTOM_ORDER_TYPE_NAME,
      displayName,
      shortName,
      positionIndex = 6,
    }) => {
      const { orderTypeApi, layoutConfigApi } = requireApis();
      const originalOrderType = await readOrderType(orderTypeApi, name);
      const originalLayout = await readHomeLayout(layoutConfigApi, name);
      const resourceId = `${originalOrderType.id}:${originalLayout.id}`;

      if (options.resourceRegistry.has('custom-order-type-configuration', resourceId)) {
        throw new Error(`自定义订单类型 ${name} 已在当前测试中配置，不能重复覆盖恢复基线。`);
      }

      options.resourceRegistry.register({
        type: 'custom-order-type-configuration',
        id: resourceId,
        name,
        cleanupPriority: 100,
        cleanup: async () => {
          await expectOkEnvelope(
            await layoutConfigApi.saveLayoutConfigs({ layoutConfig: [originalLayout] }),
          );
          await expectOkEnvelope(await orderTypeApi.saveOrderType(originalOrderType));
        },
      });

      const requestedOrderType: CustomOrderTypeSetting = {
        ...originalOrderType,
        displayName,
        shortName,
        orderType: 'DELIVERY',
      };
      const requestedLayout: HomeLayoutConfig = {
        ...originalLayout,
        positionIndex,
        layoutType: 'BODY',
        buttonType: 'ORDER',
        hide: false,
      };

      await expectOkEnvelope(await orderTypeApi.saveOrderType(requestedOrderType));
      await expectOkEnvelope(
        await layoutConfigApi.saveLayoutConfigs({ layoutConfig: [requestedLayout] }),
      );

      const orderType = await readOrderType(orderTypeApi, name);
      const layout = await readHomeLayout(layoutConfigApi, name);

      if (
        orderType.displayName !== displayName ||
        orderType.shortName !== shortName ||
        orderType.orderType !== 'DELIVERY'
      ) {
        throw new Error(`自定义订单类型 ${name} 更新后回读不一致。`);
      }

      if (layout.hide || layout.layoutType !== 'BODY' || layout.positionIndex !== positionIndex) {
        throw new Error(`自定义订单类型 ${name} 的首页布局更新后回读不一致。`);
      }

      return { orderType, layout };
    },
  };
}

async function readOrderType(
  api: OrderTypeApiClient,
  name: string,
): Promise<CustomOrderTypeSetting> {
  const body = await expectOkEnvelope(
    await api.listOrderTypes({ fetchInUsedCustomOrderType: false }),
  );
  const values = Array.isArray(body.data) ? body.data : [];
  const value = values.find(
    (item) => isRecord(item) && item.name === name,
  );

  if (!isRecord(value)) {
    throw new Error(`未找到自定义订单类型 ${name}。`);
  }

  return toCustomOrderTypeSetting(value, name);
}

async function readHomeLayout(
  api: LayoutConfigApiClient,
  name: string,
): Promise<HomeLayoutConfig> {
  const body = await expectOkEnvelope(
    await api.listLayoutConfigs({ location: MAIN_PANEL_LOCATION }),
  );
  const data = isRecord(body.data) ? body.data : {};
  const values = Array.isArray(data.layoutConfigs) ? data.layoutConfigs : [];
  const value = values.find(
    (item) => isRecord(item) && item.name === name,
  );

  if (!isRecord(value)) {
    throw new Error(`未找到自定义订单类型 ${name} 的首页布局。`);
  }

  return toHomeLayoutConfig(value, name);
}

function toCustomOrderTypeSetting(
  value: Record<string, unknown>,
  expectedName: string,
): CustomOrderTypeSetting {
  const { id, name, displayName, shortName, orderType, defaultAreaId, type } = value;

  if (
    typeof id !== 'number' ||
    name !== expectedName ||
    typeof displayName !== 'string' ||
    typeof shortName !== 'string' ||
    (orderType !== null && typeof orderType !== 'string') ||
    (defaultAreaId !== null && typeof defaultAreaId !== 'number') ||
    type !== 'CUSTOM'
  ) {
    throw new Error(`自定义订单类型 ${expectedName} 的接口数据结构无效。`);
  }

  return { id, name, displayName, shortName, orderType, defaultAreaId, type };
}

function toHomeLayoutConfig(
  value: Record<string, unknown>,
  expectedName: string,
): HomeLayoutConfig {
  const { id, name, positionIndex, layoutType, buttonType, icon, hide } = value;

  if (
    typeof id !== 'number' ||
    name !== expectedName ||
    typeof positionIndex !== 'number' ||
    typeof layoutType !== 'string' ||
    typeof buttonType !== 'string' ||
    (icon !== null && typeof icon !== 'string') ||
    typeof hide !== 'boolean'
  ) {
    throw new Error(`自定义订单类型 ${expectedName} 的首页布局接口数据结构无效。`);
  }

  return { id, name, positionIndex, layoutType, buttonType, icon, hide };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

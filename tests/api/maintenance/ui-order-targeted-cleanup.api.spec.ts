import { test } from '../../../fixtures/api.fixture';

const targetOrderIds = parseTargetOrderIds(
  process.env.UI_ORDER_IDS_TO_CLEAN,
);

test.describe('UI 自动化订单定向清理', () => {
  test.skip(
    targetOrderIds.length === 0,
    '未提供 UI_ORDER_IDS_TO_CLEAN，不执行订单清理。',
  );

  test('应只作废显式指定的订单 ID 并清理对应桌台占用', async ({
    orderApi,
  }) => {
    for (const orderId of targetOrderIds) {
      await test.step(`作废并清理 UI 自动化订单 ${orderId}`, async () => {
        await orderApi.voidOrderById(orderId);
        await orderApi.clearTableOrders([orderId]);
      });
    }
  });
});

function parseTargetOrderIds(value: string | undefined): number[] {
  if (!value?.trim()) {
    return [];
  }

  const orderIds = value.split(',').map((item) => Number(item.trim()));
  if (
    orderIds.some(
      (orderId) => !Number.isInteger(orderId) || orderId <= 0,
    )
  ) {
    throw new Error(
      'UI_ORDER_IDS_TO_CLEAN 只能包含以逗号分隔的正整数订单 ID。',
    );
  }

  return [...new Set(orderIds)];
}

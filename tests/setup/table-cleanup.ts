import { OrderApiClient } from '../../api/clients/order-api.client';
import { loadApiConfig } from '../../api/core/api-config';
import { createApiRequestContext } from '../../api/core/api-context';
import { expectResponseEnvelope } from '../../api/core/api-response';
import { MysqlDb } from '../../utils/db';
import { resolveKposMysqlConfig } from '../../utils/db-config';

type OccupiedOrderRow = {
  order_id: number | string;
};

const CLEAR_TABLE_BATCH_SIZE = 50;

export async function clearOccupiedTablesBeforeRun(): Promise<number> {
  const apiConfig = loadApiConfig();
  const db = new MysqlDb(resolveKposMysqlConfig(apiConfig.baseURL));
  const rows = await db.queryRows<OccupiedOrderRow>(
    [
      'SELECT COALESCE(order_bill.parent_order_id, order_bill.id) AS order_id',
      'FROM kpos.order_bill AS order_bill',
      'INNER JOIN (',
      'SELECT table_id, MAX(id) AS latest_order_id',
      'FROM kpos.order_bill',
      'WHERE table_id IS NOT NULL',
      'AND status IN (1, 2, 3, 4, 100, 101)',
      'GROUP BY table_id',
      ') AS occupied_tables ON occupied_tables.latest_order_id = order_bill.id',
      'ORDER BY order_id',
    ].join(' '),
  );
  const orderIds = rows.map(({ order_id: orderId }) => {
    const normalizedOrderId = Number(orderId);

    if (!Number.isInteger(normalizedOrderId) || normalizedOrderId <= 0) {
      throw new Error(`Occupied table query returned invalid order id: ${String(orderId)}`);
    }

    return normalizedOrderId;
  });

  if (orderIds.length === 0) {
    return 0;
  }

  const apiContext = await createApiRequestContext(apiConfig);
  const orderApi = new OrderApiClient(apiContext);

  try {
    for (let index = 0; index < orderIds.length; index += CLEAR_TABLE_BATCH_SIZE) {
      const batchOrderIds = orderIds.slice(index, index + CLEAR_TABLE_BATCH_SIZE);
      const response = await orderApi.clearTable({ orderIds: batchOrderIds });
      const body: unknown = await response.json();

      expectResponseEnvelope(body);
      if (!response.ok() || body.code !== 0) {
        throw new Error(
          `Failed to clear occupied tables: HTTP ${response.status()}, code=${body.code}, msg=${body.msg}`,
        );
      }
    }
  } finally {
    await apiContext.dispose();
  }

  return orderIds.length;
}

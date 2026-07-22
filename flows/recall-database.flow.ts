import type { RecallDateRange } from '../test-data/recall-list';
import { MysqlDb } from '../utils/db';
import { resolveKposMysqlConfig } from '../utils/db-config';
import { step } from '../utils/step';

type OrderCountRow = {
  count: number | string;
};

type SplitChildOrderRow = {
  id: number | string;
  parent_order_id: number | string | null;
};

type OrderStatusRow = {
  id: number | string;
  status: number | string;
};

type OrderReceiptPrintCountRow = {
  number_of_receipt_printed: number | string;
};

type OccupiedTableOrderRow = {
  table_id: number | string;
};

function toMysqlDate(date: string): string {
  const [month, day, year] = date.split('/');

  if (!month || !day || !year) {
    throw new Error(`无法解析 Recall 日期：${date}`);
  }

  return `${year}-${month}-${day}`;
}

export class RecallDatabaseFlow {
  private readonly db: MysqlDb;

  constructor(apiBaseURL: string) {
    this.db = new MysqlDb(resolveKposMysqlConfig(apiBaseURL));
  }

  @step('业务步骤：按 Recall 父子单合并口径查询日期范围内的订单数量')
  async countParentOrdersInDateRange(range: RecallDateRange): Promise<number> {
    const rows = await this.db.queryRows<OrderCountRow>(
      [
        'SELECT COUNT(DISTINCT COALESCE(parent_order.id, child_order.id)) AS count',
        'FROM kpos.order_bill AS child_order',
        'LEFT JOIN kpos.order_bill AS parent_order',
        'ON parent_order.id = child_order.parent_order_id',
        'WHERE child_order.created_on BETWEEN ? AND ?',
        'AND (',
        'child_order.status <> -3',
        'OR (child_order.status = -3 AND child_order.is_be_merged = 1)',
        ')',
      ].join(' '),
      [
        `${toMysqlDate(range.start)} 00:00:00`,
        `${toMysqlDate(range.end)} 23:59:59`,
      ],
    );
    const count = Number(rows[0]?.count);

    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`数据库返回了无效的 Recall 订单数量：${String(rows[0]?.count)}`);
    }

    return count;
  }

  @step('业务步骤：按 Recall 父子单合并口径查询指定状态的订单数量')
  async countParentOrdersByStatusesInDateRange(
    range: RecallDateRange,
    statuses: number[],
  ): Promise<number> {
    if (statuses.length === 0) {
      throw new Error('查询 Recall 状态订单数量时必须至少提供一个状态。');
    }

    const rows = await this.db.queryRows<OrderCountRow>(
      [
        'SELECT COUNT(DISTINCT COALESCE(parent_order.id, child_order.id)) AS count',
        'FROM kpos.order_bill AS child_order',
        'LEFT JOIN kpos.order_bill AS parent_order',
        'ON parent_order.id = child_order.parent_order_id',
        'WHERE child_order.created_on BETWEEN ? AND ?',
        `AND child_order.status IN (${statuses.map(() => '?').join(', ')})`,
      ].join(' '),
      [
        `${toMysqlDate(range.start)} 00:00:00`,
        `${toMysqlDate(range.end)} 23:59:59`,
        ...statuses,
      ],
    );
    const count = Number(rows[0]?.count);

    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        `数据库返回了无效的 Recall 状态订单数量：${String(rows[0]?.count)}`,
      );
    }

    return count;
  }

  @step('业务步骤：为分单子单临时设置带字母的订单号')
  async replaceLatestSplitChildOrderNumberWithAlphabetic(
    childOrderNumber: string,
  ): Promise<{ orderNumber: string; restore: () => Promise<void> }> {
    const rows = await this.db.queryRows<SplitChildOrderRow>(
      [
        'SELECT id, parent_order_id',
        'FROM kpos.order_bill',
        'WHERE order_num = ?',
        'ORDER BY id DESC',
        'LIMIT 1',
      ].join(' '),
      [childOrderNumber],
    );
    const row = rows[0];

    if (!row || row.parent_order_id === null) {
      throw new Error(`数据库中未找到已落库的分单子单：${childOrderNumber}`);
    }

    const rowId = Number(row.id);
    if (!Number.isInteger(rowId) || rowId <= 0) {
      throw new Error(`分单子单 ${childOrderNumber} 返回了无效数据库 ID：${String(row.id)}`);
    }

    const alphabeticOrderNumber = childOrderNumber.replace(/-\d+$/, 'A');
    if (alphabeticOrderNumber === childOrderNumber) {
      throw new Error(`无法从分单子单号生成带字母订单号：${childOrderNumber}`);
    }

    await this.db.execute('UPDATE kpos.order_bill SET order_num = ? WHERE id = ?', [
      alphabeticOrderNumber,
      rowId,
    ]);

    return {
      orderNumber: alphabeticOrderNumber,
      restore: async () => {
        await this.db.execute('UPDATE kpos.order_bill SET order_num = ? WHERE id = ?', [
          childOrderNumber,
          rowId,
        ]);
      },
    };
  }

  @step('业务步骤：读取指定订单号最新记录的数据库状态')
  async readLatestOrderStatus(orderNumber: string): Promise<string> {
    const rows = await this.db.queryRows<OrderStatusRow>(
      [
        'SELECT id, status',
        'FROM kpos.order_bill',
        'WHERE order_num = ?',
        'ORDER BY id DESC',
        'LIMIT 1',
      ].join(' '),
      [orderNumber],
    );
    const status = rows[0]?.status;

    if (status === undefined || status === null || String(status).trim() === '') {
      throw new Error(`数据库中未找到订单 ${orderNumber} 的状态。`);
    }

    return String(status);
  }

  @step('业务步骤：读取指定订单号最新记录的小票打印次数')
  async readLatestReceiptPrintCount(orderNumber: string): Promise<number> {
    const rows = await this.db.queryRows<OrderReceiptPrintCountRow>(
      [
        'SELECT number_of_receipt_printed',
        'FROM kpos.order_bill',
        'WHERE order_num = ?',
        'ORDER BY id DESC',
        'LIMIT 1',
      ].join(' '),
      [orderNumber],
    );
    const count = Number(rows[0]?.number_of_receipt_printed);

    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`数据库中未找到订单 ${orderNumber} 的有效小票打印次数。`);
    }

    return count;
  }

  @step('业务步骤：读取当前被最少未完成订单占用的桌台 ID')
  async readLeastOccupiedTableId(): Promise<number> {
    const rows = await this.db.queryRows<OccupiedTableOrderRow>(
      [
        'SELECT table_id',
        'FROM kpos.order_bill',
        'WHERE table_id IS NOT NULL',
        'AND status IN (1, 2, 3)',
        'GROUP BY table_id',
        'ORDER BY COUNT(*) ASC, MIN(created_on) ASC',
        'LIMIT 1',
      ].join(' '),
    );
    const tableId = Number(rows[0]?.table_id);

    if (!Number.isInteger(tableId) || tableId <= 0) {
      throw new Error('数据库中没有可清理的已占用桌台。');
    }

    return tableId;
  }

}

import type { RecallDateRange } from '../test-data/recall-list';
import { MysqlDb } from '../utils/db';
import { resolveKposMysqlConfig } from '../utils/db-config';
import { step } from '../utils/step';

type OrderCountRow = {
  count: number | string;
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
}

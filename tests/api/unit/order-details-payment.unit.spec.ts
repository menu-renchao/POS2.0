import { expect, test } from '@playwright/test';
import { parseOrderPaymentText } from '../../../pages/shared/order-details/order-details-payment.section';

test.describe('订单详情支付流水解析', () => {
  test('应一次解析两笔现金支付及各自明细', () => {
    expect(
      parseOrderPaymentText(`
        PAYMENT
        Cash
        $5.00
        Tips
        $0.00
        Change
        $0.00
        Void
        Refund
        Tips
        Cash
        $4.68
        Tips
        $0.00
        Change
        $0.00
        Void
        Refund
        Tips
      `),
    ).toEqual([
      {
        method: 'Cash',
        amount: '$5.00',
        details: { Tips: '$0.00', Change: '$0.00' },
      },
      {
        method: 'Cash',
        amount: '$4.68',
        details: { Tips: '$0.00', Change: '$0.00' },
      },
    ]);
  });

  test('Tips 展开后不应把操作按钮误判为新的支付流水', () => {
    expect(
      parseOrderPaymentText(`
        PAYMENT
        Cash
        $6.00
        Tips
        $1.00
        Cash Tips
        $1.00
        Change
        $0.00
        Void
        Refund
        Tips
      `),
    ).toEqual([
      {
        method: 'Cash',
        amount: '$6.00',
        details: { Tips: '$1.00', 'Cash Tips': '$1.00' },
      },
    ]);
  });

  test('应解析不含小费字段的负向现金退款流水', () => {
    expect(
      parseOrderPaymentText(`
        PAYMENT
        Cash
        $20.57
        Tips
        $0.00
        Change
        $0.00
        Void
        Refund
        Tips
        Cash
        -$9.68
        Change
        $0.00
        Refund
        Void
      `),
    ).toEqual([
      {
        method: 'Cash',
        amount: '$20.57',
        details: { Tips: '$0.00', Change: '$0.00' },
      },
      {
        method: 'Cash',
        amount: '-$9.68',
        details: { Change: '$0.00' },
      },
    ]);
  });
});

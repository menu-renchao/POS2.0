import { expect, test } from '../../support/endpoint-fixture';
import { expectApiOk } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

const ORDER_SAVE_IDENTITY = { method: 'POST', path: '/api/order/save' } as const;
const PAYMENT_SAVE_IDENTITY = { method: 'POST', path: '/api/payment/record/save' } as const;
const PAYMENT_DELETE_IDENTITY = { method: 'POST', path: '/api/payment/record/delete' } as const;

test.describe('订单支付 endpoint', () => {
  test(
    toEndpointTitle(PAYMENT_SAVE_IDENTITY.method, PAYMENT_SAVE_IDENTITY.path, '应能保存支付记录'),
    async ({ endpointResources }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于支付'),
        async () => await endpointResources.createOrderResource(),
      );
      const payment = await test.step(
        toEndpointTitle(PAYMENT_SAVE_IDENTITY.method, PAYMENT_SAVE_IDENTITY.path, '保存支付记录并登记清理'),
        async () => await endpointResources.createPaymentRecordResource(order.id),
      );

      expect(payment.id).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(PAYMENT_DELETE_IDENTITY.method, PAYMENT_DELETE_IDENTITY.path, '应能删除本次创建的支付记录'),
    async ({ endpointResources, paymentApi, resourceRegistry }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于支付删除'),
        async () => await endpointResources.createOrderResource(),
      );
      const payment = await test.step(
        toEndpointTitle(PAYMENT_SAVE_IDENTITY.method, PAYMENT_SAVE_IDENTITY.path, '先保存支付记录用于删除'),
        async () => await endpointResources.createPaymentRecordResource(order.id),
      );

      await test.step(
        toEndpointTitle(PAYMENT_DELETE_IDENTITY.method, PAYMENT_DELETE_IDENTITY.path, '删除支付记录并校验响应'),
        async () => {
          await expectApiOk(
            await paymentApi.deleteRecord({
              id: payment.id,
              paymentRecordId: payment.id,
              orderId: order.id,
              reason: 'API_AUTOMATION_ENDPOINT',
            }),
            PAYMENT_DELETE_IDENTITY,
          );
        },
      );

      expect(resourceRegistry.markCleaned('payment', payment.id)).toBe(true);
    },
  );
});
